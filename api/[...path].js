// Single catch-all — handles ALL /api/* routes
// Fully self-contained: zero imports from outside api/

// ── CORS ─────────────────────────────────────────────────────────────────────

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ── Storage (Upstash Redis + in-memory fallback) ──────────────────────────────

const USE_REDIS = !!(
  (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) &&
  (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)
);

const memStrings = new Map();
const memLists   = new Map();

function memCmd([op, key, ...args]) {
  switch (op) {
    case 'SET':    memStrings.set(key, args[0]); return 'OK';
    case 'GET':    return memStrings.get(key) ?? null;
    case 'DEL':    { const had = memStrings.has(key); memStrings.delete(key); return had ? 1 : 0; }
    case 'LPUSH':  { const list = memLists.get(key) ?? []; list.unshift(args[0]); memLists.set(key, list); return list.length; }
    case 'LRANGE': { const list = memLists.get(key) ?? []; const s = parseInt(args[0], 10), e = parseInt(args[1], 10); return e === -1 ? list.slice(s) : list.slice(s, e + 1); }
    case 'LREM':   { const list = memLists.get(key) ?? []; const next = list.filter(v => v !== args[1]); memLists.set(key, next); return list.length - next.length; }
    default: return null;
  }
}

function getRedisConfig() {
  return {
    url:   process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
  };
}

async function redisCmd(command) {
  const { url, token } = getRedisConfig();
  const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(command) });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

async function redisPipeline(commands) {
  const { url, token } = getRedisConfig();
  const res = await fetch(`${url}/pipeline`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(commands) });
  const results = await res.json();
  return results.map(r => r.result);
}

async function dbCmd(command)      { return USE_REDIS ? redisCmd(command)       : Promise.resolve(memCmd(command)); }
async function dbPipeline(commands){ return USE_REDIS ? redisPipeline(commands) : Promise.resolve(commands.map(memCmd)); }

// ── Auth ──────────────────────────────────────────────────────────────────────

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = '123456';

function authLogin(req, res) {
  const { username, password } = req.body ?? {};
  if (!username || !password) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '用户名和密码不能为空' } });
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: '用户名或密码错误' } });
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const token = Buffer.from(JSON.stringify({ username, role: 'admin', expiresAt })).toString('base64');
  return res.status(200).json({ success: true, data: { token, user: { username, role: 'admin' }, expiresAt } });
}

function authLogout(_req, res) {
  return res.status(200).json({ success: true, data: { message: '已退出登录' } });
}

function authRegister(_req, res) {
  return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '注册功能已关闭，请联系管理员' } });
}

function authVerify(req, res) {
  const { token } = req.body ?? {};
  if (!token) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'token 必填' } });
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
    if (!payload.username || !payload.expiresAt) throw new Error('invalid');
    if (new Date(payload.expiresAt) < new Date()) return res.status(401).json({ success: false, error: { code: 'TOKEN_EXPIRED', message: '登录已过期' } });
    return res.status(200).json({ success: true, data: { user: { username: payload.username, role: payload.role } } });
  } catch {
    return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: '无效的 token' } });
  }
}

// ── Inquiry ───────────────────────────────────────────────────────────────────

function parsePrice(v) {
  if (typeof v === 'number') return v;
  return parseFloat(String(v ?? 0).replace(/[^0-9.]/g, '')) || 0;
}

const VALID_TRANSITIONS = {
  new:              ['quoted', 'pending_recovery', 'accepted'],
  quoted:           ['pending_recovery', 'accepted', 'rejected'],
  pending_recovery: ['accepted', 'processing', 'completed'],
  accepted:         ['processing'],
  rejected:         [],
  processing:       ['completed'],
  completed:        [],
};

const VALID_INIT_STATUSES = ['new', 'pending_recovery', 'accepted'];

