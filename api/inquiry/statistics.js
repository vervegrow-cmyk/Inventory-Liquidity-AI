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
      return res.status(200).json({
        success: true,
        data: { total: 0, new: 0, quoted: 0, accepted: 0, rejected: 0, processing: 0, completed: 0, totalValue: 0 },
      });
    }

    const jsons = await pipeline(ids.map(id => ['GET', `inquiry:${id}`]));
    const all = jsons.filter(Boolean).map(j => JSON.parse(j));

    const count = (s) => all.filter(i => i.status === s).length;
    const stats = {
      total: all.length,
      new: count('new'),
      quoted: count('quoted'),
      accepted: count('accepted'),
      rejected: count('rejected'),
      processing: count('processing'),
      completed: count('completed'),
      totalValue: all.reduce((sum, i) => sum + (i.estimatedTotal ?? 0), 0),
    };

    return res.status(200).json({ success: true, data: stats });
  } catch (err) {
    console.error('inquiry/statistics error:', err);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '统计失败' } });
  }
}
