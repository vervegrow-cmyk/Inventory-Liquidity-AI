import { cmd, pipeline } from '../_lib/upstash.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false });

  try {
    const ids = await cmd(['LRANGE', 'inquiry:list', 0, -1]);
    if (!ids || ids.length === 0) {
      return res.status(200).json({ success: true, data: { inquiries: [] } });
    }

    const jsons = await pipeline(ids.map(id => ['GET', `inquiry:${id}`]));
    const inquiries = jsons
      .filter(Boolean)
      .map(j => JSON.parse(j))
      .filter(inq => {
        const { status } = req.body ?? {};
        return !status || inq.status === status;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.status(200).json({ success: true, data: { inquiries } });
  } catch (err) {
    console.error('inquiry/list error:', err);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '加载失败' } });
  }
}
