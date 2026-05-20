/**
 * Optional Redis persistence for map veto sessions (multi-instance deploys).
 * Falls back to in-memory-only when REDIS_URL is unset.
 */

let redisClient = null;
let redisReady = false;

const KEY_PREFIX = 'mapveto:session:';
const TTL_SECONDS = 4 * 60 * 60;

export async function initMapVetoStore() {
  const url = process.env.REDIS_URL || process.env.SOCKET_REDIS_URL;
  if (!url) return;

  try {
    const { createClient } = await import('redis');
    redisClient = createClient({ url });
    redisClient.on('error', (err) => {
      console.warn('Map veto Redis error:', err.message);
      redisReady = false;
    });
    await redisClient.connect();
    redisReady = true;
  } catch (err) {
    console.warn('Map veto Redis unavailable, using in-memory only:', err.message);
    redisClient = null;
    redisReady = false;
  }
}

export async function persistVetoSession(matchId, session) {
  if (!redisReady || !redisClient) return;
  try {
    await redisClient.setEx(
      `${KEY_PREFIX}${matchId}`,
      TTL_SECONDS,
      JSON.stringify(session)
    );
  } catch (err) {
    console.warn('persistVetoSession failed:', err.message);
  }
}

export async function loadVetoSession(matchId) {
  if (!redisReady || !redisClient) return null;
  try {
    const raw = await redisClient.get(`${KEY_PREFIX}${matchId}`);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('loadVetoSession failed:', err.message);
    return null;
  }
}

export async function deleteVetoSession(matchId) {
  if (!redisReady || !redisClient) return;
  try {
    await redisClient.del(`${KEY_PREFIX}${matchId}`);
  } catch (err) {
    console.warn('deleteVetoSession failed:', err.message);
  }
}
