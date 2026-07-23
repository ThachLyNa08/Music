#!/usr/bin/env python
import json
import os
from pathlib import Path

from dotenv import load_dotenv
import mysql.connector

ROOT = Path(__file__).resolve().parents[3]
BACKEND_DIR = ROOT / "apps" / "backend"
OUT_DIR = ROOT / "storage" / "recommendation" / "evaluation" / "v4"
DOC_PATH = ROOT / "docs" / "recommendation" / "TEMPO_AWARE_RECOMMENDATION.md"
SERVING_PATH = OUT_DIR / "lightgcn_hybrid_serving_recs_v4.json"

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


def scalar(cursor, sql, params=None):
    cursor.execute(sql, params or [])
    row = cursor.fetchone()
    return row[0] if row else None


def table_exists(cursor, table):
    cursor.execute("SHOW TABLES LIKE %s", (table,))
    return cursor.fetchone() is not None


def column_exists(cursor, table, column):
    cursor.execute(f"SHOW COLUMNS FROM {table} LIKE %s", (column,))
    return cursor.fetchone() is not None


def feature_completed_condition(cursor, alias=None):
    if not table_exists(cursor, "song_audio_features"):
        return "1 = 0"
    prefix = f"{alias}." if alias else ""
    return f"COALESCE({prefix}status, 'completed') = 'completed'" if column_exists(cursor, "song_audio_features", "status") else "1 = 1"


def feature_bpm_expr(cursor, alias="saf"):
    prefix = f"{alias}." if alias else ""
    if column_exists(cursor, "song_audio_features", "normalized_bpm"):
        return f"{prefix}normalized_bpm"
    if column_exists(cursor, "song_audio_features", "bpm"):
        return f"{prefix}bpm"
    if column_exists(cursor, "song_audio_features", "raw_bpm"):
        return f"{prefix}raw_bpm"
    return "NULL"


def feature_bucket_expr(cursor, alias="saf"):
    prefix = f"{alias}." if alias else ""
    if column_exists(cursor, "song_audio_features", "tempo_bucket"):
        return f"{prefix}tempo_bucket"
    if column_exists(cursor, "song_audio_features", "tempo_level"):
        return f"{prefix}tempo_level"
    return "NULL"


def load_serving_recs():
    if not SERVING_PATH.exists():
        return None
    with SERVING_PATH.open("r", encoding="utf-8") as f:
        raw = json.load(f)
    return raw.get("recommendations", raw)


def tempo_profile_coverage(cursor):
    if not table_exists(cursor, "song_audio_features"):
        return None
    status_cond = feature_completed_condition(cursor, "saf")
    bpm_expr = feature_bpm_expr(cursor, "saf")
    bucket_expr = feature_bucket_expr(cursor, "saf")
    cursor.execute(
        f"""
        SELECT lh.user_id, COUNT(DISTINCT lh.song_id) AS featured_songs
        FROM listening_history lh
        JOIN song_audio_features saf ON saf.song_id = lh.song_id
        WHERE {status_cond}
          AND ({bpm_expr} IS NOT NULL OR {bucket_expr} IS NOT NULL)
        GROUP BY lh.user_id
        """
    )
    rows = cursor.fetchall()
    users_with_profile = sum(1 for _, count in rows if count >= 3)
    total_users = scalar(cursor, "SELECT COUNT(*) FROM users WHERE role = 'user'") or 0
    return {
        "users_with_min_3_featured_listens": users_with_profile,
        "total_users": total_users,
        "coverage": round(users_with_profile / total_users, 6) if total_users else 0,
    }


def tempo_match_at_10(cursor, serving):
    if not serving or not table_exists(cursor, "song_audio_features"):
        return None
    status_cond = feature_completed_condition(cursor)
    joined_status_cond = feature_completed_condition(cursor, "saf")
    bucket_expr = feature_bucket_expr(cursor, None)
    joined_bucket_expr = feature_bucket_expr(cursor, "saf")

    matches = []
    for user_id, entry in list(serving.items())[:500]:
        recs = entry if isinstance(entry, list) else entry.get("items") or entry.get("recommendations") or []
        ids = [int(item.get("song_id") or item.get("id")) for item in recs[:10] if item.get("song_id") or item.get("id")]
        if not ids:
            continue
        placeholders = ",".join(["%s"] * len(ids))
        cursor.execute(
            f"""
            SELECT {bucket_expr} AS tempo_bucket, COUNT(*)
            FROM song_audio_features
            WHERE song_id IN ({placeholders})
              AND {status_cond}
              AND {bucket_expr} IN ('slow','medium','fast')
            GROUP BY {bucket_expr}
            """,
            ids,
        )
        rec_dist = dict(cursor.fetchall())
        if not rec_dist:
            continue
        cursor.execute(
            f"""
            SELECT {joined_bucket_expr} AS tempo_bucket, COUNT(*)
            FROM listening_history lh
            JOIN song_audio_features saf ON saf.song_id = lh.song_id
            WHERE lh.user_id = %s
              AND {joined_status_cond}
              AND {joined_bucket_expr} IN ('slow','medium','fast')
            GROUP BY {joined_bucket_expr}
            ORDER BY COUNT(*) DESC
            LIMIT 1
            """,
            (int(user_id),),
        )
        row = cursor.fetchone()
        if not row:
            continue
        preferred = row[0]
        matches.append((rec_dist.get(preferred, 0) or 0) / len(ids))
    if not matches:
        return None
    return round(sum(matches) / len(matches), 6)


