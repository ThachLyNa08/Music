import os
import json
import pandas as pd
from collections import Counter

def main():
    print("Generating Most Popular Recommendations for V4...")
    base_dir = os.path.join(os.path.dirname(__file__), '../../../datasets/processed/recommendation/v4/all_users')
    eval_dir = os.path.join(os.path.dirname(__file__), '../../../storage/recommendation/evaluation/v4')
    os.makedirs(eval_dir, exist_ok=True)

    train_path = os.path.join(base_dir, 'train_v4_all.csv')
    if not os.path.exists(train_path):
        print(f"Error: {train_path} not found.")
        return

    df = pd.read_csv(train_path)
    # We only count positive interactions for popularity (e.g. not skipped)
    # Or just count all interactions in train.
    # Let's count all non-skip interactions as popularity
    df_pos = df[df['is_skip'] == 0]

    song_counts = Counter(df_pos['song_id'])
    popular_songs = [song_id for song_id, count in song_counts.most_common()]

    user_history = {}
    for uid, group in df.groupby('user_id'):
        user_history[str(uid)] = set(group['song_id'])

    recs = {}
    for uid, history in user_history.items():
        user_recs = []
        for sid in popular_songs:
            if sid not in history:
                user_recs.append({"song_id": int(sid), "score": float(song_counts[sid])})
                if len(user_recs) >= 20:
                    break
        recs[uid] = user_recs

    out_path = os.path.join(eval_dir, 'most_popular_recs_v4.json')
    with open(out_path, 'w') as f:
        json.dump(recs, f, indent=4)

    print(f"Most Popular recommendations generated for {len(recs)} users at {out_path}")

if __name__ == "__main__":
    main()
