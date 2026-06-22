require('dotenv').config();

const assert = require('assert');
const { pool } = require('../../src/config/database');
const recommendationService = require('../../src/services/recommendation.service');

const USER_ID = 11;
const LIMIT = 20;

function countBy(items, keyFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item) || 'UNKNOWN';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function asciiName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

async function run() {
  const profile = await recommendationService.buildUserTasteProfile(USER_ID);
  assert.strictEqual(profile.dominantMarket, 'KPOP', 'dominantMarket must be KPOP for user_id=11');
  assert.strictEqual(profile.dominantGenreName, 'KPOP-GEN3', 'dominantGenre must be KPOP-GEN3 for user_id=11');

  const result = await recommendationService.getRecommendationsForUser(USER_ID, { limit: LIMIT });
  assert(result.items.length >= Math.min(10, LIMIT), 'recommendation result should have enough items');

  const marketCounts = countBy(result.items, (item) => item.market);
  const artistCounts = countBy(result.items, (item) => item.artist_name);
  const kpopCount = marketCounts.KPOP || 0;
  const vpopCount = marketCounts.VPOP || 0;
  const dieuKienCount = result.items.filter((item) => asciiName(item.artist_name).includes('dieu kien')).length;
  const maxArtistCount = Math.max(...Object.values(artistCounts));

  assert(
    kpopCount > result.items.length / 2,
    `top recommendations must be mostly KPOP, got ${JSON.stringify(marketCounts)}`
  );
  assert(vpopCount < result.items.length, 'recommendations must not be all VPOP');
  assert(dieuKienCount < result.items.length, 'recommendations must not be all Dieu Kien');
  assert(maxArtistCount < result.items.length, 'recommendations should not come from a single artist');

  console.log(JSON.stringify({
    userId: USER_ID,
    strategy: result.strategy,
    dominantMarket: profile.dominantMarket,
    dominantMarketShare: Number(profile.dominantMarketShare.toFixed(4)),
    dominantGenre: profile.dominantGenreName,
    marketCounts,
    artistCounts,
    top10: result.items.slice(0, 10).map((item) => ({
      id: item.id,
      title: item.title,
      artist: item.artist_name,
      market: item.market,
      genre: item.genre_name,
      score: item.recommendation_score,
    })),
  }, null, 2));
}

run()
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
