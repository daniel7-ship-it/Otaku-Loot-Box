import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { once } from 'node:events';
import { catalog } from '../backend/catalog.mjs';
import { CASSIUS_ACCOUNT, SHIPPING_COUNTRIES, validateConfig, verifySandbox, buildCheckout, checkoutKey, encodeForm, createStripeClient } from '../backend/checkout.mjs';
import { createApp } from '../backend/server.mjs';

const config = { storefront: 'https://daniel7-ship-it.github.io/Otaku-Loot-Box/', origin: 'https://daniel7-ship-it.github.io' };
const requestId = 'ab53719c-1fa4-4f4d-a438-7032b504fe39';
const session = { id: 'cs_test_example', livemode: false, metadata: { integration: 'otaku-loot-box-sandbox' }, url: 'https://checkout.stripe.com/c/pay/cs_test_example', status: 'complete', payment_status: 'paid' };

test('multi-item checkout uses authoritative cents, worldwide shipping and no tax', () => {
  const result = buildCheckout([{ id: 10, qty: 2, price: 1 }, { id: 1, qty: 3, currency: 'eur' }], config.storefront);
  assert.equal(result.line_items.length, 2);
  assert.equal(result.line_items.reduce((sum, row) => sum + row.quantity * row.price_data.unit_amount, 0), 15233);
  assert.equal(result.line_items[1].price_data.unit_amount, 5818);
  assert.equal(result.line_items[0].price_data.currency, 'usd');
  assert.deepEqual(result.automatic_tax, { enabled: false });
  assert.deepEqual(result.tax_id_collection, { enabled: false });
  assert.ok(result.line_items.every(row => !row.tax_rates && !row.dynamic_tax_rates));
  assert.ok(SHIPPING_COUNTRIES.length > 230);
  assert.equal(new Set(SHIPPING_COUNTRIES).size, SHIPPING_COUNTRIES.length);
  for (const code of ['US', 'CA', 'GB', 'JP', 'AU', 'BR', 'ZA', 'IN']) assert.ok(SHIPPING_COUNTRIES.includes(code));
  assert.equal(result.metadata.fulfillment, 'disabled');
  const form = encodeForm(result);
  assert.equal(form.get('line_items[1][quantity]'), '2');
  assert.equal(form.get('automatic_tax[enabled]'), 'false');
  assert.equal(form.get('shipping_address_collection[allowed_countries][0]'), 'AC');
});

test('rejects empty, malformed, duplicate and excessive carts', () => {
  for (const items of [null, [], {}, [null], [{ id: 1, qty: 0 }], [{ id: 1, qty: -1 }], [{ id: 1, qty: 100 }], [{ id: 1, qty: 1.5 }], [{ id: 1, qty: '1' }], [{ id: 100, qty: 1 }], [{ id: 1, qty: 1 }, { id: 1, qty: 1 }]]) {
    assert.throws(() => buildCheckout(items, config.storefront), { status: 400 });
  }
});

test('live keys and other accounts fail closed', async () => {
  for (const secret of ['', 'sk_live_example', 'rk_live_example']) assert.throws(() => validateConfig({ STRIPE_SECRET_KEY: secret, STOREFRONT_URL: config.storefront }));
  assert.equal(validateConfig({ STRIPE_SECRET_KEY: 'sk_test_example', STOREFRONT_URL: config.storefront }).origin, config.origin);
  await assert.rejects(verifySandbox(async () => ({ id: 'acct_wrong' })));
  await assert.rejects(verifySandbox(async path => path === '/account' ? { id: CASSIUS_ACCOUNT } : { livemode: true }));
  await verifySandbox(async path => path === '/account' ? { id: CASSIUS_ACCOUNT } : { livemode: false });
});

test('idempotency binds a retry to its complete checkout parameters', () => {
  const first = buildCheckout([{ id: 1, qty: 1 }], config.storefront);
  assert.equal(checkoutKey(requestId, first), checkoutKey(requestId, first));
  assert.notEqual(checkoutKey(requestId, first), checkoutKey(requestId, buildCheckout([{ id: 1, qty: 2 }], config.storefront)));
  assert.throws(() => checkoutKey('bad', first), { status: 400 });
});

test('Stripe transport sends encoded server prices and hides API error details', async () => {
  let received;
  const stripe = createStripeClient('sk_test_example', async (url, options) => {
    received = { url, options };
    return new Response(JSON.stringify(session), { status: 200 });
  });
  await stripe('/checkout/sessions', { body: buildCheckout([{ id: 10, qty: 2 }], config.storefront), idempotencyKey: 'retry' });
  assert.equal(received.url, 'https://api.stripe.com/v1/checkout/sessions');
  assert.equal(received.options.headers['Idempotency-Key'], 'retry');
  assert.equal(received.options.body.get('line_items[0][price_data][unit_amount]'), '5818');
  await assert.rejects(createStripeClient('sk_test_example', async () => new Response('private error', { status: 401 }))('/account'), error => !error.message.includes('private error') && error.status === 502);
});

