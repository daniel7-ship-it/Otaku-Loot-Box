# Test order queue

This prepares order intake for a Starnet connection. It does not place supplier
orders or determine whether real payouts have reached a bank. Every recorded
order remains sandbox-only and real supplier payment is blocked.

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

Agents can GET `/api/orders` with `Authorization: Bearer YOUR_TOKEN` over HTTPS.
They can claim an order, prepare a supplier dry-run plan, record a supplier
confirmation, and record tracking through the corresponding POST endpoints.
Claims are single-winner and persisted atomically. Supplier plans retain each
product origin link but explicitly use `blocked_no_customer_card`; no payment
endpoint exists. The public checkout status endpoint reveals no customer data.

Progress entries are appended to a private `notifications.jsonl` admin log.
An external destination can be connected later through an adapter without
changing the order model. Supplier links/variants must be mapped and verified
before live purchasing is implemented. Catalog IDs are retained in order items.
Live use will require payout reconciliation, supplier availability and variant
checks, authenticated job claiming, and recorded purchase/tracking results.

Without the three environment variables, existing test checkout works as before
and order recording is disabled. Merely pushing this code to GitHub Pages does
not enable a backend webhook or provision persistent storage.
