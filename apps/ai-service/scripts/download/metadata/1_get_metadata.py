import csv
import html
import json
import re
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


PROJECT_ROOT = Path(__file__).resolve().parents[5]
BACKEND_UPLOADS_DIR = PROJECT_ROOT / "apps" / "backend" / "uploads"
CSV_FILE = BACKEND_UPLOADS_DIR / "music" / "nct_metadata_pending1.csv"
CSV_FILE.parent.mkdir(parents=True, exist_ok=True)

# Keep this structure: Genre -> Main artist -> list of NhacCuaTui URLs.
# URLs may be album, playlist, or song pages if they expose Nuxt metadata.
PLAYLISTS = {
    "VPOP-GENZ": {
        "Orange": [
            "https://www.nhaccuatui.com/album/HXtYgWPtHcPT",
        ],
    }
}

CSV_HEADERS = [
    "Title",
    "Main_Artist",
    "Original_Artist",
    "Album",
    "Genre",
    "Market",
    "Duration_Sec",
    "Source",
    "Source_ID",
    "Source_URL",
    "Cover_URL",
    "File_Path",
    "Audio_URL",
    "Download_Status",
]

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "vi,en-US;q=0.9,en;q=0.8",
}


def get_market_info(genre):
    genre_lower = genre.lower()
    if "kpop" in genre_lower:
        return "KPOP", "Kpop"
    if "vpop" in genre_lower or "v-pop" in genre_lower:
        return "VPOP", "Vpop"
    if "usuk" in genre_lower or "us-uk" in genre_lower:
        return "USUK", "USUK"
    return "OTHER", "Other"


def sanitize_filename(name):
    value = str(name or "Unknown").strip()
    value = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", value)
    value = re.sub(r"\s+", " ", value).strip(" .")
    return value or "Unknown"


def fetch_html(url, timeout=25):
    request = Request(url, headers=REQUEST_HEADERS)
    with urlopen(request, timeout=timeout) as response:
        raw = response.read()
        charset = response.headers.get_content_charset() or "utf-8"
        return raw.decode(charset, errors="replace")


def extract_nuxt_payload(page_html):
    match = re.search(
        r'<script[^>]+id=["\']__NUXT_DATA__["\'][^>]*>(.*?)</script>',
        page_html,
        flags=re.DOTALL | re.IGNORECASE,
    )
    if not match:
        raise ValueError("Khong tim thay __NUXT_DATA__ trong HTML.")
    return json.loads(html.unescape(match.group(1)))


def make_payload_reader(payload):
    cache = {}

    def read_index(index):
        if index < 0:
            return None
        if index in cache:
            return cache[index]

        raw = payload[index]
        if isinstance(raw, dict):
            value = {}
            cache[index] = value
            for key, item in raw.items():
                value[key] = read_value(item)
            return value

        if isinstance(raw, list):
            if raw and isinstance(raw[0], str) and raw[0] in {"Reactive", "ShallowReactive", "Ref"}:
                return read_value(raw[1]) if len(raw) > 1 else None

            value = []
            cache[index] = value
            value.extend(read_value(item) for item in raw)
            return value

        cache[index] = raw
        return raw

    def read_value(value):
        if isinstance(value, int):
            return read_index(value)
        return value

    return read_index, read_value


def extract_source_key(url):
    match = re.search(r"/(?:album|playlist|song)/([^/?#]+)", url)
    return match.group(1) if match else ""


def find_detail_object(payload, source_key):
    read_index, _ = make_payload_reader(payload)

    # In Nuxt data, detail records are usually stored at data.dataDetail:<key>.
    for raw in payload:
        if not isinstance(raw, dict):
            continue
        for key, value in raw.items():
            if key == f"dataDetail:{source_key}" and isinstance(value, int):
                return read_index(value)

    # Fallback: scan for an object whose key equals the source key.
    for index, raw in enumerate(payload):
        if isinstance(raw, dict) and raw.get("key") is not None:
            try:
                item = read_index(index)
            except RecursionError:
                continue
            if isinstance(item, dict) and item.get("key") == source_key:
                return item

    return None


def choose_audio_url(song):
    streams = song.get("streamURL") or []
    if not isinstance(streams, list):
        return ""

    normal_streams = [item for item in streams if isinstance(item, dict) and not item.get("onlyVIP")]
    candidates = normal_streams or [item for item in streams if isinstance(item, dict)]
    if not candidates:
        return ""

    # Prefer highest non-VIP quality by order; NCT often uses order 55/60 for mp3.
    best = sorted(candidates, key=lambda item: item.get("order") or 0, reverse=True)[0]
    return best.get("stream") or best.get("download") or ""


