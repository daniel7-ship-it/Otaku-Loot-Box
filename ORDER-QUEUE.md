# Test order queue

**No paid Render disk?** Use [SUPABASE-SETUP.md](SUPABASE-SETUP.md) instead of the
disk configuration below. Both storage options preserve the same order payload.

This prepares order intake for a future Starnet connection. It does not place
supplier orders, send notifications, or determine whether real payouts have
reached a bank. Every recorded order remains `test_order_held`.

## Enable on the private backend

Set all three private environment variables together:

- `ORDER_DATA_DIR`: absolute path on a private persistent disk outside the repo
  and outside any publicly served directory. Use one backend instance. Ephemeral
  host storage is not suitable. Back up this directory securely.
- `STRIPE_WEBHOOK_SECRET`: signing secret for a Cassius sandbox webhook endpoint.
- `ORDER_AGENT_TOKEN`: random secret of at least 32 characters, stored only in
  server/agent secret settings. Never put it in the website or GitHub.

Register `https://YOUR-BACKEND/api/stripe/webhook` in the Stripe sandbox for
`checkout.session.completed` and `checkout.session.async_payment_succeeded`.
The endpoint verifies the raw-body signature, retrieves the session from Stripe,
checks test mode and paid status, and snapshots purchased line items and shipping.
Webhook retries cannot overwrite or duplicate an existing session order.

Future agents can GET `/api/orders` with `Authorization: Bearer YOUR_TOKEN` over
HTTPS. This private endpoint returns up to 100 records (session-ID sort order),
including customer information. Do not grant this token until the agent is ready
and trusted to handle addresses. The public checkout status endpoint reveals no
customer information. No claim, purchase, or release endpoint exists yet.

Notification status is `pending_configuration`; no messages are sent. Choose a
notification destination later. Supplier links/variants must be mapped and verified
before agent purchasing is implemented. Catalog IDs are retained in order items.
Live use will require payout reconciliation, supplier availability and variant
checks, authenticated job claiming, and recorded purchase/tracking results.

Without the three environment variables, existing test checkout works as before
and order recording is disabled. Merely pushing this code to GitHub Pages does
not enable a backend webhook or provision persistent storage.
