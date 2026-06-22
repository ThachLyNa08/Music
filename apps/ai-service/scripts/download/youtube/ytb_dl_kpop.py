import csv
import re
from pathlib import Path

import yt_dlp
from yt_dlp.cookies import CookieLoadError
from yt_dlp.utils import DownloadError


PROJECT_ROOT = Path(__file__).resolve().parents[5]
BACKEND_UPLOADS_DIR = PROJECT_ROOT / "apps" / "backend" / "uploads"
BASE_DOWNLOAD_DIR = BACKEND_UPLOADS_DIR / "music" / "final_songs" / "Kpop"
CSV_FILE = BACKEND_UPLOADS_DIR / "music" / "music_database_kpop1.csv"
ARCHIVE_FILE = BACKEND_UPLOADS_DIR / "music" / "downloaded_kpop.txt"
COOKIE_FILE = PROJECT_ROOT / "apps" / "ai-service" / "cookies.txt"
# Dung cookie truc tiep tu trinh duyet dang dang nhap YouTube Music.
# Doi thanh False neu muon dung file cookies.txt thay vi Chrome.
USE_BROWSER_COOKIES = True
BROWSER_NAME = "chrome"
SUPPORTED_BROWSERS = {"brave", "chrome", "chromium", "edge", "firefox", "opera", "safari", "vivaldi", "whale"}

CSV_HEADERS = [
    "Title",
    "Main_Artist",
    "Original_Artist",
    "Album",
    "Genre",
    "YouTube_URL",
    "Cover_URL",
    "File_Path",
]

PLAYLISTS = {
    "kpop-gen2": {
    },
    "kpop-gen3": {
        "BLACKPINK": [
            "https://music.youtube.com/playlist?list=OLAK5uy_lRomaeWWbiUqoxaxM8v3jZ9-sm1iRMT6s",
            "https://music.youtube.com/playlist?list=OLAK5uy_l3QGS6y9ZWficqzcu429HoCvcKlpMmmmY",
            "https://music.youtube.com/playlist?list=OLAK5uy_m1OQNnyJAlg50n3C_TywdGIbF7fki4PmA",
        ],
    },
}


def safe_path_part(value: str, default: str = "Unknown") -> str:
    value = str(value or default).strip()
    value = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", value)
    value = re.sub(r"\s+", " ", value).strip(" .")

    if not value:
        value = default

    reserved_names = {
        "CON", "PRN", "AUX", "NUL",
        "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
        "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    }

    if value.upper() in reserved_names:
        value = f"_{value}"

    return value[:150]


def load_existing_csv_keys(csv_file: Path) -> set:
    if not csv_file.exists():
        return set()

    keys = set()
    with csv_file.open("r", newline="", encoding="utf-8-sig") as file:
        reader = csv.DictReader(file)
        for row in reader:
            youtube_url = (row.get("YouTube_URL") or "").strip()
            file_path = (row.get("File_Path") or "").strip()
            if youtube_url:
                keys.add(youtube_url)
            if file_path:
                keys.add(file_path)
    return keys


def get_best_cover_url(info: dict) -> str:
    thumbnails = info.get("thumbnails") or []
    if thumbnails:
        return thumbnails[-1].get("url", "")
    return info.get("thumbnail", "")


def get_video_url(entry: dict) -> str:
    url = entry.get("webpage_url") or entry.get("original_url") or entry.get("url") or ""
    if url.startswith("http"):
        return url

    video_id = entry.get("id") or url
    if video_id:
        return f"https://music.youtube.com/watch?v={video_id}"

    return ""


def apply_cookie_options(opts: dict) -> dict:
    if USE_BROWSER_COOKIES:
        if BROWSER_NAME not in SUPPORTED_BROWSERS:
            raise ValueError(
                f'BROWSER_NAME phai la ten trinh duyet, khong phai file cookie: "{BROWSER_NAME}". '
                'Vi du dung "chrome", "edge", hoac "firefox". '
                "Neu muon dung cookies.txt, hay dat USE_BROWSER_COOKIES = False."
            )
        opts["cookiesfrombrowser"] = (BROWSER_NAME,)
    elif COOKIE_FILE.exists():
        opts["cookiefile"] = str(COOKIE_FILE)
    else:
        print("CANH BAO: Khong thay cookies.txt. YouTube co the chan voi loi not a bot.")

    return opts


def build_playlist_ydl_opts() -> dict:
    opts = {
        "extract_flat": "in_playlist",
        "ignoreerrors": True,
        "quiet": False,
        "retries": 10,
        "sleep_interval": 2,
        "max_sleep_interval": 6,
    }
    return apply_cookie_options(opts)


def build_common_ydl_opts() -> dict:
    opts = {
        "format": "bestaudio/best",
        "ignoreerrors": True,
        "quiet": False,
        "retries": 10,
        "fragment_retries": 10,
        "sleep_interval": 2,
        "max_sleep_interval": 6,
        "download_archive": str(ARCHIVE_FILE),
        "windowsfilenames": True,
        "restrictfilenames": False,
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "128",
        }],
    }

    return apply_cookie_options(opts)


def ensure_csv_header(csv_file: Path) -> None:
    csv_file.parent.mkdir(parents=True, exist_ok=True)

    if not csv_file.exists() or csv_file.stat().st_size == 0:
        with csv_file.open("w", newline="", encoding="utf-8-sig") as file:
            writer = csv.writer(file)
            writer.writerow(CSV_HEADERS)


