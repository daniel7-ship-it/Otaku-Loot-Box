import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { HttpError, validateConfig, createStripeClient, verifySandbox, buildCheckout, checkoutKey, assertTestSession } from './checkout.mjs';

async function readJson(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw new HttpError(415, 'Send JSON.');
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > 8192) throw new HttpError(413, 'Request too large.');
  }
  try { return JSON.parse(body); } catch { throw new HttpError(400, 'Invalid JSON.'); }
}

export function createApp({ config, stripe }) {
  const limits = new Map();
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Vary', 'Origin');
    const send = (status, data) => { res.writeHead(status); res.end(JSON.stringify(data)); };
    try {
      const url = new URL(req.url, 'http://backend.local');
      if (url.pathname === '/health' && req.method === 'GET') return send(200, { mode: 'test', fulfillment: 'disabled' });
      if (req.headers.origin !== config.origin) throw new HttpError(403, 'Storefront origin is not allowed.');
      res.setHeader('Access-Control-Allow-Origin', config.origin);
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.writeHead(204); return res.end();
      }
      // Bound memory and requests. Configure shared rate limiting at the host for multiple instances.
      const now = Date.now();
      for (const [key, value] of limits) if (value.reset <= now) limits.delete(key);
      const ip = req.socket.remoteAddress;
      if (!limits.has(ip) && limits.size >= 10000) throw new HttpError(429, 'Please try again shortly.');
      const limit = limits.get(ip) || { count: 0, reset: now + 60000 };
      limits.set(ip, limit);
      if (++limit.count > 30) throw new HttpError(429, 'Too many requests. Please wait a minute.');

      if (url.pathname === '/api/checkout' && req.method === 'POST') {
        const body = await readJson(req);
        const parameters = buildCheckout(body?.items, config.storefront);
        const session = await stripe('/checkout/sessions', { body: parameters, idempotencyKey: checkoutKey(body?.requestId, parameters) });
        assertTestSession(session);
        const target = new URL(session.url);
        if (target.origin !== 'https://checkout.stripe.com' || target.username || target.password) throw new HttpError(502, 'Invalid Stripe checkout URL.');
        return send(200, { url: target.href, mode: 'test' });
      }
      if (url.pathname === '/api/checkout/status' && req.method === 'GET') {
        const id = url.searchParams.get('session_id') || '';
        if (!/^cs_test_[A-Za-z0-9]{1,200}$/.test(id)) throw new HttpError(400, 'A test session ID is required.');
        const session = await stripe(`/checkout/sessions/${id}`);
        assertTestSession(session);
        // Return no email, shipping address, or other personal information.
        return send(200, { mode: 'test', status: session.status, paymentStatus: session.payment_status, fulfillment: 'disabled' });
      }
      throw new HttpError(404, 'Not found.');
    } catch (error) {
      send(error instanceof HttpError ? error.status : 500,
        { error: error instanceof HttpError ? error.message : 'Checkout is unavailable. Please try again.' });
    }
  });
}

export async function start(env = process.env) {
  const config = validateConfig(env);
  const stripe = createStripeClient(config.secret);
  await verifySandbox(stripe);
  const server = createApp({ config, stripe });
  server.requestTimeout = 20000;
  server.headersTimeout = 10000;
  server.listen(Number(env.PORT || 4242), env.HOST || '127.0.0.1', () => console.log('Otaku checkout ready: Cassius sandbox, test mode, fulfillment disabled.'));
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  start().catch(() => {
    console.error('Backend startup refused. Check the Cassius test key, account permissions, network, and STOREFRONT_URL.');
    process.exitCode = 1;
  });
}
