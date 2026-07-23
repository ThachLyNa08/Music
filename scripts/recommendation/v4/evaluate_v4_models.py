import os
import json
import math
import numpy as np
import pandas as pd
import mysql.connector
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), '../../../apps/backend'))

def load_env(filepath):
    env_vars = {}
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'): continue
                if '=' in line:
                    k, v = line.split('=', 1)
                    env_vars[k.strip()] = v.strip().strip('"\'')
    return env_vars

def fetch_song_metadata():
    env = load_env(os.path.join(os.path.dirname(__file__), '../../../apps/backend/.env'))
    conn = mysql.connector.connect(
        host=env.get('DB_HOST', '127.0.0.1'),
        port=int(env.get('DB_PORT', 3306)),
        database=env.get('DB_NAME', 'musicflow'),
        user=env.get('DB_USER', 'root'),
        password=env.get('DB_PASSWORD', '')
    )
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id, artist_id, genre_id, play_count FROM songs")
    songs = cursor.fetchall()
    conn.close()
    return {str(s['id']): s for s in songs}

def ndcg_at_k(recommended_list, user_test_items, k):
    dcg = 0.0
    idcg = sum(1.0 / math.log2(i + 2) for i in range(min(k, len(user_test_items))))
    if idcg == 0: return 0.0

    for i, item in enumerate(recommended_list[:k]):
        if item in user_test_items:
            dcg += 1.0 / math.log2(i + 2)

    return dcg / idcg

def evaluate_recs(recs_path, test_data_path, song_meta):
    with open(recs_path, 'r') as f:
        all_recs = json.load(f)

    test_df = pd.read_csv(test_data_path)
    test_df_pos = test_df[test_df['is_skip'] == 0]

    user_test_items = {}
    for uid, group in test_df_pos.groupby('user_id'):
        user_test_items[str(uid)] = set(str(sid) for sid in group['song_id'])

    metrics = {
        'Precision@10': [],
        'Recall@10': [],
        'NDCG@10': [],
        'HitRate@10': [],
        'Coverage@20': set(),
        'ArtistDiversity@20': [],
        'GenreDiversity@20': [],
        'Novelty@20': []
    }

    max_play_count = max([s.get('play_count', 0) for s in song_meta.values()]) if song_meta else 1
    if max_play_count == 0: max_play_count = 1

    for uid, user_recs in all_recs.items():
        if uid not in user_test_items:
            continue

        test_items = user_test_items[uid]
        if not test_items:
            continue

        rec_song_ids = [str(r['song_id']) for r in user_recs]
        rec_10 = rec_song_ids[:10]
        rec_20 = rec_song_ids[:20]

        hits = set(rec_10).intersection(test_items)

        metrics['Precision@10'].append(len(hits) / 10)
        metrics['Recall@10'].append(len(hits) / len(test_items))
        metrics['HitRate@10'].append(1 if hits else 0)
        metrics['NDCG@10'].append(ndcg_at_k(rec_10, test_items, 10))

        for iid in rec_20:
            metrics['Coverage@20'].add(iid)

        artists = set(song_meta.get(iid, {}).get('artist_id') for iid in rec_20)
        genres = set(song_meta.get(iid, {}).get('genre_id') for iid in rec_20)

        metrics['ArtistDiversity@20'].append(len(artists) / 20)
        metrics['GenreDiversity@20'].append(len(genres) / 20)

        novelty_sum = sum([1.0 - (song_meta.get(iid, {}).get('play_count', 0) / max_play_count) for iid in rec_20])
        metrics['Novelty@20'].append(novelty_sum / len(rec_20) if rec_20 else 0)

    avg_metrics = {
        'Precision@10': np.mean(metrics['Precision@10']) if metrics['Precision@10'] else 0,
        'Recall@10': np.mean(metrics['Recall@10']) if metrics['Recall@10'] else 0,
        'NDCG@10': np.mean(metrics['NDCG@10']) if metrics['NDCG@10'] else 0,
        'HitRate@10': np.mean(metrics['HitRate@10']) if metrics['HitRate@10'] else 0,
        'Coverage@20': len(metrics['Coverage@20']) / len(song_meta) if song_meta else 0,
        'ArtistDiversity@20': np.mean(metrics['ArtistDiversity@20']) if metrics['ArtistDiversity@20'] else 0,
        'GenreDiversity@20': np.mean(metrics['GenreDiversity@20']) if metrics['GenreDiversity@20'] else 0,
        'Novelty@20': np.mean(metrics['Novelty@20']) if metrics['Novelty@20'] else 0,
    }

    return avg_metrics

