import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuote, quoteTemu, TEMU_PRODUCTS } from '../quote-worker/temu.mjs';

const input = { productId: 18, quantity: 1, country: 'US', postalCode: '10001' };
const observed = { destination: 'Deliver to United States, 10001', usd: true, shippingText: 'Shipping $ 6.99' };

test('Temu quote parser returns an unverified listing estimate only', () => {
  const quote = parseQuote(input, observed, 0);
  assert.equal(quote.shippingAmount, 699);
  assert.equal(quote.checkoutEligible, false);
  assert.equal(quote.sourceUrl, TEMU_PRODUCTS[18]);
});

test('Temu parser rejects wrong destination, free-shipping text, and ambiguous amounts', () => {
  for (const patch of [{ destination: 'Deliver to United States, 90210' }, { shippingText: 'Free shipping' },
    { shippingText: 'Shipping $ 6.99 Delivery $ 8.99' }, { blocked: true }]) {
    assert.throws(() => parseQuote(input, { ...observed, ...patch }));
  }
});

test('Temu browser worker remains blocked until selectors are verified', async () => {
  let closed = 0;
  const browser = { newContext: async () => ({
    newPage: async () => ({ setDefaultTimeout() {}, goto: async () => ({ ok: () => true }) }),
    close: async () => { closed++; },
  }) };
  await assert.rejects(quoteTemu(browser, input), /selectors require supplier verification/);
  assert.equal(closed, 1);
});
