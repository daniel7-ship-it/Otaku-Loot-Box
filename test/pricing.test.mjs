import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareCheckout, normalizeCustomer, shippingFor } from '../backend/pricing.mjs';

export const customer = { email: 'test@example.com', name: 'Test Customer', address: '123 Test Street', city: 'New York', state: 'NY', postalCode: '10001', country: 'US' };
export const items = [{ id: 12, qty: 1 }];
export const requestId = 'ab53719c-1fa4-4f4d-a438-7032b504fe39';
// Synthetic rates are test fixtures only, never deployed shipping configuration.
export const rates = [{ approved: true, currency: 'usd', country: 'US', state: 'NY', postalCodes: ['10001'], items, amount: 650, source: 'Synthetic test fixture', validUntil: '2099-01-01T00:00:00Z' }];
export const pricingConfig = { shippingRates: rates, publishableKey: 'pk_test_fixture' };
export function stripeFixture(calls = [], change = {}) {
  return async (path, options) => {
    calls.push({ path, options });
    if (path === '/customers') return { id: 'cus_fixture', livemode: false };
    return { id: 'cs_test_fixture', client_secret: 'cs_test_fixture_secret_fixture', status: 'open', livemode: false,
      metadata: { integration: 'otaku-loot-box-sandbox' }, currency: 'usd', automatic_tax: { status: 'complete' },
      amount_subtotal: 1789, amount_total: 2634, total_details: { amount_shipping: 650, amount_tax: 195 },
      expires_at: options.body.expires_at, ...change };
  };
}

test('verified destination rate and Stripe Tax produce the exact embedded payment total', async () => {
  const calls = [];
  const data = await prepareCheckout({ items, customer, requestId, amount: 1 }, pricingConfig, stripeFixture(calls));
  assert.deepEqual(data.totals, { subtotal: 1789, shipping: 650, tax: 195, total: 2634, currency: 'usd' });
  const parameters = calls[1].options.body;
  assert.equal(parameters.ui_mode, 'embedded_page');
  assert.equal(parameters.redirect_on_completion, 'never');
  assert.equal(parameters.automatic_tax.enabled, true);
  assert.equal(parameters.payment_intent_data.shipping.address.postal_code, '10001');
  assert.equal(calls[0].options.body.shipping.address.postal_code, '10001');
  assert.equal(parameters.shipping_address_collection, undefined);
  assert.equal(parameters.success_url, undefined);
  assert.equal(data.url, undefined);
});

test('missing, expired, unapproved, ambiguous, wrong ZIP/state/cart rates block before Stripe', async () => {
  const base = rates[0];
  for (const shippingRates of [[], [base, base], [{ ...base, approved: false }], [{ ...base, amount: -1 }],
    [{ ...base, validUntil: '2020-01-01' }], [{ ...base, postalCodes: ['39759'] }], [{ ...base, state: 'MS' }],
    [{ ...base, items: [{ id: 12, qty: 2 }] }]]) {
    await assert.rejects(prepareCheckout({ items, customer, requestId }, { ...pricingConfig, shippingRates }, () => { throw new Error('Must not call Stripe'); }), { status: 422 });
  }
});

test('unverified tax, stale sessions, live sessions and mismatched totals never expose payment secrets', async () => {
  for (const change of [{ automatic_tax: { status: 'requires_location_inputs' } }, { automatic_tax: { status: 'failed' } },
    { amount_total: 1789 }, { total_details: { amount_tax: null, amount_shipping: 650 } }, { currency: 'eur' },
    { livemode: true }, { status: 'complete' }, { expires_at: 1 }, { client_secret: null }]) {
    await assert.rejects(prepareCheckout({ items, customer, requestId }, pricingConfig, stripeFixture([], change)), { status: 502 });
  }
});

test('changed address binds different Stripe idempotency keys and valid zero tax is accepted', async () => {
  const calls = [];
  const stripe = stripeFixture(calls, { amount_total: 2439, total_details: { amount_shipping: 650, amount_tax: 0 } });
  const body = { items, customer, requestId };
  const data = await prepareCheckout(body, pricingConfig, stripe);
  await prepareCheckout(body, pricingConfig, stripe);
  assert.equal(calls[0].options.idempotencyKey, calls[2].options.idempotencyKey);
  await prepareCheckout({ ...body, customer: { ...customer, address: '456 Test Street' } }, pricingConfig, stripe);
  assert.notEqual(calls[0].options.idempotencyKey, calls[4].options.idempotencyKey);
  assert.equal(data.totals.tax, 0);
});

test('address validation and missing public key fail explicitly', async () => {
  for (const input of [null, { ...customer, email: 'bad' }, { ...customer, country: 'CA' }, { ...customer, postalCode: 'bad' }, { ...customer, state: '' }]) assert.throws(() => normalizeCustomer(input), { status: 400 });
  await assert.rejects(prepareCheckout({ items, customer, requestId }, { shippingRates: rates }, stripeFixture()), { status: 503 });
});
