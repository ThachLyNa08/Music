import yt_dlp
import csv
import os
from pathlib import Path

# ==========================================
# CẤU HÌNH ĐƯỜNG DẪN LƯU TRỮ
# ==========================================
PROJECT_ROOT = Path(__file__).resolve().parents[5]
BACKEND_UPLOADS_DIR = PROJECT_ROOT / "apps" / "backend" / "uploads"
BASE_DOWNLOAD_DIR = str(BACKEND_UPLOADS_DIR / "music" / "final_songs" / "Vpop")
CSV_FILE = str(BACKEND_UPLOADS_DIR / "music" / "music_database_vpop.csv")

os.makedirs(os.path.dirname(CSV_FILE), exist_ok=True)
file_exists = os.path.isfile(CSV_FILE)

# ==========================================
# CẤU TRÚC MỚI: THỂ LOẠI -> NGHỆ SĨ CHÍNH -> DANH SÁCH LINK
# Bà tự đặt tên Nghệ Sĩ (VD: 'T-ara', 'Girls Generation'), máy sẽ gộp hết vào thư mục tên đó
# ==========================================
PLAYLISTS = {
    # 🇻🇳 CỤM 1: MAINSTREAM
    'vpop-mainstream': {
        'Sơn Tùng M-TP': [
            'https://music.youtube.com/playlist?list=OLAK5uy_kq6u7GZbsa9TKcZQc6HQWPsKsFjQenbmA'
        ],
        'Hà Anh Tuấn': [
            'https://music.youtube.com/playlist?list=OLAK5uy_nz5gw0GXghFpeyOa8kuSgIR41OyOdVaa8'
        ],
        'Noo Phước Thịnh': [
            'https://music.youtube.com/playlist?list=OLAK5uy_muFkvNqAiXLW1e_CFCptcKFz8eoWb7u-k'
        ],
        'Soobin Hoàng Sơn': [
            'https://music.youtube.com/playlist?list=OLAK5uy_k14lgzYKa_LQckzEdwdzA9CWMHsfDwc9U'
        ],
        'Erik': [
            'https://music.youtube.com/playlist?list=OLAK5uy_lXa9WyCYN7fnG3Qipq9-xBlKVTTI9aOYA'
        ],
        'Đức Phúc': [
            'https://music.youtube.com/playlist?list=OLAK5uy_l6910_6ScpWbWtnaJzvj_yL8Fjyl6cTMo'
        ],
        'Mỹ Tâm': [
            'https://music.youtube.com/playlist?list=OLAK5uy_mvPMTL_PqfeFBS9Hzrny9_cU7v4wga_r0'
        ],
        'Hồ Ngọc Hà': [
            'https://music.youtube.com/playlist?list=OLAK5uy_k8ievsEYUGhQcRidQvlAwtV9SgORHD5Cw' # Lưu ý: Đây là link kênh, có thể yt-dlp sẽ cào toàn bộ video
        ],
        'Đông Nhi': [
            'https://music.youtube.com/playlist?list=OLAK5uy_m-rasTXr519edho0_QSz4X_wJM3lL4XGM'
        ],
        'Tóc Tiên': [
            'https://music.youtube.com/playlist?list=OLAK5uy_kQdZ2xeVzfuYHr9d5slWIQUA6ySpcKNyM'
        ],
        'Bảo Anh': [
            'https://music.youtube.com/playlist?list=OLAK5uy_mtzOBl_kdP75JUQ-yrBUoOkJw17m4A1H8'
        ],
        'Văn Mai Hương': [
            'https://music.youtube.com/playlist?list=OLAK5uy_nUccKoNtWIRh2ebFxRybhAZhGB48cKEFU'
        ]
    },

    # 🇻🇳 CỤM 2: GEN Z / TRENDING
    'vpop-genz': {
        'tlinh': [
            'https://music.youtube.com/playlist?list=OLAK5uy_krIV_fkvvwCt1TbTtG7ImklkeHjKLy74U'
        ],
        'AMEE': [
            'https://music.youtube.com/playlist?list=OLAK5uy_luOoEFxBEziyCu4ZFqx3etpiwETrG9dVQ'
        ],
        'Phương Mỹ Chi': [
            'https://music.youtube.com/playlist?list=OLAK5uy_nLmxC6tpCrqrgEbtv4DTxcE0q3Vu0btrY'
        ],
        'Pháo': [
            'https://music.youtube.com/playlist?list=OLAK5uy_k4ML9NeLgLlivG8CjcZxk7SBInP4QN8T4'
        ],
        'Min': [
            'https://music.youtube.com/playlist?list=OLAK5uy_m5kosnXBYA-4bpIUOn_HxSGBdMxqtPsOw'
        ],
        'GREY D': [
            'https://music.youtube.com/playlist?list=OLAK5uy_nLcZdKxiVbR5m3tA5m5UQfftzRxtoBkOU'
        ],
        'MONO': [
            'http://music.youtube.com/playlist?list=OLAK5uy_ktsBb5SxHrlnWrFzpxE1TaQfRQwCTfo8E'
        ],
        'Hoàng Dũng': [
            'https://music.youtube.com/playlist?list=OLAK5uy_kY65Jg3ctIh-eTVmegU970omuE9bN_CX0'
        ],
        'Tăng Duy Tân': [
            'https://music.youtube.com/playlist?list=OLAK5uy_mL5JTve6OFMqJHwqP1_0NQe2jsPNcAgPM'
        ],
        'Anh Tú (Voi Bản Đôn)': [
            'https://music.youtube.com/playlist?list=OLAK5uy_n5JlKkCwhetUM9_utx3oALA3gS7zdQ6UI'
        ]
    },

    # 🇻🇳 CỤM 3: RAP & HIP-HOP
    'vpop-rap-hiphop': {
        'Đen Vâu': [
            'https://music.youtube.com/playlist?list=OLAK5uy_mbUdGAsayV7rqBycerKCBvh4DKG-yhiXY'
        ],
        'JustaTee': [
            'https://music.youtube.com/playlist?list=OLAK5uy_nQeESQBXRq-rPOHPpfwsYY73AJUSUIZG8'
        ],
        'Rhymastic': [
            'https://music.youtube.com/playlist?list=OLAK5uy_nDmwNiiw6lvyVehYcYTYth3desDwLxeWY'
        ],
        'HIEUTHUHAI': [
            'https://music.youtube.com/playlist?list=OLAK5uy_mGtaK9p1TLEujoDj1K9RF-WfW3-9Irxg0'
        ]
    },

    # 🇻🇳 CỤM 4: INDIE / CHILL
    'vpop-indie-chill': {
        'Chillies': [
            'https://music.youtube.com/playlist?list=OLAK5uy_k3aOoLJq0D4t95U7gZoiyQd05pvKVFpy8'
        ],
        'Da LAB': [
            'https://music.youtube.com/playlist?list=OLAK5uy_m-ISCZqMBoGEGWE805wvlvTIrD5Su4ZaE'
        ],
        'Ngọt': [
            'https://music.youtube.com/playlist?list=OLAK5uy_mEvNEVceGECQWtOLyZfmSNdmT9vK2Z9og'
        ],
        'Cá Hồi Hoang': [
            'https://music.youtube.com/playlist?list=OLAK5uy_kJkpQmCnbkkQqBfASaTCW4TaCaODrlTuY'
        ],
        'Vũ. (Hoàng tử Indie)': [
            'https://music.youtube.com/playlist?list=OLAK5uy_nc39QO0jLQo-APDKe7NdspIvocoOmHY8I'
        ],
        'Thịnh Suy': [
            'https://music.youtube.com/playlist?list=OLAK5uy_kaMOJV63p8EaQ3-y_c4ZmWVU7hzPSWOrk'
        ],
        'Phùng Khánh Linh': [
            'https://music.youtube.com/playlist?list=OLAK5uy_l72s0nCokfAhHzUBeEKo43kWHkWZaQkuU'
        ],
        'Hoàng Thùy Linh': [
            'https://music.youtube.com/playlist?list=OLAK5uy_l72s0nCokfAhHzUBeEKo43kWHkWZaQkuU'
        ],
        'Hòa MinZy': [
            'https://music.youtube.com/playlist?list=OLAK5uy_n4Wl-zURsQR2qUXB8EPoRBX3zIijfBLvs'
        ],
        'buitruonglinh': [
            'https://music.youtube.com/playlist?list=OLAK5uy_kO-e_F0ht9dHrNuqzaQYfvzGbWJf8RlKQ'
        ]
    },
    # 🇻🇳 CỤM 5: DÂN CA / TRỮ TÌNH (BOLERO)
    'vpop-bolero-folk': {
        'Phi Nhung': [
            'https://music.youtube.com/playlist?list=OLAK5uy_lax50Z1OVsD4ajv82UQL9iWY1Ovuh9M_M', # Bậu Ơi Đừng Khóc # Album Cánh Hoa Rừng
        ],
        'Như Quỳnh': [
            'https://music.youtube.com/playlist?list=OLAK5uy_lHn6rEPeo-0DtwbhkXJcIkNug1ZMOW5rM',
        ],
        'Cẩm Ly': [
            'https://music.youtube.com/playlist?list=OLAK5uy_lMVyCk8ZHpZFq2d5Iq3uRYE9_y_GlsqCU'
        ],
        'Mạnh Quỳnh': [
            'https://music.youtube.com/playlist?list=OLAK5uy_kDwIkbARXb3E7Bn_RaprBlcEeSwT7vcn8'
        ],
        'Quang Lê': [
            'https://music.youtube.com/playlist?list=OLAK5uy_k-4Ooe7j1K239i49UZQUMQgBs30xnMsVE'
        ],
        'Lệ Quyên': [
            'https://music.youtube.com/playlist?list=OLAK5uy_l_7SsrMdp8RsBXpR06F4slB2MMwkB-xec' # Nữ hoàng phòng trà hát Bolero cực đỉnh
        ],
        'Đan Trường': [
            'https://music.youtube.com/playlist?list=OLAK5uy_mnAp23qUgNYIZBL8wyV3lEC490sGavLJ8' # Nhạc dân ca trữ tình của anh Bo
        ],
        'Diệu Kiên': [
            'https://music.youtube.com/playlist?list=OLAK5uy_kzXEl_mCEZQlO63Vl6XhheLnK7FAKKwj4'
        ],
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
                'quiet': True ,

                # 📌 BÙA CHÚ GIỚI HẠN SỐ LƯỢNG Ở ĐÂY:
                'playlistend': 50
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

print(f"\n=======================================================")
print(f"📊 BÁO CÁO THỐNG KÊ DATASET ĐỢT NÀY")
print(f"=======================================================")
print(f"🎵 Tổng số bài hát đã tải về: {total_songs_count} bài")
print(f"🎤 Số lượng Nghệ sĩ gốc (Main):  {len(PLAYLISTS['kpop-gen2']) + len(PLAYLISTS.get('kpop-gen3', {}))} nghệ sĩ")
print(f"💽 Số lượng Album bóc tách được: {len(unique_albums_set)} album")
print(f"=======================================================\n")
