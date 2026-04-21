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
  if (!image && !text) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing image or text' } });
  }
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
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing messages array' } });
  }
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
