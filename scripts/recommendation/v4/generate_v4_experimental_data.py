import os
import sys
import random
import csv
import mysql.connector
import datetime
import argparse
from tqdm import tqdm

sys.path.append(os.path.join(os.path.dirname(__file__), '../../../apps/backend'))

def load_env(filepath):
    env_vars = {}
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'): continue
                if '=' in line:
                    key, val = line.split('=', 1)
                    env_vars[key.strip()] = val.strip().strip('"\'')
    return env_vars

BACKEND_ENV = os.path.join(os.path.dirname(__file__), '../../../apps/backend/.env')
env = load_env(BACKEND_ENV)

DB_HOST = env.get('DB_HOST', '127.0.0.1')
DB_PORT = int(env.get('DB_PORT', 3306))
DB_NAME = env.get('DB_NAME', 'musicflow')
DB_USER = env.get('DB_USER', 'root')
DB_PASSWORD = env.get('DB_PASSWORD', '')

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '../../../datasets/processed/recommendation/v4')
os.makedirs(OUTPUT_DIR, exist_ok=True)

USER_GROUPS = [
    {'name': 'VPOP_Main', 'main': ['VPOP'], 'secondary': ['KPOP', 'USUK']},
    {'name': 'KPOP_Main', 'main': ['KPOP'], 'secondary': ['VPOP', 'USUK']},
    {'name': 'USUK_Main', 'main': ['USUK'], 'secondary': ['VPOP', 'KPOP']},
    {'name': 'VPOP_KPOP', 'main': ['VPOP', 'KPOP'], 'secondary': ['USUK']},
    {'name': 'VPOP_USUK', 'main': ['VPOP', 'USUK'], 'secondary': ['KPOP']},
]

