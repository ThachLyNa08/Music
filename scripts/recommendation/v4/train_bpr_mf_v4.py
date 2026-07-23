import os
import json
import random
import time
from datetime import datetime
import pandas as pd
import numpy as np
from collections import defaultdict
from tqdm import tqdm

def load_data(file_path):
    print(f"Loading data from {file_path}")
    df = pd.read_csv(file_path)

    # Implicit feedback: listen_duration > 0 means interaction. We can filter by completion rate if needed.
    # We will treat all interactions in train set as positive items, but maybe filter out skips?
    # Usually BPR uses implicit feedback. Let's use is_skip == 0 as positive feedback.
    df_pos = df[df['is_skip'] == 0]

    user_items = defaultdict(set)
    for u, i in zip(df_pos['user_id'], df_pos['song_id']):
        user_items[u].add(i)

    all_items = set(df['song_id'].unique())
    all_users = set(df['user_id'].unique())

    return user_items, list(all_users), list(all_items)

class BPRMF_Numpy:
    def __init__(self, n_users, n_items, factors=32, lr=0.01, reg=0.01):
        self.factors = factors
        self.lr = lr
        self.reg = reg

        # Initialize embeddings with small random values
        self.user_emb = np.random.normal(0, 0.1, (n_users, factors))
        self.item_emb = np.random.normal(0, 0.1, (n_items, factors))

    def predict(self, u, i):
        return np.dot(self.user_emb[u], self.item_emb[i])

    def update(self, u, i, j):
        # Forward
        score_i = self.predict(u, i)
        score_j = self.predict(u, j)
        xuij = score_i - score_j

        # Sigmoid gradient
        exp_xuij = np.exp(-xuij)
        grad = exp_xuij / (1.0 + exp_xuij)

        # Backward
        u_emb = self.user_emb[u].copy()
        i_emb = self.item_emb[i].copy()
        j_emb = self.item_emb[j].copy()

        self.user_emb[u] += self.lr * (grad * (i_emb - j_emb) - self.reg * u_emb)
        self.item_emb[i] += self.lr * (grad * u_emb - self.reg * i_emb)
        self.item_emb[j] += self.lr * (grad * (-u_emb) - self.reg * j_emb)

        return np.log(1.0 + exp_xuij)

def main():
    base_dir = os.path.join(os.path.dirname(__file__), '../../../datasets/processed/recommendation/v4/all_users')
    train_file = os.path.join(base_dir, 'train_v4_all.csv')
    model_dir = os.path.join(os.path.dirname(__file__), '../../../storage/recommendation/models/v4')
    os.makedirs(model_dir, exist_ok=True)

    if not os.path.exists(train_file):
        print(f"Error: {train_file} not found.")
        return

    user_items, users, items = load_data(train_file)

    # Map raw IDs to internal indices
    user_id2idx = {u: idx for idx, u in enumerate(users)}
    item_id2idx = {i: idx for idx, i in enumerate(items)}

    user_idx2id = {idx: u for u, idx in user_id2idx.items()}
    item_idx2id = {idx: i for i, idx in item_id2idx.items()}

    n_users = len(users)
    n_items = len(items)

    print(f"Training BPR-MF on {n_users} users and {n_items} items.")

    # Prepare training triplets
    train_triplets = []
    print("Preparing positive pairs...")
    for u, pos_items in tqdm(user_items.items()):
        u_idx = user_id2idx[u]
        for i in pos_items:
            train_triplets.append((u_idx, item_id2idx[i]))

    model = BPRMF_Numpy(n_users, n_items, factors=32, lr=0.02, reg=0.01)
    epochs = 50

    print("Starting SGD...")
    start_time = time.time()
    history = {'epoch': [], 'loss': [], 'duration_seconds': []}
    for epoch in range(epochs):
        epoch_start = time.time()
        random.shuffle(train_triplets)

        total_loss = 0
        for u_idx, i_idx in train_triplets:
            # Sample negative item
            j_idx = random.randint(0, n_items - 1)
            # Fast check is omitted for speed, but generally j_idx is not in user_items
            loss = model.update(u_idx, i_idx, j_idx)
            total_loss += loss

        duration = time.time() - epoch_start
        print(f"Epoch {epoch+1}/{epochs} completed. Loss: {total_loss:.4f} - {duration:.2f}s")
        history['epoch'].append(epoch + 1)
        history['loss'].append(float(total_loss))
        history['duration_seconds'].append(float(duration))

    print(f"Training finished in {time.time() - start_time:.2f}s.")

    # Save history
    history_path = os.path.join(model_dir, 'training_history_bpr_mf_v4.json')
    with open(history_path, 'w') as f:
        json.dump(history, f, indent=4)
    print(f"Training history saved to {history_path}")

    # Save model
    model_path = os.path.join(model_dir, 'bpr_mf_v4.json')
    model_data = {
        'user_embeddings': {str(user_idx2id[k]): v.tolist() for k, v in enumerate(model.user_emb)},
        'item_embeddings': {str(item_idx2id[k]): v.tolist() for k, v in enumerate(model.item_emb)},
        'factors': model.factors,
        'algorithm': 'BPR-MF',
        'version': 'v4',
        'model_type': 'BPR-MF',
        'trained_users': n_users,
        'trained_items': n_items,
        'epochs': epochs,
        'trained_at': datetime.now().isoformat(),
        'train_interactions': len(train_triplets),
        'artifact_path': 'storage/recommendation/models/v4/bpr_mf_v4.json'
    }

    with open(model_path, 'w') as f:
        json.dump(model_data, f)

    print(f"Model saved to {model_path}")

if __name__ == "__main__":
    main()
