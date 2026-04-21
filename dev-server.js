import 'dotenv/config';
import http from 'http';
import { logRequest, logError } from './backend/middlewares/logger.js';

// ── Feature controllers ───────────────────────────────────────────────────
import { pricingController }    from './features/pricing/controller.js';
import { identifyController }   from './features/identify/controller.js';
import { generateController }   from './features/generate/controller.js';
import { groupController }      from './features/identify/groupController.js';
import {
  recoveryCreateController,
  recoveryBatchCreateController,
  recoveryListController,
  recoveryStatusController,
} from './features/recovery/controller.js';
import {
  authLoginController,
  authRegisterController,
  authLogoutController,
  authVerifyController,
} from './features/auth/controller.js';

// ── Inquiry module (refactored: controller → service → repository → db) ───
import {
  inquiryCreateController,
  inquiryListController,
  inquiryDetailController,
  inquiryUpdateController,
  inquiryUpdateStatusController,
  inquiryDeleteController,
  inquiryStatisticsController,
  decisionSubmitController,
  decisionGetController,
  logisticsSelectController,
  logisticsDetailController,
  adminInquiryListController,
  adminInquiryDetailController,
  adminInquiryUpdateController,
} from './features/inquiry/controller.js';

const PORT = 3001;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      if (!body) { resolve({}); return; }
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error('Invalid JSON')); }
    });
  });
}

function send(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
}

function httpStatus(result) {
  if (result.success) return 200;
  switch (result.error?.code) {
    case 'VALIDATION_ERROR': return 400;
    case 'UNAUTHORIZED':     return 401;
    case 'NOT_FOUND':        return 404;
    default:                 return 500;
  }
}

// ── Route table ───────────────────────────────────────────────────────────

const ROUTES = {
  // Auth
  '/api/auth/login':    authLoginController,
  '/api/auth/register': authRegisterController,
  '/api/auth/logout':   authLogoutController,
  '/api/auth/verify':   authVerifyController,

  // Inquiry (new layered architecture)
  '/api/inquiry/create':        inquiryCreateController,
  '/api/inquiry/list':          inquiryListController,
  '/api/inquiry/detail':        inquiryDetailController,
  '/api/inquiry/update':        inquiryUpdateController,
  '/api/inquiry/update-status': inquiryUpdateStatusController,
  '/api/inquiry/delete':        inquiryDeleteController,
  '/api/inquiry/statistics':    inquiryStatisticsController,

  // Decision
  '/api/decision/submit': decisionSubmitController,
  '/api/decision/get':    decisionGetController,

  // Logistics
  '/api/logistics/select': logisticsSelectController,
  '/api/logistics/detail': logisticsDetailController,

  // Admin (recycler / admin role)
  '/api/admin/inquiry/list':   adminInquiryListController,
  '/api/admin/inquiry/detail': adminInquiryDetailController,
  '/api/admin/inquiry/update': adminInquiryUpdateController,

  // AI / Valuation
  '/api/pricing/calculate': pricingController,
  '/api/identify/analyze':  identifyController,
  '/api/identify/group':    groupController,
  '/api/generate/content':  generateController,

  // Recovery (legacy, kept for compatibility)
  '/api/recovery/create':       recoveryCreateController,
  '/api/recovery/batch-create': recoveryBatchCreateController,
  '/api/recovery/list':         recoveryListController,
  '/api/recovery/status':       recoveryStatusController,
};

// Legacy aliases — old frontend calls still work
const LEGACY = {
  '/api/chat':     pricingController,
  '/api/identify': identifyController,
  '/api/pricing':     pricingController,
  '/api/ai/identify': identifyController,
  '/api/ai/pricing':  pricingController,
  '/api/generate': generateController,

  // Map old /api/inquiry/save → new create
  '/api/inquiry/save': inquiryCreateController,
  // Map old /api/inquiry/get → new detail
  '/api/inquiry/get':  inquiryDetailController,
};

// ── Server ────────────────────────────────────────────────────────────────

http.createServer(async (req, res) => {
  const url = req.url;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    send(res, 204, {});
    return;
  }

  logRequest(req.method, url);

  if (req.method !== 'POST') {
    send(res, 405, { success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST' } });
    return;
  }

  const controller = ROUTES[url] ?? LEGACY[url];
  if (!controller) {
    send(res, 404, { success: false, error: { code: 'NOT_FOUND', message: `Route not found: ${url}` } });
    return;
  }

  try {
    const body   = await readBody(req);
    const result = await controller(body);
    send(res, httpStatus(result), result);
  } catch (err) {
    logError(url, err);
    send(res, 500, { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }

}).listen(PORT, () => {
  console.log(`\n🚀  API server  →  http://localhost:${PORT}`);
  console.log('─────────────────────────────────────────');
  console.log('Auth      POST /api/auth/{login|register|logout|verify}');
  console.log('Inquiry   POST /api/inquiry/{create|list|detail|update|delete|statistics}');
  console.log('Decision  POST /api/decision/{submit|get}');
  console.log('Logistics POST /api/logistics/{select|detail}');
  console.log('Admin     POST /api/admin/inquiry/{list|detail|update}');
  console.log('AI        POST /api/pricing/calculate  /api/identify/analyze');
  console.log('─────────────────────────────────────────\n');
});
