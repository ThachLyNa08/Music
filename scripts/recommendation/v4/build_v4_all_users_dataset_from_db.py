import os
import sys
import csv
import json
import mysql.connector
import datetime
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

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '../../../datasets/processed/recommendation/v4/all_users')
os.makedirs(OUTPUT_DIR, exist_ok=True)

EVAL_DIR = os.path.join(os.path.dirname(__file__), '../../../storage/recommendation/evaluation/v4')
os.makedirs(EVAL_DIR, exist_ok=True)

def main():
    try:
        conn = mysql.connector.connect(host=DB_HOST, port=DB_PORT, database=DB_NAME, user=DB_USER, password=DB_PASSWORD)
    except Exception as e:
        print(f"Failed to connect to DB: {e}")
        return

    cursor = conn.cursor(dictionary=True)

    # Fetch active listener users
    print("Fetching active listener users...")
    cursor.execute("SELECT id, display_name as username, created_at FROM users WHERE role = 'user' AND status = 'active'")
    users = cursor.fetchall()

    if not users:
        print("No active listener users found.")
        conn.close()
        return

    user_ids = [str(u['id']) for u in users]
    print(f"Found {len(user_ids)} active listener users.")

    # Write users CSV
    users_csv_path = os.path.join(OUTPUT_DIR, 'users_v4_all.csv')
    with open(users_csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['user_id', 'username', 'created_at'])
        for u in users:
            writer.writerow([u['id'], u['username'], u['created_at']])

    print(f"Users saved to {users_csv_path}")

    # Fetch interactions for these users
    print("Fetching interactions...")
    # Using parameterized queries for IN clause with chunks to avoid query too large
    chunk_size = 500
    all_interactions = []
    min_date = None
    max_date = None

    for i in tqdm(range(0, len(user_ids), chunk_size)):
        chunk = user_ids[i:i + chunk_size]
        placeholders = ', '.join(['%s'] * len(chunk))
        query = f"""
            SELECT user_id, song_id, listen_duration, completion_rate, is_skipped as is_skip, listened_at as created_at
            FROM listening_history
            WHERE user_id IN ({placeholders})
        """
        cursor.execute(query, chunk)
        rows = cursor.fetchall()
        for r in rows:
            all_interactions.append(r)
            dt = r['created_at']
            if min_date is None or dt < min_date: min_date = dt
            if max_date is None or dt > max_date: max_date = dt

    print(f"Found {len(all_interactions)} interactions.")

    # Write interactions CSV
    interactions_csv_path = os.path.join(OUTPUT_DIR, 'interactions_v4_all.csv')
    with open(interactions_csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['user_id', 'song_id', 'listen_duration', 'completion_rate', 'is_skip', 'created_at'])
        for r in all_interactions:
            writer.writerow([
                r['user_id'], r['song_id'], r['listen_duration'],
                r['completion_rate'], r['is_skip'], r['created_at']
            ])

    print(f"Interactions saved to {interactions_csv_path}")

    # Write metadata
    metadata = {
        "totalUsers": len(users),
        "totalInteractions": len(all_interactions),
        "minDate": min_date.isoformat() if min_date else None,
        "maxDate": max_date.isoformat() if max_date else None,
        "source": "database_all_active_listener_users",
        "idType": "db_user_id"
    }

    summary_path = os.path.join(EVAL_DIR, 'all_users_dataset_summary.json')
    with open(summary_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=4)

    print(f"Metadata saved to {summary_path}")

    cursor.close()
    conn.close()

if __name__ == "__main__":
    main()
