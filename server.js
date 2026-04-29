import 'dotenv/config';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR  = path.join(__dirname, 'dist');
const PORT      = process.env.PORT || 3001;

// ── MIME types ────────────────────────────────────────────────────────────

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.webp': 'image/webp',
};

function serveStatic(res, filePath) {
  const ext      = path.extname(filePath).toLowerCase();
  const mimeType = MIME[ext] || 'application/octet-stream';
  const content  = fs.readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': mimeType });
  res.end(content);
}

function serveIndex(res) {
  const indexPath = path.join(DIST_DIR, 'index.html');
  const content   = fs.readFileSync(indexPath);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(content);
}

// ── Route table ───────────────────────────────────────────────────────────

const ROUTES = {
  '/api/auth/login':    authLoginController,
  '/api/auth/register': authRegisterController,
  '/api/auth/logout':   authLogoutController,
  '/api/auth/verify':   authVerifyController,

  '/api/inquiry/create':        inquiryCreateController,
  '/api/inquiry/list':          inquiryListController,
  '/api/inquiry/detail':        inquiryDetailController,
  '/api/inquiry/update':        inquiryUpdateController,
  '/api/inquiry/update-status': inquiryUpdateStatusController,
  '/api/inquiry/delete':        inquiryDeleteController,
  '/api/inquiry/statistics':    inquiryStatisticsController,

  '/api/decision/submit': decisionSubmitController,
  '/api/decision/get':    decisionGetController,

  '/api/logistics/select': logisticsSelectController,
  '/api/logistics/detail': logisticsDetailController,

  '/api/admin/inquiry/list':   adminInquiryListController,
  '/api/admin/inquiry/detail': adminInquiryDetailController,
  '/api/admin/inquiry/update': adminInquiryUpdateController,

  '/api/pricing/calculate': pricingController,
  '/api/identify/analyze':  identifyController,
  '/api/identify/group':    groupController,
  '/api/generate/content':  generateController,

  '/api/recovery/create':       recoveryCreateController,
  '/api/recovery/batch-create': recoveryBatchCreateController,
  '/api/recovery/list':         recoveryListController,
  '/api/recovery/status':       recoveryStatusController,
};

const LEGACY = {
  '/api/chat':         pricingController,
  '/api/identify':     identifyController,
  '/api/pricing':      pricingController,
  '/api/ai/identify':  identifyController,
  '/api/ai/pricing':   pricingController,
  '/api/generate':     generateController,
  '/api/inquiry/save': inquiryCreateController,
  '/api/inquiry/get':  inquiryDetailController,
};

// ── Helpers ───────────────────────────────────────────────────────────────

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

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
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

// ── Server ────────────────────────────────────────────────────────────────

http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  logRequest(req.method, url);

  // API routes
  if (url.startsWith('/api/')) {
    if (req.method !== 'POST') {
      sendJson(res, 405, { success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST' } });
      return;
    }
    const controller = ROUTES[url] ?? LEGACY[url];
    if (!controller) {
      sendJson(res, 404, { success: false, error: { code: 'NOT_FOUND', message: `Route not found: ${url}` } });
      return;
    }
    try {
      const body   = await readBody(req);
      const result = await controller(body);
      sendJson(res, httpStatus(result), result);
    } catch (err) {
      logError(url, err);
      sendJson(res, 500, { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    }
    return;
  }

  // Static file serving (GET only)
  if (req.method !== 'GET') {
    sendJson(res, 405, { success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET' } });
    return;
  }

  const filePath = path.join(DIST_DIR, url === '/' ? 'index.html' : url);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    try {
      serveStatic(res, filePath);
    } catch (err) {
      logError(url, err);
      res.writeHead(500); res.end('Internal Server Error');
    }
    return;
  }

  // SPA fallback
  try {
    serveIndex(res);
  } catch {
    res.writeHead(404); res.end('Not Found — run npm run build first');
  }

}).listen(PORT, () => {
  console.log(`\n🚀  Server  →  http://localhost:${PORT}`);
  console.log('   Static files from ./dist');
  console.log('   API routes at /api/*\n');
});
