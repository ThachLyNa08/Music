#!/usr/bin/env python
import argparse
import csv
import json
import math
import os
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import mysql.connector
import numpy as np
import pandas as pd
from tqdm import tqdm

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = PROJECT_ROOT / "apps" / "backend"
AUDIO_ROOT = PROJECT_ROOT / "apps" / "backend" / "uploads" / "music" / "final_songs"
AUDIO_MARKET_DIRS = {
    "KPOP": AUDIO_ROOT / "Kpop",
    "USUK": AUDIO_ROOT / "USUK",
    "VPOP": AUDIO_ROOT / "Vpop",
}
OUTPUT_DIR = PROJECT_ROOT / "datasets" / "processed" / "audio_features"
SUPPORTED_EXTENSIONS = {".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg"}
ENSEMBLE_ANALYSIS_VERSION = "essentia_librosa_ensemble_v1"
LIBROSA_FALLBACK_VERSION = "librosa_fallback_v1"
MAX_ANALYSIS_SECONDS = 75.0
TARGET_SAMPLE_RATE = 22050
RECOMPUTED_CSV = OUTPUT_DIR / "audio_features_recomputed.csv"
SUMMARY_JSON = OUTPUT_DIR / "audio_features_audit_summary.json"
BEFORE_AFTER_CSV = OUTPUT_DIR / "audio_features_before_after.csv"
MISSING_CSV = OUTPUT_DIR / "missing_audio_files.csv"


def load_env_file(path):
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def db_connect():
    load_env_file(PROJECT_ROOT / ".env")
    load_env_file(BACKEND_DIR / ".env")
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "3306")),
        database=os.getenv("DB_NAME", "musicflow"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
    )


def clamp01(x):
    try:
        n = float(x)
    except Exception:
        return 0.0
    if not math.isfinite(n):
        return 0.0
    return max(0.0, min(1.0, n))


def normalize01(value):
    if value is None:
        return None
    try:
        n = float(value)
    except Exception:
        return None
    if not math.isfinite(n):
        return None
    return clamp01(n / 100.0 if n > 1 else n)


def normalize_market(value):
    raw = str(value or "").strip().lower()
    if raw in ["kpop", "k-pop", "ko", "kr"]:
        return "KPOP"
    if raw in ["vpop", "v-pop", "vn", "vi"]:
        return "VPOP"
    if raw in ["usuk", "us-uk", "us uk", "english", "en"]:
        return "USUK"
    return raw.upper() if raw else None


def normalize_bpm_range(bpm):
    if bpm is None:
        return None
    bpm = float(bpm)
    if not math.isfinite(bpm) or bpm <= 0:
        return None
    while bpm < 60:
        bpm *= 2
    while bpm > 180:
        bpm /= 2
    return bpm


def choose_final_bpm(values):
    valid = []
    for value in values:
        if value is None:
            continue
        try:
            value = float(value)
        except Exception:
            continue
        if value <= 0 or not math.isfinite(value):
            continue
        normalized = normalize_bpm_range(value)
        if normalized:
            valid.append(normalized)

    if not valid:
        return None, 0.0, "none"

    median = float(np.median(valid))
    close = [v for v in valid if abs(v - median) <= 6]
    if len(close) >= 2:
        return float(np.median(close)), min(1.0, 0.6 + 0.15 * len(close)), "ensemble"
    return float(valid[0]), 0.45, "single_source"


def get_tempo_level(bpm):
    if bpm is None:
        return "unknown"
    bpm = float(bpm)
    if bpm < 90:
        return "slow"
    if bpm <= 120:
        return "medium"
    return "fast"


def compute_energy_score(features):
    rms_norm = features.get("rms_norm", 0)
    onset_norm = features.get("onset_strength_norm", 0)
    brightness_norm = features.get("brightness", 0)
    danceability_norm = features.get("danceability", 0)
    loudness_norm = features.get("loudness_norm", 0)
    energy = (
        0.35 * rms_norm
        + 0.20 * onset_norm
        + 0.20 * brightness_norm
        + 0.15 * danceability_norm
        + 0.10 * loudness_norm
    )
    return clamp01(energy)


def calibrate_energy_score(base_energy_score, bpm, danceability, acoustic_score, brightness, loudness, dynamic_complexity):
    fast_tempo_bonus = 0.05 if bpm is not None and float(bpm) > 120 else 0.0
    slow_tempo_penalty = 0.07 if bpm is not None and float(bpm) < 90 else 0.0
    calibrated = (
        0.43
        + (clamp01(base_energy_score) - 0.58) * 1.75
        + clamp01(brightness) * 0.13
        + clamp01(danceability) * 0.06
        + clamp01(loudness) * 0.04
        + clamp01(dynamic_complexity) * 0.07
        - clamp01(acoustic_score) * 0.17
        + fast_tempo_bonus
        - slow_tempo_penalty
    )
    return clamp01(calibrated)


