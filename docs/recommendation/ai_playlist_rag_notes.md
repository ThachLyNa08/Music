# AI Playlist Semantic RAG Notes

## Data source

AI Playlist RAG uses the canonical semantic profile export:

`datasets/processed/semantic/profiles/song_semantic_profiles.csv`

Each CSV row is treated as one retrievable document keyed by `song_id`. The runtime fields used for retrieval are `title`, `artist`, `summary_vi`, `main_theme`, `sub_themes`, `mood_tags`, `situation_tags`, `lyrical_keywords`, `semantic_text`, `emotion_intensity`, `meaning_confidence`, `evidence_level`, and `review_status`.

## Pipeline

1. Parse the prompt with the existing AI Playlist intent parser.
2. Load semantic profiles once per backend process and cache the in-memory index.
3. Build a retrieval query from raw prompt plus intent signals such as market, genre, mood, activity, context, energy, and artist constraints.
4. Retrieve top semantic candidates, normally top 300 `song_id` values.
5. Query MusicFlow DB using those IDs, then apply playable/public filters and strict market, genre, and artist constraints.
6. Fall back to the old DB candidate tiers only when RAG candidates are not enough.
7. Rerank with `semanticRag`, intent match, BPR-MF when available, audio features, user history, popularity, semantic DB profile score, and diversity.
8. Diversify final songs by limiting repeated artists unless the prompt explicitly asks for one artist.
9. Return preview songs plus `retrieval` metadata for debugging and thesis evaluation.

## Why the LLM does not generate songs directly

The final playlist must contain real MusicFlow songs. Semantic RAG lets the system use language understanding from song profiles, but every output song is still validated against the DB and filtered for active/playable status. This prevents hallucinated titles, unavailable uploads, and songs that do not exist in the application.

## RAG + DB + reranking

Semantic RAG is the recall layer. It finds likely song IDs from text meaning.

The DB query is the truth layer. It verifies song existence, audio URL availability, public/release status, market, genre, and artist constraints.

The reranker is the listening-quality layer. It combines RAG relevance with existing AI Playlist scoring signals: BPR-MF personalization, audio features, intent match, popularity, and artist diversity.

## Example checks

| Prompt | Expected behavior |
| --- | --- |
| `tạo playlist KPOP năng lượng để tập gym` | Intent detects `KPOP`, `gym`, high energy. RAG retrieves energetic/gym/party profiles and DB keeps KPOP when enough songs exist. |
| `tạo playlist VPOP buồn nhẹ buổi tối` | Intent detects `VPOP`, sad/calm, night. Top results should stay VPOP when the catalog has enough playable VPOP songs. |
| `tạo playlist chữa lành sau chia tay` | Intent detects healing/breakup/emotional context. RAG prioritizes profiles tagged `healing`, `heartbreak`, `breakup`, `calm`, or similar semantic text instead of random popular songs. |

## API metadata

Preview responses include:

```json
{
  "retrieval": {
    "strategy": "semantic_rag_v1",
    "semanticProfileSource": "datasets/processed/semantic/profiles/song_semantic_profiles.csv",
    "retrievedCandidates": 300,
    "usedCandidates": 20,
    "averageRagScore": 0.72
  }
}
```

The frontend only displays a small `Semantic RAG` badge. Detailed metadata remains available for debugging and reporting.
