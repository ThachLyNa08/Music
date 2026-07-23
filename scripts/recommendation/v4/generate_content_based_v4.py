import os
import json
import pandas as pd
import mysql.connector
from collections import Counter

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
    cursor.execute("SELECT id, artist_id, genre_id FROM songs")
    songs = cursor.fetchall()
    conn.close()
    return {s['id']: s for s in songs}

def main():
    print("Generating Content-Based (Metadata) Recommendations for V4...")
    base_dir = os.path.join(os.path.dirname(__file__), '../../../datasets/processed/recommendation/v4/all_users')
    eval_dir = os.path.join(os.path.dirname(__file__), '../../../storage/recommendation/evaluation/v4')
    os.makedirs(eval_dir, exist_ok=True)

    train_path = os.path.join(base_dir, 'train_v4_all.csv')
    if not os.path.exists(train_path):
        print(f"Error: {train_path} not found.")
        return

    df = pd.read_csv(train_path)
    df_pos = df[df['is_skip'] == 0]

    print("Fetching metadata from DB...")
    song_meta = fetch_song_metadata()

    print("Calculating popularities...")
    song_counts = Counter(df_pos['song_id'])

    # Pre-sort all songs by popularity
    all_songs_by_pop = [sid for sid, c in song_counts.most_common()]

    # We will score candidate songs for each user based on metadata overlap
    # To make it fast, we will only evaluate candidate songs that share genre or artist

    # Build indexes
    songs_by_genre = {}
    songs_by_artist = {}
    for sid, m in song_meta.items():
        gid = m.get('genre_id')
        aid = m.get('artist_id')
        if gid:
            songs_by_genre.setdefault(gid, []).append(sid)
        if aid:
            songs_by_artist.setdefault(aid, []).append(sid)

    print("Generating recommendations...")
    user_history = {}
    for uid, group in df.groupby('user_id'):
        user_history[uid] = set(group['song_id'])

    recs = {}
    for uid, group in df_pos.groupby('user_id'):
        history = user_history.get(uid, set())

        user_genres = [song_meta[sid]['genre_id'] for sid in group['song_id'] if sid in song_meta and song_meta[sid]['genre_id']]
        user_artists = [song_meta[sid]['artist_id'] for sid in group['song_id'] if sid in song_meta and song_meta[sid]['artist_id']]

        top_genres = [g for g, c in Counter(user_genres).most_common(3)]
        top_artists = [a for a, c in Counter(user_artists).most_common(3)]

        candidates = set()
        for g in top_genres:
            candidates.update(songs_by_genre.get(g, []))
        for a in top_artists:
            candidates.update(songs_by_artist.get(a, []))

        candidates.difference_update(history)

        # Score candidates
        candidate_scores = []
        for sid in candidates:
            m = song_meta.get(sid, {})
            score = 0
            if m.get('genre_id') in top_genres: score += 1
            if m.get('artist_id') in top_artists: score += 1

            pop_score = song_counts.get(sid, 0)
            candidate_scores.append((sid, score, pop_score))

        # Sort by match score DESC, then popularity DESC
        candidate_scores.sort(key=lambda x: (x[1], x[2]), reverse=True)

        user_recs = [{"song_id": int(sid), "score": float(score)} for sid, score, pop in candidate_scores[:20]]

        # Fallback if less than 20
        if len(user_recs) < 20:
            rec_sids = set(r['song_id'] for r in user_recs)
            for sid in all_songs_by_pop:
                if sid not in history and sid not in rec_sids:
                    user_recs.append({"song_id": int(sid), "score": 0.0})
                    if len(user_recs) >= 20:
                        break

        recs[str(uid)] = user_recs

    out_path = os.path.join(eval_dir, 'content_based_recs_v4.json')
    with open(out_path, 'w') as f:
        json.dump(recs, f, indent=4)

    print(f"Content-Based recommendations generated for {len(recs)} users at {out_path}")

if __name__ == "__main__":
    main()