def compute_study_suitability_score(energy_score, bpm, danceability, acoustic_score, brightness):
    if bpm is None:
        tempo_fit = 0.5
    elif bpm < 90:
        tempo_fit = 1.0
    elif bpm <= 120:
        tempo_fit = 0.75
    else:
        tempo_fit = 0.15

    score = (
        0.35 * (1 - energy_score)
        + 0.25 * tempo_fit
        + 0.15 * acoustic_score
        + 0.15 * (1 - brightness)
        + 0.10 * (1 - danceability)
    )
    return clamp01(score)


def compute_calm_fit_score(energy_score, bpm, danceability, acoustic_score, brightness, dynamic_complexity):
    if bpm is None:
        tempo_fit = 0.5
    elif bpm < 90:
        tempo_fit = 1.0
    elif bpm <= 120:
        tempo_fit = 0.8
    else:
        tempo_fit = 0.2
    return clamp01(
        0.32 * (1 - energy_score)
        + 0.24 * tempo_fit
        + 0.18 * acoustic_score
        + 0.14 * (1 - brightness)
        + 0.07 * (1 - danceability)
        + 0.05 * (1 - dynamic_complexity)
    )


def table_columns(cursor, table_name):
    cursor.execute(f"SHOW COLUMNS FROM {table_name}")
    return {row[0] for row in cursor.fetchall()}


def build_audio_file_index():
    index = {}
    for file_path in AUDIO_ROOT.rglob("*"):
        if file_path.is_file() and file_path.suffix.lower() in SUPPORTED_EXTENSIONS:
            index[file_path.name.lower()] = file_path
            index[file_path.stem.lower()] = file_path
    return index


def candidate_backend_upload_path(audio_url):
    raw = str(audio_url or "").strip().replace("\\", "/")
    if not raw:
        return None
    if raw.startswith("/uploads/"):
        return BACKEND_DIR / raw.lstrip("/")
    if raw.startswith("uploads/"):
        return BACKEND_DIR / raw
    return None


def resolve_audio_path(song, audio_index):
    audio_url = song.get("audio_url") or ""
    market = normalize_market(song.get("market"))
    candidates = []

    direct_upload = candidate_backend_upload_path(audio_url)
    if direct_upload:
        candidates.append(direct_upload)

    if audio_url:
        filename = Path(audio_url.replace("\\", "/")).name
        if market in AUDIO_MARKET_DIRS:
            candidates.append(AUDIO_MARKET_DIRS[market] / filename)
        candidates.append(AUDIO_ROOT / filename)
        for subdir in AUDIO_MARKET_DIRS.values():
            candidates.append(subdir / filename)
        if filename.lower() in audio_index:
            candidates.append(audio_index[filename.lower()])
        stem = Path(filename).stem.lower()
        if stem in audio_index:
            candidates.append(audio_index[stem])

    for key in ["audio_path", "file_path", "local_path"]:
        value = song.get(key)
        if value:
            p = Path(value)
            candidates.append(p)
            candidates.append(PROJECT_ROOT / value)

    seen = set()
    for path in candidates:
        if not path:
            continue
        key = str(path).lower()
        if key in seen:
            continue
        seen.add(key)
        if path.exists() and path.is_file():
            return path
    return None


def expected_audio_path(song):
    audio_url = song.get("audio_url") or ""
    market = normalize_market(song.get("market"))
    filename = Path(audio_url.replace("\\", "/")).name
    if market in AUDIO_MARKET_DIRS and filename:
        return str(AUDIO_MARKET_DIRS[market] / filename)
    if filename:
        return str(AUDIO_ROOT / filename)
    return ""


