// POST /api/ai/identify  — AI product identification
// POST /api/ai/pricing   — AI multi-turn pricing conversation
// Self-contained: no imports outside api/

console.log('api/ai/[action].js loaded');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

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

async function openaiChat({ model = 'gpt-4o-mini', messages, retries = 2 }) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1500 * attempt));
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model, messages }),
      });
      if (!res.ok) {
        const err = await res.text();
        lastErr = new Error(`OpenAI API error (${res.status}): ${err.slice(0, 200)}`);
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
  if (!image && !text) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing image or text' } });
  }
  try {
    let parsed;
    if (image) {
      const raw = await openaiChat({
        model: 'gpt-4o',
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
      const raw = await openaiChat({
        messages: [
          { role: 'system', content: '你是商品识别专家。只返回合法 JSON，不要任何解释文字。' },
          { role: 'user', content: `以下是商品表格数据，识别商品信息，返回 JSON：{"name":"商品名称","category":"类别","brand":"品牌"}\n\n${text}` },
        ],
      });
      parsed = parseJson(raw);
    }
    return res.status(200).json({ success: true, data: {
      name: parsed?.name || '未知商品',
      category: parsed?.category || '其他',
      brand: parsed?.brand || '未知',
    }});
  } catch (err) {
    console.error('[ai/identify]', err.message);
    return res.status(500).json({ success: false, error: { code: 'AI_ERROR', message: 'AI identification failed' } });
  }
}

// ── Pricing ───────────────────────────────────────────────────────────────────

const PRICING_SYSTEM = `你是二手收货商"小收"，帮卖家快速评估回收价格。说话简短接地气，像朋友聊天。

【核心流程——严格执行】

收到商品信息后，第一条回复必须同时做两件事：
① 立即给出初步收货价区间（以7~8成新为基准估算）
② 只问一个问题：成色如何，有没有损坏？

用户确认成色后直接给出精确报价（done:true）。最多2轮问答，不得拖延。

【定价模型——所有报价必须严格按公式计算，不可主观估价】

第一步：多平台比价，取最低参考价 P
分别查询以下平台同款二手成交价（不用新品零售价），取**最低价**作为 P：
  - TikTok Shop（二手/翻新成交价）
  - Whatnot（拍卖成交价）
  - eBay（Used / Sold listings 最低成交价）
  - Amazon（二手 / Renewed 最低售价）
若某平台无数据则跳过，至少参考1个平台。

第二步：三个价格字段
  resale_price（转售价）      = P              ← 四平台最低参考价
  quick_sale_price（快速出货）= P × 13%        ← 快速变现收货价（立即结款）
  estimated_price（正常收货） = P × 18% × 成色系数 × 数量系数

第三步：成色系数
  9~10成新（接近全新）        ：× 1.00
  7~8成新（轻微使用痕迹）     ：× 0.80
  5~6成新（明显磨损/轻微损坏）：× 0.60
  3~4成新（较多损坏）         ：× 0.40
  3成以下（严重损坏/无法使用）：× 0.20

第四步：数量系数
  1件 × 1.0 ｜ 2~5件 × 1.05 ｜ 6件及以上 × 1.10

初步区间（首轮，成色未确认）：
  P × 18% × 0.80 × 0.92  ~  P × 18% × 0.80 × 1.08

精确区间（成色确认后）：
  计算值 × 0.92 ~ 计算值 × 1.08，精确到整数

【用户对报价有异议时】
- 简短解释：多平台比价最低¥P，扣去50%平台费后净¥P×0.5，保留利润空间后最高收货¥P×0.18
- 用户提供新信息（成色更好/数量更多）：按公式重算并上调
- 无新信息：最多让步5%，说明这已是上限

reason字段（简洁）：多平台最低参考¥P（TikTok/Whatnot/eBay/Amazon）→ P×18%×成色系数×数量系数=¥xx

【绝对禁止】
- 首轮不给初步价格
- 一次问超过1个问题
- 超过2轮不给最终报价
- 不经公式直接主观报价

【输出：只能输出JSON，无其他文字】

进行中（含初步估价）：
{"reply":"这款[商品]在TikTok/eBay等平台二手约卖¥P，初步收货价¥xx-xx（按7~8成新估），成色咋样，有没有损坏？","done":false}

最终报价：
{"reply":"好的，给您报个价：","estimated_price":"¥xx-xx","resale_price":"¥P","quick_sale_price":"¥xx","confidence":"high/medium/low","reason":"TikTok参考价约¥P，收货=P×18%×成色系数×数量系数=¥xx","recommended_method":"pickup或shipping","method_reason":"原因","done":true}

recommended_method：pickup=大件/批量多/难搬运；shipping=小件/数量少/易打包`;

async function handlePricing(req, res) {
  const { messages } = req.body ?? {};
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing messages array' } });
  }
  try {
    const trimmed = messages.length > 9 ? [messages[0], ...messages.slice(-8)] : messages;
    const allMessages = [{ role: 'system', content: PRICING_SYSTEM }, ...trimmed];
    let text = await openaiChat({ messages: allMessages });
    let parsed = parseJson(text);
    if (!parsed) {
      text = await openaiChat({ messages: [
        ...allMessages,
        { role: 'assistant', content: text },
        { role: 'user', content: '请严格按照JSON格式回复，只输出JSON，不要任何其他文字。' },
      ]});
      parsed = parseJson(text);
    }
    if (!parsed) throw new Error('Invalid AI response after retry');
    return res.status(200).json({ success: true, data: parsed });
  } catch (err) {
    console.error('[ai/pricing]', err.message);
    return res.status(500).json({ success: false, error: { code: 'AI_ERROR', message: 'AI pricing failed' } });
  }
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

const HANDLERS = {
  identify: handleIdentify,
  pricing:  handlePricing,
};

export default async function handler(req, res) {
  console.log(`API HIT: /api/ai/${req.query.action}`, req.method);
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false });

  const fn = HANDLERS[req.query.action];
  if (!fn) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Unknown AI action: ${req.query.action}` } });
  }
  try {
    return await fn(req, res);
  } catch (err) {
    console.error(`[ai/${req.query.action}]`, err);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }
}
