import argparse
import csv
import os
from pathlib import Path

import mysql.connector
from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[4]
AI_SERVICE_ROOT = PROJECT_ROOT / "apps" / "ai-service"
DEFAULT_OUTPUT = Path("exports") / "karaoke_completed_songs.csv"


def load_env():
    load_dotenv(PROJECT_ROOT / "apps" / "backend" / ".env")
    load_dotenv(AI_SERVICE_ROOT / ".env")


def connect_db():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "3306")),
        database=os.getenv("DB_NAME", "musicflow"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
        charset="utf8mb4",
    )


def resolve_output_path(output):
    output_path = Path(output)

    if not output_path.is_absolute():
        output_path = AI_SERVICE_ROOT / output_path

    output_path.parent.mkdir(parents=True, exist_ok=True)
    return output_path


def fetch_completed_songs(conn, limit=None):
    cursor = conn.cursor(dictionary=True)

    sql = """
        SELECT
          s.id AS song_id,
          s.title AS song_title,
          a.name AS artist_name,
          g.name AS genre_name,
          ss.vocals_url,
          ss.instrumental_url,
          ss.processed_at
        FROM song_stems ss
        JOIN songs s ON s.id = ss.song_id
        LEFT JOIN artists a ON a.id = s.artist_id
        LEFT JOIN genres g ON g.id = s.genre_id
        WHERE ss.status = 'completed'
        ORDER BY ss.processed_at DESC, ss.updated_at DESC, ss.id DESC
    """

    params = ()
    if limit is not None:
        sql += " LIMIT %s"
        params = (limit,)

    cursor.execute(sql, params)
    rows = cursor.fetchall()
    cursor.close()
    return rows


def export_csv(rows, output_path):
    fieldnames = [
        "song_id",
        "song_title",
        "artist_name",
        "genre_name",
        "vocals_url",
        "instrumental_url",
        "processed_at",
    ]

    with output_path.open("w", newline="", encoding="utf-8-sig") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()

        for row in rows:
            writer.writerow(
                {
                    "song_id": row.get("song_id"),
                    "song_title": row.get("song_title") or "",
                    "artist_name": row.get("artist_name") or "",
                    "genre_name": row.get("genre_name") or "",
                    "vocals_url": row.get("vocals_url") or "",
                    "instrumental_url": row.get("instrumental_url") or "",
                    "processed_at": row.get("processed_at") or "",
                }
            )


def parse_args():
    parser = argparse.ArgumentParser(
        description="Export completed Karaoke stem songs to CSV."
    )

    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum completed songs to export. If omitted, export all completed songs.",
    )

    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT),
        help="Output CSV path relative to apps/ai-service.",
    )

    return parser.parse_args()


def main():
    args = parse_args()

    limit = None
    if args.limit is not None:
        limit = max(1, int(args.limit))

    output_path = resolve_output_path(args.output)

    load_env()
    conn = connect_db()

    try:
        rows = fetch_completed_songs(conn, limit)
        export_csv(rows, output_path)

        limit_text = "all" if limit is None else str(limit)
        print(
            f"Exported {len(rows)} completed Karaoke song(s) "
            f"to {output_path} (limit={limit_text})"
        )
    finally:
        conn.close()


if __name__ == "__main__":
    main()