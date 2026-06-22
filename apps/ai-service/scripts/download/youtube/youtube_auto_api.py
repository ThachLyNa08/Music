import yt_dlp
import csv
import os
from pathlib import Path
from ytmusicapi import YTMusic

# ==========================================
# 1. CẤU HÌNH HỆ THỐNG
# ==========================================
PROJECT_ROOT = Path(__file__).resolve().parents[5]
BACKEND_UPLOADS_DIR = PROJECT_ROOT / "apps" / "backend" / "uploads"
BASE_DOWNLOAD_DIR = str(BACKEND_UPLOADS_DIR / "music" / "final_songs")
CSV_FILE = str(BACKEND_UPLOADS_DIR / "music" / "music_database_auto.csv")
os.makedirs(os.path.dirname(CSV_FILE), exist_ok=True)

# Khởi tạo API YouTube Music (Không cần Token, cào tẹt ga!)
ytmusic = YTMusic()

# ==========================================
# 2. TỪ KHÓA TỰ ĐỘNG TÌM KIẾM
# Bà chỉ cần gõ tên thể loại/nghệ sĩ, API sẽ tự tìm Playlist chuẩn nhất
# ==========================================
AUTO_KEYWORDS = {
    'kpop-gen3': 'BLACKPINK',
}

# ==========================================
# 3. CẤU HÌNH TẢI NHẠC (yt-dlp)
# ==========================================
ydl_opts = {
    'format': 'bestaudio/best',
    'postprocessors': [{
        'key': 'FFmpegExtractAudio',
        'preferredcodec': 'mp3',
        'preferredquality': '128',
    }],
    'outtmpl': f'{BASE_DOWNLOAD_DIR}/%(artist)s/%(album|Single)s/%(title)s.%(ext)s',
    'ignoreerrors': True,
    'quiet': True 
}

# ==========================================
# 4. CHU TRÌNH: TÌM KIẾM -> LẤY LINK -> TẢI & LƯU CSV
# ==========================================
with open(CSV_FILE, mode='w', newline='', encoding='utf-8') as file:
    writer = csv.writer(file)
    writer.writerow(['Title', 'Artist', 'Album', 'Genre', 'YouTube_URL', 'Cover_URL', 'File_Path'])

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        for genre, keyword in AUTO_KEYWORDS.items():
            print(f"\n=========================================")
            print(f"🤖 Đang dùng API tìm kiếm Playlist cho: '{keyword}'...")
            
            # Gọi API tìm đúng 1 Playlist xịn nhất (filter='playlists')
            search_results = ytmusic.search(keyword, filter="playlists", limit=1)
            
            if not search_results:
                print(f"❌ Không tìm thấy playlist nào cho từ khóa này.")
                continue
                
            # Trích xuất mã Playlist (browseId) từ API trả về
            playlist_id = search_results[0]['browseId']
            auto_url = f"https://music.youtube.com/playlist?list={playlist_id}"
            
            print(f"🔗 API đã tự động bắt được Link: {auto_url}")
            print(f"🔥 Bắt đầu tải cho thể loại: [{genre.upper()}]")
            
            # Chuyền link tự động lấy được cho yt-dlp tải
            info = ydl.extract_info(auto_url, download=True)
            if not info:
                continue

            entries = info.get('entries', [info])
            
            for entry in entries:
                if not entry:
                    continue
                    
                title = entry.get('track') or entry.get('title', 'Unknown Title')
                artist = entry.get('artist') or entry.get('uploader', 'Unknown Artist')
                album = entry.get('album') or 'Single'
                yt_url = entry.get('original_url') or entry.get('webpage_url', '')
                cover_url = entry.get('thumbnail', '')
                
                safe_title = title.replace('/', '_').replace(':', '_').replace('"', '').replace('|', '_')
                safe_artist = artist.replace('/', '_').replace(':', '_').replace('"', '').replace('|', '_')
                safe_album = album.replace('/', '_').replace(':', '_').replace('"', '').replace('|', '_')
                
                relative_file_path = f"{safe_artist}/{safe_album}/{safe_title}.mp3"
                
                writer.writerow([title, artist, album, genre, yt_url, cover_url, relative_file_path])
                print(f"   ✅ Auto Crawl: {title} - {artist}")

print(f"\n🎉 HỆ THỐNG AUTO CRAWL ĐÃ CHẠY XONG!")