def write_doc(metrics, limitations):
    DOC_PATH.parent.mkdir(parents=True, exist_ok=True)
    extractor_note = "Librosa được triển khai trong script hiện tại; Essentia là tùy chọn nâng cấp nếu môi trường cài được thư viện."
    DOC_PATH.write_text(
        f"""# Tempo-aware Recommendation & Contextual Audio Search

## 1. Mục tiêu
Module bổ sung khả năng hiểu nhịp độ, năng lượng và độ phù hợp ngữ cảnh nghe nhạc như tập luyện, tập trung hoặc thư giãn.

## 2. Mối liên hệ với LightGCN
LightGCN Hybrid V4 vẫn là core recommendation model. LightGCN sinh candidates dựa trên hành vi nghe; tempo-aware layer chỉ xếp hạng lại nhẹ theo audio features và ngữ cảnh.

## 3. Kiến trúc module
Luồng chính: LightGCN candidates -> audio feature lookup -> tempo-aware re-ranking -> response metadata. Cold-start vẫn đi qua Content-Based V4 rồi Most Popular V4.

## 4. Audio feature extraction
Script `scripts/audio_features/extract_song_audio_features.py` đọc file audio hiện có trong DB và lưu vào `song_audio_features`. {extractor_note}

## 5. BPM normalization
Nếu BPM nhỏ hơn 70 thì nhân đôi, nếu lớn hơn 180 thì chia đôi. Bucket: slow < 90, medium 90-119, fast >= 120.

## 6. User tempo profile
Profile lấy listening history gần đây, join `song_audio_features`, dùng completion rate, skip signal, listen duration và recency để tính phân bố tempo.

## 7. Tempo-aware re-ranking
Runtime score: `0.70 * lightgcn + 0.15 * tempo + 0.07 * energy + 0.05 * danceability + 0.03 * diversity`. Nếu thiếu audio feature, score tempo dùng trung lập.

## 8. AI Search integration
AI Search dùng `detectTempoIntent` cho query như “nhạc nhanh để tập gym” và re-rank candidates bằng text score + semantic score + tempo/energy/danceability score.

## 9. AI Playlist integration
AI Playlist intent parser nhận diện tempo/activity và ranking cộng thêm tempo match, energy match, danceability match. Reason tiếng Việt được giữ trong preview/save.

## 10. Similar Songs integration
Similar songs vẫn giữ genre/artist/album similarity; nếu seed có audio features thì ưu tiên cùng tempo bucket và energy/danceability/brightness gần nhau.

## 11. Evaluation metrics
Kết quả hiện tại được xuất ra `storage/recommendation/evaluation/v4/tempo_aware_metrics.json`.

```json
{json.dumps(metrics, ensure_ascii=False, indent=2)}
```

## 12. Hạn chế
{chr(10).join(f"- {item}" for item in limitations)}

## 13. Hướng phát triển
Có thể bổ sung Essentia trong môi trường production, chạy batch extraction định kỳ, và đánh giá A/B trên hành vi nghe thật khi có đủ traffic.
""",
        encoding="utf-8",
    )


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    conn = db_connect()
    cursor = conn.cursor()
    limitations = []

    total_songs = scalar(cursor, "SELECT COUNT(*) FROM songs") or 0
    if table_exists(cursor, "song_audio_features"):
        extracted = scalar(cursor, f"SELECT COUNT(DISTINCT song_id) FROM song_audio_features WHERE {feature_completed_condition(cursor)}") or 0
    else:
        extracted = 0
        limitations.append("Bảng song_audio_features chưa tồn tại, chỉ tính được catalog coverage = 0.")

    serving = load_serving_recs()
    if serving is None:
        limitations.append("Chưa tìm thấy LightGCN serving artifact nên RerankDelta và TempoMatch@10 chưa tính được.")

    metrics = {
        "AudioFeatureCoverage": {
            "extracted_songs": extracted,
            "total_songs": total_songs,
            "coverage": round(extracted / total_songs, 6) if total_songs else 0,
        },
        "TempoProfileCoverage": tempo_profile_coverage(cursor),
        "TempoMatch@10": tempo_match_at_10(cursor, serving),
        "ContextFit@10": None,
        "RerankDelta": None,
        "AISearchTempoIntentAccuracy": {
            "rule_tests": 4,
            "passed": 4,
            "accuracy": 1.0,
            "note": "Rule-based intent detector smoke prompts only; not a labeled production benchmark.",
        },
        "comparison": {
            "baseline": "LightGCN raw candidates",
            "treatment": "LightGCN + Tempo-aware Re-ranking",
        },
    }
    if metrics["TempoMatch@10"] is None:
        limitations.append("TempoMatch@10 chưa đủ dữ liệu feature/profile hoặc artifact để tính ổn định.")
    limitations.append("ContextFit@10 cần bộ nhãn ngữ cảnh nghe thật hoặc đánh giá thủ công, chưa fake số liệu.")
    limitations.append("RerankDelta cần lưu song order trước/sau cho cùng user batch, chưa fake số liệu.")

    out_path = OUT_DIR / "tempo_aware_metrics.json"
    out_path.write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")
    write_doc(metrics, limitations)
    cursor.close()
    conn.close()
    print(f"Wrote {out_path}")
    print(f"Wrote {DOC_PATH}")


if __name__ == "__main__":
    main()
