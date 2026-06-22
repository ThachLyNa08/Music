import csv
import subprocess
import os
from pathlib import Path

# Đường dẫn file CSV (tạo từ bước Spotify) và nơi lưu nhạc
PROJECT_ROOT = Path(__file__).resolve().parents[5]
CSV_FILE = str(PROJECT_ROOT / "apps" / "backend" / "uploads" / "music")
DOWNLOAD_DIR = str(PROJECT_ROOT / "apps" / "backend" / "uploads" / "music" / "final_songs")

if not os.path.exists(DOWNLOAD_DIR):
    os.makedirs(DOWNLOAD_DIR)

def download_song(track, artist):
    query = f"{track} {artist} official audio"
    # Dùng yt-dlp để tải audio và chuyển sang mp3
    command = [
        'yt-dlp',
        '-x', '--audio-format', 'mp3',
        '--audio-quality', '128K',
        '-o', f'{DOWNLOAD_DIR}/%(title)s.%(ext)s',
        f'ytsearch1:{query}'
    ]
    subprocess.run(command)

with open(CSV_FILE, mode='r', encoding='utf-8') as file:
    reader = csv.DictReader(file)
    for row in reader:
        print(f"Đang tải: {row['Track']} - {row['Artist']}")
        download_song(row['Track'], row['Artist'])
