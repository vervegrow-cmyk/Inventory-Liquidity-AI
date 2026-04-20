export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'GET only' } });
  }
  // Vercel serverless has no persistent state; client reads from localStorage.
  res.status(200).json({ success: true, data: [], message: 'ok' });
}
