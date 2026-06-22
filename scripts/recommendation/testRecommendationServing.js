// scripts/recommendation/testRecommendationServing.js
// Smoke test for BPR-MF serving: calls the service directly for several users
// and prints strategy, top songs, duplicate count, and recent-listened leak count.

const path = require('path');
const projectRoot = path.resolve(__dirname, '..', '..');
const backendRoot = path.join(projectRoot, 'apps', 'backend');
require('dotenv').config({ path: path.join(backendRoot, '.env') });

const { pool } = require(path.join(backendRoot, 'src/config/database'));
const recommendationService = require(path.join(backendRoot, 'src/services/recommendation.service'));
const modelService = require(path.join(backendRoot, 'src/services/recommendationModel.service'));

async function pickUsers() {
  const model = modelService.tryLoad().model;
  const modelUserIds = model ? new Set(Object.keys(model.user_index_map).map(Number)) : new Set();

  const [expRows] = await pool.query(
    `SELECT id, email FROM users WHERE email LIKE 'exp_%@musicflow.test' ORDER BY email`
  );
  const [realRows] = await pool.query(
    `SELECT id, email FROM users
     WHERE (email IS NULL OR email NOT LIKE 'exp_%@musicflow.test')
       AND role <> 'admin'
     ORDER BY id LIMIT 1`
  );

  const groupMap = { vpop: 'VPOP', kpop: 'KPOP', usuk: 'USUK' };
  const inModel = [];
  for (const r of expRows) {
    if (!modelUserIds.has(Number(r.id))) continue;
    const m = r.email.match(/exp_(vpop|kpop|usuk)/i);
    const labelKey = m ? groupMap[m[1].toLowerCase()] : null;
    inModel.push({ id: r.id, email: r.email, group: labelKey });
  }
  const byGroup = { VPOP: null, KPOP: null, USUK: null };
  for (const u of inModel) {
    if (u.group && !byGroup[u.group]) byGroup[u.group] = u;
  }
  const groups = [];
  for (const g of ['VPOP', 'KPOP', 'USUK']) {
    if (byGroup[g]) groups.push({ label: `exp_${g.toLowerCase()} (in model)`, userId: byGroup[g].id });
  }
  if (realRows.length) {
    groups.push({ label: 'real user (not in model)', userId: realRows[0].id });
  }
  return groups;
}

function dedupeCheck(items) {
  const ids = items.map((i) => Number(i.id));
  const seen = new Set();
  let dupes = 0;
  for (const id of ids) {
    if (seen.has(id)) dupes++;
    else seen.add(id);
  }
  return { duplicateCount: dupes, total: items.length };
}

async function recentListenedSet(userId) {
  const [rows] = await pool.query(
    `SELECT DISTINCT song_id FROM listening_history
     WHERE user_id = ? AND listened_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
    [userId]
  );
  return new Set(rows.map((r) => Number(r.song_id)));
}

async function runOne(label, userId) {
  const t0 = Date.now();
  const result = await recommendationService.getRecommendationsForUser(userId, { limit: 20 });
  const elapsed = Date.now() - t0;
  const dupes = dedupeCheck(result.items);
  const recent = await recentListenedSet(userId);
  const leaks = result.items.filter((i) => recent.has(Number(i.id))).length;
  const inModel = modelService.getUserIndex(userId);

  console.log(`\n--- ${label} (user_id=${userId}, model_idx=${inModel}) ---`);
  console.log(`strategy: ${result.strategy}`);
  console.log(`strategy_reason: ${result.reason}`);
  console.log(`items returned: ${result.items.length}`);
  console.log(`duplicate song count: ${dupes.duplicateCount} / ${dupes.total}`);
  console.log(`recent-listened leak count: ${leaks}`);
  console.log(`elapsed: ${elapsed}ms`);
  console.log(`top 5:`);
  for (const s of result.items.slice(0, 5)) {
    console.log(`  - id=${s.id} artist=${s.artist_name || s.artist_id} market=${s.market} title="${(s.title||'').slice(0,40)}" score=${s.recommendation_score}`);
  }
  if (result.items.length) {
    const sample = result.items[0];
    console.log(`first item URL sanity: cover_url=${sample.cover_url ? 'present' : 'null'} audio_url=${sample.audio_url ? 'present' : 'null'}`);
  }
}

async function main() {
  console.log('═'.repeat(60));
  console.log('  MusicFlow Recommendation Serving — Smoke Test');
  console.log('═'.repeat(60));

  const loadResult = modelService.tryLoad();
  if (loadResult.ok) {
    const meta = modelService.getModelMetadata();
    console.log(`[model] loaded: ${meta.algorithm} | trained_users=${meta.trained_users} trained_items=${meta.trained_items} factors=${meta.factors} generated_at=${meta.generated_at}`);
  } else {
    console.log(`[model] FAILED to load: ${loadResult.error}`);
  }

  const groups = await pickUsers();
  if (!groups.length) {
    console.log('No test users available.');
    await pool.end();
    return;
  }

  for (const g of groups) {
    await runOne(g.label, g.userId);
  }

  // Fallback test: rename path temporarily to verify fallback path
  console.log('\n--- fallback test: model unavailable ---');
  const origPath = modelService.resolveModelPath();
  const tmpPath = origPath + '.bak';
  const fs = require('fs');
  if (fs.existsSync(origPath)) {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    fs.renameSync(origPath, tmpPath);
    modelService.clearCache();
    try {
      const r = await recommendationService.getRecommendationsForUser(groups[0].userId, { limit: 10 });
      console.log(`strategy with model missing: ${r.strategy} | items: ${r.items.length} | reason: ${r.reason}`);
    } finally {
      fs.renameSync(tmpPath, origPath);
      modelService.clearCache();
      modelService.tryLoad();
      console.log('model restored');
    }
  } else {
    console.log('(skipping rename test — original model path missing)');
  }

  await pool.end();
}

main().catch((e) => {
  console.error('test failed:', e);
  process.exit(1);
});
