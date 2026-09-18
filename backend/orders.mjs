import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { mkdir, writeFile, link, unlink, readdir, readFile } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { HttpError, assertTestSession } from './checkout.mjs';
import { catalog } from './catalog.mjs';

export function verifySignature(raw, header, secret, now = Date.now()) {
  const parts = String(header || '').split(',');
  const timestamp = parts.find(p => p.startsWith('t='))?.slice(2);
  if (!/^\d+$/.test(timestamp || '') || Math.abs(now / 1000 - Number(timestamp)) > 300) throw new HttpError(400, 'Invalid webhook signature.');
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(raw).digest();
  const valid = parts.filter(p => /^v1=[a-f0-9]{64}$/.test(p)).some(p => timingSafeEqual(expected, Buffer.from(p.slice(3), 'hex')));
  if (!valid) throw new HttpError(400, 'Invalid webhook signature.');
}

export function orderStore(directory) {
  if (!isAbsolute(directory)) throw new Error('ORDER_DATA_DIR must be an absolute private persistent directory.');
  return {
    directory,
    async save(order) {
      if (!/^cs_test_[A-Za-z0-9]+$/.test(order.id)) throw new Error('Invalid order ID');
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const temporary = join(directory, `${randomUUID()}.tmp`);
      await writeFile(temporary, JSON.stringify(order), { mode: 0o600, flag: 'wx' });
      try {
        // Publish a complete record atomically; repeated Stripe events cannot overwrite it.
        await link(temporary, join(directory, `${order.id}.json`));
        return true;
      } catch (error) { if (error.code === 'EEXIST') return false; throw error; }
      finally { await unlink(temporary); }
    },
    async list() {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const names = (await readdir(directory)).filter(n => /^cs_test_[A-Za-z0-9]+\.json$/.test(n));
      return Promise.all(names.sort().map(n => readFile(join(directory, n), 'utf8').then(JSON.parse)));
    },
    async get(id) {
      if (!/^cs_test_[A-Za-z0-9]{1,200}$/.test(id || '')) return null;
      try { return JSON.parse(await readFile(join(directory, `${id}.json`), 'utf8')); }
      catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    }
  };
}

export async function captureOrder(event, stripe, store) {
  if (event.livemode !== false) throw new HttpError(400, 'Only test events are accepted.');
  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) return;
  const id = event.data?.object?.id;
  if (!/^cs_test_[A-Za-z0-9]{1,200}$/.test(id || '')) throw new HttpError(400, 'Invalid session.');
  const session = await stripe(`/checkout/sessions/${id}`);
  assertTestSession(session);
  if (session.payment_status !== 'paid' || session.status !== 'complete') return;
  const items = [];
  let after = '';
  do {
    const page = await stripe(`/checkout/sessions/${id}/line_items?limit=100&expand[]=data.price.product${after ? `&starting_after=${encodeURIComponent(after)}` : ''}`);
    if (!Array.isArray(page.data) || (page.has_more && !page.data.length)) throw new Error('Invalid line items');
    items.push(...page.data.map(item => { const catalogId = item.price?.product?.metadata?.catalog_id || null; return { catalogId, name: item.description, quantity: item.quantity, amountTotal: item.amount_total, currency: item.currency, originLink: catalog.get(Number(catalogId))?.origin || null }; }));
    after = page.has_more ? page.data.at(-1).id : '';
  } while (after);
  await store.save({ id, mode: 'test', receivedAt: new Date().toISOString(), status: 'test_order_held', purchasingEnabled: false, claimedBy: null, supplierPurchase: null, tracking: null,
    fundingStatus: 'not_applicable_test_payment', notificationStatus: 'pending_configuration', items,
    amountTotal: session.amount_total, currency: session.currency,
    shipping: session.collected_information?.shipping_details || session.shipping_details || null,
    email: session.customer_details?.email || null });
}

export function authorized(header, token) {
  const actual = Buffer.from(String(header || ''));
  const expected = Buffer.from(`Bearer ${token}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
