import { createServer } from 'node:http';
import { prepareCheckout } from './pricing.mjs';
import { pathToFileURL } from 'node:url';
import { verifySignature, captureOrder, authorized } from './orders.mjs';
import { configureOrders } from './order-config.mjs';
import { HttpError, validateConfig, createStripeClient, verifySandbox, assertTestSession } from './checkout.mjs';
import { updateOrder, notificationLog, supplierPurchasePlan, claimToken, hashToken, requireClaim, transitionOrder, validateAgentId, validateText } from './fulfillment.mjs';

async function readJson(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw new HttpError(415, 'Send JSON.');
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > 8192) throw new HttpError(413, 'Request too large.');
  }
  try { return JSON.parse(body); } catch { throw new HttpError(400, 'Invalid JSON.'); }
}

export function createApp({ config, stripe, orders }) {
  const limits = new Map();
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Vary', 'Origin');
    const send = (status, data) => { res.writeHead(status); res.end(JSON.stringify(data)); };
    try {
      const url = new URL(req.url, 'http://backend.local');
      if (url.pathname === '/api/stripe/webhook' && req.method === 'POST') {
        if (!orders || !config.webhookSecret) throw new HttpError(503, 'Order recording is not configured.');
        const chunks = []; let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 262144) throw new HttpError(413, 'Request too large.');
          chunks.push(chunk);
        }
        const raw = Buffer.concat(chunks);
        verifySignature(raw, req.headers['stripe-signature'], config.webhookSecret);
        let event;
        try { event = JSON.parse(raw); } catch { throw new HttpError(400, 'Invalid JSON.'); }
        await captureOrder(event, stripe, orders);
        return send(200, { received: true });
      }
      if (url.pathname === '/api/orders' && req.method === 'GET') {
        if (!orders || !config.agentToken) throw new HttpError(503, 'Order access is not configured.');
        if (!authorized(req.headers.authorization, config.agentToken)) throw new HttpError(401, 'Unauthorized.');
        return send(200, { mode: 'test', purchasingEnabled: false, orders: await orders.list() });
      }
      if (url.pathname.startsWith('/api/orders/') && req.method === 'POST') {
        if (!orders || !config.agentToken) throw new HttpError(503, 'Order access is not configured.');
        if (!authorized(req.headers.authorization, config.agentToken)) throw new HttpError(401, 'Unauthorized.');
        const match = url.pathname.match(/^\/api\/orders\/(cs_test_[A-Za-z0-9]{1,200})\/(claim|purchase-plan|supplier-confirmation|tracking)$/);
        if (!match) throw new HttpError(404, 'Not found.');
        if (!orders.directory) throw new HttpError(503, 'Agent order updates are not enabled for this storage provider.');
        const [, id, action] = match; const body = await readJson(req); const log = notificationLog(orders.directory);
        const current = await orders.get(id); if (!current) throw new HttpError(404, 'Order not found.');
        if (action === 'claim') {
          validateAgentId(body.agentId); const token = claimToken(); let conflict = false;
          const order = await updateOrder(orders.directory, id, old => { if (old.claimedBy || old.status !== 'ready_for_purchase' || old.fundingStatus !== 'available') { conflict = true; return old; } return { ...transitionOrder(old, 'claimed'), claimedBy: body.agentId, claimTokenHash: hashToken(token), claimedAt: new Date().toISOString() }; });
          if (conflict) throw new HttpError(409, 'Order is already claimed or not ready for purchase.');
          await log.add({ orderId: id, kind: 'progress', message: `Order claimed by ${body.agentId}` }); return send(200, { order, claimToken: token });
        }
        if (action === 'purchase-plan') {
          requireClaim(current, body.agentId, body.claimToken); const plan = supplierPurchasePlan(current); const order = await updateOrder(orders.directory, id, old => { requireClaim(old, body.agentId, body.claimToken); if (old.status === 'purchase_prepared') return old; return { ...transitionOrder(old, 'purchase_prepared'), supplierPurchase: { ...plan, preparedBy: body.agentId, preparedAt: new Date().toISOString() } }; });
          await log.add({ orderId: id, kind: 'progress', message: 'Supplier purchase dry-run prepared; no payment submitted.' }); return send(200, { order, plan });
        }
        if (action === 'supplier-confirmation') {
          requireClaim(current, body.agentId, body.claimToken); validateText(body.confirmationId, 'confirmationId');
          const order = await updateOrder(orders.directory, id, old => { requireClaim(old, body.agentId, body.claimToken); if (old.status === 'supplier_confirmed') return old; return { ...transitionOrder(old, 'supplier_confirmed'), supplierPurchase: { ...(old.supplierPurchase || {}), confirmationId: body.confirmationId, confirmedAt: new Date().toISOString() } }; });
          await log.add({ orderId: id, kind: 'progress', message: 'Supplier confirmation recorded.' }); return send(200, { order });
        }
        requireClaim(current, body.agentId, body.claimToken); validateText(body.carrier, 'carrier'); validateText(body.trackingNumber, 'trackingNumber');
        const order = await updateOrder(orders.directory, id, old => { requireClaim(old, body.agentId, body.claimToken); if (old.status === 'tracking_recorded') return old; return { ...transitionOrder(old, 'tracking_recorded'), tracking: { carrier: body.carrier, trackingNumber: body.trackingNumber, recordedAt: new Date().toISOString() } }; });
        await log.add({ orderId: id, kind: 'progress', message: 'Tracking recorded.' }); return send(200, { order });
      }
      if (url.pathname === '/health' && req.method === 'GET') return send(200, { mode: 'test', fulfillment: 'disabled' });
      if (url.pathname === '/api/readiness' && req.method === 'GET') return send(200, {
        mode: 'test', livePaymentsEnabled: false,
        orderRecordingConfigured: Boolean(orders && config.webhookSecret && config.agentToken),
        supplierPurchasingEnabled: false,
        checkoutVersion: 'embedded-v1',
        embeddedKeyConfigured: /^pk_test_[A-Za-z0-9]+$/.test(config.publishableKey || ''),
        shippingRatesConfigured: Array.isArray(config.shippingRates) && config.shippingRates.length > 0,
      });
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
        return send(200, await prepareCheckout(body, config, stripe));
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
      const status = error instanceof HttpError ? error.status : error.code === 'UNAUTHORIZED_CLAIM' ? 401 : error.code === 'INVALID_INPUT' || error.code === 'INVALID_TRANSITION' ? 409 : 500;
      send(status,
        { error: error instanceof HttpError ? error.message : 'Checkout is unavailable. Please try again.' });
    }
  });
}

export async function start(env = process.env) {
  const config = validateConfig(env);
  config.publishableKey = env.STRIPE_PUBLISHABLE_KEY;
  config.shippingRates = JSON.parse(env.SHIPPING_RATES_JSON || '[]');
  if (!Array.isArray(config.shippingRates)) throw new Error('SHIPPING_RATES_JSON must be an array.');
  const orders = configureOrders(env, config);
  if (orders?.check) await orders.check();
  const stripe = createStripeClient(config.secret);
  await verifySandbox(stripe);
  const server = createApp({ config, stripe, orders });
  server.requestTimeout = 20000;
  server.headersTimeout = 10000;
  server.listen(Number(env.PORT || 4242), env.HOST || '127.0.0.1', () => console.log('Otaku checkout ready: Cassius sandbox, test mode, fulfillment disabled.'));
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  start().catch(() => {
    console.error('Backend startup refused. Check Stripe, STOREFRONT_URL, and complete order storage settings/table availability.');
    process.exitCode = 1;
  });
}