async function inquiryCreate(req, res) {
  const { userName, contact, address = '', userType = 'personal', note = '', status: reqStatus, products = [], estimatedTotal } = req.body ?? {};
  if (!userName || !contact) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: '姓名和联系方式不能为空' } });
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const inquiry = {
    id,
    userName, customerName: userName,
    contact, phone: contact,
    address: address ?? '',
    userType,
    status: (reqStatus && VALID_INIT_STATUSES.includes(reqStatus)) ? reqStatus : 'new',
    estimatedTotal: typeof estimatedTotal === 'number' ? estimatedTotal : parsePrice(estimatedTotal),
    note: note ?? '',
    products: (products ?? []).map(p => ({
      id: crypto.randomUUID(), inquiryId: id,
      title: p.title ?? p.name ?? '未知商品',
      name: p.name ?? p.title ?? '未知商品',
      category: p.category ?? '其他',
      brand: p.brand ?? '未知品牌',
      images: p.images ?? (p.thumbnail ? [p.thumbnail] : []),
      thumbnail: p.thumbnail ?? p.images?.[0] ?? null,
      condition: p.condition ?? 'used',
      estimatedPrice: parsePrice(p.estimatedPrice),
      quantity: typeof p.quantity === 'number' ? p.quantity : 1,
    })),
    createdAt: now, updatedAt: now,
  };
  try {
    await dbCmd(['SET', `inquiry:${id}`, JSON.stringify(inquiry)]);
    await dbCmd(['LPUSH', 'inquiry:list', id]);
    return res.status(200).json({ success: true, data: { inquiry } });
  } catch (err) {
    console.error('inquiry/create error:', err);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '存储失败，请检查数据库配置' } });
  }
}

async function inquiryList(req, res) {
  try {
    const ids = await dbCmd(['LRANGE', 'inquiry:list', 0, -1]);
    if (!ids || ids.length === 0) return res.status(200).json({ success: true, data: { inquiries: [] } });
    const jsons = await dbPipeline(ids.map(id => ['GET', `inquiry:${id}`]));
    const { status } = req.body ?? {};
    const inquiries = jsons
      .filter(Boolean).map(j => JSON.parse(j))
      .filter(inq => !status || inq.status === status)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.status(200).json({ success: true, data: { inquiries } });
  } catch (err) {
    console.error('inquiry/list error:', err);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '加载失败' } });
  }
}

async function inquiryGet(req, res) {
  const { id } = req.body ?? {};
  if (!id) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'id 必填' } });
  try {
    const json = await dbCmd(['GET', `inquiry:${id}`]);
    if (!json) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '询价不存在' } });
    return res.status(200).json({ success: true, data: { inquiry: JSON.parse(json) } });
  } catch (err) {
    console.error('inquiry/get error:', err);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '查询失败' } });
  }
}

async function inquiryUpdate(req, res) {
  const { id, ...patch } = req.body ?? {};
  if (!id) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'id 必填' } });
  try {
    const json = await dbCmd(['GET', `inquiry:${id}`]);
    if (!json) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '询价不存在' } });
    const inquiry = { ...JSON.parse(json), ...patch, id, updatedAt: new Date().toISOString() };
    await dbCmd(['SET', `inquiry:${id}`, JSON.stringify(inquiry)]);
    return res.status(200).json({ success: true, data: { inquiry } });
  } catch (err) {
    console.error('inquiry/update error:', err);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '更新失败' } });
  }
}

async function inquiryUpdateStatus(req, res) {
  const { id, status } = req.body ?? {};
  if (!id || !status) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'id 和 status 必填' } });
  try {
    const json = await dbCmd(['GET', `inquiry:${id}`]);
    if (!json) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '询价不存在' } });
    const inquiry = JSON.parse(json);
    const allowed = VALID_TRANSITIONS[inquiry.status] ?? [];
    if (!allowed.includes(status)) return res.status(400).json({ success: false, error: { code: 'INVALID_TRANSITION', message: `不能从 ${inquiry.status} 转换到 ${status}` } });
    inquiry.status = status;
    inquiry.updatedAt = new Date().toISOString();
    await dbCmd(['SET', `inquiry:${id}`, JSON.stringify(inquiry)]);
    return res.status(200).json({ success: true, data: { inquiry } });
  } catch (err) {
    console.error('inquiry/update-status error:', err);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '更新失败' } });
  }
}

async function inquiryDelete(req, res) {
  const { id } = req.body ?? {};
  if (!id) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'id 必填' } });
  try {
    await dbCmd(['LREM', 'inquiry:list', 0, id]);
    await dbCmd(['DEL', `inquiry:${id}`]);
    return res.status(200).json({ success: true, data: { message: '已删除' } });
  } catch (err) {
    console.error('inquiry/delete error:', err);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '删除失败' } });
  }
}