def fetch_songs(cursor, limit=None):
    song_cols = table_columns(cursor, "songs")
    genre_cols = table_columns(cursor, "genres")
    feature_cols = table_columns(cursor, "song_audio_features")

    status_expr = []
    if "status" in song_cols:
        status_expr.append("s.status IN ('published', 'active', 'released')")
    if "release_status" in song_cols:
        status_expr.append("s.release_status = 'published'")
    if "is_active" in song_cols:
        status_expr.append("s.is_active = 1")
    if "review_status" in song_cols:
        status_expr.append("s.review_status = 'approved'")

    optional_song_cols = [c for c in ["audio_path", "file_path", "local_path"] if c in song_cols]
    select_parts = [
        "s.id",
        "s.title",
        "s.audio_url",
        "a.name AS artist_name",
        "g.name AS genre_name",
        "COALESCE(g.market, s.market) AS market",
        "s.release_status" if "release_status" in song_cols else "NULL AS release_status",
        "s.is_active" if "is_active" in song_cols else "NULL AS is_active",
        "s.review_status" if "review_status" in song_cols else "NULL AS review_status",
    ]
    select_parts.extend([f"s.{c}" for c in optional_song_cols])

    old_cols = {
        "bpm_old": "bpm",
        "tempo_level_old": "tempo_level",
        "energy_score_old": "energy_score",
    }
    for alias, col in old_cols.items():
        select_parts.append(f"f.{col} AS {alias}" if col in feature_cols else f"NULL AS {alias}")

    where = ["s.audio_url IS NOT NULL", "TRIM(s.audio_url) <> ''"]
    where.extend(status_expr)
    sql = f"""
        SELECT {", ".join(select_parts)}
        FROM songs s
        LEFT JOIN artists a ON a.id = s.artist_id
        LEFT JOIN genres g ON g.id = s.genre_id
        LEFT JOIN song_audio_features f ON f.song_id = s.id
        WHERE {" AND ".join(where)}
        ORDER BY s.id ASC
    """
    params = []
    if limit:
        sql += " LIMIT %s"
        params.append(int(limit))
    cursor.execute(sql, params)
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def load_audio_segment(path):
    import librosa

    try:
        duration = librosa.get_duration(path=str(path))
    except Exception:
        duration = None
    offset = 0.0
    clip_duration = MAX_ANALYSIS_SECONDS
    if duration and duration > MAX_ANALYSIS_SECONDS + 45:
        offset = min(30.0, max(0.0, (duration - MAX_ANALYSIS_SECONDS) / 2.0))
    y, sr = librosa.load(str(path), sr=TARGET_SAMPLE_RATE, mono=True, offset=offset, duration=clip_duration)
    if y.size == 0:
        raise ValueError("empty audio signal")
    return y, sr


def tempo_stability(intervals):
    arr = np.asarray(intervals, dtype=float)
    arr = arr[np.isfinite(arr)]
    if arr.size < 2:
        return 0.5
    mean = float(np.mean(arr))
    if mean <= 0:
        return 0.5
    return clamp01(1.0 - float(np.std(arr) / mean))


def try_essentia_bpm(path):
    try:
        import essentia.standard as es
    except Exception:
        return None, None
    try:
        audio = es.MonoLoader(filename=str(path), sampleRate=44100)()
        rhythm = es.RhythmExtractor2013(method="multifeature")
        bpm, _, confidence, _, _ = rhythm(audio)
        return float(bpm), clamp01(confidence)
    except Exception:
        return None, None


def try_aubio_bpm(path):
    try:
        import aubio
    except Exception:
        return None
    try:
        source = aubio.source(str(path), 0, 512)
        samplerate = source.samplerate
        tempo = aubio.tempo("default", 1024, 512, samplerate)
        beats = []
        while True:
            samples, read = source()
            if tempo(samples):
                beats.append(float(tempo.get_last_s()))
            if read < 512:
                break
        if len(beats) < 2:
            return None
        intervals = np.diff(beats)
        intervals = intervals[np.isfinite(intervals)]
        intervals = intervals[intervals > 0]
        if intervals.size == 0:
            return None
        return float(60.0 / np.median(intervals))
    except Exception:
        return None


