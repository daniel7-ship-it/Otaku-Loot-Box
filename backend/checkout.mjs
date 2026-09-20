import { createHash } from 'node:crypto';
import { catalog } from './catalog.mjs';

export const CASSIUS_ACCOUNT = 'acct_1UGpSAJlV0UouMVW';
export const STRIPE_API_VERSION = '2026-08-26.dahlia';
// Stripe's official shipping_address_collection enum, excluding ZZ (unknown).
// Source: https://github.com/stripe/openapi/blob/master/openapi/spec3.json
export const SHIPPING_COUNTRIES = 'AC AD AE AF AG AI AL AM AO AQ AR AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CD CF CG CH CI CK CL CM CN CO CR CV CW CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HN HR HT HU ID IE IL IM IN IO IQ IS IT JE JM JO JP KE KG KH KI KM KN KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MK ML MM MN MO MQ MR MS MT MU MV MW MX MY MZ NA NC NE NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SZ TA TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VN VU WF WS XK YE YT ZA ZM ZW'.split(' ');

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function validateConfig(env) {
  const mode = env.STRIPE_MODE || 'test';
  if (!['test', 'live'].includes(mode)) throw new Error('STRIPE_MODE must be test or live.');
  const prefix = mode === 'live' ? 'live' : 'test';
  if (!new RegExp(`^(sk|rk)_${prefix}_[A-Za-z0-9]+$`).test(env.STRIPE_SECRET_KEY || '')) throw new Error(`A Stripe ${mode} secret key is required.`);
  if (env.STRIPE_PUBLISHABLE_KEY && !new RegExp(`^pk_${prefix}_[A-Za-z0-9]+$`).test(env.STRIPE_PUBLISHABLE_KEY)) throw new Error(`A matching Stripe ${mode} publishable key is required.`);
  const url = new URL(env.STOREFRONT_URL);
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash) {
    throw new Error('STOREFRONT_URL must be an HTTPS page URL (HTTP localhost is allowed for development).');
  }
  return { secret: env.STRIPE_SECRET_KEY, publishableKey: env.STRIPE_PUBLISHABLE_KEY, storefront: url.href, origin: url.origin,
    mode, accountId: env.STRIPE_ACCOUNT_ID || (mode === 'test' ? CASSIUS_ACCOUNT : '') };
}

export function normalizeCart(items) {
  if (!Array.isArray(items) || !items.length || items.length > catalog.size) {
    throw new HttpError(400, 'Choose between 1 and 10 different products.');
  }
  const seen = new Set();
  return items.map(item => {
    if (!item || !Number.isInteger(item.id) || !catalog.has(item.id) ||
        !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99 || seen.has(item.id)) {
      throw new HttpError(400, 'Invalid product or quantity. Use 1–99 per product, with no duplicate products.');
    }
    seen.add(item.id);
    return { id: item.id, qty: item.qty };
  }).sort((a, b) => a.id - b.id);
}

export function buildCheckout(items, storefront) {
  const cart = normalizeCart(items);
  return {
    mode: 'payment',
    success_url: `${storefront}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${storefront}?checkout=cancelled`,
    automatic_tax: { enabled: false },
    tax_id_collection: { enabled: false },
    shipping_address_collection: { allowed_countries: SHIPPING_COUNTRIES },
    custom_text: { submit: { message: 'Sandbox test only. No real payment, shipment, or supplier order. Shipping is not charged in this test.' } },
    metadata: { integration: 'otaku-loot-box-sandbox', fulfillment: 'disabled' },
    line_items: cart.map(({ id, qty }) => ({
      quantity: qty,
      price_data: {
        currency: 'usd', unit_amount: catalog.get(id).amount,
        product_data: { name: catalog.get(id).name, metadata: { catalog_id: String(id) } },
      },
    })),
  };
}

export function encodeForm(value, prefix = '', form = new URLSearchParams()) {
  for (const [key, entry] of Object.entries(value)) {
    const name = prefix ? `${prefix}[${key}]` : key;
    if (entry !== null && typeof entry === 'object') encodeForm(entry, name, form);
    else form.append(name, String(entry));
  }
  return form;
}

export function createStripeClient(secret, fetchImpl = fetch) {
  return async (path, { body, idempotencyKey } = {}) => {
    const headers = { Authorization: `Bearer ${secret}`, 'Stripe-Version': STRIPE_API_VERSION };
    if (body) headers['Content-Type'] = 'application/x-www-form-urlencoded';
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    const response = await fetchImpl(`https://api.stripe.com/v1${path}`, {
      method: body ? 'POST' : 'GET', headers,
      body: body ? encodeForm(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      let detail = {};
      try { detail = await response.json(); } catch {}
      console.error(JSON.stringify({ event: 'stripe_request_failed', path, status: response.status, type: detail?.error?.type, code: detail?.error?.code, param: detail?.error?.param, message: detail?.error?.message }));
      throw new HttpError(502, 'Stripe is unavailable or backend configuration needs attention. Please retry.');
    }
    return response.json();
  };
}

export async function verifyAccount(stripe, config) {
  const account = await stripe('/account');
  if (config.accountId && account.id !== config.accountId) throw new Error('Refusing to run: the Stripe key does not belong to the configured account.');
  const balance = await stripe('/balance');
  if (balance.livemode !== (config.mode === 'live')) throw new Error('Refusing to run: Stripe mode does not match STRIPE_MODE.');
}

export const verifySandbox = stripe => verifyAccount(stripe, { mode: 'test', accountId: CASSIUS_ACCOUNT });

export function checkoutKey(requestId, parameters) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId || '')) {
    throw new HttpError(400, 'A valid checkout request ID is required.');
  }
  return `otaku-test-${requestId}-${createHash('sha256').update(JSON.stringify(parameters)).digest('hex')}`;
}

export function assertSession(session, config = { mode: 'test' }) {
  const live = config.mode === 'live';
  if (session.livemode !== live || !session.id?.startsWith(live ? 'cs_live_' : 'cs_test_') ||
      session.metadata?.integration !== (live ? 'otaku-loot-box' : 'otaku-loot-box-sandbox')) {
    throw new HttpError(502, 'Stripe returned an unexpected checkout session.');
  }
}

export const assertTestSession = session => assertSession(session, { mode: 'test' });
