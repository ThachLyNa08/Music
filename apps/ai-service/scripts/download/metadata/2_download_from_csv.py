import csv
import html
import os
import re
import shutil
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import yt_dlp


PROJECT_ROOT = Path(__file__).resolve().parents[5]
UPLOADS_DIR = PROJECT_ROOT / "apps" / "backend" / "uploads"
CSV_FILE = UPLOADS_DIR / "music" / "nct_metadata_pending.csv"
FINAL_SONGS_DIR = UPLOADS_DIR / "music" / "final_songs"

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "vi,en-US;q=0.9,en;q=0.8",
}


def get_market_folder(market):
    market_upper = str(market or "").upper()
    if market_upper == "KPOP":
        return "Kpop"
    if market_upper == "VPOP":
        return "Vpop"
    if market_upper == "USUK":
        return "USUK"
    return "Other"


def clean_relative_path(value):
    path = str(value or "").strip().replace("\\", "/")
    while path.startswith("/"):
        path = path[1:]

    if path.lower().startswith("uploads/"):
        path = path[len("uploads/"):]

    return path


def normalize_audio_url(row):
    file_path = clean_relative_path(row.get("File_Path") or "")
    market_folder = get_market_folder(row.get("Market"))

    if file_path:
        lower_path = file_path.lower()
        if lower_path.startswith("music/final_songs/"):
            return f"/uploads/{file_path}"
        if lower_path.startswith("final_songs/"):
            return f"/uploads/music/{file_path}"
        if lower_path.startswith(("kpop/", "vpop/", "usuk/", "other/")):
            return f"/uploads/music/final_songs/{file_path}"
        return f"/uploads/music/final_songs/{market_folder}/{file_path}"

    audio_url = str(row.get("Audio_URL") or "").strip().replace("\\", "/")
    if audio_url.startswith("/uploads/"):
        return audio_url
    if audio_url.startswith("uploads/"):
        return f"/{audio_url}"
    if audio_url.startswith("music/"):
        return f"/uploads/{audio_url}"
    return audio_url


def resolve_save_path(row):
    raw_file_path = row.get("File_Path") or ""
    file_path = clean_relative_path(raw_file_path)
    market_folder = get_market_folder(row.get("Market"))

    if not file_path:
        title = sanitize_path_part(row.get("Title") or "Unknown Title")
        artist = sanitize_path_part(row.get("Main_Artist") or row.get("Original_Artist") or "Unknown Artist")
        album = sanitize_path_part(row.get("Album") or "Single")
        file_path = f"{artist}/{album}/{title}.mp3"

    lower_path = file_path.lower()

    if lower_path.startswith("music/final_songs/"):
        full_path = UPLOADS_DIR / Path(file_path)
    elif lower_path.startswith("final_songs/"):
        full_path = UPLOADS_DIR / "music" / Path(file_path)
    elif lower_path.startswith(("kpop/", "vpop/", "usuk/", "other/")):
        full_path = FINAL_SONGS_DIR / Path(file_path)
    else:
        full_path = FINAL_SONGS_DIR / market_folder / Path(file_path)

    return full_path


def write_csv(rows, headers):
    if "Audio_URL" not in headers:
        headers.append("Audio_URL")
    if "Download_Status" not in headers:
        headers.append("Download_Status")

    try:
        with CSV_FILE.open("w", newline="", encoding="utf-8-sig") as file:
            writer = csv.DictWriter(file, fieldnames=headers)
            writer.writeheader()
            for row in rows:
                writer.writerow({header: row.get(header, "") for header in headers})
        return True
    except PermissionError as exc:
        print(f"warning: khong ghi duoc CSV status tu Python: {exc}")
        print("warning: hay chay ben apps/backend:")
        print("  node scripts/maintenance/updateMetadataDownloadStatus.js --file=uploads/music/nct_metadata_pending.csv")
        return False


def mark_row(row, status):
    row["Audio_URL"] = normalize_audio_url(row)
    row["Download_Status"] = status


def sanitize_path_part(value):
    text = str(value or "Unknown").strip()
    text = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", text)
    text = re.sub(r"\s+", " ", text).strip(" .")
    return text or "Unknown"


def get_source_url(row):
    return (row.get("Source_URL") or row.get("YouTube_URL") or "").strip()


def get_title(row):
    return row.get("Title") or row.get("title") or "Unknown Title"


def get_artist(row):
    return (
        row.get("Original_Artist")
        or row.get("Main_Artist")
        or row.get("Artist")
        or "Unknown Artist"
    )


def is_nhaccuatui_url(url):
    return "nhaccuatui.com" in url.lower()


