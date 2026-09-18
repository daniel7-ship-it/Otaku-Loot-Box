import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifySignature, orderStore, captureOrder, authorized } from '../backend/orders.mjs';

test('webhook signatures reject tampering and stale requests; agent access fails closed', () => {
  const body = Buffer.from('{"test":true}'), secret = 'whsec_test', now = Date.now(), t = Math.floor(now / 1000);
  const signature = `t=${t},v1=${createHmac('sha256', secret).update(`${t}.`).update(body).digest('hex')}`;
  verifySignature(body, signature, secret, now);
  assert.throws(() => verifySignature(Buffer.from('{}'), signature, secret, now));
  assert.throws(() => verifySignature(body, signature, secret, now + 301000));
  assert.equal(authorized('Bearer correct', 'correct'), true);
  assert.equal(authorized(undefined, 'correct'), false);
});

test('paid orders survive restart and concurrent retries; unpaid and live events cannot enqueue', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'otaku-orders-'));
  try {
    const store = orderStore(dir);
    const session = { id: 'cs_test_example', livemode: false, metadata: { integration: 'otaku-loot-box-sandbox' }, status: 'complete', payment_status: 'paid', collected_information: { shipping_details: { name: 'Test Buyer', address: { country: 'US' } } } };
    const stripe = async path => path.includes('line_items') ? { data: [{ description: 'Plush', quantity: 1, price: { product: { metadata: { catalog_id: '18' } } } }], has_more: false } : session;
    const event = { livemode: false, type: 'checkout.session.completed', data: { object: { id: session.id } } };
    session.payment_status = 'unpaid';
    await captureOrder(event, stripe, store);
    assert.equal((await store.list()).length, 0);
    session.payment_status = 'paid';
    await Promise.all([captureOrder(event, stripe, store), captureOrder(event, stripe, store)]);
    const records = await orderStore(dir).list();
    assert.equal(records.length, 1);
    assert.equal(records[0].shipping.name, 'Test Buyer');
    assert.equal(records[0].purchasingEnabled, false);
    assert.equal(records[0].items[0].catalogId, '18');
    await assert.rejects(captureOrder({ ...event, livemode: true }, stripe, store));
  } finally { await rm(dir, { recursive: true }); }
});
