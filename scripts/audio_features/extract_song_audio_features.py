#!/usr/bin/env python
import argparse
import json
import math
import os
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
from dotenv import load_dotenv
import mysql.connector

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "apps" / "backend"
UPLOADS_DIR = BACKEND_DIR / "uploads"

load_dotenv(ROOT / ".env")
load_dotenv(BACKEND_DIR / ".env")


def db_connect():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "3306")),
        database=os.getenv("DB_NAME", "musicflow"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
    )


def normalize_bpm(raw_bpm):
    try:
        bpm = float(raw_bpm)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(bpm) or bpm <= 0:
        return None
    if bpm < 70:
        return bpm * 2
    if bpm > 180:
        return bpm / 2
    return bpm


def tempo_bucket(normalized_bpm):
    if normalized_bpm is None or not math.isfinite(float(normalized_bpm)):
        return "unknown"
    if normalized_bpm < 90:
        return "slow"
    if normalized_bpm < 120:
        return "medium"
    return "fast"


def clamp01(value):
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(n):
        return None
    return max(0.0, min(1.0, n))


def resolve_audio_path(song):
    candidates = [
        song.get("audio_url"),
        song.get("file_path"),
        song.get("audio_path"),
        song.get("source_url"),
    ]
    for value in candidates:
        if not value:
            continue
        raw = str(value).strip()
        if raw.startswith("http://") or raw.startswith("https://"):
            continue
        if raw.startswith("/uploads/"):
            return BACKEND_DIR / raw.lstrip("/")
        path = Path(raw)
        if path.is_absolute():
            return path
        local = ROOT / raw
        if local.exists():
            return local
        upload_local = UPLOADS_DIR / raw.lstrip("/\\")
        if upload_local.exists():
            return upload_local
    return None


def safe_json(values, max_items=512):
    if values is None:
        return None
    arr = np.asarray(values, dtype=float).flatten()
    if arr.size == 0:
        return None
    arr = arr[:max_items]
    return json.dumps([round(float(x), 6) for x in arr if math.isfinite(float(x))])


def tempo_stability_from_intervals(intervals):
    arr = np.asarray(intervals, dtype=float)
    arr = arr[np.isfinite(arr)]
    if arr.size < 2:
        return None
    mean = float(np.mean(arr))
    if mean <= 0:
        return None
    cv = float(np.std(arr) / mean)
    return clamp01(1.0 - cv)


def extract_with_essentia(audio_path):
    import essentia.standard as es

    audio = es.MonoLoader(filename=str(audio_path), sampleRate=44100)()
    rhythm = es.RhythmExtractor2013(method="multifeature")
    bpm, beats, beats_confidence, _, beats_intervals = rhythm(audio)

    energy = clamp01(float(np.sqrt(np.mean(np.square(audio)))) * 6.0)
    brightness = None
    if audio.size > 0:
        spectrum = es.Spectrum()
        centroid = es.Centroid()
        frame = audio[: min(audio.size, 44100 * 30)]
        brightness = clamp01(float(centroid(spectrum(frame))) / 8000.0)

    stability = tempo_stability_from_intervals(beats_intervals)
    danceability = None
    if stability is not None and beats_confidence is not None and energy is not None:
        danceability = clamp01(stability * 0.45 + clamp01(beats_confidence) * 0.35 + energy * 0.20)

    return {
        "raw_bpm": float(bpm) if bpm and math.isfinite(float(bpm)) else None,
        "tempo_confidence": clamp01(beats_confidence),
        "beat_positions": beats,
        "beat_intervals": beats_intervals,
        "energy_score": energy,
        "danceability_score": danceability,
        "brightness_score": brightness,
        "tempo_stability": stability,
        "extractor": "essentia",
    }


