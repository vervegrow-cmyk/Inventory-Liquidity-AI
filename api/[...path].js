import * as auth    from './_handlers/auth.js';
import * as inquiry from './_handlers/inquiry.js';

// Single Vercel Serverless Function — dispatches all /api/* routes
// AI handlers are imported lazily so a broken AI dependency never kills auth/inquiry.

const ROUTES = {
  // Auth (stateless)
  'auth/login':    auth.login,
  'auth/logout':   auth.logout,
  'auth/register': auth.register,
  'auth/verify':   auth.verify,

  // Inquiry CRUD + logistics (Upstash / in-memory)
  'inquiry/create':        inquiry.create,
  'inquiry/list':          inquiry.list,
  'inquiry/get':           inquiry.get,
  'inquiry/update':        inquiry.update,
  'inquiry/update-status': inquiry.updateStatus,
  'inquiry/delete':        inquiry.del,
  'inquiry/statistics':    inquiry.statistics,
  'inquiry/save':          inquiry.create,   // legacy alias
  'logistics/select':      inquiry.logisticsSelect,
};

const AI_ROUTES = new Set(['pricing/calculate', 'identify/analyze', 'identify/group', 'chat', 'identify']);

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST' } });
  }

  const segments = Array.isArray(req.query.path) ? req.query.path : [req.query.path];
  const routeKey = segments.join('/');

  // Static routes (auth + inquiry)
  const staticHandler = ROUTES[routeKey];
  if (staticHandler) {
    try {
      return await staticHandler(req, res);
    } catch (err) {
      console.error(`[/api/${routeKey}]`, err);
      return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    }
  }

  // AI routes — lazy import so startup errors don't affect other routes
  if (AI_ROUTES.has(routeKey)) {
    try {
      const ai = await import('./_handlers/ai.js');
      const aiMap = {
        'pricing/calculate': ai.pricingCalculate,
        'identify/analyze':  ai.identifyAnalyze,
        'identify/group':    ai.identifyGroup,
        'chat':              ai.pricingCalculate,
        'identify':          ai.identifyAnalyze,
      };
      return await aiMap[routeKey](req, res);
    } catch (err) {
      console.error(`[/api/${routeKey} AI]`, err);
      return res.status(503).json({ success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'AI 服务暂不可用' } });
    }
  }

  return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Route not found: /api/${routeKey}` } });
}