def analyze_with_librosa(path):
    import librosa

    y, sr = load_audio_segment(path)
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, onset_envelope=onset_env)
    if isinstance(tempo, np.ndarray):
        tempo = float(tempo[0]) if tempo.size else None
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    beat_intervals = np.diff(beat_times) if len(beat_times) > 1 else np.array([])

    rms = librosa.feature.rms(y=y)[0]
    rms_p75 = float(np.percentile(rms, 75)) if rms.size else 0.0
    rms_db = float(20.0 * np.log10(max(rms_p75, 1e-8)))
    rms_norm = clamp01((rms_db + 55.0) / 45.0)
    loudness_norm = clamp01((rms_db + 60.0) / 60.0)

    onset_mean = float(np.nanmean(onset_env)) if onset_env.size else 0.0
    onset_p95 = float(np.nanpercentile(onset_env, 95)) if onset_env.size else 1.0
    onset_norm = clamp01(onset_mean / max(onset_p95, 1e-6) * 1.8)

    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr, roll_percent=0.85)[0]
    zcr = librosa.feature.zero_crossing_rate(y)[0]
    centroid_norm = clamp01((float(np.nanmean(centroid)) - 600.0) / 4500.0)
    rolloff_norm = clamp01((float(np.nanmean(rolloff)) - 1200.0) / 7000.0)
    brightness = clamp01(0.65 * centroid_norm + 0.35 * rolloff_norm)

    stability = tempo_stability(beat_intervals)
    beat_strength = 0.5
    if onset_env.size and len(beat_frames) > 0:
        picked = onset_env[beat_frames]
        beat_strength = clamp01(float(np.nanmean(picked)) / max(onset_p95, 1e-6))
    danceability = clamp01(0.45 * stability + 0.35 * beat_strength + 0.20 * onset_norm)

    dynamic_complexity = clamp01(float(np.nanstd(rms) / max(float(np.nanmean(rms)), 1e-8)) / 1.5) if rms.size else 0.5
    zcr_norm = clamp01(float(np.nanmean(zcr)) / 0.15) if zcr.size else 0.5
    acoustic_score = clamp01(1.0 - (0.35 * brightness + 0.25 * onset_norm + 0.20 * loudness_norm + 0.20 * zcr_norm))

    base_features = {
        "rms_norm": rms_norm,
        "onset_strength_norm": onset_norm,
        "brightness": brightness,
        "danceability": danceability,
        "loudness_norm": loudness_norm,
    }
    raw_energy_score = compute_energy_score(base_features)
    # Modern pop masters are loud by construction; keep loudness useful without
    # letting it turn every KPOP/USUK pop track into "high energy".
    energy_score = clamp01(raw_energy_score * 0.82 - acoustic_score * 0.08 + dynamic_complexity * 0.04)

    return {
        "bpm_librosa": float(tempo) if tempo and math.isfinite(float(tempo)) else None,
        "tempo_stability": stability,
        "energy_score": energy_score,
        "danceability": danceability,
        "acoustic_score": acoustic_score,
        "brightness": brightness,
        "loudness": loudness_norm,
        "loudness_db": rms_db,
        "dynamic_complexity": dynamic_complexity,
        "rms_norm": rms_norm,
        "onset_strength_norm": onset_norm,
        "raw_energy_score": raw_energy_score,
        "feature_source": "librosa_fallback",
    }


def analyze_audio(path):
    bpm_essentia, essentia_confidence = try_essentia_bpm(path)
    bpm_aubio = try_aubio_bpm(path)
    features = analyze_with_librosa(path)
    final_bpm, bpm_confidence, bpm_source = choose_final_bpm([
        bpm_essentia,
        features.get("bpm_librosa"),
        bpm_aubio,
    ])
    if essentia_confidence:
        bpm_confidence = max(bpm_confidence, essentia_confidence)
    tempo_level = get_tempo_level(final_bpm)
    base_energy = features["energy_score"]
    danceability = features["danceability"]
    acoustic = features["acoustic_score"]
    brightness = features["brightness"]
    dynamic = features["dynamic_complexity"]
    loudness = features["loudness"]
    energy = calibrate_energy_score(base_energy, final_bpm, danceability, acoustic, brightness, loudness, dynamic)
    optional_sources_used = bool(bpm_essentia or bpm_aubio)
    analysis_version = ENSEMBLE_ANALYSIS_VERSION if optional_sources_used else LIBROSA_FALLBACK_VERSION
    feature_source = "essentia_librosa_ensemble" if optional_sources_used else "librosa_fallback"
    return {
        **features,
        "feature_source": feature_source,
        "bpm_essentia": bpm_essentia,
        "bpm_librosa": features.get("bpm_librosa"),
        "bpm_aubio": bpm_aubio,
        "bpm_new": round(final_bpm, 2) if final_bpm is not None else None,
        "bpm_confidence": round(float(bpm_confidence), 4),
        "bpm_source": bpm_source,
        "tempo_level_new": tempo_level,
        "energy_score_new": round(energy, 4),
        "danceability": round(danceability, 4),
        "acoustic_score": round(acoustic, 4),
        "brightness": round(brightness, 4),
        "loudness": round(features["loudness"], 4),
        "dynamic_complexity": round(dynamic, 4),
        "study_suitability_score": round(compute_study_suitability_score(energy, final_bpm, danceability, acoustic, brightness), 4),
        "calm_fit_score": round(compute_calm_fit_score(energy, final_bpm, danceability, acoustic, brightness, dynamic), 4),
        "analysis_version": analysis_version,
        "error": "",
    }


