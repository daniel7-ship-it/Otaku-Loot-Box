# Otaku Loot Box — Cassius sandbox checkout

Optional paid test-order recording is now implemented. See [ORDER-QUEUE.md](ORDER-QUEUE.md)
for private persistent storage and webhook setup. Without that configuration,
order recording remains disabled. Supplier purchasing and notifications remain disabled.

The storefront remains on GitHub Pages. A separate Node backend creates multi-item
Stripe-hosted Checkout sessions. No custom domain is needed.

## Status

Implemented from GitHub commit `da57689b248cb283ffef0d06297a17cc811fb297`.
**Not connected to a deployed backend yet.** An empty `checkout-config.js` URL
shows a setup message and preserves the cart. Tests use mocked Stripe responses;
no real Stripe payment has been run.

## Behavior

- Startup requires a test key belonging to **Cassius sandbox**,
  `acct_1UGpSAJlV0UouMVW`. The backend verifies the account and test-mode balance.
- All cart items go into one Checkout session. Server-owned USD cent prices match
  the storefront. Browser prices, currencies, and redirect URLs are ignored.
- Collects shipping addresses across Stripe's supported countries/territories,
  excluding the unknown-country code `ZZ`. This does not promise actual delivery.
- Automatic tax and tax-ID collection are disabled; no manual tax rates are sent.
- No shipping charge is added in this sandbox; no delivery service is selected.
- Validates cart IDs and quantities, restricts browser origins, caps request sizes,
  rate-limits requests, and uses idempotency keys for checkout retries.
- Verifies payment status with Stripe. A success URL alone is never confirmation.
  The cart stays available for testing after success, cancellation, or errors.
- No supplier orders or shipments are created. When configured, the signed webhook
  persists paid test orders and shipping addresses privately. Public status responses
  never expose addresses. See ORDER-QUEUE.md for the optional configuration.

## Connect the backend

1. Deploy the backend to a Node 22+ host with outbound HTTPS access to
   `api.stripe.com`. No package installation/build is required. Start command:
   `node backend/server.mjs`. A Dockerfile is also supplied.
2. In the host's **private environment settings**, set:

   | Setting | Value |
   | --- | --- |
   | `STRIPE_SECRET_KEY` | A test secret key from Cassius sandbox only |
   | `STOREFRONT_URL` | Exact GitHub Pages URL including repository path and trailing slash |
   | `HOST` | `0.0.0.0` on the deployed host |
   | `PORT` | The host-provided port, or `4242` |

   A restricted `rk_test_` key needs permission for account/balance reads,
   Checkout Session creation/retrieval, and the inline products/prices used here.
   Startup fails if account or mode verification is unavailable.
3. Confirm `/health` returns `{"mode":"test","fulfillment":"disabled"}`.
4. Set `window.OTAKU_CHECKOUT_API` in `checkout-config.js` to the backend's HTTPS
   origin. This public URL is not a key. Publish the frontend files together.
5. Add multiple products and select **Test checkout**. Check quantities, totals,
   test mode, shipping-address collection, and zero tax on Stripe's page. Cancel
   to check cart preservation. If completing a sandbox payment, use only Stripe's
   documented test card details.

Keep secrets in host secret settings or an ignored local `backend/.env`. Never put
them in HTML, public JavaScript, browser storage, Git commits, or chat. Stripe MCP
authentication is separate from the backend's runtime key.

The backend serves API endpoints only, never repository files or `.env`. For
multiple instances, configure shared rate limiting at the host. The built-in
limiter uses socket IPs and does not trust arbitrary forwarding headers; visitors
behind a proxy may therefore share its quota.

## Local development

1. Copy `backend/.env.example` to `backend/.env`; privately fill in the Cassius
   test key and set `STOREFRONT_URL=http://localhost:8080/`.
2. Run `node --env-file=backend/.env backend/server.mjs`.
3. Serve **only** `index.html`, `checkout-client.js`, and `checkout-config.js` on
   `localhost:8080` with your static development server. Do not expose `.env` or
   the backend through a generic repository-wide file server.
4. Temporarily set the public API URL to `http://localhost:4242`. Restore the
   deployed HTTPS URL before publishing.

Run tests: `node --test test/*.test.mjs`. Tests cover multi-item totals, malformed
carts, account/mode guards, API encoding, idempotency, CORS, private status data,
client retries, cancellation, and return verification. Backend prices live in
`backend/catalog.mjs`; update alongside the storefront (tests detect drift).

## References

- [Checkout Sessions API](https://docs.stripe.com/api/checkout/sessions/create)
- [Shipping addresses](https://docs.stripe.com/payments/collect-addresses?payment-ui=checkout)
- [Stripe testing](https://docs.stripe.com/testing)
- [Official country enum](https://github.com/stripe/openapi/blob/master/openapi/spec3.json)

REST requests pin API version `2026-08-26.dahlia`. The Stripe implementation
planner was run and accepted for hosted, one-time web checkout before coding.
