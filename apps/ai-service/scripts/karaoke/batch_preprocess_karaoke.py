import argparse
import os
import random
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import mysql.connector
from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[4]
BACKEND_UPLOADS_ROOT = PROJECT_ROOT / "apps" / "backend" / "uploads"
PUBLIC_STEMS_PREFIX = "/uploads/stems"
DEFAULT_LIMIT = 50
GENRE_TARGETS = {
    "VPOP": 20,
    "KPOP": 15,
    "USUK": 15,
}
SYSTEM_PLAYLIST_HINTS = ("trending", "daily", "weekly")


def load_env():
    load_dotenv(PROJECT_ROOT / "apps" / "backend" / ".env")
    load_dotenv(PROJECT_ROOT / "apps" / "ai-service" / ".env")


def connect_db():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "3306")),
        database=os.getenv("DB_NAME", "musicflow"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
        charset="utf8mb4",
    )


def ensure_song_stems_table(conn):
    sql = """
    CREATE TABLE IF NOT EXISTS song_stems (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      song_id INT UNSIGNED NOT NULL,
      vocals_url VARCHAR(500) NULL,
      instrumental_url VARCHAR(500) NULL,
      status ENUM('pending', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'pending',
      error_message TEXT NULL,
      processed_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_song_stems_song
        FOREIGN KEY (song_id) REFERENCES songs(id)
        ON DELETE CASCADE,
      UNIQUE KEY unique_song_stem_active (song_id),
      INDEX idx_song_stems_status (status),
      INDEX idx_song_stems_processed_at (processed_at)
    )
    """
    cursor = conn.cursor()
    cursor.execute(sql)
    conn.commit()
    cursor.close()


