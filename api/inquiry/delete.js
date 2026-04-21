import { cmd } from '../_lib/upstash.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false });

  const { id } = req.body ?? {};
  if (!id) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'id 必填' } });

  try {
    await cmd(['LREM', 'inquiry:list', 0, id]);
    await cmd(['DEL', `inquiry:${id}`]);
    return res.status(200).json({ success: true, data: { message: '已删除' } });
  } catch (err) {
    console.error('inquiry/delete error:', err);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '删除失败' } });
  }
}
