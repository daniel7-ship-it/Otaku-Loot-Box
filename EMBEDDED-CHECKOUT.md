# Embedded checkout deployment

Deployment update, September 20, 2026: commit `8c4363b` is on GitHub main and
Render. The correct Stripe sandbox's default product category has been saved
as General - Tangible Goods. Public-key configuration is deployed and verified.
Shipping uses a clearly disclosed flat $7.00 store policy while supplier APIs are unavailable.
The proposed temporary four-ZIP rate table was not deployed after automatic
approval review rejected that incomplete fallback. Checkout must not be described
as fully configured or verified end to end yet.

The website collects the delivery address, requests a priced Checkout Session,
shows items + shipping + tax = total, then mounts Stripe on the same page.
The backend stays sandbox-only. Live keys remain rejected.

## Configuration still required

- `STRIPE_PUBLISHABLE_KEY` is configured on Render for the intended sandbox.
- Complete that sandbox's Stripe Tax settings and product classifications.
  Registrations must reflect the merchant's actual collection setup. A valid
  calculation can be zero; the application does not invent a percentage or create
  tax registrations. Session `automatic_tax.status` must be `complete`.
- Connect a server-owned `quoteShipping` provider after Etsy approves API access
  and its responses are verified to support the required shipping calculation.
  `SHIPPING_RATES_JSON` is no longer read. No rate table is stored.

Each checkout request calls the provider with normalized `items`, `destination`
(address, city, state, postalCode, country), and the required `expiresAt` in Unix
seconds. Email and name are omitted. Its result must contain the same items and
destination, `checkoutEligible: true`, `currency: "usd"`, integer `amount` in cents,
nonempty `source`, and ISO `validUntil` covering the full Stripe session
(30–60 minutes). Listing estimates are not payment-eligible. No provider is
wired into server startup yet: API approval does not guarantee this capability.
The current UI requests pricing after the full address is submitted; automatic
ZIP-triggered quotes remain to be implemented once the supplier API is verified.

Until these inputs exist, the form reports unavailable shipping and does not
expose a payment form. This replaces the previous misleading subtotal-only flow.
No rate is silently treated as free. No legacy hosted checkout fallback is used.

## Verification

Run `node --test test/*.test.mjs`. Fixtures use synthetic rates; they are not
evidence of supplier rates or real Stripe connectivity. Verify the deployed
sandbox with approved shipping inputs, both taxable and legitimate zero-tax
destinations, address edits, expired sessions, Stripe failure, and a test card.
Confirm the paid webhook records the PaymentIntent shipping address.

The delivery address is fixed for each session. Editing it destroys the current
payment UI and recalculates. Card details go directly to Stripe's iframe. Card-only
checkout with `redirect_on_completion: never` keeps the storefront URL, with
server-verified completion status. Bank authentication may still show a challenge.

References: https://docs.stripe.com/checkout/embedded/quickstart and
https://docs.stripe.com/tax/checkout/page.