def column_exists(conn, table, column):
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT 1
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = %s
          AND COLUMN_NAME = %s
        LIMIT 1
        """,
        (table, column),
    )
    exists = cursor.fetchone() is not None
    cursor.close()
    return exists


def uploads_path_from_url(audio_url):
    if not audio_url:
        return None

    value = str(audio_url).strip()
    if value.startswith("http://") or value.startswith("https://"):
        from urllib.parse import urlparse, unquote

        value = unquote(urlparse(value).path)

    if not value.startswith("/uploads/"):
        return None

    relative = value.replace("/uploads/", "", 1).replace("/", os.sep)
    resolved = (BACKEND_UPLOADS_ROOT / relative).resolve()
    try:
        resolved.relative_to(BACKEND_UPLOADS_ROOT.resolve())
    except ValueError:
        return None
    return resolved if resolved.is_file() else None


def normalize_market(row):
    market = str(row.get("market") or "").upper()
    genre = str(row.get("genre_name") or "").upper()
    title = str(row.get("title") or "").upper()
    combined = f"{market} {genre} {title}"
    if "VPOP" in combined or market == "VN":
        return "VPOP"
    if "KPOP" in combined or "K-POP" in combined or "KOREA" in combined:
        return "KPOP"
    if "USUK" in combined or "US-UK" in combined or "US UK" in combined or "POP" in genre:
        return "USUK"
    return "OTHER"


def get_candidate_rows(conn, limit, only_missing, song_id=None, retry_failed=False):
    has_market = column_exists(conn, "songs", "market")
    market_select = "s.market" if has_market else "NULL AS market"
    filters = []
    params = []

    if song_id is not None:
        filters.append("s.id = %s")
        params.append(song_id)

    if only_missing:
        filters.append("(ss.id IS NULL OR ss.status <> 'completed')")

    # Kept for compatibility with older commands. --only-missing already includes failed rows.
    if retry_failed:
        pass

    extra_filter = ""
    if filters:
        extra_filter = "AND " + " AND ".join(filters)

    sql = f"""
    SELECT
      s.id,
      s.title,
      s.audio_url,
      s.created_at,
      {market_select},
      g.name AS genre_name,
      COALESCE(s.play_count, 0) AS play_count,
      COALESCE(lh.listen_count, 0) AS listen_count,
      COALESCE(sl.like_count, 0) AS like_count,
      COALESCE(sp.system_playlist_score, 0) AS system_playlist_score,
      ss.status AS stem_status
    FROM songs s
    LEFT JOIN genres g ON g.id = s.genre_id
    LEFT JOIN song_stems ss ON ss.song_id = s.id
    LEFT JOIN (
      SELECT song_id, COUNT(*) AS listen_count
      FROM listening_history
      GROUP BY song_id
    ) lh ON lh.song_id = s.id
    LEFT JOIN (
      SELECT song_id, COUNT(*) AS like_count
      FROM song_likes
      GROUP BY song_id
    ) sl ON sl.song_id = s.id
    LEFT JOIN (
      SELECT ps.song_id, COUNT(*) AS system_playlist_score
      FROM playlist_songs ps
      JOIN playlists p ON p.id = ps.playlist_id
      WHERE p.type = 'system'
         OR p.is_system = TRUE
         OR LOWER(COALESCE(p.system_key, '')) REGEXP 'trending|daily|weekly'
         OR LOWER(p.name) REGEXP 'trending|daily|weekly'
      GROUP BY ps.song_id
    ) sp ON sp.song_id = s.id
    WHERE s.is_active = TRUE
      AND s.audio_url IS NOT NULL
      AND s.audio_url <> ''
      {extra_filter}
    """
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql, params)
    rows = cursor.fetchall()
    cursor.close()

    valid_rows = []
    for row in rows:
        audio_path = uploads_path_from_url(row["audio_url"])
        if not audio_path:
            continue
        row["audio_path"] = audio_path
        row["market_bucket"] = normalize_market(row)
        row["priority_score"] = (
            int(row.get("listen_count") or 0) * 4
            + int(row.get("play_count") or 0) * 3
            + int(row.get("like_count") or 0) * 6
            + int(row.get("system_playlist_score") or 0) * 30
        )
        valid_rows.append(row)

    random.shuffle(valid_rows)
    valid_rows.sort(
        key=lambda row: (
            row["priority_score"],
            created_at_score(row.get("created_at")),
        ),
        reverse=True,
    )
    if song_id is not None:
        return valid_rows[:1]
    return pick_balanced_rows(valid_rows, limit)


def created_at_score(value):
    if hasattr(value, "timestamp"):
        return value.timestamp()
    return 0


def pick_balanced_rows(rows, limit):
    selected = []
    selected_ids = set()

    for bucket, target in GENRE_TARGETS.items():
        bucket_rows = [row for row in rows if row["market_bucket"] == bucket]
        for row in bucket_rows[: min(target, limit - len(selected))]:
            selected.append(row)
            selected_ids.add(row["id"])
        if len(selected) >= limit:
            return selected[:limit]

    for row in rows:
        if row["id"] in selected_ids:
            continue
        selected.append(row)
        selected_ids.add(row["id"])
        if len(selected) >= limit:
            break

    return selected[:limit]


def public_urls(song_id):
    return {
        "vocals_url": f"{PUBLIC_STEMS_PREFIX}/{song_id}/vocals.mp3",
        "instrumental_url": f"{PUBLIC_STEMS_PREFIX}/{song_id}/instrumental.mp3",
    }


def update_song_stem(conn, song_id, status, vocals_url=None, instrumental_url=None, error_message=None):
    processed_at = "NOW()" if status == "completed" else "NULL"
    cursor = conn.cursor()
    cursor.execute(
        f"""
        INSERT INTO song_stems
          (song_id, status, vocals_url, instrumental_url, error_message, processed_at, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, {processed_at}, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          status = VALUES(status),
          vocals_url = COALESCE(VALUES(vocals_url), vocals_url),
          instrumental_url = COALESCE(VALUES(instrumental_url), instrumental_url),
          error_message = VALUES(error_message),
          processed_at = CASE WHEN VALUES(status) = 'completed' THEN NOW() ELSE processed_at END,
          updated_at = NOW()
        """,
        (song_id, status, vocals_url, instrumental_url, error_message),
    )
    conn.commit()
    cursor.close()


def find_demucs_outputs(work_dir):
    vocals_candidates = list(work_dir.glob("**/vocals.mp3"))
    instrumental_candidates = list(work_dir.glob("**/no_vocals.mp3"))
    vocals = vocals_candidates[0] if vocals_candidates else None
    instrumental = instrumental_candidates[0] if instrumental_candidates else None
    return vocals, instrumental


def run_demucs(input_path, output_dir, timeout=900):
    with tempfile.TemporaryDirectory(prefix="musicflow_batch_stem_") as tmp:
        work_dir = Path(tmp)
        input_ext = Path(input_path).suffix.lower()
        if input_ext not in {".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg"}:
            input_ext = ".mp3"
        safe_input = work_dir / f"input{input_ext}"
        shutil.copy2(str(input_path), str(safe_input))

        env = os.environ.copy()
        env["PYTHONUTF8"] = "1"
        env["PYTHONIOENCODING"] = "utf-8"

        command = [
            sys.executable,
            "-m",
            "demucs",
            "--two-stems=vocals",
            "-n",
            os.getenv("DEMUCS_MODEL", "htdemucs"),
            "--mp3",
            "--out",
            str(work_dir),
            str(safe_input),
        ]
        print("  command:", " ".join(str(part) for part in command))
        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=timeout,
                env=env,
            )
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError(f"Demucs timeout after {timeout} seconds") from exc

        if result.returncode != 0:
            detail = (result.stderr or result.stdout or "Demucs failed").strip()
            raise RuntimeError(detail[-2000:])

        vocals_src, instrumental_src = find_demucs_outputs(work_dir)
        if not vocals_src or not instrumental_src:
            raise RuntimeError("Demucs output files were not found")

        output_dir.mkdir(parents=True, exist_ok=True)
        shutil.move(str(vocals_src), str(output_dir / "vocals.mp3"))
        shutil.move(str(instrumental_src), str(output_dir / "instrumental.mp3"))


def process_song(conn, row, dry_run=False, timeout=900):
    song_id = int(row["id"])
    urls = public_urls(song_id)
    output_dir = BACKEND_UPLOADS_ROOT / "stems" / str(song_id)
    vocals_path = output_dir / "vocals.mp3"
    instrumental_path = output_dir / "instrumental.mp3"

    if vocals_path.is_file() and instrumental_path.is_file():
        update_song_stem(conn, song_id, "completed", urls["vocals_url"], urls["instrumental_url"], None)
        return "completed-existing"

    if dry_run:
        return "dry-run"

    update_song_stem(conn, song_id, "processing", None, None, None)
    try:
        run_demucs(row["audio_path"], output_dir, timeout=timeout)
        update_song_stem(conn, song_id, "completed", urls["vocals_url"], urls["instrumental_url"], None)
        return "completed"
    except Exception as exc:
        error_message = str(exc)[:1000]
        update_song_stem(conn, song_id, "failed", None, None, error_message)
        print("  -> failed")
        print(f"  error: {error_message}")
        return "failed"


def parse_args():
    parser = argparse.ArgumentParser(description="Preprocess Karaoke stems for the top demo songs.")
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT, help="Maximum songs to process. Default: 50.")
    parser.add_argument("--only-missing", action="store_true", help="Skip songs already completed in song_stems.")
    parser.add_argument("--retry-failed", action="store_true", help="Compatibility flag. Failed rows are already included by --only-missing.")
    parser.add_argument("--song-id", type=int, default=None, help="Process one song by id for testing.")
    parser.add_argument("--timeout", type=int, default=900, help="Demucs timeout per song in seconds. Default: 900.")
    parser.add_argument("--dry-run", action="store_true", help="Print selected songs without running Demucs.")
    return parser.parse_args()


def main():
    args = parse_args()
    limit = max(1, min(args.limit or DEFAULT_LIMIT, DEFAULT_LIMIT))
    timeout = max(1, int(args.timeout or 900))

    load_env()
    conn = connect_db()
    try:
        ensure_song_stems_table(conn)
        rows = get_candidate_rows(
            conn,
            limit,
            args.only_missing,
            song_id=args.song_id,
            retry_failed=args.retry_failed,
        )
        print(
            f"Selected {len(rows)} song(s), limit={limit}, only_missing={args.only_missing}, "
            f"retry_failed={args.retry_failed}, song_id={args.song_id}, timeout={timeout}"
        )

        summary = {"completed": 0, "completed-existing": 0, "failed": 0, "dry-run": 0}
        for index, row in enumerate(rows, start=1):
            label = f"[{index}/{len(rows)}] song_id={row['id']} bucket={row['market_bucket']} title={row['title']}"
            print(label)
            status = process_song(conn, row, dry_run=args.dry_run, timeout=timeout)
            summary[status] = summary.get(status, 0) + 1
            if status != "failed":
                print(f"  -> {status}")

        print("Summary:", summary)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
