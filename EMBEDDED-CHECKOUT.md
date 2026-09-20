# Embedded checkout deployment

The website collects the delivery address, requests a priced Checkout Session,
shows items + shipping + tax = total, then mounts Stripe on the same page.
The backend stays sandbox-only. Live keys remain rejected.

## Configuration still required

- `STRIPE_PUBLISHABLE_KEY`: public test key from account `acct_1UGpSAJlV0UouMVW`,
  matching the existing private backend key. Set on Render, never disclose secrets.
- Complete that sandbox's Stripe Tax settings and product classifications.
  Registrations must reflect the merchant's actual collection setup. A valid
  calculation can be zero; the application does not invent a percentage or create
  tax registrations. Session `automatic_tax.status` must be `complete`.
- `SHIPPING_RATES_JSON`: an array of merchant-approved rules. There are deliberately
  no deployed rules yet. The Etsy worker returns listing estimates that remain
  ineligible for payment. An API with confirmed cart shipping totals or approved
  supplier rate tables is still needed to establish the actual rates.

Each shipping rule has `approved: true`, `currency: "usd"`, `country: "US"`,
two-letter `state`, an array of five-digit `postalCodes`, exact sorted `items`
(each with integer `id` and `qty`), integer `amount` in cents, nonempty `source`
describing the verification, and ISO `validUntil`. Rates cover the whole cart;
they are never multiplied or combined by assumption. Exactly one rule must match.
The rule must remain valid for the full Stripe session (30–60 minutes).

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
