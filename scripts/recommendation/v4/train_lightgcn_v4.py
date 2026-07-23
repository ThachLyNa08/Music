import os
import json
import random
import time
from datetime import datetime
import pandas as pd
import numpy as np
from collections import defaultdict
from tqdm import tqdm

try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False

def load_data(file_path):
    df = pd.read_csv(file_path)
    df_pos = df[df['is_skip'] == 0]

    user_items = defaultdict(set)
    for u, i in zip(df_pos['user_id'], df_pos['song_id']):
        user_items[u].add(i)

    all_users = list(df['user_id'].unique())
    all_items = list(df['song_id'].unique())

    return user_items, all_users, all_items

if HAS_TORCH:
    class LightGCN(nn.Module):
        def __init__(self, n_users, n_items, embedding_dim=64, n_layers=3):
            super(LightGCN, self).__init__()
            self.n_users = n_users
            self.n_items = n_items
            self.embedding_dim = embedding_dim
            self.n_layers = n_layers

            self.embedding_user = nn.Embedding(num_embeddings=self.n_users, embedding_dim=self.embedding_dim)
            self.embedding_item = nn.Embedding(num_embeddings=self.n_items, embedding_dim=self.embedding_dim)

            nn.init.normal_(self.embedding_user.weight, std=0.1)
            nn.init.normal_(self.embedding_item.weight, std=0.1)

        def compute(self, adj):
            users_emb = self.embedding_user.weight
            items_emb = self.embedding_item.weight
            all_emb = torch.cat([users_emb, items_emb])

            embs = [all_emb]
            for layer in range(self.n_layers):
                all_emb = torch.sparse.mm(adj, all_emb)
                embs.append(all_emb)

            embs = torch.stack(embs, dim=1)
            light_out = torch.mean(embs, dim=1)

            users, items = torch.split(light_out, [self.n_users, self.n_items])
            return users, items

        def forward(self, adj, users, pos_items, neg_items):
            all_users, all_items = self.compute(adj)

            user_emb = all_users[users]
            pos_emb = all_items[pos_items]
            neg_emb = all_items[neg_items]

            pos_scores = torch.mul(user_emb, pos_emb).sum(dim=1)
            neg_scores = torch.mul(user_emb, neg_emb).sum(dim=1)

            # BPR Loss
            loss = -torch.mean(torch.nn.functional.logsigmoid(pos_scores - neg_scores))
            # Regularization
            reg_loss = (self.embedding_user(users).norm(2).pow(2) +
                        self.embedding_item(pos_items).norm(2).pow(2) +
                        self.embedding_item(neg_items).norm(2).pow(2)) / float(len(users))

            return loss, reg_loss

def create_adjacency_matrix(user_items, n_users, n_items):
    import scipy.sparse as sp

    R = sp.dok_matrix((n_users, n_items), dtype=np.float32)
    for u, items in user_items.items():
        for i in items:
            R[u, i] = 1.0

    R = R.tolil()
    adj_mat = sp.dok_matrix((n_users + n_items, n_users + n_items), dtype=np.float32)
    adj_mat = adj_mat.tolil()

    adj_mat[:n_users, n_users:] = R
    adj_mat[n_users:, :n_users] = R.T
    adj_mat = adj_mat.todok()

    # Normalize
    rowsum = np.array(adj_mat.sum(axis=1))
    with np.errstate(divide='ignore'):
        d_inv = np.power(rowsum, -0.5).flatten()
    d_inv[np.isinf(d_inv)] = 0.
    d_mat = sp.diags(d_inv)

    norm_adj = d_mat.dot(adj_mat).dot(d_mat)
    norm_adj = norm_adj.tocoo()

    if HAS_TORCH:
        indices = torch.LongTensor(np.vstack((norm_adj.row, norm_adj.col)))
        values = torch.FloatTensor(norm_adj.data)
        shape = torch.Size(norm_adj.shape)
        return torch.sparse_coo_tensor(indices, values, shape).float()
    return norm_adj