def main():
    eval_dir = os.path.join(os.path.dirname(__file__), '../../../storage/recommendation/evaluation/v4')
    base_dir = os.path.join(os.path.dirname(__file__), '../../../datasets/processed/recommendation/v4/all_users')
    test_data = os.path.join(base_dir, 'test_v4_all.csv')

    bpr_recs = os.path.join(eval_dir, 'bpr_hybrid_recs_v4.json')
    lgcn_recs = os.path.join(eval_dir, 'lightgcn_hybrid_recs_v4.json')
    pop_recs = os.path.join(eval_dir, 'most_popular_recs_v4.json')
    cb_recs = os.path.join(eval_dir, 'content_based_recs_v4.json')

    song_meta = fetch_song_metadata()

    results = {}

    if os.path.exists(pop_recs):
        print("Evaluating Most Popular...")
        results['Most Popular'] = evaluate_recs(pop_recs, test_data, song_meta)

    if os.path.exists(cb_recs):
        print("Evaluating Content-Based...")
        results['Content-Based'] = evaluate_recs(cb_recs, test_data, song_meta)

    if os.path.exists(bpr_recs):
        print("Evaluating BPR-MF Hybrid...")
        results['BPR-MF Hybrid'] = evaluate_recs(bpr_recs, test_data, song_meta)

    if os.path.exists(lgcn_recs):
        print("Evaluating LightGCN Hybrid...")
        results['LightGCN Hybrid'] = evaluate_recs(lgcn_recs, test_data, song_meta)

    output_path = os.path.join(eval_dir, 'metrics_v4.json')
    with open(output_path, 'w') as f:
        json.dump(results, f, indent=4)

    # Generate metrics_comparison_v4.csv
    import csv
    csv_path = os.path.join(eval_dir, 'metrics_comparison_v4.csv')
    csv_columns = ['model', 'Precision@10', 'Recall@10', 'NDCG@10', 'HitRate@10', 'Coverage@20', 'ArtistDiversity@20', 'GenreDiversity@20', 'Novelty@20']
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=csv_columns)
        writer.writeheader()
        for model, m in results.items():
            row = {'model': model}
            for col in csv_columns[1:]:
                row[col] = m.get(col, 0)
            writer.writerow(row)

    # Determine best model
    if results:
        best_model_name = None
        best_model_score = (-1, -1, -1, -1, -1)
        for model, m in results.items():
            score = (
                m.get('NDCG@10', 0),
                m.get('HitRate@10', 0),
                m.get('Precision@10', 0),
                m.get('Coverage@20', 0),
                m.get('Novelty@20', 0)
            )
            if score > best_model_score:
                best_model_score = score
                best_model_name = model

        best_model_path = os.path.join(os.path.dirname(__file__), '../../../storage/recommendation/models/v4/best_model_v4.json')
        with open(best_model_path, 'w') as f:
            json.dump({'best_model': best_model_name, 'metrics': results[best_model_name]}, f, indent=4)

    print(f"Metrics saved to {output_path}")
    for model, m in results.items():
        print(f"\n[{model}]")
        for k, v in m.items():
            print(f"  {k}: {v:.4f}")

if __name__ == "__main__":
    main()
