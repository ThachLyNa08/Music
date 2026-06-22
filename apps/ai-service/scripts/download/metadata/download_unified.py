import yt_dlp
import csv
import os
import re
from pathlib import Path

# ==========================================
# 1. CẤU HÌNH ĐƯỜNG DẪN & PLAYLISTS
# ==========================================
PROJECT_ROOT = Path(__file__).resolve().parents[5]
BACKEND_UPLOADS_DIR = PROJECT_ROOT / "apps" / "backend" / "uploads"
CSV_FILE = str(BACKEND_UPLOADS_DIR / "music" / "unified_music_database.csv")
BASE_DOWNLOAD_DIR = str(BACKEND_UPLOADS_DIR / "music" / "final_songs")

os.makedirs(os.path.dirname(CSV_FILE), exist_ok=True)

# Quăng link NhacCuaTui (hoặc YouTube) vào đây
PLAYLISTS = {
    "VPOP-GENZ": {
        "Orange": [
            "https://www.nhaccuatui.com/album/HXtYgWPtHcPT",
        ],
    }
}

CSV_HEADERS = [
    'Title', 'Main_Artist', 'Original_Artist', 'Album', 'Genre', 
    'Market', 'Duration_Sec', 'Source', 'Source_ID', 'Source_URL', 
    'Cover_URL', 'File_Path', 'Audio_URL'
]

# ==========================================
# 2. HÀM PHỤ TRỢ
# ==========================================
def sanitize_filename(name):
    if not name: return "Unknown"
    return re.sub(r'[\\/*?:"<>|]', '_', str(name)).strip()

def get_market_info(genre):
    g = genre.lower()
    if 'kpop' in g: return 'KPOP', 'Kpop'
    elif 'vpop' in g or 'v-pop' in g: return 'VPOP', 'Vpop'
    elif 'usuk' in g or 'us-uk' in g: return 'USUK', 'USUK'
    return 'OTHER', 'Other'

# ==========================================
# 3. LUỒNG CHÍNH: QUÉT -> TẢI -> KIỂM TRA -> LƯU CSV
# ==========================================
def main():
    print("🚀 BẮT ĐẦU CHẠY LUỒNG 1 BƯỚC (QUÉT -> TẢI -> LƯU CSV)...")
    
    file_exists = os.path.isfile(CSV_FILE) and os.stat(CSV_FILE).st_size > 0
    
    # Mở file CSV ở chế độ ghi nối (Append)
    with open(CSV_FILE, mode='a', newline='', encoding='utf-8') as file:
        writer = csv.writer(file)
        if not file_exists:
            writer.writerow(CSV_HEADERS)

        # Bộ cấu hình 1: Chỉ dùng để "nhìn" lấy thông tin (Chưa tải)
        meta_opts = {
            'extract_flat': False,
            'quiet': True,
            'ignoreerrors': True,
            # 'cookiefile': 'cookies.txt', # Bỏ comment nếu cào YouTube
        }

        for genre, artists_dict in PLAYLISTS.items():
            market_db, folder_market = get_market_info(genre)

            for main_artist, url_list in artists_dict.items():
                for url in url_list:
                    print(f"\n🔍 Đang phân tích link: {url}")

                    with yt_dlp.YoutubeDL(meta_opts) as ydl_meta:
                        info = ydl_meta.extract_info(url, download=False)
                        if not info:
                            print("  ❌ Không lấy được thông tin từ link này.")
                            continue

                        entries = info.get('entries', [info])

                        for entry in entries:
                            if not entry: continue

                            title = entry.get('track') or entry.get('title', 'Unknown Title')
                            source_url = entry.get('original_url') or entry.get('webpage_url') or url
                            
                            album = entry.get('album') or 'Single'
                            safe_title = sanitize_filename(title)
                            safe_album = sanitize_filename(album)
                            safe_artist = sanitize_filename(main_artist)

                            # Đường dẫn vật lý
                            relative_path = f"{safe_artist}/{safe_album}/{safe_title}.mp3"
                            full_save_path = os.path.join(BASE_DOWNLOAD_DIR, folder_market, relative_path)

                            # Tự động tạo thư mục rỗng chờ sẵn
                            os.makedirs(os.path.dirname(full_save_path), exist_ok=True)

                            # CHỐT 1: KIỂM TRA NẾU ĐÃ CÓ FILE MP3 THÌ BỎ QUA
                            if os.path.exists(full_save_path):
                                print(f"  ⏩ Đã có sẵn trên ổ cứng, lướt qua: {title}")
                                continue

                            print(f"\n⬇️ Đang tải: {title}")

                            # Bộ cấu hình 2: Thực thi kéo file MP3 về
                            dl_opts = {
                                'format': 'bestaudio/best',
                                'postprocessors': [{
                                    'key': 'FFmpegExtractAudio',
                                    'preferredcodec': 'mp3',
                                    'preferredquality': '128',
                                }],
                                'outtmpl': full_save_path.replace('.mp3', '.%(ext)s'),
                                'quiet': False, # Bật log để xem tiến độ tải
                                'ignoreerrors': True,
                                # 'cookiefile': 'cookies.txt', # Bỏ comment nếu cào YouTube
                            }

                            # BẮT ĐẦU TẢI NHẠC
                            with yt_dlp.YoutubeDL(dl_opts) as ydl_dl:
                                ydl_dl.download([source_url])

                            # ==========================================
                            # CHỐT 2 (QUAN TRỌNG NHẤT): NGHIỆM THU SAU KHI TẢI
                            # ==========================================
                            if os.path.exists(full_save_path):
                                print(f"  ✅ Tải xong! Đang lưu vào CSV: {title}")
                                
                                original_artist = entry.get('artist') or entry.get('uploader', 'Unknown Artist')
                                duration = entry.get('duration') or 0
                                source_id = entry.get('id', 'Unknown')
                                cover_url = entry.get('thumbnail', '')
                                audio_url = f"/uploads/music/final_songs/{folder_market}/{relative_path}"

                                # Ghi data vào CSV
                                writer.writerow([
                                    title, main_artist, original_artist, album, genre, 
                                    market_db, duration, 'nhaccuatui', source_id, source_url, 
                                    cover_url, relative_path, audio_url
                                ])
                                
                                # LỆNH THẦN THÁNH: Bắt ép máy tính phải lưu file CSV ngay lập tức!
                                # Đề phòng đang tải bài tiếp theo bị cúp điện thì bài này vẫn được lưu.
                                file.flush() 
                                
                            else:
                                print(f"  ❌ Tải thất bại (Do bản quyền/VIP). KHÔNG GHI CSV!")
                                
                                # CHIẾN DỊCH DỌN RÁC: Xóa cái thư mục rỗng vừa tạo ra
                                album_dir = os.path.dirname(full_save_path)
                                if os.path.exists(album_dir) and not os.listdir(album_dir):
                                    os.rmdir(album_dir)
                                    print(f"  🧹 Đã xóa thư mục ma trống rỗng!")

    print("\n🎉 XONG! HOÀN TẤT CHIẾN DỊCH 1 BƯỚC!")

if __name__ == "__main__":
    main()
