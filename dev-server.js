import 'dotenv/config';
import http from 'http';
import { pricingController } from './features/pricing/controller.js';
import { identifyController } from './features/identify/controller.js';
import { generateController } from './features/generate/controller.js';
import { groupController } from './features/identify/groupController.js';
import { logRequest, logError } from './backend/middlewares/logger.js';

const PORT = 3001;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid JSON')); }
    });
  });
}

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
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

// Primary routes following /api/{module}/{action} convention
const ROUTES = {
  '/api/pricing/calculate': pricingController,
  '/api/identify/analyze':  identifyController,
  '/api/identify/group':    groupController,
  '/api/generate/content':  generateController,
};

// Legacy aliases — kept so old frontend calls still work during migration
const LEGACY = {
  '/api/chat':     pricingController,
  '/api/identify': identifyController,
  '/api/generate': generateController,
};

http.createServer(async (req, res) => {
  const url = req.url;
  logRequest(req.method, url);

  if (req.method !== 'POST') {
    return send(res, 405, { success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method Not Allowed' } });
  }

  const controller = ROUTES[url] ?? LEGACY[url];
  if (!controller) {
    return send(res, 404, { success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
  }

  try {
    const body = await readBody(req);
    const result = await controller(body);
    send(res, httpStatus(result), result);
  } catch (err) {
    logError(url, err);
    send(res, 500, { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }
}).listen(PORT, () => {
  console.log(`API dev server running at http://localhost:${PORT}`);
  console.log('Routes: /api/pricing/calculate | /api/identify/analyze | /api/identify/group | /api/generate/content');
});
