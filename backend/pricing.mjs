import { HttpError, normalizeCart, checkoutKey, assertTestSession } from './checkout.mjs';
import { catalog } from './catalog.mjs';

export function normalizeCustomer(input) {
  const value = {};
  for (const field of ['email', 'name', 'address', 'city', 'state', 'postalCode', 'country']) {
    if (typeof input?.[field] !== 'string' || !input[field].trim() || input[field].length > 254 || /[\x00-\x1f]/.test(input[field])) {
      throw new HttpError(400, 'Enter a complete email and delivery address.');
    }
    value[field] = input[field].trim();
  }
  value.country = value.country.toUpperCase();
  value.state = value.state.toUpperCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email) || value.country !== 'US' ||
      !/^[A-Z]{2}$/.test(value.state) || !/^\d{5}(-\d{4})?$/.test(value.postalCode)) {
    throw new HttpError(400, 'Enter a valid email, US address, two-letter state and ZIP code.');
  }
  return value;
}

// Server-owned provider: fetch a fresh quote for this cart and destination.
// No persisted rate table or browser-provided shipping amount is accepted.
export async function shippingFor(cart, customer, quoteShipping, expiresAt) {
  const unavailable = () => new HttpError(422, 'Shipping is not available for this cart and address yet. No payment has been taken.');
  if (typeof quoteShipping !== 'function') throw unavailable();
  const destination = Object.fromEntries(['address', 'city', 'state', 'postalCode', 'country'].map(key => [key, customer[key]]));
  let rate;
  try {
    rate = await quoteShipping({ items: structuredClone(cart), destination: { ...destination }, expiresAt });
  } catch {
    throw unavailable();
  }
  if (!rate || rate.checkoutEligible !== true || rate.currency !== 'usd' ||
      !Object.keys(destination).every(key => rate.destination?.[key] === destination[key]) ||
      JSON.stringify(rate.items) !== JSON.stringify(cart) ||
      typeof rate.source !== 'string' || !rate.source.trim() ||
      !Number.isSafeInteger(rate.amount) || rate.amount < 0 || rate.amount > 100000 ||
      !(Date.parse(rate.validUntil) >= expiresAt * 1000)) throw unavailable();
  return rate;
}

export async function prepareCheckout(body, config, stripe, now = Date.now()) {
  const cart = normalizeCart(body?.items);
  const customer = normalizeCustomer(body?.customer);
  checkoutKey(body?.requestId, {});
  // A Checkout Session lasts at least 30 minutes. The shipping commitment must
  // cover the entire session, not just the moment the review is displayed.
  const expiresAt = Math.floor(now / 1800000) * 1800 + 3600;
  const shipping = await shippingFor(cart, customer, config.quoteShipping, expiresAt);
  if (!/^pk_test_[A-Za-z0-9]+$/.test(config.publishableKey || '')) {
    throw new HttpError(503, 'Secure payment is being configured. Please try again later.');
  }
  const address = { line1: customer.address, city: customer.city, state: customer.state, postal_code: customer.postalCode, country: customer.country };
  const customerBody = { email: customer.email, name: customer.name, address, shipping: { name: customer.name, address }, tax: { validate_location: 'immediately' } };
  const record = await stripe('/customers', { body: customerBody, idempotencyKey: checkoutKey(body.requestId, customerBody) });
  if (!/^cus_[A-Za-z0-9]+$/.test(record.id || '') || record.livemode !== false) throw new HttpError(502, 'Could not verify the customer address.');
  const parameters = {
    mode: 'payment', ui_mode: 'embedded_page', redirect_on_completion: 'never', payment_method_types: ['card'],
    customer: record.id, automatic_tax: { enabled: true }, expires_at: expiresAt,
    // The customer shipping address above fixes the tax destination. Delivery
    // address changes go back through our address step and receive a new rate.
    payment_intent_data: { shipping: customerBody.shipping },
    metadata: { integration: 'otaku-loot-box-sandbox', fulfillment: 'disabled', checkout_version: 'embedded-v1' },
    custom_text: { submit: { message: 'Sandbox test only. No real payment or shipment.' } },
    line_items: cart.map(({ id, qty }) => ({ quantity: qty, price_data: {
      currency: 'usd', unit_amount: catalog.get(id).amount, tax_behavior: 'exclusive',
      product_data: { name: catalog.get(id).name, metadata: { catalog_id: String(id) } },
    } })),
    shipping_options: [{ shipping_rate_data: { type: 'fixed_amount', display_name: 'Delivery to your address',
      fixed_amount: { amount: shipping.amount, currency: 'usd' }, tax_behavior: 'exclusive', tax_code: 'txcd_92010001' } }],
  };
  const session = await stripe('/checkout/sessions', { body: parameters, idempotencyKey: checkoutKey(body.requestId, parameters) });
  assertTestSession(session);
  const subtotal = cart.reduce((sum, item) => sum + catalog.get(item.id).amount * item.qty, 0);
  const tax = session.total_details?.amount_tax;
  if (session.status !== 'open' || session.currency !== 'usd' || session.automatic_tax?.status !== 'complete' ||
      session.amount_subtotal !== subtotal || session.total_details?.amount_shipping !== shipping.amount ||
      !Number.isSafeInteger(tax) || tax < 0 || session.amount_total !== subtotal + shipping.amount + tax ||
      !session.client_secret?.startsWith(`${session.id}_secret_`) || !Number.isSafeInteger(session.expires_at) || session.expires_at <= now / 1000 || session.expires_at > expiresAt) {
    throw new HttpError(502, 'Could not confirm shipping and tax. Please check your address and try again.');
  }
  return { mode: 'test', sessionId: session.id, clientSecret: session.client_secret, publishableKey: config.publishableKey,
    expiresAt: session.expires_at, totals: { subtotal, shipping: shipping.amount, tax, total: session.amount_total, currency: 'usd' } };
}