def fetch_songs(conn):
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
    SELECT s.id, s.title, s.artist_id, s.market, s.duration_sec,
           g.name as genre_name, g.slug as genre_slug, s.play_count
    FROM songs s LEFT JOIN genres g ON g.id = s.genre_id
    WHERE s.is_active = 1 AND s.audio_url IS NOT NULL AND s.audio_url <> ''
    """)
    songs = cursor.fetchall()

    categorized = {'VPOP': [], 'KPOP': [], 'USUK': []}
    for s in songs:
        market = (s['market'] or '').upper()
        if market not in categorized:
            genre = f"{s['genre_name']} {s['genre_slug']}".upper()
            if 'VPOP' in genre or 'V-POP' in genre: market = 'VPOP'
            elif 'KPOP' in genre or 'K-POP' in genre: market = 'KPOP'
            elif 'USUK' in genre or 'US-UK' in genre: market = 'USUK'
            else: market = 'USUK'

        if market in categorized:
            categorized[market].append(s)

    cursor.close()
    return songs, categorized

def get_random_song(categorized, group):
    r = random.random()
    if r < 0.70 and group['main']:
        pool = sum([categorized.get(m, []) for m in group['main']], [])
    elif r < 0.90 and group['secondary']:
        pool = sum([categorized.get(m, []) for m in group['secondary']], [])
    else:
        pool = sum(categorized.values(), [])

    if not pool: pool = sum(categorized.values(), [])
    return random.choice(pool) if pool else None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--users", type=int, default=2000, help="Number of users to generate")
    parser.add_argument("--interactions", type=int, default=600000, help="Total interactions to generate")
    parser.add_argument("--seed", type=int, default=None, help="Random seed for reproducibility")
    args = parser.parse_args()

    if args.seed is not None:
        random.seed(args.seed)
        print(f"Using random seed: {args.seed}")

    try:
        conn = mysql.connector.connect(host=DB_HOST, port=DB_PORT, database=DB_NAME, user=DB_USER, password=DB_PASSWORD)
        all_songs, categorized_songs = fetch_songs(conn)
        conn.close()
    except Exception as e:
        print(f"Failed to connect to DB: {e}")
        return

    if not all_songs:
        print("No songs found. Aborting.")
        return

    num_users = args.users
    total_interactions = args.interactions

    # Base configuration for standard 2000 users is roughly ~600,000 interactions.
    # We will compute a scaling factor per user to reach the exact target (approx).
    # Normal avg listens = 600,000 / 2000 = 300.
    target_avg = total_interactions / num_users if num_users > 0 else 0

    # Activity distribution
    dist = [
        ('light', 0.3, 50, 120),
        ('regular', 0.4, 150, 300),
        ('active', 0.2, 300, 600),
        ('heavy', 0.1, 700, 1200),
    ]

    # Calculate base expected average
    base_avg = (0.3 * 85) + (0.4 * 225) + (0.2 * 450) + (0.1 * 950)
    scale = target_avg / base_avg if base_avg > 0 else 1.0

    users = []
    user_records = []
    user_id_counter = 1000000

    for act_name, pct, min_l, max_l in dist:
        count = int(num_users * pct)
        for _ in range(count):
            user_id = user_id_counter
            user_id_counter += 1
            group = random.choice(USER_GROUPS)

            # Scaled listens
            target_listens = int(random.randint(min_l, max_l) * scale)
            if target_listens < 1: target_listens = 1

            users.append({
                'id': user_id,
                'email': f"exp_v4_{user_id}@musicflow.test",
                'group': group,
                'activity': act_name,
                'target_listens': target_listens
            })

            user_records.append({
                'id': user_id, 'email': f"exp_v4_{user_id}@musicflow.test",
                'is_experiment': 1, 'group_name': group['name'], 'activity_level': act_name
            })

    # Fix rounding missing users
    while len(users) < num_users:
        user_id = user_id_counter
        user_id_counter += 1
        group = random.choice(USER_GROUPS)
        target_listens = int(225 * scale)
        if target_listens < 1: target_listens = 1
        users.append({'id': user_id, 'email': f"exp_v4_{user_id}@musicflow.test", 'group': group, 'activity': 'regular', 'target_listens': target_listens})
        user_records.append({'id': user_id, 'email': f"exp_v4_{user_id}@musicflow.test", 'is_experiment': 1, 'group_name': group['name'], 'activity_level': 'regular'})

    users_csv = os.path.join(OUTPUT_DIR, 'users_v4.csv')
    with open(users_csv, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['id', 'email', 'is_experiment', 'group_name', 'activity_level'])
        writer.writeheader()
        writer.writerows(user_records)

    print(f"Generated {len(users)} users. Target avg interactions/user: {target_avg:.1f}")

    interactions = []
    end_time = datetime.datetime.now()
    start_time = end_time - datetime.timedelta(days=90)

    print("Generating interactions...")
    for u in tqdm(users):
        listens = u['target_listens']

        skip_rate = random.uniform(0.15, 0.30)
        like_rate = random.uniform(0.05, 0.15)
        playlist_add_rate = random.uniform(0.02, 0.08)
        replay_rate = random.uniform(0.05, 0.12)

        recent_songs = []
        timestamps = [start_time + datetime.timedelta(seconds=random.randint(0, 90*24*3600)) for _ in range(listens)]
        timestamps.sort()

        for i in range(listens):
            if recent_songs and random.random() < replay_rate:
                song = random.choice(recent_songs)
            else:
                song = get_random_song(categorized_songs, u['group'])

            if not song: continue

            recent_songs.append(song)
            if len(recent_songs) > 10: recent_songs.pop(0)

            is_skip = random.random() < skip_rate
            is_like = not is_skip and random.random() < like_rate
            is_playlist = not is_skip and random.random() < playlist_add_rate

            completion_rate = random.uniform(0.01, 0.30) if is_skip else random.uniform(0.70, 1.0)
            duration = song.get('duration_sec', 200) or 200

            interactions.append({
                'user_id': u['id'], 'song_id': song['id'], 'listen_duration': int(duration * completion_rate),
                'completion_rate': round(completion_rate, 4), 'is_skip': 1 if is_skip else 0,
                'is_like': 1 if is_like else 0, 'is_playlist_add': 1 if is_playlist else 0,
                'created_at': timestamps[i].strftime('%Y-%m-%d %H:%M:%S')
            })

    interactions_csv = os.path.join(OUTPUT_DIR, 'interactions_v4.csv')
    with open(interactions_csv, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'user_id', 'song_id', 'listen_duration', 'completion_rate',
            'is_skip', 'is_like', 'is_playlist_add', 'created_at'
        ])
        writer.writeheader()
        writer.writerows(interactions)

    print(f"Generated {len(interactions)} interactions. Saved to CSV.")

if __name__ == "__main__":
    main()