test('HTTP checkout, CORS, status verification, malformed requests and live rejection', async t => {
  const calls = [];
  let responseSession = session;
  const server = createApp({ config, stripe: async (path, options) => { calls.push({ path, options }); return responseSession; } });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { Origin: config.origin, 'Content-Type': 'application/json' };
  const post = body => fetch(`${base}/api/checkout`, { method: 'POST', headers, body: JSON.stringify(body) });
  const body = { items: [{ id: 10, qty: 2 }, { id: 1, qty: 3 }], requestId };
  let response = await post(body);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { url: session.url, mode: 'test' });
  assert.equal(calls[0].options.body.line_items.length, 2);
  assert.equal(response.headers.get('access-control-allow-origin'), config.origin);
  assert.equal((await fetch(`${base}/api/checkout`, { method: 'OPTIONS', headers })).status, 204);
  assert.equal((await fetch(`${base}/api/checkout`, { method: 'POST', headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await post({ items: [], requestId })).status, 400);
  assert.equal((await post(null)).status, 400);
  assert.equal((await fetch(`${base}/api/checkout`, { method: 'POST', headers, body: '{' })).status, 400);
  assert.equal((await fetch(`${base}/api/checkout`, { method: 'POST', headers, body: JSON.stringify({ padding: 'x'.repeat(9000) }) })).status, 413);
  responseSession = { ...session, customer_details: { email: 'private@example.com' } };
  response = await fetch(`${base}/api/checkout/status?session_id=cs_test_example`, { headers });
  assert.deepEqual(await response.json(), { mode: 'test', status: 'complete', paymentStatus: 'paid', fulfillment: 'disabled' });
  assert.equal((await fetch(`${base}/api/checkout/status?session_id=cs_live_bad`, { headers })).status, 400);
  responseSession = { ...session, livemode: true };
  assert.equal((await post(body)).status, 502);
  responseSession = { ...session, metadata: {} };
  assert.equal((await post(body)).status, 502);
  responseSession = { ...session, url: 'https://evil.example/' };
  assert.equal((await post(body)).status, 502);
});

test('backend catalog matches the current storefront and inline scripts parse', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const source = html.match(/const catalog = (\[[\s\S]*?\n    \]);/)[1];
  const products = vm.runInNewContext(source);
  assert.equal(products.length, catalog.size);
  for (const product of products) {
    assert.equal(catalog.get(product.id).amount, Math.round(product.price * 100));
    assert.equal(catalog.get(product.id).name, product.name);
  }
  for (const [, script] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(script);
});

function clientHarness(search = '') {
  const nodes = new Map(['checkout', 'checkoutMessage'].map(id => [id, { textContent: '', disabled: false }]));
  const storage = new Map();
  let destination;
  const context = {
    window: { OTAKU_CHECKOUT_API: 'https://backend.example', location: { assign: value => { destination = value; } } },
    document: { getElementById: id => nodes.get(id) },
    location: { search }, URL, URLSearchParams, AbortSignal, crypto, Date,
    sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    fetch: async () => new Response(JSON.stringify({ mode: 'test', url: session.url })),
  };
  vm.runInNewContext(readFileSync(new URL('../checkout-client.js', import.meta.url), 'utf8'), context);
  return { context, nodes, client: context.window.otakuCheckout, destination: () => destination };
}

test('frontend sends multiple items, blocks duplicate clicks, preserves retry ID and recovers from errors', async () => {
  const { context, client, nodes, destination } = clientHarness();
  const requests = [];
  context.fetch = async (url, options) => {
    requests.push(JSON.parse(options.body));
    if (requests.length === 1) throw new TypeError('offline');
    return new Response(JSON.stringify({ mode: 'test', url: session.url }));
  };
  const cart = [{ id: 10, qty: 2 }, { id: 1, qty: 3 }];
  await client.begin(cart);
  assert.equal(client.busy, false);
  assert.equal(nodes.get('checkout').disabled, false);
  await Promise.all([client.begin(cart), client.begin(cart)]);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].requestId, requests[1].requestId);
  assert.equal(requests[0].items.length, 2);
  assert.equal(destination(), session.url);
  assert.equal(cart.length, 2);
  client.reset();
  assert.equal(client.busy, false);
});

test('frontend return requires server verification; cancellation retains cart', async () => {
  const { context, client, nodes } = clientHarness('?checkout=success&session_id=cs_test_example');
  let opened = 0;
  context.fetch = async () => new Response(JSON.stringify({ mode: 'test', status: 'open', paymentStatus: 'unpaid' }));
  await client.checkReturn(() => opened++);
  assert.match(nodes.get('checkoutMessage').textContent, /not confirmed/);
  context.fetch = async () => new Response(JSON.stringify({ mode: 'test', status: 'complete', paymentStatus: 'paid' }));
  await client.checkReturn(() => opened++);
  assert.match(nodes.get('checkoutMessage').textContent, /confirmed by Stripe/);
  context.location.search = '?checkout=cancelled';
  context.fetch = () => { throw new Error('Must not fetch on cancellation'); };
  await client.checkReturn(() => opened++);
  assert.match(nodes.get('checkoutMessage').textContent, /cancelled.*cart is saved/);
  assert.equal(opened, 3);
});