def main():
    base_dir = os.path.join(os.path.dirname(__file__), '../../../datasets/processed/recommendation/v4/all_users')
    train_file = os.path.join(base_dir, 'train_v4_all.csv')
    model_dir = os.path.join(os.path.dirname(__file__), '../../../storage/recommendation/models/v4')
    os.makedirs(model_dir, exist_ok=True)

    if not os.path.exists(train_file):
        print(f"Error: {train_file} not found.")
        return

    print("Loading data for LightGCN...")
    user_items, users, items = load_data(train_file)

    user_id2idx = {u: idx for idx, u in enumerate(users)}
    item_id2idx = {i: idx for idx, i in enumerate(items)}

    user_idx2id = {idx: u for u, idx in user_id2idx.items()}
    item_idx2id = {idx: i for i, idx in item_id2idx.items()}

    n_users = len(users)
    n_items = len(items)

    internal_user_items = {user_id2idx[u]: [item_id2idx[i] for i in items] for u, items in user_items.items()}

    if not HAS_TORCH:
        print("="*60)
        print("⚠️  PyTorch is not installed. Status: skipped_due_to_missing_dependency")
        print("⚠️  Generating bipartite graph data anyway for future training...")
        print("="*60)

        # Save graph for fallback
        graph_file = os.path.join(model_dir, 'lightgcn_graph_v4.json')
        with open(graph_file, 'w') as f:
            json.dump({
                'n_users': n_users,
                'n_items': n_items,
                'user_items': internal_user_items,
                'user_idx2id': user_idx2id,
                'item_idx2id': item_idx2id
            }, f)
        print(f"Graph data saved to {graph_file}")
        return

    print("Creating normalized adjacency matrix...")
    adj = create_adjacency_matrix(internal_user_items, n_users, n_items)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    adj = adj.to(device)

    model = LightGCN(n_users, n_items, embedding_dim=64, n_layers=3).to(device)
    optimizer = optim.Adam(model.parameters(), lr=0.01)

    # Prepare flat triplets
    train_triplets = []
    for u, pos_items in internal_user_items.items():
        for i in pos_items:
            train_triplets.append((u, i))

    batch_size = 2048
    epochs = 50

    print(f"Training LightGCN on {device}...")
    import time
    history = {'epoch': [], 'loss': [], 'duration_seconds': []}
    for epoch in range(epochs):
        epoch_start = time.time()
        random.shuffle(train_triplets)
        model.train()
        total_loss = 0

        for idx in tqdm(range(0, len(train_triplets), batch_size), desc=f"Epoch {epoch+1}/{epochs}"):
            batch = train_triplets[idx:idx+batch_size]
            users_b = torch.LongTensor([b[0] for b in batch]).to(device)
            pos_b = torch.LongTensor([b[1] for b in batch]).to(device)
            neg_b = torch.LongTensor([random.randint(0, n_items-1) for _ in batch]).to(device)

            optimizer.zero_grad()
            loss, reg_loss = model(adj, users_b, pos_b, neg_b)
            batch_loss = loss + 1e-4 * reg_loss
            batch_loss.backward()
            optimizer.step()
            total_loss += batch_loss.item()

        duration = time.time() - epoch_start
        print(f"Epoch {epoch+1} Loss: {total_loss:.4f} - {duration:.2f}s")
        history['epoch'].append(epoch + 1)
        history['loss'].append(float(total_loss))
        history['duration_seconds'].append(float(duration))

    print("Training finished. Saving model...")

    # Save history
    history_path = os.path.join(model_dir, 'training_history_lightgcn_v4.json')
    with open(history_path, 'w') as f:
        json.dump(history, f, indent=4)
    print(f"Training history saved to {history_path}")
    model.eval()
    with torch.no_grad():
        final_users, final_items = model.compute(adj)

    # Save as JSON similar to BPR for easy loading in hybrid rerank
    model_path = os.path.join(model_dir, 'lightgcn_v4.json')
    model_data = {
        'user_embeddings': {str(user_idx2id[k]): v.tolist() for k, v in enumerate(final_users.cpu().numpy())},
        'item_embeddings': {str(item_idx2id[k]): v.tolist() for k, v in enumerate(final_items.cpu().numpy())},
        'algorithm': 'LightGCN',
        'version': 'v4',
        'model_type': 'LightGCN',
        'trained_users': n_users,
        'trained_items': n_items,
        'embedding_dim': 64,
        'epochs': epochs,
        'trained_at': datetime.now().isoformat(),
        'train_interactions': len(train_triplets),
        'artifact_path': 'storage/recommendation/models/v4/lightgcn_v4.json'
    }
    with open(model_path, 'w') as f:
        json.dump(model_data, f)

    print(f"Model saved to {model_path}")

if __name__ == "__main__":
    main()