def energy_label(score):
    value = normalize01(score)
    if value is None:
        return None
    if value < 0.4:
        return "low"
    if value < 0.7:
        return "medium"
    return "high"


def ensure_output_dir():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def write_csv(path, rows, fieldnames):
    ensure_output_dir()
    with path.open("w", newline="", encoding="utf-8-sig") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def read_csv_rows(path):
    if not path.exists() or path.stat().st_size == 0:
        return []
    with path.open("r", newline="", encoding="utf-8-sig") as fh:
        return list(csv.DictReader(fh))


def summarize(rows, missing_rows, total_songs):
    by_market = defaultdict(lambda: {"found": 0, "missing": 0, "errors": 0})
    energy_before = defaultdict(int)
    energy_dist = defaultdict(int)
    tempo_dist = defaultdict(int)
    for row in rows:
        market = normalize_market(row.get("market")) or "UNKNOWN"
        energy_before[f"{market}:{energy_label(row.get('energy_score_old')) or 'unknown'}"] += 1
        if row.get("error"):
            by_market[market]["errors"] += 1
        else:
            by_market[market]["found"] += 1
            energy_dist[f"{market}:{energy_label(row.get('energy_score_new')) or 'unknown'}"] += 1
            tempo_dist[f"{market}:{row.get('tempo_level_new') or 'unknown'}"] += 1
    for row in missing_rows:
        market = normalize_market(row.get("market")) or "UNKNOWN"
        by_market[market]["missing"] += 1
    return {
        "analysis_version": rows[0].get("analysis_version") if rows else LIBROSA_FALLBACK_VERSION,
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "total_songs": total_songs,
        "found_files": len(rows),
        "missing_files": len(missing_rows),
        "analyzed_success": sum(1 for row in rows if not row.get("error")),
        "analyzed_failed": sum(1 for row in rows if row.get("error")),
        "errors": sum(1 for row in rows if row.get("error")),
        "by_market": dict(by_market),
        "energy_distribution_before": dict(energy_before),
        "energy_distribution": dict(energy_dist),
        "tempo_distribution": dict(tempo_dist),
    }


def print_summary(summary):
    print("Total songs:", summary["total_songs"])
    print("Found files:", summary["found_files"])
    print("Missing files:", summary["missing_files"])
    print("Analyzed success:", summary["analyzed_success"])
    print("Analyzed failed:", summary["analyzed_failed"])
    for market in ["KPOP", "VPOP", "USUK"]:
        item = summary["by_market"].get(market, {})
        print(f"{market} found/missing:", item.get("found", 0), "/", item.get("missing", 0))
    print("Energy distribution before:", json.dumps(summary.get("energy_distribution_before", {}), ensure_ascii=False))
    print("Energy distribution after:", json.dumps(summary.get("energy_distribution", {}), ensure_ascii=False))
    print("Tempo distribution after:", json.dumps(summary.get("tempo_distribution", {}), ensure_ascii=False))


def print_export_audit(rows, missing_rows):
    def bucket_old(row):
        return energy_label(row.get("energy_score_old")) or "unknown"

    def bucket_new(row):
        return energy_label(row.get("energy_score_new")) or "unknown"

    successful = [row for row in rows if not row.get("error")]
    high_to_lower = [row for row in successful if bucket_old(row) == "high" and bucket_new(row) in ("medium", "low")]
    lower_to_high = [row for row in successful if bucket_old(row) in ("low", "medium") and bucket_new(row) == "high"]
    bpm_changed = []
    missing_bpm = []
    for row in successful:
        old = row.get("bpm_old")
        new = row.get("bpm_new")
        try:
            old_n = float(old)
            new_n = float(new)
        except Exception:
            if new in (None, ""):
                missing_bpm.append(row)
            continue
        diff = abs(old_n - new_n)
        if diff >= 12:
            bpm_changed.append((diff, row))
    bpm_changed.sort(key=lambda item: item[0], reverse=True)

    def print_rows(title, items, include_diff=False):
        print(f"[AudioFeature Audit] {title}: {len(items)}")
        for item in items[:30]:
            diff = None
            row = item
            if include_diff:
                diff, row = item
            suffix = f" diff={diff:.2f}" if diff is not None else ""
            print(
                f"  song_id={row.get('song_id')} market={row.get('market')} "
                f"old={row.get('energy_score_old')} new={row.get('energy_score_new')} "
                f"bpm_old={row.get('bpm_old')} bpm_new={row.get('bpm_new')} "
                f"title={row.get('title')}{suffix}"
            )

    print_rows("Top energy high -> medium/low", high_to_lower)
    print_rows("Top energy low/medium -> high", lower_to_high)
    print_rows("Top BPM changed significantly", bpm_changed, include_diff=True)
    print_rows("Songs with missing BPM", missing_bpm)
    print(f"[AudioFeature Audit] Songs with missing audio files: {len(missing_rows)}")


