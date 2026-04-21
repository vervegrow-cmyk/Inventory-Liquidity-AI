import { cmd } from '../_lib/upstash.js';

const VALID_TRANSITIONS = {
  new: ['quoted'],
  quoted: ['accepted', 'rejected'],
  accepted: ['processing'],
  rejected: [],
  processing: ['completed'],
  completed: [],
};

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false });

  const { id, status } = req.body ?? {};
  if (!id || !status) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'id 和 status 必填' } });
  }

  try {
    const json = await cmd(['GET', `inquiry:${id}`]);
    if (!json) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '询价不存在' } });

    const inquiry = JSON.parse(json);
    const allowed = VALID_TRANSITIONS[inquiry.status] ?? [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TRANSITION', message: `不能从 ${inquiry.status} 转换到 ${status}` },
      });
    }

    inquiry.status = status;
    inquiry.updatedAt = new Date().toISOString();
    await cmd(['SET', `inquiry:${id}`, JSON.stringify(inquiry)]);
    return res.status(200).json({ success: true, data: { inquiry } });
  } catch (err) {
    console.error('inquiry/update-status error:', err);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: '更新失败' } });
  }
}