def fetch_text(url, timeout=25):
    request = Request(url, headers=REQUEST_HEADERS)
    with urlopen(request, timeout=timeout) as response:
        raw = response.read()
        charset = response.headers.get_content_charset() or "utf-8"
        return raw.decode(charset, errors="replace")


def find_nct_mp3_url(source_url):
    page_html = html.unescape(fetch_text(source_url))
    matches = re.findall(r"https?://[^\"'<>\\\s]+?\.mp3\?[^\"'<>\\\s]+", page_html)
    if not matches:
        return ""

    non_hq = [url for url in matches if "_hq.mp3" not in url.lower()]
    candidates = non_hq or matches

    # Keep the stream URL, not the download URL, when both are present.
    stream_urls = [url for url in candidates if "download=true" not in url.lower()]
    return (stream_urls or candidates)[0]


def download_direct_mp3(source_url, full_save_path):
    stream_url = find_nct_mp3_url(source_url)
    if not stream_url:
        print("  failed: khong tim thay stream mp3 tren trang NhacCuaTui")
        return 1

    request = Request(stream_url, headers=REQUEST_HEADERS)
    temp_path = full_save_path.with_suffix(full_save_path.suffix + ".part")

    try:
        with urlopen(request, timeout=60) as response, temp_path.open("wb") as output:
            shutil.copyfileobj(response, output)
        temp_path.replace(full_save_path)
        return 0
    except (HTTPError, URLError, TimeoutError, OSError) as exc:
        if temp_path.exists():
            temp_path.unlink(missing_ok=True)
        print(f"  failed: loi tai truc tiep tu NhacCuaTui: {exc}")
        return 1


def download_with_ytdlp(source_url, full_save_path):
    ydl_opts = {
        "format": "bestaudio/best",
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "128",
        }],
        "outtmpl": str(full_save_path.with_suffix(".%(ext)s")),
        "quiet": False,
        "ignoreerrors": True,
        "no_warnings": False,
        "overwrites": False,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            return ydl.download([source_url])
    except Exception as exc:
        message = str(exc)
        if "Sign in to confirm" in message or "not a bot" in message:
            print("  failed: YouTube chan dang nhap/not a bot. Hay cap nhat cookie va chay lai.")
        else:
            print(f"  failed: loi yt-dlp: {exc}")
        return 1


def download_audio(source_url, full_save_path):
    if is_nhaccuatui_url(source_url):
        return download_direct_mp3(source_url, full_save_path)
    return download_with_ytdlp(source_url, full_save_path)


def main():
    print("BAT DAU BUOC 2: TAI FILE AM THANH TU CSV METADATA...")

    if not CSV_FILE.exists():
        print(f"failed: Khong tim thay CSV: {CSV_FILE}")
        return

    with CSV_FILE.open("r", newline="", encoding="utf-8-sig") as file:
        reader = csv.DictReader(file)
        rows = list(reader)
        headers = list(reader.fieldnames or [])

    total_rows = len(rows)
    success_count = 0
    skip_count = 0
    missing_url_count = 0
    failed_count = 0

    for index, row in enumerate(rows, start=1):
        title = get_title(row)
        artist = get_artist(row)
        source_url = get_source_url(row)
        full_save_path = resolve_save_path(row)

        print("\n----------------------------------------")
        print(f"[{index}/{total_rows}] title: {title}")
        print(f"artist: {artist}")
        print(f"source_url: {source_url or '(missing)'}")
        print(f"full_save_path: {full_save_path}")

        if not source_url:
            print("status: failed - thieu Source_URL/YouTube_URL")
            mark_row(row, "failed")
            missing_url_count += 1
            continue

        os.makedirs(full_save_path.parent, exist_ok=True)

        if full_save_path.exists():
            print("status: skipped - da co file, bo qua")
            mark_row(row, "downloaded")
            skip_count += 1
            continue

        error_code = download_audio(source_url, full_save_path)

        if error_code == 0 and full_save_path.exists():
            print("status: downloaded")
            mark_row(row, "downloaded")
            success_count += 1
        else:
            print("status: failed - yt-dlp/direct download khong tao ra file mp3")
            mark_row(row, "failed")
            failed_count += 1

        time.sleep(1)

    write_csv(rows, headers)

    print("\n==================================================")
    print("TONG KET BUOC 2")
    print("==================================================")
    print(f"Tong dong CSV              : {total_rows}")
    print(f"Tai thanh cong             : {success_count}")
    print(f"Bo qua vi da co file       : {skip_count}")
    print(f"Loi do thieu URL           : {missing_url_count}")
    print(f"Loi tai that bai           : {failed_count}")
    print("==================================================")


if __name__ == "__main__":
    main()