def ensure_apply_columns(cursor):
    feature_cols = table_columns(cursor, "song_audio_features")
    statements = []
    if "bpm_confidence" not in feature_cols:
        statements.append("ADD COLUMN bpm_confidence FLOAT NULL")
    if "bpm_source" not in feature_cols:
        statements.append("ADD COLUMN bpm_source VARCHAR(50) NULL")
    if "loudness" not in feature_cols:
        statements.append("ADD COLUMN loudness FLOAT NULL")
    if "dynamic_complexity" not in feature_cols:
        statements.append("ADD COLUMN dynamic_complexity FLOAT NULL")
    if "study_suitability_score" not in feature_cols:
        statements.append("ADD COLUMN study_suitability_score FLOAT NULL")
    if "calm_fit_score" not in feature_cols:
        statements.append("ADD COLUMN calm_fit_score FLOAT NULL")
    if "analysis_version" not in feature_cols:
        statements.append("ADD COLUMN analysis_version VARCHAR(80) NULL")
    if "analysis_updated_at" not in feature_cols:
        statements.append("ADD COLUMN analysis_updated_at DATETIME NULL")

    for statement in statements:
        cursor.execute(f"ALTER TABLE song_audio_features {statement}")
    return len(statements)


def backup_feature_table(cursor):
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_table = f"song_audio_features_backup_{stamp}"
    cursor.execute(f"CREATE TABLE {backup_table} AS SELECT * FROM song_audio_features")
    return backup_table


def apply_rows(conn, rows):
    cursor = conn.cursor()
    added_columns = ensure_apply_columns(cursor)
    backup_table = backup_feature_table(cursor)
    sql = """
        INSERT INTO song_audio_features (
            song_id, bpm, raw_bpm, normalized_bpm, tempo_level, tempo_bucket,
            bpm_confidence, bpm_source, energy_score, energy, danceability,
            danceability_score, acoustic_score, brightness, brightness_score,
            loudness, dynamic_complexity, study_suitability_score, calm_fit_score,
            analysis_version, analysis_updated_at, extractor, status, error_message,
            analyzed_at, extracted_at, created_at, updated_at
        ) VALUES (
            %(song_id)s, %(bpm_new)s, %(bpm_new)s, %(bpm_new)s, %(tempo_level_db)s, %(tempo_bucket_db)s,
            %(bpm_confidence)s, %(bpm_source)s, %(energy_score_new)s, %(energy_label)s, %(danceability)s,
            %(danceability)s, %(acoustic_score)s, %(brightness)s, %(brightness)s,
            %(loudness)s, %(dynamic_complexity)s, %(study_suitability_score)s, %(calm_fit_score)s,
            %(analysis_version)s, NOW(), %(feature_source)s, 'completed', NULL,
            NOW(), NOW(), NOW(), NOW()
        )
        ON DUPLICATE KEY UPDATE
            bpm = VALUES(bpm),
            raw_bpm = VALUES(raw_bpm),
            normalized_bpm = VALUES(normalized_bpm),
            tempo_level = VALUES(tempo_level),
            tempo_bucket = VALUES(tempo_bucket),
            bpm_confidence = VALUES(bpm_confidence),
            bpm_source = VALUES(bpm_source),
            energy_score = VALUES(energy_score),
            energy = VALUES(energy),
            danceability = VALUES(danceability),
            danceability_score = VALUES(danceability_score),
            acoustic_score = VALUES(acoustic_score),
            brightness = VALUES(brightness),
            brightness_score = VALUES(brightness_score),
            loudness = VALUES(loudness),
            dynamic_complexity = VALUES(dynamic_complexity),
            study_suitability_score = VALUES(study_suitability_score),
            calm_fit_score = VALUES(calm_fit_score),
            analysis_version = VALUES(analysis_version),
            analysis_updated_at = NOW(),
            extractor = VALUES(extractor),
            status = 'completed',
            error_message = NULL,
            analyzed_at = NOW(),
            extracted_at = NOW(),
            updated_at = NOW()
    """
    applied = 0
    numeric_columns = [
        "song_id",
        "bpm_new",
        "bpm_confidence",
        "energy_score_new",
        "danceability",
        "acoustic_score",
        "brightness",
        "loudness",
        "dynamic_complexity",
        "study_suitability_score",
        "calm_fit_score",
    ]
    for row in rows:
        if row.get("error"):
            continue
        payload = dict(row)
        for column in numeric_columns:
            value = payload.get(column)
            if value in ("", None):
                payload[column] = None
                continue
            try:
                payload[column] = int(value) if column == "song_id" else float(value)
            except Exception:
                payload[column] = None
        if not payload.get("song_id"):
            continue
        payload["feature_source"] = payload.get("feature_source") or (
            "librosa_fallback" if payload.get("analysis_version") == LIBROSA_FALLBACK_VERSION else "essentia_librosa_ensemble"
        )
        payload["analysis_version"] = payload.get("analysis_version") or LIBROSA_FALLBACK_VERSION
        payload["energy_label"] = energy_label(row.get("energy_score_new"))
        tempo_level = str(payload.get("tempo_level_new") or "").strip().lower()
        payload["tempo_level_db"] = tempo_level if tempo_level in ("slow", "medium", "fast") else None
        payload["tempo_bucket_db"] = tempo_level if tempo_level in ("slow", "medium", "fast") else "unknown"
        cursor.execute(sql, payload)
        applied += 1
    conn.commit()
    cursor.close()
    return {"backup_table": backup_table, "added_columns": added_columns, "applied": applied}


