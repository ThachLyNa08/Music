const fs = require('fs');
const path = require('path');

const EVAL_DIR = path.join(__dirname, '../../../storage/recommendation/evaluation/v4');
const BENCHMARK_LIGHTGCN_PATH = path.join(EVAL_DIR, 'lightgcn_hybrid_recs_v4.json');
const OUTPUT_PATH = path.join(EVAL_DIR, 'lightgcn_hybrid_serving_recs_v4.json');

function compactItems(items) {
  return (items || []).map((song) => ({
    song_id: Number(song.id || song.song_id),
    score: Number(Number(song.final_score ?? song.model_score ?? song.score ?? 0).toFixed(6)),
  })).filter((item) => Number.isFinite(item.song_id));
}

function main() {
  console.log(`Reading LightGCN recommendations from ${BENCHMARK_LIGHTGCN_PATH}...`);
  if (!fs.existsSync(BENCHMARK_LIGHTGCN_PATH)) {
    console.error("File not found!");
    process.exit(1);
  }

  const lightgcnData = JSON.parse(fs.readFileSync(BENCHMARK_LIGHTGCN_PATH, 'utf8'));
  const servingData = {};

  for (const [userId, items] of Object.entries(lightgcnData)) {
    servingData[userId] = {
      strategy: 'lightgcn_hybrid_v4',
      items: compactItems(items)
    };
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(servingData, null, 2));
  console.log(`Generated serving artifact with ${Object.keys(servingData).length} users at ${OUTPUT_PATH}`);
}

main();
