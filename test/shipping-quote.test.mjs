import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRequest, parseQuote, quoteJinx, ETSY_PRODUCTS } from '../quote-worker/etsy.mjs';

const input = { productId: 12, quantity: 1, country: 'US', postalCode: '10001' };
const observed = { destination: 'Deliver to United States, 10001', usd: true, shippingText: 'Cost to ship:\n$ 7.08\nEnjoy free shipping when you spend $35+' };

test('listing estimate uses integer cents, expires, and is not checkout eligible', () => {
  const quote = parseQuote(input, observed, 0);
  assert.equal(quote.shippingAmount, 708);
  assert.equal(quote.checkoutEligible, false);
  assert.equal(Date.parse(quote.expiresAt), 300_000);
});

test('reject unsupported carts, stale destination, ambiguous currency, loading and challenge pages', () => {
  for (const patch of [{ productId: 18 }, { quantity: 2 }, { country: 'CA' }, { postalCode: '10001&x=1' }]) {
    assert.throws(() => validateRequest({ ...input, ...patch }));
  }
  for (const patch of [{ destination: 'Deliver to United States, 39759' }, { usd: false }, { loading: true }, { blocked: true },
    { shippingText: 'Enjoy free shipping when you spend $35+' }, { shippingText: 'Cost to ship: $ 7.08 Cost to ship: $ 9.00' }]) {
    assert.throws(() => parseQuote(input, { ...observed, ...patch }));
  }
});

test('all eight Etsy catalog products use their own listing URL', () => {
  assert.equal(Object.keys(ETSY_PRODUCTS).length, 8);
  for (const productId of Object.keys(ETSY_PRODUCTS)) {
    const quote = parseQuote({ productId: Number(productId), quantity: 1, country: 'US', postalCode: '10001' }, observed, 0);
    assert.equal(quote.sourceUrl, ETSY_PRODUCTS[productId]);
  }
});

test('browser failure closes isolated context; invalid input never opens browser', async () => {
  let opened = 0, closed = 0;
  const browser = { newContext: async () => {
    opened++;
    return { newPage: async () => { throw new Error('blocked'); }, close: async () => { closed++; } };
  } };
  await assert.rejects(quoteJinx(browser, { ...input, quantity: 99 }));
  assert.equal(opened, 0);
  await assert.rejects(quoteJinx(browser, input));
  assert.equal(closed, 1);
});

test('supplier HTTP 403 stops immediately and closes the browser context', async () => {
  let closed = 0;
  const browser = { newContext: async () => ({
    newPage: async () => ({ setDefaultTimeout() {}, goto: async () => ({ ok: () => false, status: () => 403 }) }),
    close: async () => { closed++; },
  }) };
  await assert.rejects(quoteJinx(browser, input), /HTTP 403/);
  assert.equal(closed, 1);
});