def run_distribution_queries(cursor):
    energy_sql = """
        SELECT
          COALESCE(g.market, s.market, 'UNKNOWN') AS market,
          CASE
            WHEN f.energy_score IS NULL THEN 'unknown'
            WHEN f.energy_score < 0.4 THEN 'low'
            WHEN f.energy_score < 0.7 THEN 'medium'
            ELSE 'high'
          END AS energy_bucket,
          COUNT(*) AS total
        FROM songs s
        LEFT JOIN genres g ON g.id = s.genre_id
        LEFT JOIN song_audio_features f ON f.song_id = s.id
        WHERE s.release_status = 'published'
          AND s.is_active = 1
          AND s.review_status = 'approved'
          AND s.audio_url IS NOT NULL
          AND TRIM(s.audio_url) <> ''
        GROUP BY COALESCE(g.market, s.market, 'UNKNOWN'), energy_bucket
        ORDER BY market, energy_bucket
    """
    tempo_sql = """
        SELECT
          COALESCE(g.market, s.market, 'UNKNOWN') AS market,
          COALESCE(f.tempo_level, 'unknown') AS tempo_level,
          COUNT(*) AS total
        FROM songs s
        LEFT JOIN genres g ON g.id = s.genre_id
        LEFT JOIN song_audio_features f ON f.song_id = s.id
        WHERE s.release_status = 'published'
          AND s.is_active = 1
          AND s.review_status = 'approved'
          AND s.audio_url IS NOT NULL
          AND TRIM(s.audio_url) <> ''
        GROUP BY COALESCE(g.market, s.market, 'UNKNOWN'), COALESCE(f.tempo_level, 'unknown')
        ORDER BY market, tempo_level
    """
    cursor.execute(energy_sql)
    energy_rows = cursor.fetchall()
    cursor.execute(tempo_sql)
    tempo_rows = cursor.fetchall()
    print("[AudioFeature] Energy distribution:")
    for row in energy_rows:
        print(row)
    print("[AudioFeature] Tempo distribution:")
    for row in tempo_rows:
        print(row)


