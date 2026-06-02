import yt_dlp
import csv
import os

# ==========================================
# CẤU HÌNH ĐƯỜNG DẪN LƯU TRỮ
# ==========================================
BASE_DOWNLOAD_DIR = '../backend/uploads/music/final_songs/Kpop/BLACKPINK'
CSV_FILE = '../backend/uploads/music/music_database_kpop1.csv'

os.makedirs(os.path.dirname(CSV_FILE), exist_ok=True)
file_exists = os.path.isfile(CSV_FILE)

# ==========================================
# CẤU TRÚC MỚI: THỂ LOẠI -> NGHỆ SĨ CHÍNH -> DANH SÁCH LINK
# Bà tự đặt tên Nghệ Sĩ (VD: 'T-ara', 'Girls Generation'), máy sẽ gộp hết vào thư mục tên đó
# ==========================================
PLAYLISTS = {
    'kpop-gen2': {
    },
    'kpop-gen3': {
        'BORNPINK':[
            'https://music.youtube.com/playlist?list=OLAK5uy_lRomaeWWbiUqoxaxM8v3jZ9-sm1iRMT6s',
            
            ],
    },
    # 'kpop-gen4':{
    #     'aespa':['https://music.youtube.com/playlist?list=RDCLAK5uy_n4rcgvZK8C8dWgOFZPsNlteK8vY1bNyRs',],
    #     'NewJeans':['https://music.youtube.com/playlist?list=RDCLAK5uy_mEWBeziQVuUMly1swT96vfGMzDmF6M1XM',],
    #     'IVE':['https://music.youtube.com/playlist?list=RDCLAK5uy_lnqcAaHruSFLBKg5wuEsmVEYndfGUmx2Y',],
    #     'LE SSERAFIM':['https://music.youtube.com/playlist?list=RDCLAK5uy_n7aTWwvK-ba0RY3RLBLnsWaAwcI4FxUoY',],
    #     'i-dle (아이들)':['https://music.youtube.com/playlist?list=OLAK5uy_nsqlD2_RJ-HE2rjfygPHv76qT2cGLW_QI',],
    #     'ITZY':['https://music.youtube.com/playlist?list=RDCLAK5uy_l2_I_gyG8l4Fqy-JYSN3W5ovWydDgL2Do',],
    #     'NMIXX':['https://music.youtube.com/playlist?list=RDCLAK5uy_kJ7rcyBwfYFjrkWAaAouIF4V3uy8aKgRo',],
    #     'Stray Kids':['https://music.youtube.com/playlist?list=RDCLAK5uy_kcx2cun9mi1I2pCZf0Q7C0sG0Xx8d73O4',],
    #     'TOMORROW X TOGETHER':['https://music.youtube.com/playlist?list=RDCLAK5uy_nrUnNIc6GplFhaW7PnPB7RgMyXz4Fu8Xk',],
    #     'ENHYPEN':['https://music.youtube.com/playlist?list=RDCLAK5uy_nlhh4mNyaHthUeGQ9HIvFqifxiR5ZIQFI',],
    #     'ATEEZ':['https://music.youtube.com/playlist?list=RDCLAK5uy_ks_ukNS4uN_-HCdVwPjaCJ3KnGYaymhRw',],
    #     'TREASURE':['https://music.youtube.com/playlist?list=OLAK5uy_lLGWqmg-vO-EES3XgxuiJTbWivj3K3hGY',]

    # },
    # 'kpop-gen5': {
    #     'BABYMONSTER':['https://music.youtube.com/playlist?list=OLAK5uy_mrKpuT43K4DwoMiJgQrPwECYJWf9uvspU',],
    #     'ILLIT':['https://music.youtube.com/playlist?list=RDCLAK5uy_nLvUsQh8YpqMX320gosvRY9_oqpOc0KUU',],
    #     'TWS':['https://music.youtube.com/playlist?list=OLAK5uy_namFgbwYNQ3G0dNtTVCIlhqIWeas5iDsE',],
    #     'CORTIS':['https://music.youtube.com/playlist?list=OLAK5uy_lGltRMFUZ_XFtWZUPF5KuNGOYwyWigmeo',]
    # },
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

print(f"\n=======================================================")
print(f"📊 BÁO CÁO THỐNG KÊ DATASET ĐỢT NÀY")
print(f"=======================================================")
print(f"🎵 Tổng số bài hát đã tải về: {total_songs_count} bài")
print(f"🎤 Số lượng Nghệ sĩ gốc (Main):  {len(PLAYLISTS['kpop-gen2']) + len(PLAYLISTS.get('kpop-gen3', {}))} nghệ sĩ")
print(f"💽 Số lượng Album bóc tách được: {len(unique_albums_set)} album")
print(f"=======================================================\n")