import os
import sys
import argparse
import time
import pandas as pd
import mysql.connector
from dotenv import load_dotenv

from pathlib import Path

AI_SERVICE_ROOT = Path(__file__).resolve().parents[2]

if str(AI_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(AI_SERVICE_ROOT))

from pipelines.semantic.rule_based_semantic_analyzer import analyze_rule_based
from pipelines.semantic.gemini_semantic_analyzer import analyze_gemini
from pipelines.semantic.embedding_builder import build_and_save_embeddings

# Load env from backend
load_dotenv(dotenv_path=os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../apps/backend/.env')))

def get_db_connection():
    try:
        conn = mysql.connector.connect(
            host=os.environ.get('DB_HOST', 'localhost'),
            port=int(os.environ.get('DB_PORT', 3306)),
            user=os.environ.get('DB_USER', 'root'),
            password=os.environ.get('DB_PASSWORD', ''),
            database=os.environ.get('DB_NAME', 'musicflow')
        )
        return conn
    except Exception as e:
        print(f"Failed to connect to database: {e}")
        return None

def fetch_songs(conn, limit=20, target_song_id=None, only_with_lyrics=False):
    cursor = conn.cursor(dictionary=True)
    
    query = """
    SELECT 
        s.id as song_id, s.title, a.name as artist_name, al.title as album_name, 
        s.language as market, g.name as genre_name, 
        s.lyrics, s.tempo as bpm,
        (s.play_count * 1) + 
        (COALESCE(lh.listen_count, 0) * 3) + 
        (COALESCE(sl.like_count, 0) * 5) AS score
    FROM songs s
    LEFT JOIN artists a ON s.artist_id = a.id
    LEFT JOIN albums al ON s.album_id = al.id
    LEFT JOIN genres g ON s.genre_id = g.id
    LEFT JOIN (SELECT song_id, COUNT(*) as listen_count FROM listening_history GROUP BY song_id) lh ON s.id = lh.song_id
    LEFT JOIN (SELECT song_id, COUNT(*) as like_count FROM song_likes GROUP BY song_id) sl ON s.id = sl.song_id
    WHERE 1=1
    """
    
    params = []
    if target_song_id:
        query += " AND s.id = %s"
        params.append(target_song_id)
        
    if only_with_lyrics:
        query += " AND s.lyrics IS NOT NULL"
        
    query += " ORDER BY score DESC LIMIT %s"
    params.append(limit)
    
    cursor.execute(query, tuple(params))
    return cursor.fetchall()

def main():
    parser = argparse.ArgumentParser(description="Generate Song Semantic Profiles")
    parser.add_argument('--limit', type=int, default=20)
    parser.add_argument('--song-id', type=int, default=None)
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--use-gemini', action='store_true')
    parser.add_argument('--input-csv', type=str, default=None)
    parser.add_argument('--output', type=str, default=None)
    parser.add_argument('--llm-delay', type=float, default=3.0)
    parser.add_argument('--llm-max-retries', type=int, default=3)
    parser.add_argument('--min-llm-success-rate', type=float, default=0.60)
    parser.add_argument('--retry-llm-failed', type=str, default=None)
    parser.add_argument('--max-lyrics-chars', type=int, default=4000)
    parser.add_argument('--only-with-lyrics', action='store_true')
    parser.add_argument('--market', type=str, default=None)
    parser.add_argument('--force', action='store_true')
    
    args = parser.parse_args()
    
    print("--- GENERATE SONG SEMANTIC PROFILES (PYTHON) ---")
    print(f"Mode: {'DRY-RUN' if args.dry_run else 'EXECUTE (Generating CSV)'}")
    print(f"Limit: {args.limit}")
    print(f"Use Gemini: {args.use_gemini}")
    if args.use_gemini:
        print(f"Using Gemini model: {os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash')}")
    
    if args.input_csv:
        print(f"Using input CSV: {args.input_csv}")
        # Not fully implemented in this MVP, focusing on DB read
        return
        
    retry_song_ids = None
    if args.retry_llm_failed:
        if os.path.exists(args.retry_llm_failed):
            retry_df = pd.read_csv(args.retry_llm_failed)
            if 'song_id' in retry_df.columns:
                retry_song_ids = set(retry_df['song_id'].tolist())
                print(f"Loaded {len(retry_song_ids)} songs to retry from {args.retry_llm_failed}")
            else:
                print(f"Warning: {args.retry_llm_failed} does not contain 'song_id' column.")
        else:
            print(f"Warning: Retry file {args.retry_llm_failed} not found. Ignoring.")

    conn = get_db_connection()
    if not conn:
        print("Continuing with dummy data for test? (Fallback not implemented for missing DB)")
        return
        
    songs = fetch_songs(conn, limit=args.limit, target_song_id=args.song_id, only_with_lyrics=args.only_with_lyrics)
    if retry_song_ids is not None:
        songs = [s for s in songs if s['song_id'] in retry_song_ids]
        
    print(f"Found {len(songs)} songs to process.")
    
    results = []
    
    for i, song in enumerate(songs):
        if args.use_gemini:
            profile = analyze_gemini(song, llm_delay=args.llm_delay, llm_max_retries=args.llm_max_retries)
            import time
            time.sleep(args.llm_delay)
        else:
            profile = analyze_rule_based(song)
            
        profile['song_id'] = song['song_id']
        profile['title'] = song['title']
        profile['artist'] = song['artist_name']
        
        results.append(profile)
        
        if args.dry_run and i < 5:
            # Print combined log for dry-run sample
            print(f"\nProcessing [{i+1}/{len(songs)}] ID: {song['song_id']} - {song['title']}")
            print(f"[SAMPLE] {song['title']}")
            print(f"- Source: {profile.get('source')}")
            print(f"- LLM Status: {profile.get('llm_status')}")
            print(f"- Theme: {profile.get('main_theme')}")
            print(f"- Moods: {', '.join(profile.get('mood_tags', []))}")
            print(f"- Situations: {', '.join(profile.get('situation_tags', []))}")
            summary = profile.get('summary_vi', '')
            # Shorten summary for console log only
            if len(summary) > 180:
                summary = summary[:177] + '...'
            print(f"- Summary: {summary}")
        else:
            # Only print processing line if not showing sample
            print(f"Processing [{i+1}/{len(songs)}] ID: {song['song_id']} - {song['title']}")

    print("\nGenerating export preview...")
    
    # Calculate LLM success rate
    if args.use_gemini and len(results) > 0:
        llm_success_count = sum(1 for r in results if r.get('llm_status') == 'success')
        llm_success_rate = llm_success_count / len(results)
        if llm_success_rate < args.min_llm_success_rate:
            print(f"\n[QUALITY WARNING] llm_success_rate={llm_success_rate:.2f} below required {args.min_llm_success_rate:.2f}. Do not use this file as final semantic dataset.\n")

    if args.output:
        output_path = args.output
        embeddings_output_dir = os.path.dirname(output_path)
    else:
        output_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../datasets/processed/semantic/previews/song_semantic_profiles_python_preview.csv'))
        embeddings_output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../datasets/processed/semantic/embeddings'))
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    df = pd.DataFrame(results)
    
    # Ensure specific order of columns
    cols = ['song_id', 'title', 'artist', 'summary_vi', 'main_theme', 'theme_changed', 'sub_themes', 'mood_tags', 'situation_tags', 'lyrical_keywords', 'emotion_intensity', 'meaning_confidence', 'semantic_text', 'source', 'generated_by', 'evidence_level', 'review_status', 'llm_status', 'llm_error_type', 'llm_error_message', 'needs_llm_retry']
    for c in cols:
        if c not in df.columns:
            df[c] = None
    
    # Convert lists to semicolon separated strings for CSV
    list_cols = ['sub_themes', 'mood_tags', 'situation_tags', 'lyrical_keywords']
    for c in list_cols:
        df[c] = df[c].apply(lambda x: ';'.join(x) if isinstance(x, list) else x)
        
    df = df[cols]
    df.to_csv(output_path, index=False, encoding='utf-8')
    print(f"\nExported {len(df)} profiles to {output_path}")
    
    # Export retry queue
    if args.use_gemini:
        retry_df = df[df['needs_llm_retry'] == True]
        if len(retry_df) > 0:
            retry_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../datasets/processed/semantic/reports/song_semantic_llm_retry_queue.csv'))
            os.makedirs(os.path.dirname(retry_path), exist_ok=True)
            retry_df[['song_id', 'title', 'artist', 'llm_error_type', 'llm_error_message']].to_csv(retry_path, index=False, encoding='utf-8')
            print(f"Exported {len(retry_df)} failed profiles to {retry_path}")
    
    # Create embeddings
    build_and_save_embeddings(results, embeddings_output_dir)
    
    conn.close()

if __name__ == "__main__":
    main()
