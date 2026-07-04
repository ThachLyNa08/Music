// src/config/redis.js
const { createClient } = require('redis');

const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    reconnectStrategy: (retries) => {
      // Stop retrying after 1 attempt to avoid blocking the server startup
      return new Error('Redis connection failed');
    }
  },
  password: process.env.REDIS_PASSWORD || undefined,
});

let isRedisConnected = false;

redisClient.on('error', (err) => {
  // Silent console logs for connection attempts to prevent terminal clutter
  if (err.code !== 'ECONNREFUSED') {
    console.error('❌ Redis error:', err.message || err);
  }
});

redisClient.on('connect', () => {
  isRedisConnected = true;
  if (process.argv.includes('--debug')) {
    console.log('✅ Redis connected successfully');
  }
});

redisClient.on('end', () => {
  isRedisConnected = false;
});

async function connectRedis() {
  try {
    await redisClient.connect();
  } catch (err) {
    if (process.argv.includes('--debug')) {
      console.warn('⚠️  Redis server is not running. Caching is disabled, falling back to direct database queries.');
    }
  }
}

// Helper: lấy giá trị đã parse JSON
async function getCache(key) {
  if (!isRedisConnected) return null;
  try {
    const val = await redisClient.get(key);
    return val ? JSON.parse(val) : null;
  } catch (err) {
    return null;
  }
}

// Helper: set giá trị với TTL (giây)
async function setCache(key, value, ttlSeconds = 3600) {
  if (!isRedisConnected) return;
  try {
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch (err) {
    // Ignore error
  }
}

async function deleteCache(key) {
  if (!isRedisConnected) return;
  try {
    await redisClient.del(key);
  } catch (err) {
    // Ignore error
  }
}

module.exports = { redisClient, connectRedis, getCache, setCache, deleteCache };
