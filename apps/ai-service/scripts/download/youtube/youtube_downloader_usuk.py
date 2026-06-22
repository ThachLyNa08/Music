import yt_dlp
import csv
import os
from pathlib import Path

# ==========================================
# CẤU HÌNH ĐƯỜNG DẪN LƯU TRỮ
# ==========================================
PROJECT_ROOT = Path(__file__).resolve().parents[5]
BACKEND_UPLOADS_DIR = PROJECT_ROOT / "apps" / "backend" / "uploads"
BASE_DOWNLOAD_DIR = str(BACKEND_UPLOADS_DIR / "music" / "final_songs" / "USUK")
CSV_FILE = str(BACKEND_UPLOADS_DIR / "music" / "music_database_usuk.csv")

os.makedirs(os.path.dirname(CSV_FILE), exist_ok=True)
file_exists = os.path.isfile(CSV_FILE)

# ==========================================
# CẤU TRÚC MỚI: THỂ LOẠI -> NGHỆ SĨ CHÍNH -> DANH SÁCH LINK
# Bà tự đặt tên Nghệ Sĩ (VD: 'T-ara', 'Girls Generation'), máy sẽ gộp hết vào thư mục tên đó
# ==========================================
PLAYLISTS = {
    # 🇺🇸 CỤM 1: POP ROYALTY
    'usuk-pop': {
        'Taylor Swift': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_k1272v-yXtLJm7gmMiAxjOl-vh5aEC11A'
        ],
        'Ariana Grande': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_m6_xW9k1AulRRrn2tpl9gU_Lp3v110LpA'
        ],
        'Dua Lipa': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_mcZWLaApLs3D3SYsdd6r8fZWrr5dSOtI8'
        ],
        'Billie Eilish': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_lwlSMeiO10xaaWLi8V9wASu0duyNtOCOo'
        ],
        'Adele': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_nYysbwK29-nLNgVT7gaDEzu5th1Ghrnnc'
        ],
        'Lady Gaga': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_lC3CVlccVxKUKd5Hi2suI7myREC6rc_Y0'
        ],
        'Rihanna': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_lo76MLtV5lTG0J36Tn9KitDgjtZ-Cn2a8'
        ],
        'Beyoncé': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_ncffR0dhOYH0ExFnztUg6rq4fkFULExAU'
        ],
        'Justin Bieber': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_kbM5Udvwj2DarPd7LKmd8mqHbcLsAcerg'
        ],
        'Ed Sheeran': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_lL718gGQZgQf4jkKYjVbOXHABQCFAYuj0'
        ],
        'Bruno Mars': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_kBGve9D_9yPxIThGq87PGVzjxfkjE0CJI'
        ],
        'Shawn Mendes': [
            'https://music.youtube.com/playlist?list=OLAK5uy_nn0Iu1GpQzH_SsgUwGHnjOS5kELgvLZoM'
        ],
        'Charlie Puth': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_lvehly_k4btdBv7RWD1-b1Qyw8uppYCFY'
        ],
        'Harry Styles': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_nYpSt_cTBRksgFx2cm75h2Cgd55dSGSBo'
        ]
    },

    # 🇺🇸 CỤM 2: RAP & HIP-HOP
    'usuk-rap': {
        'Eminem': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_nnk58Y3rT4Y62vuYUvGpWGjxL9wsb10uI'
        ],
        'Drake': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_n7TBD7OyJBbU9VnPuvrCbgpU5AXRY2lYg'
        ],
        'Kendrick Lamar': [
            'https://music.youtube.com/playlist?list=OLAK5uy_lcvoZKgUhdnEreHlWY_RaEwR47D-vwdTI'
        ],
        'Travis Scott': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_mDOuBN9g8hVpRmoDWRGonRUn7lKYgNvPA'
        ],
        'Doja Cat': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_n8z29KotPfeENs7oc7oidRiG6q2DCWkM4'
        ],
        'Cardi B': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_lFnolCKpviuCyaMaI7OeRYyeMy2iwQclg'
        ],
        'Nicki Minaj': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_k1tbUKLMKNlVUmvBnJzcdxbmTV5SJ32Fo'
        ],
        'Megan Thee Stallion': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_ktzRRR-jEacEiPCwosf96W-6WfVmnKmZI'
        ]
    },

    # 🇺🇸 CỤM 3: R&B / SOUL
    'usuk-rnb': {
        'The Weeknd': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_nCz51lvimQoR1Iedu0zDkh5HVJRVr2sYA'
        ],
        'SZA': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_m-r6WCqwqy5cA5qJ3fb3io7DeUY31H15M'
        ],
        'Frank Ocean': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_kU3T2LpSy7Z92m20BwBnWAo_CBSmdPbdo'
        ],
        'Chris Brown': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_lU_PzTL8Cvlrqgn707qmZPS_vsGbQ8PZ0'
        ],
        'Khalid': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_mrwsmMF6UtQMOEecZrEDl4sI1Q0xavwGQ'
        ],
        'Kehlani': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_mEJ3kzhxDw0cY3Wcft-YzWjNoQLmqav2Q'
        ],
        'Lana Del Rey': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_mAOd0HAu9UNHEUJ4bSszYHN_ofhisFvzA'
        ]
    },

    # 🇺🇸 CỤM 4: POP-ROCK & INDIE
    'usuk-rock-indie': {
        'Coldplay': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_mvVkrLZoWvAImblfAn-BPxrIYPP6r18tQ'
        ],
        'Imagine Dragons': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_mzpBFnAPcGS-4FYm4BzAY-Q3VmvNCQwxY'
        ],
        'Maroon 5': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_mygsXSPH6yvTzhhqQD22oVvHT6lF_DkoY'
        ],
        'OneRepublic': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_muHINkQV8u-ZdjyVfwq-uQsvZxb6V-CKE'
        ],
        'The Neighbourhood': [
            'https://music.youtube.com/playlist?list=OLAK5uy_meeJQOG6WFsN6T-1pvyaUC8yTSphLVyjU'
        ],
        'The 1975': [
            'https://music.youtube.com/playlist?list=OLAK5uy_my-MLaeN5_sZ22bsWC1NTzSWOacx-Pctk'
        ]
    },

    # 🇺🇸 CỤM 5: EDM & DANCE
    'usuk-edm': {
        'Calvin Harris': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_lxmLa39tJ_EEt9WXCrINdERMaf3oW90Mg'
        ],
        'Avicii': [
            'http://music.youtube.com/playlist?list=RDCLAK5uy_nDRCp6HLWB_DupMjvqKXzzwt3z3WAxXYQ'
        ],
        'The Chainsmokers': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_l-F0v2etpParKwNEzY2Woun6ug-fdNDa0'
        ],
        'David Guetta': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_nlwI2Hk1q5n28Wwi-Pz7Y9kHCPhkax-cc'
        ],
        'Marshmello': [
            'http://music.youtube.com/playlist?list=RDCLAK5uy_koPsIwLw5o5gAR44n4593m4j68tOKWtVU'
        ],
        'DJ Snake': [
            'https://music.youtube.com/playlist?list=RDCLAK5uy_mi-KlZIDrZrulelCmmN4UkS6jCgYpl6NY'
        ]
    }
}

