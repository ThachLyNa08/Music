const fs = require('fs');
const path = require('path');

const DEFAULT_MODEL_PATH = path.resolve(
  __dirname,
  '../../../../storage/recommendation/models/bpr_mf_latest.json'
);

const NEW_MODEL_PATH = path.resolve(
  __dirname,
  '../../../../datasets/processed/recommendation/final/recommendation_bpr_model_final_semantic_v2.json'
);

let cached = null;
let cachedAt = 0;
let loadStatus = { ok: false, error: null, loadedAt: null, path: null };

function clearCache() {
  cached = null;
  cachedAt = 0;
  loadStatus = { ok: false, error: null, loadedAt: null, path: null };
}

function findLatestFileByPrefix(dir, prefix, ext = '.json') {
  if (!fs.existsSync(dir)) return null;

  const files = fs.readdirSync(dir)
    .filter((file) => file.startsWith(prefix) && file.endsWith(ext))
    .map((file) => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      return {
        file,
        fullPath,
        mtimeMs: stat.mtimeMs,
        size: stat.size
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return files[0] ? files[0].fullPath : null;
}
const recommendationFinalDir = path.resolve(
  __dirname,
  '../../../../datasets/processed/recommendation/final'
);

function resolveModelPath(overridePath) {
  if (overridePath) return path.isAbsolute(overridePath) ? overridePath : path.resolve(__dirname, '../../../', overridePath);
  
  const projectRoot = path.resolve(__dirname, '../../../../');
  
  // Priority 1: env var
  if (process.env.RECOMMENDATION_MODEL_PATH) {
    const envPath = path.isAbsolute(process.env.RECOMMENDATION_MODEL_PATH) ? process.env.RECOMMENDATION_MODEL_PATH : path.resolve(projectRoot, process.env.RECOMMENDATION_MODEL_PATH);
    if (fs.existsSync(envPath)) {
      console.log(`[RecommendationModel] Loaded active model from env RECOMMENDATION_MODEL_PATH: ${envPath}`);
      return envPath;
    }
  }
  if (process.env.BPR_MF_MODEL_PATH) {
    const envPath2 = path.isAbsolute(process.env.BPR_MF_MODEL_PATH) ? process.env.BPR_MF_MODEL_PATH : path.resolve(projectRoot, process.env.BPR_MF_MODEL_PATH);
    if (fs.existsSync(envPath2)) {
      return envPath2;
    }
  }
  
  // Priority 2: current_model.json pointer
  const pointerPath = path.join(projectRoot, 'storage/recommendation/models/current_model.json');
  try {
    if (fs.existsSync(pointerPath)) {
      const pointerData = JSON.parse(fs.readFileSync(pointerPath, 'utf8'));
      if (pointerData && pointerData.model_path) {
        const activeModelPath = path.isAbsolute(pointerData.model_path) 
          ? pointerData.model_path 
          : path.join(projectRoot, pointerData.model_path);
          
        if (fs.existsSync(activeModelPath)) {
          console.log(`[RecommendationModel] Loaded active model: ${pointerData.active_version || 'unknown'} from ${activeModelPath}`);
          return activeModelPath;
        } else {
          console.warn(`[RecommendationModel] Warning: current_model.json points to non-existent model_path: ${activeModelPath}. Falling back.`);
        }
      }
    }
  } catch (err) {
    console.warn(`[RecommendationModel] Error reading current_model.json: ${err.message}. Falling back.`);
  }

  // Priority 3: V3 fallback if exists
  const v3Path = path.join(projectRoot, 'storage/recommendation/models/v3/bpr_mf_v3.json');
  if (fs.existsSync(v3Path)) {
    console.log(`[RecommendationModel] Loaded active model: v3 (fallback) from ${v3Path}`);
    return v3Path;
  }

  // Priority 4: Legacy logic
  const latestModelPath = findLatestFileByPrefix(recommendationFinalDir, 'recommendation_bpr_model_final_', '.json');
  if (latestModelPath) {
    if (process.argv.includes('--debug')) {
      console.log(`[BPR-MF] Found latest model artifact: ${latestModelPath}`);
    }
    return latestModelPath;
  }
  
  if (fs.existsSync(NEW_MODEL_PATH)) {
    return NEW_MODEL_PATH;
  }
  return DEFAULT_MODEL_PATH;
}

function validate(artifact) {
  const required = ['user_index_map', 'song_index_map', 'user_factors', 'item_factors'];
  const missing = required.filter((k) => !artifact[k]);
  if (missing.length) {
    throw new Error(`BPR-MF model artifact missing required fields: ${missing.join(', ')}`);
  }
  if (!Array.isArray(artifact.user_factors) || !artifact.user_factors.length) {
    throw new Error('user_factors must be a non-empty 2D array');
  }
  if (!Array.isArray(artifact.item_factors) || !artifact.item_factors.length) {
    throw new Error('item_factors must be a non-empty 2D array');
  }
  const userDim = artifact.user_factors[0]?.length || 0;
  const itemDim = artifact.item_factors[0]?.length || 0;
  if (userDim !== itemDim) {
    throw new Error(`user_factors dim (${userDim}) != item_factors dim (${itemDim})`);
  }
  if (artifact.user_biases && artifact.user_biases.length !== artifact.user_factors.length) {
    throw new Error('user_biases length does not match user_factors rows');
  }
  if (artifact.item_biases && artifact.item_biases.length !== artifact.item_factors.length) {
    throw new Error('item_biases length does not match item_factors rows');
  }
}

function load(overridePath) {
  const modelPath = resolveModelPath(overridePath);
  if (cached && cachedAt === fs.statSync(modelPath).mtimeMs && loadStatus.path === modelPath) {
    return cached;
  }
  if (!fs.existsSync(modelPath)) {
    const err = new Error(`BPR-MF model artifact not found at ${modelPath}`);
    loadStatus = { ok: false, error: err.message, loadedAt: null, path: modelPath };
    throw err;
  }
  const raw = fs.readFileSync(modelPath, 'utf8');
  let artifact;
  try {
    artifact = JSON.parse(raw);
  } catch (parseErr) {
    const err = new Error(`BPR-MF model artifact is corrupt JSON: ${parseErr.message}`);
    loadStatus = { ok: false, error: err.message, loadedAt: null, path: modelPath };
    throw err;
  }
  try {
    validate(artifact);
  } catch (valErr) {
    loadStatus = { ok: false, error: valErr.message, loadedAt: null, path: modelPath };
    throw valErr;
  }
  cached = artifact;
  cachedAt = fs.statSync(modelPath).mtimeMs;
  loadStatus = { ok: true, error: null, loadedAt: new Date().toISOString(), path: modelPath };
  if (process.argv.includes('--debug')) {
    console.log(`[BPR-MF] model loaded: ${artifact.trained_users} users, ${artifact.trained_items} items, factors=${artifact.user_factors[0].length}`);
  }
  return cached;
}

function tryLoad(overridePath) {
  try {
    return { ok: true, model: load(overridePath), status: loadStatus };
  } catch (err) {
    return { ok: false, model: null, status: loadStatus, error: err.message };
  }
}

function reloadModel() {
  clearCache();
  return tryLoad();
}

function getModelMetadata() {
  if (!cached) return null;
  return {
    algorithm: cached.algorithm || 'BPR-MF',
    generated_at: cached.generated_at || null,
    hyperparameters: cached.hyperparameters || null,
    trained_users: cached.trained_users || 0,
    trained_items: cached.trained_items || 0,
    train_positive_pairs: cached.train_positive_pairs || 0,
    factors: cached.user_factors[0]?.length || 0,
    dataset_source: cached.dataset_source || null,
    notes: cached.notes || [],
    limitations: cached.limitations || [],
  };
}

function getLoadStatus() {
  return { ...loadStatus };
}

function getUserIndex(userId) {
  if (!cached) return -1;
  return cached.user_index_map[String(userId)] ?? -1;
}

function getSongIndex(songId) {
  if (!cached) return -1;
  return cached.song_index_map[String(songId)] ?? -1;
}

module.exports = {
  load,
  tryLoad,
  reloadModel,
  getModelMetadata,
  getLoadStatus,
  getUserIndex,
  getSongIndex,
  clearCache,
  resolveModelPath,
  DEFAULT_MODEL_PATH,
};
