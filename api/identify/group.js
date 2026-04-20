import { groupController } from '../../features/identify/groupController.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method Not Allowed' } });
  }
  const result = await groupController(req.body);
  const status = result.success ? 200 : result.error?.code === 'VALIDATION_ERROR' ? 400 : 500;
  return res.status(status).json(result);
}