async function inquiryStatistics(_req, res) {
  try {
    const ids = await dbCmd(['LRANGE', 'inquiry:list', 0, -1]);
    if (!ids || ids.length === 0) return res.status(200).json({ success: true, data: { total: 0, new: 0, quoted: 0, pending_recovery: 0, accepted: 0, rejected: 0, processing: 0, completed: 0, totalValue: 0 } });
    const jsons = await dbPipeline(ids.map(id => ['GET', `inquiry:${id}`]));
    const all = jsons.filter(Boolean).map(j => JSON.parse(j));
    const count = s => all.filter(i => i.status === s).length;
    return res.status(200).json({ success: true, data: { total: all.length, new: count('new'), quoted: count('quoted'), pending_recovery: count('pending_recovery'), accepted: count('accepted'), rejected: count('rejected'), processing: count('processing'), completed: count('completed'), totalValue: all.reduce((sum, i) => sum + (i.estimatedTotal ?? 0), 0) } });
  } catch (err) {
    console.error('inquiry/statistics error:', err);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '统计失败' } });
  }
}

async function logisticsSelect(req, res) {
  const { inquiryId, type, address, contactName, contactPhone, timeSlot, shippingAddress, notes } = req.body ?? {};
  if (!inquiryId || !type) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'inquiryId 和 type 必填' } });
  try {
    const json = await dbCmd(['GET', `inquiry:${inquiryId}`]);
    if (!json) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '询价不存在' } });
    const inquiry = JSON.parse(json);
    inquiry.logistics = { type, address, contactName, contactPhone, timeSlot, shippingAddress, notes };
    inquiry.acceptedShippingMethod = type;
    inquiry.updatedAt = new Date().toISOString();
    await dbCmd(['SET', `inquiry:${inquiryId}`, JSON.stringify(inquiry)]);
    return res.status(200).json({ success: true, data: { logistics: inquiry.logistics } });
  } catch (err) {
    console.error('logistics/select error:', err);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '保存失败' } });
  }
}

// ── AI helpers ────────────────────────────────────────────────────────────────

function parseJson(text) {
  try { return JSON.parse(text.trim()); } catch { /* */ }
  const stripped = text.replace(/```(?:json)?/gi, '').trim();
  try { return JSON.parse(stripped); } catch { /* */ }
  let depth = 0, start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') { if (depth === 0) start = i; depth++; }
    else if (text[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        try { return JSON.parse(text.slice(start, i + 1)); } catch { start = -1; }
      }
    }
  }
  return null;
}

async function kimiChat({ model = 'moonshot-v1-8k', messages, retries = 2 }) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1500 * attempt));
    try {
      const res = await fetch('https://api.moonshot.cn/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.KIMI_API_KEY}` },
        body: JSON.stringify({ model, messages }),
      });
      if (!res.ok) {
        const err = await res.text();
        lastErr = new Error(`Kimi API error (${res.status}): ${err.slice(0, 200)}`);
        if (res.status >= 500 && attempt < retries) continue;
        throw lastErr;
      }
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? '';
    } catch (err) {
      lastErr = err;
      if (attempt < retries) continue;
    }
  }
  throw lastErr;
}

// ── Identify ──────────────────────────────────────────────────────────────────