def extract_with_librosa(audio_path):
    import librosa

    y, sr = librosa.load(str(audio_path), sr=22050, mono=True)
    if y.size == 0:
        raise ValueError("empty audio signal")

    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, onset_envelope=onset_env)
    if isinstance(tempo, np.ndarray):
        tempo = float(tempo[0]) if tempo.size else None
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    beat_intervals = np.diff(beat_times) if len(beat_times) > 1 else np.array([])

    rms = librosa.feature.rms(y=y)[0]
    energy = clamp01(float(np.percentile(rms, 75)) * 12.0)
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    brightness = clamp01(float(np.nanmean(centroid)) / 8000.0)
    stability = tempo_stability_from_intervals(beat_intervals)
    beat_confidence = None
    if onset_env.size > 0 and len(beat_frames) > 0:
        picked = onset_env[beat_frames]
        denom = float(np.percentile(onset_env, 95)) or 1.0
        beat_confidence = clamp01(float(np.mean(picked)) / denom)

    normalized = normalize_bpm(tempo)
    bucket = tempo_bucket(normalized)
    bucket_boost = 0.1 if bucket in ("medium", "fast") else 0.0
    danceability = None
    if stability is not None or beat_confidence is not None or energy is not None:
        danceability = clamp01(
            (stability if stability is not None else 0.5) * 0.45
            + (beat_confidence if beat_confidence is not None else 0.5) * 0.30
            + (energy if energy is not None else 0.5) * 0.15
            + bucket_boost
        )

    return {
        "raw_bpm": float(tempo) if tempo and math.isfinite(float(tempo)) else None,
        "tempo_confidence": beat_confidence,
        "beat_positions": beat_times,
        "beat_intervals": beat_intervals,
        "energy_score": energy,
        "danceability_score": danceability,
        "brightness_score": brightness,
        "tempo_stability": stability,
        "extractor": "librosa",
    }


def extract_features(audio_path, extractor):
    if extractor == "essentia":
        try:
            return extract_with_essentia(audio_path)
        except ImportError:
            return extract_with_librosa(audio_path)
    return extract_with_librosa(audio_path)


def ensure_processing(cursor, song_id, dry_run=False):
    if dry_run:
        return
    cursor.execute(
        """
        INSERT INTO song_audio_features (song_id, status, extractor, created_at, updated_at)
        VALUES (%s, 'processing', 'librosa', NOW(), NOW())
        ON DUPLICATE KEY UPDATE status = 'processing', error_message = NULL, updated_at = NOW()
        """,
        (song_id,),
    )


def update_failed(cursor, song_id, message, dry_run=False):
    short = str(message).replace("\n", " ")[:500]
    if dry_run:
        print(f"[dry-run] song_id={song_id} failed: {short}")
        return
    cursor.execute(
        """
        INSERT INTO song_audio_features (song_id, status, error_message, created_at, updated_at)
        VALUES (%s, 'failed', %s, NOW(), NOW())
        ON DUPLICATE KEY UPDATE status = 'failed', error_message = VALUES(error_message), updated_at = NOW()
        """,
        (song_id, short),
    )


def update_completed(cursor, song_id, features, dry_run=False):
    raw_bpm = features.get("raw_bpm")
    normalized = normalize_bpm(raw_bpm)
    bucket = tempo_bucket(normalized)
    beat_positions = safe_json(features.get("beat_positions"))
    beat_intervals = safe_json(features.get("beat_intervals"))
    beat_count = len(np.asarray(features.get("beat_positions") or []).flatten())
    payload = {
        "raw_bpm": raw_bpm,
        "normalized_bpm": normalized,
        "tempo_bucket": bucket,
        "tempo_level": bucket if bucket in ("slow", "medium", "fast") else None,
        "tempo_confidence": features.get("tempo_confidence"),
        "beat_count": beat_count if beat_count > 0 else None,
        "beat_positions_json": beat_positions,
        "beat_intervals_json": beat_intervals,
        "energy_score": features.get("energy_score"),
        "danceability_score": features.get("danceability_score"),
        "brightness_score": features.get("brightness_score"),
        "brightness": features.get("brightness_score"),
        "tempo_stability": features.get("tempo_stability"),
        "energy": (
            "high" if features.get("energy_score") is not None and features.get("energy_score") >= 0.67
            else "low" if features.get("energy_score") is not None and features.get("energy_score") <= 0.33
            else "medium" if features.get("energy_score") is not None
            else None
        ),
        "extractor": features.get("extractor", "librosa"),
    }

    if dry_run:
        print(f"[dry-run] song_id={song_id} completed {json.dumps(payload, ensure_ascii=False)}")
        return

    cursor.execute(
        """
        INSERT INTO song_audio_features (
          song_id, raw_bpm, normalized_bpm, tempo_bucket, tempo_confidence,
          beat_count, beat_positions_json, beat_intervals_json, energy_score,
          danceability_score, brightness_score, tempo_stability, extractor,
          bpm, tempo_level, energy, danceability, brightness, analyzed_at,
          status, error_message, extracted_at, created_at, updated_at
        )
        VALUES (
          %(song_id)s, %(raw_bpm)s, %(normalized_bpm)s, %(tempo_bucket)s, %(tempo_confidence)s,
          %(beat_count)s, %(beat_positions_json)s, %(beat_intervals_json)s, %(energy_score)s,
          %(danceability_score)s, %(brightness_score)s, %(tempo_stability)s, %(extractor)s,
          %(normalized_bpm)s, %(tempo_level)s, %(energy)s, %(danceability_score)s, %(brightness)s, NOW(),
          'completed', NULL, NOW(), NOW(), NOW()
        )
        ON DUPLICATE KEY UPDATE
          raw_bpm = VALUES(raw_bpm),
          normalized_bpm = VALUES(normalized_bpm),
          tempo_bucket = VALUES(tempo_bucket),
          tempo_confidence = VALUES(tempo_confidence),
          beat_count = VALUES(beat_count),
          beat_positions_json = VALUES(beat_positions_json),
          beat_intervals_json = VALUES(beat_intervals_json),
          energy_score = VALUES(energy_score),
          danceability_score = VALUES(danceability_score),
          brightness_score = VALUES(brightness_score),
          tempo_stability = VALUES(tempo_stability),
          extractor = VALUES(extractor),
          bpm = VALUES(bpm),
          tempo_level = VALUES(tempo_level),
          energy = VALUES(energy),
          danceability = VALUES(danceability),
          brightness = VALUES(brightness),
          analyzed_at = NOW(),
          status = 'completed',
          error_message = NULL,
          extracted_at = NOW(),
          updated_at = NOW()
        """,
        {"song_id": song_id, **payload},
    )