def main():
    parser = argparse.ArgumentParser(description="Recompute MusicFlow audio features from real audio files.")
    scope = parser.add_mutually_exclusive_group(required=True)
    scope.add_argument("--all", action="store_true")
    scope.add_argument("--limit", type=int)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--export", action="store_true")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    if not args.dry_run and not args.export and not args.apply:
        parser.error("Choose at least one action: --dry-run, --export, or --apply")

    print("[AudioFeature] PROJECT_ROOT:", PROJECT_ROOT)
    print("[AudioFeature] AUDIO_ROOT:", AUDIO_ROOT)
    print("[AudioFeature] AUDIO_ROOT exists:", AUDIO_ROOT.exists())

    conn = db_connect()
    cursor = conn.cursor()
    csv_rows = read_csv_rows(RECOMPUTED_CSV)
    if args.apply and not args.export and not args.dry_run and csv_rows:
        songs = fetch_songs(cursor, limit=None if args.all else args.limit)
        expected_count = len(songs)
        csv_song_ids = {str(row.get("song_id")) for row in csv_rows if row.get("song_id")}
        if len(csv_rows) >= expected_count * 0.95 and len(csv_song_ids) >= expected_count * 0.95:
            missing_rows = read_csv_rows(MISSING_CSV)
            summary = summarize(csv_rows, missing_rows, expected_count)
            print("[AudioFeature] Reusing exported CSV for apply:", RECOMPUTED_CSV)
            print_summary(summary)
            print_export_audit(csv_rows, missing_rows)
            result = apply_rows(conn, csv_rows)
            print("[AudioFeature] Apply result:", json.dumps(result, ensure_ascii=False))
            run_distribution_queries(cursor)
            cursor.close()
            conn.close()
            return
        print("[AudioFeature] Existing CSV is incomplete; recomputing before apply.")

    audio_index = build_audio_file_index()
    songs = fetch_songs(cursor, limit=None if args.all else args.limit)
    print("[AudioFeature] Indexed audio files:", len(audio_index))
    print("[AudioFeature] Songs to inspect:", len(songs))

    rows = []
    missing_rows = []
    fieldnames = [
        "song_id", "title", "artist_name", "market", "audio_path",
        "bpm_old", "bpm_new", "bpm_confidence", "bpm_source",
        "tempo_level_old", "tempo_level_new",
        "energy_score_old", "energy_score_new",
        "danceability", "acoustic_score", "brightness", "loudness",
        "dynamic_complexity", "study_suitability_score", "calm_fit_score",
        "feature_source", "analysis_version", "error",
    ]

    for song in tqdm(songs, desc="Audio features"):
        song_id = int(song["id"])
        market = normalize_market(song.get("market"))
        path = resolve_audio_path(song, audio_index)
        should_log_each = args.dry_run or len(songs) <= 20
        if not path:
            if should_log_each:
                print(f"[MISSING] song_id={song_id} market={market} title={song.get('title')} audio_url={song.get('audio_url')}")
            missing_rows.append({
                "song_id": song_id,
                "title": song.get("title"),
                "artist_name": song.get("artist_name"),
                "market": market,
                "audio_url": song.get("audio_url"),
                "expected_path": expected_audio_path(song),
            })
            continue

        if should_log_each:
            print(f"[FOUND] song_id={song_id} market={market} title={song.get('title')} path={path}")
        base = {
            "song_id": song_id,
            "title": song.get("title"),
            "artist_name": song.get("artist_name"),
            "market": market,
            "audio_path": str(path),
            "bpm_old": song.get("bpm_old"),
            "tempo_level_old": song.get("tempo_level_old"),
            "energy_score_old": normalize01(song.get("energy_score_old")),
        }
        try:
            rows.append({**base, **analyze_audio(path)})
        except Exception as exc:
            rows.append({
                **base,
                "bpm_new": None,
                "bpm_confidence": 0,
                "bpm_source": "none",
                "tempo_level_new": "unknown",
                "energy_score_new": None,
                "danceability": None,
                "acoustic_score": None,
                "brightness": None,
                "loudness": None,
                "dynamic_complexity": None,
                "study_suitability_score": None,
                "calm_fit_score": None,
                "analysis_version": LIBROSA_FALLBACK_VERSION,
                "error": str(exc)[:500],
            })

    summary = summarize(rows, missing_rows, len(songs))
    print_summary(summary)
    print_export_audit(rows, missing_rows)

    ensure_output_dir()
    write_csv(OUTPUT_DIR / "missing_audio_files.csv", missing_rows, [
        "song_id", "title", "artist_name", "market", "audio_url", "expected_path"
    ])

    if args.export or args.apply or args.dry_run:
        write_csv(RECOMPUTED_CSV, rows, fieldnames)
        before_after_fields = [
            "song_id", "title", "market", "bpm_old", "bpm_new",
            "tempo_level_old", "tempo_level_new", "energy_score_old", "energy_score_new",
            "analysis_version", "error",
        ]
        write_csv(BEFORE_AFTER_CSV, rows, before_after_fields)
        SUMMARY_JSON.write_text(
            json.dumps(summary, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    if args.apply:
        result = apply_rows(conn, rows)
        print("[AudioFeature] Apply result:", json.dumps(result, ensure_ascii=False))
        run_distribution_queries(cursor)
    else:
        print("[AudioFeature] DB update skipped. Pass --apply to backup and update song_audio_features.")

    cursor.close()
    conn.close()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
