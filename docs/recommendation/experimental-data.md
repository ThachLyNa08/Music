# MusicFlow Experimental Recommendation Data

## Purpose

This dataset creates controlled experimental listening behavior for MusicFlow recommendation training, evaluation, and algorithm comparison. It is useful for comparing:

- Most Popular / Trending baseline
- Content-Based Audio
- BPR-MF collaborative filtering
- Hybrid Context-Aware ranking

The generated users and interactions are experimental/simulated behavior based on real songs in the MusicFlow MySQL database. They are not real user behavior.

## User Groups

The seed creates exactly 200 experimental users:

| Group | Users | Email prefix |
| --- | ---: | --- |
| VPOP main | 35 | `exp_vpop_` |
| KPOP main | 35 | `exp_kpop_` |
| USUK main | 35 | `exp_usuk_` |
| VPOP + KPOP | 20 | `exp_vpop_kpop_` |
| VPOP + USUK | 20 | `exp_vpop_usuk_` |
| KPOP + USUK | 20 | `exp_kpop_usuk_` |
| VPOP + KPOP + USUK | 25 | `exp_all_` |
| Explorer / Trending | 10 | `exp_explorer_` |

All experimental emails use the `@musicflow.test` domain. When the database has `users.is_experiment`, the seed marks these users with `is_experiment = 1`.

## Generated Behavior

The seed uses real songs from `songs`, joined with `genres`, `artists`, and `song_audio_features` when available. It does not hardcode fixed `song_id` values.

Each user receives natural listening variation:

- Low activity: 40-70 listens
- Medium activity: 80-120 listens
- High activity: 130-200 listens

The seed writes `listening_history.source = 'experiment_seed'`, and maps to the current schema columns such as `listen_duration`, `song_duration`, `completion_rate`, `is_skipped`, `skip_at_sec`, `implicit_rating`, and `listened_at`.

Implicit rating follows the recommendation skill formula:

```text
implicit_rating =
  0.45 * completion_rate
+ 0.25 * liked
+ 0.15 * repeated
+ 0.10 * playlist_added
+ 0.05 * artist_followed
- 0.25 * skipped_early
```

Scores are clamped to 0-1.

## Commands

Seed without reset:

```bash
node scripts/recommendation/seedExperimentalUsersAndListening.js --count=200
```

Reset and seed again:

```bash
node scripts/recommendation/seedExperimentalUsersAndListening.js --reset --count=200
```

Export all users:

```bash
node scripts/recommendation/exportUsersCsv.js
```

CSV output:

```text
datasets/processed/musicflow_users_export.csv
```

## Safety

Reset only targets:

- users where `is_experiment = 1`, when the column exists
- or emails matching `exp_%@musicflow.test`
- listening rows with `source = 'experiment_seed'`

The scripts do not touch `apps/backend/uploads`, do not change `/uploads/...` URLs, and do not modify PlayerBar, QueuePanel, payment, or admin UI.

## Quick SQL Checks

Count experimental users:

```sql
SELECT COUNT(*) AS experimental_users
FROM users
WHERE is_experiment = 1
   OR email LIKE 'exp\\_%@musicflow.test' ESCAPE '\\';
```

Distribution by group:

```sql
SELECT
  CASE
    WHEN email LIKE 'exp_vpop_kpop_%@musicflow.test' THEN 'VPOP + KPOP'
    WHEN email LIKE 'exp_vpop_usuk_%@musicflow.test' THEN 'VPOP + USUK'
    WHEN email LIKE 'exp_kpop_usuk_%@musicflow.test' THEN 'KPOP + USUK'
    WHEN email LIKE 'exp_vpop_%@musicflow.test' THEN 'VPOP main'
    WHEN email LIKE 'exp_kpop_%@musicflow.test' THEN 'KPOP main'
    WHEN email LIKE 'exp_usuk_%@musicflow.test' THEN 'USUK main'
    WHEN email LIKE 'exp_all_%@musicflow.test' THEN 'VPOP + KPOP + USUK'
    WHEN email LIKE 'exp_explorer_%@musicflow.test' THEN 'Explorer / Trending'
  END AS user_group,
  COUNT(*) AS total
FROM users
WHERE email LIKE 'exp\\_%@musicflow.test' ESCAPE '\\'
GROUP BY user_group;
```

Count generated listening history:

```sql
SELECT COUNT(*) AS experiment_listens
FROM listening_history
WHERE source = 'experiment_seed';
```

Market distribution:

```sql
SELECT s.market, COUNT(*) AS listens
FROM listening_history lh
JOIN songs s ON s.id = lh.song_id
JOIN users u ON u.id = lh.user_id
WHERE lh.source = 'experiment_seed'
  AND (u.is_experiment = 1 OR u.email LIKE 'exp\\_%@musicflow.test' ESCAPE '\\')
GROUP BY s.market
ORDER BY s.market;
```
