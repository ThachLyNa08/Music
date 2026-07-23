import os
import sys
import csv
import json
import datetime
import mysql.connector
import argparse
from tqdm import tqdm
import bcrypt

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

BACKEND_ENV = os.path.join(os.path.dirname(__file__), '../../../apps/backend/.env')
env = load_env(BACKEND_ENV)

DB_HOST = env.get('DB_HOST', '127.0.0.1')
DB_PORT = int(env.get('DB_PORT', 3306))
DB_NAME = env.get('DB_NAME', 'musicflow')
DB_USER = env.get('DB_USER', 'root')
DB_PASSWORD = env.get('DB_PASSWORD', '')

def get_table_info(cursor, table_name):
    query = """
    SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
    """
    cursor.execute(query, (DB_NAME, table_name))
    cols = {}
    for row in cursor.fetchall():
        cols[row[0]] = {
            'is_nullable': row[1],
            'default': row[2],
            'extra': row[3]
        }
    return cols

def main():
    parser = argparse.ArgumentParser(description="Import V4 Data into DB safely")
    parser.add_argument("--confirm", action="store_true", help="Confirm insertion into real database")
    parser.add_argument("--dry-run", action="store_true", help="Perform a dry run to see what will happen")
    args = parser.parse_args()

    if not args.confirm and not args.dry_run:
        print("Please run with --dry-run to preview, or --confirm to actually import.")
        return

    start_time = datetime.datetime.now()

    base_dir = os.path.join(os.path.dirname(__file__), '../../../datasets/processed/recommendation/v4')
    users_csv = os.path.join(base_dir, 'users_v4.csv')
    interactions_csv = os.path.join(base_dir, 'interactions_v4.csv')

    if not os.path.exists(users_csv) or not os.path.exists(interactions_csv):
        print("CSV files not found. Run generate_v4_experimental_data.py first.")
        return

    print("Connecting to DB...")
    conn = mysql.connector.connect(
        host=DB_HOST, port=DB_PORT, database=DB_NAME,
        user=DB_USER, password=DB_PASSWORD
    )
    cursor = conn.cursor()

    # 1. Schema Discovery
    user_info = get_table_info(cursor, 'users')
    lh_info = get_table_info(cursor, 'listening_history')

    user_cols = set(user_info.keys())
    lh_cols = set(lh_info.keys())

    # Detect required user columns
    required_user_cols = []
    for col, info in user_info.items():
        if info['is_nullable'] == 'NO' and info['default'] is None and 'auto_increment' not in info['extra'].lower():
            required_user_cols.append(col)

    # Auto-map safe values
    dummy_password = bcrypt.hashpw(b'MusicFlowExperiment2026!', bcrypt.gensalt()).decode('utf-8')
    now_str = start_time.strftime('%Y-%m-%d %H:%M:%S')

    u_map = {'email': 'email'}

    # Map required & common columns
    unknown_required = []
    for col in user_cols:
        if col in ['id', 'email']:
            continue

        mapped = False
        if col == 'password_hash': u_map[col] = dummy_password; mapped = True
        elif col == 'role': u_map[col] = 'user'; mapped = True
        elif col == 'status': u_map[col] = 'active'; mapped = True
        elif col in ['provider', 'auth_provider']: u_map[col] = 'local'; mapped = True
        elif col in ['created_at', 'updated_at']: u_map[col] = now_str; mapped = True
        elif col in ['email_verified', 'is_verified']: u_map[col] = 0; mapped = True
        elif col == 'is_experiment': u_map[col] = 1; mapped = True
        elif col == 'username': u_map[col] = 'v4_exp_user_{id}'; mapped = True
        elif col in ['name', 'display_name']: u_map[col] = 'V4 Experimental User {id}'; mapped = True

        if col in required_user_cols and not mapped:
            unknown_required.append(col)

    if unknown_required:
        print(f"\n❌ Error: Unknown required users columns: {unknown_required}")
        print("Please update the script to map these columns securely.")
        cursor.close()
        conn.close()
        return

    # LH Mapping
    lh_map = {'user_id': 'db_user_id', 'song_id': 'song_id'}
    if 'listen_duration' in lh_cols: lh_map['listen_duration'] = 'listen_duration'
    elif 'listened_duration' in lh_cols: lh_map['listened_duration'] = 'listen_duration'

    if 'completion_rate' in lh_cols: lh_map['completion_rate'] = 'completion_rate'

    if 'is_skip' in lh_cols: lh_map['is_skip'] = 'is_skip'
    elif 'skipped' in lh_cols: lh_map['skipped'] = 'is_skip'

    if 'created_at' in lh_cols: lh_map['created_at'] = 'created_at'
    elif 'played_at' in lh_cols: lh_map['played_at'] = 'created_at'

    if 'source' in lh_cols: lh_map['source'] = 'v4_experimental'

    if 'is_like' in lh_cols: lh_map['is_like'] = 'is_like'
    if 'is_playlist_add' in lh_cols: lh_map['is_playlist_add'] = 'is_playlist_add'

    # Load CSVs
    with open(users_csv, 'r', encoding='utf-8') as f:
        csv_users = list(csv.DictReader(f))
    with open(interactions_csv, 'r', encoding='utf-8') as f:
        csv_interactions = list(csv.DictReader(f))

    csv_user_emails = [u['email'] for u in csv_users]

    # Pre-checks
    cursor.execute("SELECT email FROM users WHERE email LIKE 'exp_v4_%@musicflow.test'")
    existing_emails = set(row[0] for row in cursor.fetchall())
    duplicate_emails_count = len(existing_emails)

    csv_song_ids = set(int(row['song_id']) for row in csv_interactions)
    cursor.execute("SELECT id FROM songs")
    db_song_ids = set(row[0] for row in cursor.fetchall())
    missing_songs = csv_song_ids - db_song_ids
    missing_songs_count = len(missing_songs)

    users_to_insert = [u for u in csv_users if u['email'] not in existing_emails]

    # Dry Run Reporting
    print("\n--- Dry Run Checks ---")
    print(f"Required users columns detected: {required_user_cols}")
    print("\nDefault values / Mappings used for users:")
    for c, v in u_map.items():
        req_tag = "(REQUIRED)" if c in required_user_cols else ""
        print(f"  - {c} = {v} {req_tag}")

    print("\nFinal INSERT columns for users:")
    print(f"  [{', '.join(u_map.keys())}]")

    print("\nFinal INSERT columns for listening_history:")
    print(f"  [{', '.join(lh_map.keys())}]")

    print(f"\nUsers to import: {len(users_to_insert)} (Total CSV: {len(csv_users)})")
    print(f"Interactions to import: {len(csv_interactions)} (Skipping missing songs if any)")
    print(f"Duplicate/Existing emails found in DB: {duplicate_emails_count}")
    print(f"Missing song_ids in DB: {missing_songs_count}")

    if duplicate_emails_count > 0:
        print("\n⚠️ WARNING: Found existing V4 users in database.")
        print("These duplicates will be skipped. Only new users will be inserted.")

    if args.dry_run:
        print("\nDry run completed cleanly. Run with --confirm to actually import.")
        cursor.close()
        conn.close()
        return

    # --- Actual Import ---
    print("\n--- Starting Import ---")

    if users_to_insert:
        print(f"Inserting {len(users_to_insert)} users...")
        db_cols = list(u_map.keys())
        placeholders = ', '.join(['%s'] * len(db_cols))
        insert_user_query = f"INSERT INTO users ({', '.join(db_cols)}) VALUES ({placeholders})"

        insert_data = []
        for u in users_to_insert:
            row = []
            for col in db_cols:
                val_pattern = u_map[col]
                if isinstance(val_pattern, str) and '{id}' in val_pattern:
                    row.append(val_pattern.format(id=u['id']))
                elif val_pattern == 'email': row.append(u['email'])
                else: row.append(val_pattern)
            insert_data.append(tuple(row))

        cursor.executemany(insert_user_query, insert_data)
        conn.commit()
    else:
        print("No new users to insert.")

    # Build mapping csv_user_id -> db_user_id
    print("Building ID mapping...")
    format_strings = ','.join(['%s'] * len(csv_user_emails))
    cursor.execute(f"SELECT id, email FROM users WHERE email IN ({format_strings})", tuple(csv_user_emails))
    email_to_db_id = {row[1]: row[0] for row in cursor.fetchall()}
    csv_id_to_db_id = {u['id']: email_to_db_id.get(u['email']) for u in csv_users}

    # Filter interactions
    valid_interactions = []
    for row in csv_interactions:
        if int(row['song_id']) in missing_songs: continue
        db_uid = csv_id_to_db_id.get(row['user_id'])
        if not db_uid: continue
        row['db_user_id'] = db_uid
        valid_interactions.append(row)

    if valid_interactions:
        print(f"Inserting {len(valid_interactions)} interactions...")
        lh_db_cols = list(lh_map.keys())
        lh_placeholders = ', '.join(['%s'] * len(lh_db_cols))
        insert_lh_query = f"INSERT INTO listening_history ({', '.join(lh_db_cols)}) VALUES ({lh_placeholders})"

        batch_size = 5000
        for i in tqdm(range(0, len(valid_interactions), batch_size)):
            batch = valid_interactions[i:i+batch_size]
            data = []
            for b in batch:
                r = []
                for col in lh_db_cols:
                    val = b.get(lh_map[col], lh_map[col])
                    if col in ['is_skip', 'skipped', 'is_like', 'is_playlist_add']: r.append(int(val) if val else 0)
                    elif col in ['completion_rate']: r.append(float(val) if val else 0.0)
                    elif col in ['listen_duration', 'listened_duration']: r.append(int(val) if val else 0)
                    else: r.append(val)
                data.append(tuple(r))
            cursor.executemany(insert_lh_query, data)
            conn.commit()

    cursor.close()
    conn.close()

    end_time = datetime.datetime.now()

    log_dir = os.path.join(os.path.dirname(__file__), '../../../storage/recommendation/evaluation/v4')
    log_path = os.path.join(log_dir, 'import_v4_to_db_log.json')

    log_data = {
        'imported_users': len(users_to_insert),
        'imported_interactions': len(valid_interactions),
        'skipped_duplicates': duplicate_emails_count,
        'missing_songs': missing_songs_count,
        'started_at': start_time.isoformat(),
        'finished_at': end_time.isoformat(),
        'status': 'success',
        'mapping_strategy': {
            'users': u_map,
            'listening_history': lh_map
        }
    }

    with open(log_path, 'w') as f:
        json.dump(log_data, f, indent=4)

    print(f"\nImport completed! Log saved to {log_path}")

if __name__ == "__main__":
    main()
