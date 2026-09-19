import test from 'node:test';
import assert from 'node:assert/strict';
import { supabaseOrderStore } from '../backend/supabase-orders.mjs';
import { configureOrders } from '../backend/order-config.mjs';
import { createApp } from '../backend/server.mjs';
import { createHmac } from 'node:crypto';
import { once } from 'node:events';

const url = 'https://example.supabase.co';
const key = 'sb_secret_test';
const order = { id: 'cs_test_example', mode: 'test', receivedAt: '2026-09-19T00:00:00Z' };

test('Supabase rejects incomplete configuration, public keys, and unexpected origins', () => {
  for (const origin of ['http://example.supabase.co', 'https://evil.com', 'https://example.supabase.co/path', 'https://user@example.supabase.co', 'https://example.supabase.co?x=1']) {
    assert.throws(() => supabaseOrderStore(origin, key));
  }
  assert.throws(() => supabaseOrderStore(url, 'sb_publishable_public'));
  assert.equal(configureOrders({}, {}), undefined);
  const env = { SUPABASE_URL: url, SUPABASE_SECRET_KEY: key, STRIPE_WEBHOOK_SECRET: 'whsec_test', ORDER_AGENT_TOKEN: 'x'.repeat(32) };
  for (const name of Object.keys(env)) {
    assert.throws(() => configureOrders({ ...env, [name]: '' }, {}));
  }
  assert.throws(() => configureOrders({ ...env, ORDER_DATA_DIR: '/data' }, {}));
  assert.ok(configureOrders(env, {}));
});

test('Supabase saves once using conflict-ignore and lists latest records without leaking its key', async () => {
  const saved = new Map();
  const store = supabaseOrderStore(url, key, async (target, options) => {
    assert.equal(options.headers.apikey, key);
    assert.equal(options.redirect, 'error');
    assert.equal(target.includes(key), false);
    if (options.method === 'POST') {
      assert.match(options.headers.Prefer, /resolution=ignore-duplicates/);
      assert.match(target, /on_conflict=id/);
      const row = JSON.parse(options.body);
      if (saved.has(row.id)) return Response.json([]);
      saved.set(row.id, row);
      return Response.json([{ id: row.id }]);
    }
    if (target.includes('select=id')) return Response.json([]);
    assert.match(target, /order=received_at.desc,id.desc&limit=100/);
    return Response.json([...saved.values()]);
  });
  await store.check();
  assert.equal(await store.save(order), true);
  assert.equal(await store.save({ ...order, email: 'changed@example.com' }), false);
  assert.deepEqual(await store.list(), [order]);
  await assert.rejects(store.save({ ...order, mode: 'live' }));
});

test('database failures are sanitized and cause webhook failure so Stripe can retry', async () => {
  const store = supabaseOrderStore(url, key, async () => new Response('private upstream details', { status: 500 }));
  await assert.rejects(store.check(), { status: 503, message: 'Order storage is unavailable. Please retry.' });
  const secret = 'whsec_test';
  const server = createApp({
    config: { webhookSecret: secret }, orders: store,
    stripe: async path => path.includes('line_items') ? { data: [], has_more: false } : {
      id: order.id, livemode: false, metadata: { integration: 'otaku-loot-box-sandbox' }, status: 'complete', payment_status: 'paid',
    },
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const body = JSON.stringify({ livemode: false, type: 'checkout.session.completed', data: { object: { id: order.id } } });
    const t = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/stripe/webhook`, {
      method: 'POST', body, headers: { 'stripe-signature': `t=${t},v1=${signature}` },
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'Order storage is unavailable. Please retry.' });
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('Supabase agent mutations fail explicitly without using local disk', async () => {
  const server = createApp({ config: { agentToken: 'private' }, orders: {}, stripe: async () => ({}) });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/orders/cs_test_example/claim`, {
      method: 'POST', headers: { authorization: 'Bearer private', 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'Agent order updates are not enabled for this storage provider.' });
  } finally { await new Promise(resolve => server.close(resolve)); }
});
