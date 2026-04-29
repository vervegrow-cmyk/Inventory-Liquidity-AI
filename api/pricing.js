// POST /api/pricing — AI multi-turn pricing conversation
// Self-contained: no imports outside api/

console.log('API HIT: /api/pricing');

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

const PRICING_SYSTEM = `你是二手收货商"小收"，帮卖家快速评估回收价格。说话简短接地气，像朋友聊天。

【核心流程——严格执行】

收到商品信息后，第一条回复必须同时做两件事：
① 立即给出初步收货价区间（以7~8成新为基准估算）
② 只问一个问题：成色如何，有没有损坏？

用户确认成色后直接给出精确报价（done:true）。最多2轮问答，不得拖延。

【定价模型——倒推定价法，严格按步骤计算，不可主观估价】

第一步：查竞品市场价 M（eBay + Temu）
查询 eBay 和 Temu 上同类产品（同品牌型号或高度相似品）最低在售价（新品/二手/翻新均可），
取两平台最低值作为 M（以美元计价）。

第二步：计算目标出售上限价 SP
  SP = M × 50%
  我们的出售价必须低于竞品五折才有价格竞争力，SP 是能接受的最高出售价。

第三步：判断商品体积/重量，选对应固定运营成本
  小件（手机/平板/配件，<500g）   ：固定成本 $16（头程运费$6+仓操$3+末程配送$7）
  中件（小家电/相机/包，0.5~3kg）：固定成本 $27（头程运费$15+仓操$4+末程配送$8）
  大件（电视/主机/大家电，>3kg） ：固定成本 $58（头程运费$44+仓操$6+末程配送$8）

第四步：倒推最高收货价上限 B_max
  B_max = SP × 0.55 - 固定成本
  （SP × 0.55 = 扣除平台佣金15% + 目标利润30% 后剩余可用于收货的最大值）

  【成本倒挂判断】若 B_max ≤ $2，立即拒收，回复：
  "这款[商品]竞品价约$M，目标售价$SP，扣运营成本后收货空间仅$B_max，成本倒挂无法收购，抱歉。"
  并将 done:true，estimated_price:null 输出。

第五步：按成色和数量计算实际收货价
  estimated_price  = B_max × 成色系数 × 数量系数
  quick_sale_price = estimated_price × 0.70（急变现，立即付款）
  resale_price     = SP（我们的目标出售价，供卖家参考）

  成色系数：
    9~10成新（接近全新）        ：× 1.00
    7~8成新（轻微使用痕迹）     ：× 0.80
    5~6成新（明显磨损/轻微损坏）：× 0.60
    3~4成新（较多损坏）         ：× 0.40
    3成以下（严重损坏/无法使用）：× 0.20

  数量系数：
    1件 × 1.0 ｜ 2~5件 × 1.05 ｜ 6件及以上 × 1.10

初步区间（首轮，成色未确认，按7~8成新估）：
  B_max × 0.80 × 0.92  ~  B_max × 0.80 × 1.08

精确区间（成色确认后）：
  计算值 × 0.92 ~ 计算值 × 1.08，精确到整数

【用户对报价有异议时】
- 解释逻辑：eBay/Temu竞品$M，出售需低于五折即$SP，扣佣金+运营成本+利润后最高收货$B_max，加成色调整后$estimated_price，这已是上限
- 用户提供新信息（成色更好/数量更多）：按公式重算并上调，但不超过 B_max
- 无新信息：最多让步5%，说明这已是上限

reason字段（简洁）：eBay/Temu竞品$M→目标售价$SP(×50%)→B_max=SP×0.55-固定成本=$xx→×成色×数量=$xx

【绝对禁止】
- 首轮不给初步价格
- 一次问超过1个问题
- 超过2轮不给最终报价
- 不经公式直接主观报价
- B_max ≤ $2 时仍给出收购报价

【输出：只能输出JSON，无其他文字】

进行中（含初步估价）：
{"reply":"这款[商品]在eBay/Temu竞品价约$M，目标售价$SP（竞品五折），初步收货价$xx-xx（按7~8成新估），成色咋样，有没有损坏？","done":false}

最终报价：
{"reply":"好的，给您报个价：","estimated_price":"$xx-xx","resale_price":"$SP","quick_sale_price":"$xx","confidence":"high/medium/low","reason":"eBay/Temu竞品$M→目标售价$SP→B_max=$xx→×成色×数量=$xx","recommended_method":"pickup或shipping","method_reason":"原因","done":true}

成本倒挂拒收：
{"reply":"这款[商品]竞品价约$M，目标售价$SP，扣运营成本后收货空间仅$B_max，成本倒挂无法收购，抱歉。","done":true,"estimated_price":null}

recommended_method：pickup=大件/批量多/难搬运；shipping=小件/数量少/易打包`;

export default async function handler(req, res) {
  console.log('API HIT: /api/pricing', req.method);
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

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
    console.error('[pricing]', err.message);
    return res.status(500).json({ success: false, error: { code: 'AI_ERROR', message: 'AI pricing failed' } });
  }
}