def fetch_songs(cursor, song_id=None, limit=None, force=False):
    cursor.execute("SHOW TABLES LIKE 'song_audio_features'")
    if cursor.fetchone() is None:
        raise RuntimeError("song_audio_features table not found; run database/migrations/create_song_audio_features.sql first")

    cursor.execute("SHOW COLUMNS FROM songs")
    song_columns = {row[0] for row in cursor.fetchall()}
    cursor.execute("SHOW COLUMNS FROM song_audio_features")
    feature_columns = {row[0] for row in cursor.fetchall()}
    optional_columns = [col for col in ("file_path", "audio_path", "source_url") if col in song_columns]
    select_optional = ", ".join([f"s.{col}" for col in optional_columns])
    select_sql = "s.id, s.audio_url" + (f", {select_optional}" if select_optional else "")
    where = ["s.audio_url IS NOT NULL", "TRIM(s.audio_url) <> ''"]
    params = []
    join = "LEFT JOIN song_audio_features saf ON saf.song_id = s.id"
    if song_id:
        where.append("s.id = %s")
        params.append(song_id)
    if not force:
        if "status" in feature_columns:
            where.append("(saf.song_id IS NULL OR COALESCE(saf.status, 'pending') IN ('pending','failed'))")
        else:
            where.append("saf.song_id IS NULL")
    sql = f"""
        SELECT {select_sql}
        FROM songs s
        {join}
        WHERE {" AND ".join(where)}
        ORDER BY s.id ASC
    """
    if limit:
        sql += " LIMIT %s"
        params.append(limit)
    cursor.execute(sql, params)
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def main():
    parser = argparse.ArgumentParser(description="Extract tempo-aware audio features for MusicFlow songs.")
    parser.add_argument("--song-id", type=int, default=None)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--extractor", choices=["essentia", "librosa"], default="librosa")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    conn = db_connect()
    cursor = conn.cursor()
    songs = fetch_songs(cursor, song_id=args.song_id, limit=args.limit, force=args.force)
    print(f"Found {len(songs)} songs to analyze")

    completed = 0
    failed = 0
    for song in songs:
        song_id = int(song["id"])
        audio_path = resolve_audio_path(song)
        if not audio_path or not audio_path.exists():
            update_failed(cursor, song_id, "audio file not found", args.dry_run)
            failed += 1
            if not args.dry_run:
                conn.commit()
            continue

        try:
            ensure_processing(cursor, song_id, args.dry_run)
            if not args.dry_run:
                conn.commit()
            features = extract_features(audio_path, args.extractor)
            update_completed(cursor, song_id, features, args.dry_run)
            completed += 1
        except Exception as exc:
            update_failed(cursor, song_id, exc, args.dry_run)
            failed += 1
        finally:
            if not args.dry_run:
                conn.commit()

    cursor.close()
    conn.close()
    print(f"Done at {datetime.now().isoformat(timespec='seconds')}: completed={completed}, failed={failed}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