# ==========================================
# KHỞI TẠO BỘ ĐẾM THỐNG KÊ 
# ==========================================
total_songs_count = 0
unique_albums_set = set()

# ==========================================
# QUÁ TRÌNH TẢI VÀ GHI DỮ LIỆU CSV
# ==========================================
with open(CSV_FILE, mode='a', newline='', encoding='utf-8') as file:
    writer = csv.writer(file)
    
    # Header mới: Tách bạch giữa Nghệ Sĩ Gốc (Main_Artist) và Tên hiển thị trên YouTube (Original_Artist)
    if not file_exists:
        writer.writerow(['Title', 'Main_Artist', 'Original_Artist', 'Album', 'Genre', 'YouTube_URL', 'Cover_URL', 'File_Path'])

    for genre, artists_dict in PLAYLISTS.items():
        print(f"\n=========================================")
        print(f"🔥 ĐANG XỬ LÝ THỂ LOẠI: {genre.upper()}")
        print(f"=========================================")
        
        for main_artist, url_list in artists_dict.items():
            valid_urls = [url for url in url_list if url.startswith('http')]
            if not valid_urls:
                continue
                
            print(f"\n👉 Đang tải và gom thư mục cho Nghệ sĩ: {main_artist}")
            
            # CHÌA KHÓA Ở ĐÂY: Đưa tên main_artist do bà đặt vào thay vì để youtube tự định đoạt
            ydl_opts = {
                'format': 'bestaudio/best',
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '128',
                }],
                # Thần chú Ép Thư Mục: final_songs / T-ara / Tên_Album / Bài_Hát.mp3
                'outtmpl': f'{BASE_DOWNLOAD_DIR}/{main_artist}/%(album|Single)s/%(title)s.%(ext)s',
                'ignoreerrors': True,
                'quiet': True 
            }

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                for url in valid_urls:
                    info = ydl.extract_info(url, download=True)
                    if not info:
                        continue

                    entries = info.get('entries', [info])
                    
                    for entry in entries:
                        if not entry:
                            continue
                            
                        title = entry.get('track') or entry.get('title', 'Unknown Title')
                        original_artist = entry.get('artist') or entry.get('uploader', 'Unknown Artist')
                        album = entry.get('album') or 'Single'
                        yt_url = entry.get('original_url') or entry.get('webpage_url', '')
                        cover_url = entry.get('thumbnail', '')
                        
                        # Dọn dẹp ký tự để lưu file không bị lỗi
                        safe_title = title.replace('/', '_').replace(':', '_').replace('"', '').replace('|', '_')
                        safe_album = album.replace('/', '_').replace(':', '_').replace('"', '').replace('|', '_')
                        
                        # Đường dẫn lưu vào CSDL (Theo đúng cấu trúc ổ cứng mới)
                        relative_file_path = f"{main_artist}/{safe_album}/{safe_title}.mp3"
                        
                        writer.writerow([title, main_artist, original_artist, album, genre, yt_url, cover_url, relative_file_path])
                        print(f"   ✅ Đã gom: {title} (Hát cùng: {original_artist})")
                        
                        total_songs_count += 1
                        if album and album != 'Single':
                            unique_albums_set.add(f"{album.strip()} - {main_artist}")

# ==========================================
# XUẤT BÁO CÁO SỐ LIỆU SAU KHI CHẠY XONG
# ==========================================
print(f"\n🎉 XUẤT SẮC! ĐÃ DỌN DẸP SẠCH SẼ VÀ TẢI XONG.")
print(f"📁 Kiểm tra ổ cứng, các thư mục nay đã chuẩn form: {BASE_DOWNLOAD_DIR}")
print(f"📊 Dataset sẵn sàng: {CSV_FILE}")

total_artists = sum(len(artists_dict) for artists_dict in PLAYLISTS.values())

print(f"\n=======================================================")
print(f"📊 BÁO CÁO THỐNG KÊ DATASET ĐỢT NÀY")
print(f"=======================================================")
print(f"🎵 Tổng số bài hát đã tải về: {total_songs_count} bài")
print(f"🎤 Số lượng Nghệ sĩ gốc (Main): {total_artists} nghệ sĩ")
print(f"💽 Số lượng Album bóc tách được: {len(unique_albums_set)} album")
print(f"=======================================================\n")
