import os
import json
import math
import random
import pandas as pd
import numpy as np
from tqdm import tqdm
import mysql.connector
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), '../../../apps/backend'))

def load_env(filepath):
    env_vars = {}
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                if '=' in line:
                    key, val = line.split('=', 1)
                    env_vars[key.strip()] = val.strip().strip('"\'')
    return env_vars

BACKEND_ENV = os.path.join(os.path.dirname(__file__), '../../../apps/backend/.env')
env = load_env(BACKEND_ENV)

def fetch_song_metadata():
    conn = mysql.connector.connect(
        host=env.get('DB_HOST', '127.0.0.1'),
        port=int(env.get('DB_PORT', 3306)),
        database=env.get('DB_NAME', 'musicflow'),
        user=env.get('DB_USER', 'root'),
        password=env.get('DB_PASSWORD', '')
    )
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT s.id, s.artist_id, s.genre_id, s.market, s.play_count, g.name as genre_name
        FROM songs s
        LEFT JOIN genres g ON g.id = s.genre_id
    """)
    songs = cursor.fetchall()
    conn.close()

    meta = {}
    for s in songs:
        meta[str(s['id'])] = s
    return meta

def rerank_candidates(user_id, candidates, recent_history, song_meta):
    """
    candidates: list of dicts {'song_id': id, 'model_score': score}
    recent_history: list of song_ids recently played by user
    song_meta: metadata dict for all songs
    """
    # Normalize model scores
    max_score = max([c['model_score'] for c in candidates]) if candidates else 1
    min_score = min([c['model_score'] for c in candidates]) if candidates else 0
    if max_score == min_score: max_score = min_score + 1

    # Calculate novelty score (inverse popularity)
    max_play_count = max([song_meta.get(str(c['song_id']), {}).get('play_count', 0) for c in candidates]) if candidates else 1
    if max_play_count == 0: max_play_count = 1

    # Recent history profiles
    recent_artists = set(song_meta.get(str(sid), {}).get('artist_id') for sid in recent_history if sid)
    recent_genres = set(song_meta.get(str(sid), {}).get('genre_id') for sid in recent_history if sid)

    ranked = []

    # Track selection for diversity penalty
    selected_artists = {}
    selected_genres = {}

    # Initial scoring
    for c in candidates:
        sid = str(c['song_id'])
        meta = song_meta.get(sid, {})

        # 1. Normalized Model Score (0 to 1)
        norm_model = (c['model_score'] - min_score) / (max_score - min_score)

        # 2. Content Match / Recent Interest
        artist_id = meta.get('artist_id')
        genre_id = meta.get('genre_id')

        content_score = 0.0
        if artist_id in recent_artists: content_score += 0.5
        if genre_id in recent_genres: content_score += 0.5

        # 3. Novelty (0 to 1) - less play count -> higher novelty
        play_count = meta.get('play_count', 0)
        novelty_score = 1.0 - (play_count / max_play_count)

        # Hybrid formula base
        base_score = (norm_model * 0.6) + (content_score * 0.3) + (novelty_score * 0.1)

        c['hybrid_score'] = base_score
        c['artist_id'] = artist_id
        c['genre_id'] = genre_id
        c['genre_name'] = meta.get('genre_name', 'Unknown')

    # Sort by hybrid score descending
    candidates.sort(key=lambda x: x['hybrid_score'], reverse=True)

    final_top_20 = []

    # Re-ranking with diversity penalty
    for c in candidates:
        if len(final_top_20) >= 20:
            break

        artist_id = c['artist_id']
        genre_id = c['genre_id']

        # Penalties
        artist_count = selected_artists.get(artist_id, 0)
        genre_count = selected_genres.get(genre_id, 0)

        penalty = 0.0
        if artist_count >= 2: penalty += 0.2 * artist_count
        if genre_count >= 4: penalty += 0.1 * genre_count

        adjusted_score = c['hybrid_score'] - penalty

        if adjusted_score < 0 and len(final_top_20) < 10:
            # allow it if we are short on candidates
            pass

        # Determine Reason
        reason = "Gợi ý khám phá ít trùng nghệ sĩ"
        if artist_count > 0:
            reason = "Cùng vibe với các bài bạn nghe gần đây"
        elif genre_id in recent_genres:
            reason = f"Vì bạn thường nghe thể loại {c['genre_name']}"
        elif c['hybrid_score'] > 0.8:
            reason = "Bài hát mới trong nhóm gu yêu thích"

        c['reason'] = reason
        c['final_score'] = adjusted_score

        final_top_20.append(c)
        selected_artists[artist_id] = artist_count + 1
        selected_genres[genre_id] = genre_count + 1

    # Sort final list by adjusted score
    final_top_20.sort(key=lambda x: x['final_score'], reverse=True)
    return final_top_20

def generate_recommendations_for_all(model_path, data_path, output_path):
    print(f"Loading model {model_path}...")
    if not os.path.exists(model_path):
        print(f"Model {model_path} not found.")
        return

    with open(model_path, 'r') as f:
        model = json.load(f)

    user_embs = {str(k): np.array(v) for k, v in model['user_embeddings'].items()}
    item_embs = {str(k): np.array(v) for k, v in model['item_embeddings'].items()}

    print("Fetching song metadata...")
    song_meta = fetch_song_metadata()

    print(f"Loading history from {data_path}...")
    df = pd.read_csv(data_path)
    df = df.sort_values(by=['user_id', 'created_at'])

    recent_histories = {}
    for user_id, group in df.groupby('user_id'):
        recent_histories[str(user_id)] = group['song_id'].tail(10).tolist()

    recommendations = {}
    print("Generating Hybrid recommendations...")

    for uid, u_emb in tqdm(user_embs.items()):
        candidates = []
        history = recent_histories.get(uid, [])
        history_str = set(str(sid) for sid in history)

        for iid, i_emb in item_embs.items():
            if iid in history_str:
                continue # Skip recently played
            score = float(np.dot(u_emb, i_emb))
            candidates.append({'song_id': iid, 'model_score': score})

        if not candidates:
            continue

        top_candidates = sorted(candidates, key=lambda x: x['model_score'], reverse=True)[:100]
        final_recs = rerank_candidates(uid, top_candidates, history, song_meta)

        recommendations[uid] = final_recs

    with open(output_path, 'w') as f:
        json.dump(recommendations, f)
    print(f"Hybrid recommendations saved to {output_path}")

def main():
    model_dir = os.path.join(os.path.dirname(__file__), '../../../storage/recommendation/models/v4')
    base_dir = os.path.join(os.path.dirname(__file__), '../../../datasets/processed/recommendation/v4/all_users')
    eval_dir = os.path.join(os.path.dirname(__file__), '../../../storage/recommendation/evaluation/v4')
    os.makedirs(eval_dir, exist_ok=True)

    # Run for BPR
    bpr_model = os.path.join(model_dir, 'bpr_mf_v4.json')
    train_data = os.path.join(base_dir, 'train_v4_all.csv')
    bpr_output = os.path.join(eval_dir, 'bpr_hybrid_recs_v4.json')

    if os.path.exists(bpr_model):
        print("=== BPR-MF Hybrid Re-ranking ===")
        generate_recommendations_for_all(bpr_model, train_data, bpr_output)

    # Run for LightGCN
    lgcn_model = os.path.join(model_dir, 'lightgcn_v4.json')
    lgcn_output = os.path.join(eval_dir, 'lightgcn_hybrid_recs_v4.json')

    if os.path.exists(lgcn_model):
        print("\n=== LightGCN Hybrid Re-ranking ===")
        generate_recommendations_for_all(lgcn_model, train_data, lgcn_output)

if __name__ == "__main__":
    main()
