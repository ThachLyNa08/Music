import yt_dlp
import pandas as pd
import time
import os
from pathlib import Path

# Đường dẫn file CSV và thư mục lưu nhạc (trỏ về backend/uploads)
PROJECT_ROOT = Path(__file__).resolve().parents[5]
CSV_FILE = str(PROJECT_ROOT / "datasets" / "raw" / "spotify_songs.csv")
OUTPUT_DIR = str(PROJECT_ROOT / "apps" / "backend" / "uploads" / "songs")

# Tạo thư mục nếu chưa có
os.makedirs(OUTPUT_DIR, exist_ok=True)

def download_song(song_name, artist):
    # Dùng cú pháp ytsearch1: để lấy đúng video top 1 tìm kiếm
    query = f"ytsearch1:{song_name} {artist} official audio"
    
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': f'{OUTPUT_DIR}/{song_name} - {artist}.%(ext)s',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '128', # 128kbps là đủ nghe và nhẹ server
        }],
        'noplaylist': True, # Không tải cả playlist nếu lỡ trúng link playlist
        'quiet': True,      # Giấu log cho màn hình console đỡ rối
        'no_warnings': True
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            print(f"Đang tải: {song_name} - {artist}...")
            ydl.download([query])
            return True
    except Exception as e:
        print(f"Lỗi khi tải {song_name}: {e}")
        return False

# Đọc file CSV (Giả sử file có cột 'track_name' và 'track_artist')
df = pd.read_csv(CSV_FILE)

# Giới hạn lấy 2000 bài đầu tiên để test
subset_df = df.head(2000)

for index, row in subset_df.iterrows():
    song = row['track_name']
    artist = row['track_artist']
    
    success = download_song(song, artist)
    
    # Nghỉ 2 giây giữa mỗi bài để YouTube không block IP vì spam request
    if success:
        time.sleep(2)
