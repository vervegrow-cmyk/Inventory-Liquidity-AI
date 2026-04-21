// Upstash Redis REST helper — NOT a Vercel route (underscore prefix)
// Falls back to in-memory storage when Redis env vars are not configured.
// In-memory data persists within a Lambda warm instance (minutes to hours);
// a cold start resets it. Set UPSTASH_REDIS_REST_URL + TOKEN for full persistence.

const USE_REDIS = !!(
  (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) &&
  (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)
);

// ── In-memory fallback ────────────────────────────────────────────────────────

const memStrings = new Map();
const memLists   = new Map();

function memCmd([op, key, ...args]) {
  switch (op) {
    case 'SET':    memStrings.set(key, args[0]); return 'OK';
    case 'GET':    return memStrings.get(key) ?? null;
    case 'DEL':    { const had = memStrings.has(key); memStrings.delete(key); return had ? 1 : 0; }
    case 'LPUSH':  {
      const list = memLists.get(key) ?? [];
      list.unshift(args[0]);
      memLists.set(key, list);
      return list.length;
    }
    case 'LRANGE': {
      const list = memLists.get(key) ?? [];
      const start = parseInt(args[0], 10);
      const end   = parseInt(args[1], 10);
      return end === -1 ? list.slice(start) : list.slice(start, end + 1);
    }
    case 'LREM':   {
      const list = memLists.get(key) ?? [];
      const next = list.filter(v => v !== args[1]);
      memLists.set(key, next);
      return list.length - next.length;
    }
    default: return null;
  }
}

// ── Redis REST helpers ────────────────────────────────────────────────────────

function getConfig() {
  const url   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return { url, token };
}

async function redisCmd(command) {
  const { url, token } = getConfig();
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

async function redisPipeline(commands) {
  const { url, token } = getConfig();
  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  const results = await res.json();
  return results.map(r => r.result);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function cmd(command) {
  return USE_REDIS ? redisCmd(command) : Promise.resolve(memCmd(command));
}

export async function pipeline(commands) {
  return USE_REDIS ? redisPipeline(commands) : Promise.resolve(commands.map(memCmd));
}

export { USE_REDIS };
