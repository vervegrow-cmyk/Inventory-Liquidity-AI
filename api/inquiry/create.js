import { cmd } from '../_lib/upstash.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function parsePrice(v) {
  if (typeof v === 'number') return v;
  return parseFloat(String(v ?? 0).replace(/[^0-9.]/g, '')) || 0;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false });

  const { userName, contact, userType = 'personal', note = '', products = [], estimatedTotal } = req.body ?? {};

  if (!userName || !contact) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: '姓名和联系方式不能为空' },
    });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const inquiry = {
    id,
    userName,
    customerName: userName,
    contact,
    phone: contact,
    userType,
    status: 'new',
    estimatedTotal: typeof estimatedTotal === 'number' ? estimatedTotal : parsePrice(estimatedTotal),
    note: note ?? '',
    products: (products ?? []).map(p => ({
      id: crypto.randomUUID(),
      inquiryId: id,
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
    createdAt: now,
    updatedAt: now,
  };

  try {
    await cmd(['SET', `inquiry:${id}`, JSON.stringify(inquiry)]);
    await cmd(['LPUSH', 'inquiry:list', id]);
    return res.status(200).json({ success: true, data: { inquiry } });
  } catch (err) {
    console.error('inquiry/create error:', err);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '存储失败，请检查数据库配置' } });
  }
}