def normalize_detail_to_songs(detail, source_url):
    if not detail:
        return []

    album_name = detail.get("name") or "Single"
    album_cover = detail.get("image") or ""
    songs = detail.get("listSong") or []

    # Song pages can expose the song itself instead of listSong.
    if not songs and detail.get("key") and detail.get("linkShare"):
        songs = [detail]
        album_name = detail.get("albumName") or "Single"

    normalized = []
    for song in songs:
        if not isinstance(song, dict):
            continue

        normalized.append({
            "source_id": song.get("key") or "",
            "title": song.get("name") or "Unknown Title",
            "artist": song.get("artistName") or detail.get("artistName") or "Unknown Artist",
            "album": album_name,
            "duration": song.get("duration") or 0,
            "source_url": song.get("linkShare") or source_url,
            "cover_url": song.get("image") or song.get("imageShare") or album_cover,
            "audio_url": choose_audio_url(song),
        })

    return normalized


def scrape_nhaccuatui(url):
    page_html = fetch_html(url)
    payload = extract_nuxt_payload(page_html)
    source_key = extract_source_key(url)
    detail = find_detail_object(payload, source_key)
    return normalize_detail_to_songs(detail, url)


def load_existing_ids(csv_file):
    if not csv_file.exists():
        return set()

    existing_ids = set()
    with csv_file.open("r", newline="", encoding="utf-8-sig") as file:
        for row in csv.DictReader(file):
            source_id = (row.get("Source_ID") or "").strip()
            if source_id:
                existing_ids.add(source_id)
    return existing_ids


def ensure_csv_header(csv_file):
    if not csv_file.exists() or csv_file.stat().st_size == 0:
        with csv_file.open("w", newline="", encoding="utf-8-sig") as file:
            csv.writer(file).writerow(CSV_HEADERS)


def main():
    print("BAT DAU BUOC 1: CAO METADATA TU NHACCUATUI...")
    stats = {"found": 0, "written": 0, "duplicate": 0, "failed": 0}

    ensure_csv_header(CSV_FILE)
    existing_ids = load_existing_ids(CSV_FILE)

    with CSV_FILE.open("a", newline="", encoding="utf-8-sig") as file:
        writer = csv.writer(file)

        for genre, artists_dict in PLAYLISTS.items():
            market_db, folder_market = get_market_info(genre)

            for main_artist, url_list in artists_dict.items():
                valid_urls = [url for url in url_list if str(url).startswith("http")]

                for url in valid_urls:
                    print(f"\nDang quet: {url}")

                    try:
                        songs = scrape_nhaccuatui(url)
                    except (HTTPError, URLError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
                        print(f"  LOI: Khong lay duoc thong tin: {exc}")
                        stats["failed"] += 1
                        continue

                    if not songs:
                        print("  LOI: Trang co HTML nhung khong tim thay bai hat trong payload.")
                        stats["failed"] += 1
                        continue

                    for song in songs:
                        stats["found"] += 1
                        source_id = song["source_id"]
                        title = song["title"]

                        if source_id in existing_ids:
                            print(f"  BO QUA TRUNG: {title}")
                            stats["duplicate"] += 1
                            continue

                        safe_title = sanitize_filename(title)
                        safe_album = sanitize_filename(song["album"])
                        safe_artist = sanitize_filename(main_artist)

                        file_path = f"{safe_artist}/{safe_album}/{safe_title}.mp3"
                        local_audio_url = f"/uploads/music/final_songs/{folder_market}/{file_path}"

                        writer.writerow([
                            title,
                            main_artist,
                            song["artist"],
                            song["album"],
                            genre,
                            market_db,
                            song["duration"],
                            "nhaccuatui",
                            source_id,
                            song["source_url"],
                            song["cover_url"],
                            file_path,
                            local_audio_url,
                            "pending",
                        ])
                        file.flush()

                        existing_ids.add(source_id)
                        stats["written"] += 1
                        print(f"  DA LUU: {title} - {song['artist']}")

                    time.sleep(1)

    print(
        "\nXONG! "
        f"TIM THAY: {stats['found']} | "
        f"LUU MOI: {stats['written']} | "
        f"BO QUA TRUNG: {stats['duplicate']} | "
        f"LOI: {stats['failed']}"
    )


if __name__ == "__main__":
    main()