def print_cookie_load_help(exc: Exception) -> None:
    print("\nLOI COOKIE: yt-dlp khong doc duoc cookie dang nhap.")
    print(f"Chi tiet: {exc}")
    print("\nCach xu ly:")
    print("1. Neu dung Chrome: dong tat ca cua so Chrome roi chay lai script.")
    print("2. Neu Chrome van bi khoa cookie: mo Task Manager va tat cac tien trinh chrome.exe con chay ngam.")
    print('3. Neu dung Edge: doi BROWSER_NAME = "edge".')
    print("4. Neu muon dung cookies.txt: dat USE_BROWSER_COOKIES = False va export lai file cookies.txt day du.")
    print("")


def main():
    BASE_DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    ensure_csv_header(CSV_FILE)

    existing_keys = load_existing_csv_keys(CSV_FILE)
    playlist_opts = build_playlist_ydl_opts()
    common_opts = build_common_ydl_opts()

    total_written = 0
    total_skipped_csv = 0
    total_failed = 0
    total_seen = 0
    unique_albums = set()
    active_artists = {
        artist
        for artists_dict in PLAYLISTS.values()
        for artist, urls in artists_dict.items()
        if any(str(url).startswith("http") for url in urls)
    }

    with CSV_FILE.open("a", newline="", encoding="utf-8-sig") as csv_file:
        writer = csv.writer(csv_file)

        for genre, artists_dict in PLAYLISTS.items():
            print("\n=========================================")
            print(f"DANG XU LY THE LOAI: {genre.upper()}")
            print("=========================================")

            for main_artist, url_list in artists_dict.items():
                valid_urls = [url for url in url_list if str(url).startswith("http")]
                if not valid_urls:
                    continue

                print(f"\nDang tai va gom thu muc cho nghe si: {main_artist}")

                with yt_dlp.YoutubeDL(playlist_opts) as playlist_ydl:
                    for playlist_url in valid_urls:
                        try:
                            playlist_info = playlist_ydl.extract_info(playlist_url, download=False)
                        except CookieLoadError as exc:
                            print_cookie_load_help(exc)
                            return
                        except DownloadError as exc:
                            print(f"   LOI: Khong doc duoc playlist: {playlist_url}")
                            print(f"        {exc}")
                            total_failed += 1
                            continue

                        if not playlist_info:
                            print(f"   LOI: Playlist khong co du lieu: {playlist_url}")
                            total_failed += 1
                            continue

                        entries = playlist_info.get("entries") or [playlist_info]

                        for entry in entries:
                            if not entry:
                                total_failed += 1
                                continue

                            video_url = get_video_url(entry)
                            if not video_url:
                                total_failed += 1
                                continue

                            total_seen += 1

                            try:
                                with yt_dlp.YoutubeDL(common_opts) as metadata_ydl:
                                    info = metadata_ydl.extract_info(video_url, download=False)
                            except CookieLoadError as exc:
                                print_cookie_load_help(exc)
                                return
                            except DownloadError as exc:
                                print(f"   LOI: Bi chan hoac khong lay duoc metadata: {video_url}")
                                print(f"        {exc}")
                                total_failed += 1
                                continue

                            if not info:
                                print(f"   LOI: Khong lay duoc metadata: {video_url}")
                                total_failed += 1
                                continue

                            title = info.get("track") or info.get("title") or "Unknown Title"
                            original_artist = info.get("artist") or info.get("uploader") or "Unknown Artist"
                            album = info.get("album") or playlist_info.get("title") or "Single"
                            yt_url = info.get("webpage_url") or video_url
                            cover_url = get_best_cover_url(info)

                            safe_artist = safe_path_part(main_artist, "Unknown Artist")
                            safe_album = safe_path_part(album, "Single")
                            safe_title = safe_path_part(title, "Unknown Title")

                            relative_file_path = f"{safe_artist}/{safe_album}/{safe_title}.mp3"
                            final_mp3_path = BASE_DOWNLOAD_DIR / safe_artist / safe_album / f"{safe_title}.mp3"

                            if yt_url in existing_keys or relative_file_path in existing_keys:
                                print(f"   BO QUA CSV TRUNG: {title}")
                                total_skipped_csv += 1
                                continue

                            song_opts = dict(common_opts)
                            song_opts["outtmpl"] = str(final_mp3_path.with_suffix(".%(ext)s"))

                            with yt_dlp.YoutubeDL(song_opts) as song_ydl:
                                result_code = song_ydl.download([yt_url])

                            if result_code != 0:
                                print(f"   LOI: yt-dlp tai that bai: {yt_url}")
                                total_failed += 1
                                continue

                            if not final_mp3_path.exists():
                                print(f"   LOI: Khong tim thay file sau khi tai: {final_mp3_path}")
                                total_failed += 1
                                continue

                            writer.writerow([
                                title,
                                main_artist,
                                original_artist,
                                album,
                                genre,
                                yt_url,
                                cover_url,
                                relative_file_path,
                            ])
                            csv_file.flush()

                            existing_keys.add(yt_url)
                            existing_keys.add(relative_file_path)
                            total_written += 1

                            if album and album != "Single":
                                unique_albums.add((main_artist, album.strip()))

                            print(f"   DA GHI: {title} - {relative_file_path}")

    print("\n=======================================================")
    print("BAO CAO THONG KE DATASET DOT NAY")
    print("=======================================================")
    print(f"Tong so bai da quet tu playlist: {total_seen}")
    print(f"Tong so bai moi ghi CSV: {total_written}")
    print(f"So bai bo qua do trung CSV: {total_skipped_csv}")
    print(f"So loi/khong tai duoc: {total_failed}")
    print(f"So luong nghe si main dang bat: {len(active_artists)}")
    print(f"So luong album boc tach dot nay: {len(unique_albums)}")
    print(f"Thu muc nhac: {BASE_DOWNLOAD_DIR}")
    print(f"CSV dataset: {CSV_FILE}")
    print("=======================================================\n")


if __name__ == "__main__":
    main()