async function handleIdentify(req, res) {
  const { image, text } = req.body ?? {};
  if (!image && !text) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing image or text' } });
  try {
    let parsed;
    if (image) {
      const raw = await kimiChat({
        model: 'moonshot-v1-8k-vision-preview',
        messages: [
          { role: 'system', content: '你是商品识别专家。只返回合法 JSON，不要任何解释文字。' },
          { role: 'user', content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image}` } },
            { type: 'text', text: '识别图片中的商品，返回 JSON 格式：{"name":"商品名称","category":"商品类别","brand":"品牌，不确定则填未知"}' },
          ]},
        ],
      });
      parsed = parseJson(raw);
    } else {
      const raw = await kimiChat({
        messages: [
          { role: 'system', content: '你是商品识别专家。只返回合法 JSON，不要任何解释文字。' },
          { role: 'user', content: `以下是商品表格数据，识别商品信息，返回 JSON：{"name":"商品名称","category":"类别","brand":"品牌"}\n\n${text}` },
        ],
      });
      parsed = parseJson(raw);
    }
    return res.status(200).json({ success: true, data: { name: parsed?.name || '未知商品', category: parsed?.category || '其他', brand: parsed?.brand || '未知' } });
  } catch (err) {
    console.error('[identify]', err.message);
    return res.status(500).json({ success: false, error: { code: 'AI_ERROR', message: 'AI identification failed' } });
  }
}

// ── Pricing ───────────────────────────────────────────────────────────────────

const PRICING_SYSTEM = `你是二手收货商"小收"，通过微信帮卖家评估回收价格。说话接地气、简短，像朋友聊天。

【每轮对话做两件事】
1. 用1句话回应用户说的内容（不管是什么，都先接一下）
2. 问下一个最关键的未知问题（只问1个）

【需要了解的信息，按优先级】
1. 成色：几成新，有没有损坏/污渍/掉色
2. 数量：几件，整批还是单件
3. 使用时长（如果不知道就跳过）
4. 品牌（表格里没有才问）

【处理用户回复的铁律】
✅ 必须接受的回复（直接推进，绝不重复问同一问题）：
- 短词：是、否、好、一般、还行、差、没有、有
- 俚语：山炮吧、凑合、不咋地、将就、还凑合
- "不知道"/"忘了"/"不清楚" → 说"没关系，这个不影响报价"，然后问下一个问题
- 任何能从上下文理解意图的内容

❌ 仅以下情况要求重答（全部满足才算无效）：
- 完全随机键盘乱敲（如"qazxswedc"）AND 与问题毫无关联

【绝对禁止】
- 重复问同一个问题（哪怕答案模糊，解读后推进）
- 用户说"不知道/忘了"后继续问同一个问题
- 超过5轮不给估价

【输出：只能输出JSON，无其他文字】

进行中：{"reply":"回应+下一个问题","done":false}

完成估价：{"reply":"好的，给您报个价：","estimated_price":"¥xx-xx","resale_price":"¥xx-xx","quick_sale_price":"¥xx-xx","confidence":"high/medium/low","reason":"简短估价依据","recommended_method":"pickup或shipping","method_reason":"推荐原因","done":true}

recommended_method：pickup=大件/批量多/难搬运；shipping=小件/数量少/易打包`;

async function handlePricing(req, res) {
  const { messages } = req.body ?? {};
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing messages array' } });
  try {
    const trimmed = messages.length > 9 ? [messages[0], ...messages.slice(-8)] : messages;
    const allMessages = [{ role: 'system', content: PRICING_SYSTEM }, ...trimmed];
    let text = await kimiChat({ messages: allMessages });
    let parsed = parseJson(text);
    if (!parsed) {
      text = await kimiChat({ messages: [
        ...allMessages,
        { role: 'assistant', content: text },
        { role: 'user', content: '请严格按照JSON格式回复，只输出JSON，不要任何其他文字。' },
      ]});
      parsed = parseJson(text);
    }
    if (!parsed) throw new Error('Invalid AI response after retry');
    return res.status(200).json({ success: true, data: parsed });
  } catch (err) {
    console.error('[pricing]', err.message);
    return res.status(500).json({ success: false, error: { code: 'AI_ERROR', message: 'AI pricing failed' } });
  }
}

// ── Route table ───────────────────────────────────────────────────────────────

const ROUTES = {
  'auth/login':              authLogin,
  'auth/logout':             authLogout,
  'auth/register':           authRegister,
  'auth/verify':             authVerify,
  'inquiry/create':          inquiryCreate,
  'inquiry/save':            inquiryCreate,
  'inquiry/list':            inquiryList,
  'inquiry/get':             inquiryGet,
  'inquiry/update':          inquiryUpdate,
  'inquiry/update-status':   inquiryUpdateStatus,
  'inquiry/delete':          inquiryDelete,
  'inquiry/statistics':      inquiryStatistics,
  'logistics/select':        logisticsSelect,
  'identify/analyze':        handleIdentify,
  'pricing/calculate':       handlePricing,
};

// ── Entry point ───────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false });

  const segments = Array.isArray(req.query.path) ? req.query.path : [req.query.path];
  const routeKey = segments.join('/');
  const fn = ROUTES[routeKey];
  if (!fn) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Unknown route: /api/${routeKey}` } });
  }
  try {
    return await fn(req, res);
  } catch (err) {
    console.error(`[${routeKey}]`, err);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }
}
