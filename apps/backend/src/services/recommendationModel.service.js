const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../../../../');
const v4EvalDir = path.join(projectRoot, 'storage/recommendation/evaluation/v4');

const V4_ARTIFACTS = {
  serving: path.join(v4EvalDir, 'lightgcn_hybrid_serving_recs_v4.json'),
  lightgcn: path.join(v4EvalDir, 'lightgcn_hybrid_recs_v4.json'),
  bpr: path.join(v4EvalDir, 'bpr_hybrid_recs_v4.json'),
  cb: path.join(v4EvalDir, 'content_based_recs_v4.json'),
  popular: path.join(v4EvalDir, 'most_popular_recs_v4.json')
};

let cachedV4 = {};
let loadStatus = { ok: false, error: null, loadedAt: null, paths: {} };

function clearCache() {
  cachedV4 = {};
  loadStatus = { ok: false, error: null, loadedAt: null, paths: {} };
}

function loadArtifact(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`V4 artifact not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Corrupt V4 JSON artifact at ${filePath}: ${err.message}`);
  }
}

function loadArtifactByKey(key) {
  if (!V4_ARTIFACTS[key]) {
    throw new Error(`Unknown V4 artifact key: ${key}`);
  }
  if (cachedV4[key]) {
    return cachedV4[key];
  }

  const artifact = loadArtifact(V4_ARTIFACTS[key]);
  cachedV4[key] = artifact;
  loadStatus = {
    ok: true,
    error: null,
    loadedAt: loadStatus.loadedAt || new Date().toISOString(),
    paths: { ...loadStatus.paths, [key]: V4_ARTIFACTS[key] }
  };
  if (process.env.DEBUG_RECOMMENDATION_MODEL === 'true') {
    console.log(`[RecommendationModel] Loaded V4 artifact: ${key}`);
  }
  return artifact;
}

function hasLoadedAllArtifacts() {
  return Object.keys(V4_ARTIFACTS).every((key) => cachedV4[key]);
}

function load() {
  if (hasLoadedAllArtifacts()) {
    if (process.env.NODE_ENV === 'development' && process.env.DEBUG_RECOMMENDATION_MODEL === 'true') {
      console.log('[RecommendationModel] V4 artifacts already loaded, using memory cache');
    }
    return cachedV4;
  }

  const models = {};
  const paths = {};

  try {
    for (const [key, filePath] of Object.entries(V4_ARTIFACTS)) {
      models[key] = loadArtifactByKey(key);
      paths[key] = filePath;
    }

    cachedV4 = { ...cachedV4, ...models };
    loadStatus = { ok: true, error: null, loadedAt: new Date().toISOString(), paths };
    console.log(`[RecommendationModel] Loaded active model: v4 LightGCN Hybrid`);
    console.log(`[RecommendationModel] V4 artifacts loaded: serving, lightgcn, bpr, content_based, most_popular`);
    return cachedV4;
  } catch (err) {
    loadStatus = { ok: false, error: err.message, loadedAt: null, paths: {} };
    throw err;
  }
}

function tryLoad() {
  try {
    return { ok: true, model: load(), status: loadStatus };
  } catch (err) {
    return { ok: false, model: null, status: loadStatus, error: err.message };
  }
}

function tryLoadArtifact(key) {
  try {
    return { ok: true, model: loadArtifactByKey(key), status: loadStatus };
  } catch (err) {
    loadStatus = { ok: false, error: err.message, loadedAt: loadStatus.loadedAt, paths: loadStatus.paths || {} };
    return { ok: false, model: null, status: loadStatus, error: err.message };
  }
}

function reloadModel() {
  clearCache();
  return tryLoad();
}

function getModelMetadata() {
  const serving = cachedV4.serving?.metadata || null;
  return {
    algorithm: 'LightGCN Hybrid V4',
    generated_at: loadStatus.loadedAt,
    notes: ['V4 serving uses DB user ids; benchmark artifacts use csv user ids'],
    dataset_source: 'v4_serving',
    benchmark_users: serving?.benchmarkUsers,
    existing_system_users: serving?.existingSystemUsers,
    serving_coverage: serving?.servingCoverage,
    fallback_policy: serving?.fallbackPolicy,
  };
}

function getLoadStatus() {
  return { ...loadStatus };
}

// Stubs for legacy V3 compatibility to prevent crashes if other parts call these
function getUserIndex(userId) { return -1; }
function getSongIndex(songId) { return -1; }
function resolveModelPath() { return V4_ARTIFACTS.lightgcn; }

module.exports = {
  load,
  tryLoad,
  reloadModel,
  getModelMetadata,
  getLoadStatus,
  tryLoadArtifact,
  getUserIndex,
  getSongIndex,
  clearCache,
  resolveModelPath,
  DEFAULT_MODEL_PATH: V4_ARTIFACTS.lightgcn,
};
