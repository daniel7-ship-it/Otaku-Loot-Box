# Sandbox fulfillment demonstration

The HTTP integration fixture `test/fulfillment-http.test.mjs` is the end-to-end mock demonstration. It creates private order files, starts the real HTTP app, races two mocked agents for one order, exercises the returned claim token through the dry-run purchase-plan endpoint, verifies replay idempotency, rejects wrong/missing tokens, rejects a held order, and proves an older order is addressable directly.

Run with the bundled runtime:

```powershell
& ..\..\Otaku-Loot-Box-review\tools\node-v24.21.0-win-x64\node.exe --test test\*.test.mjs
```

## Real backend configuration still required

- `STRIPE_SECRET_KEY`: sandbox Stripe secret key for checkout/status.
- `STRIPE_WEBHOOK_SECRET`: sandbox webhook signing secret.
- `ORDER_DATA_DIR`: absolute private persistent directory.
- `ORDER_AGENT_TOKEN`: random bearer token of at least 32 characters, stored outside the repository.
- `STOREFRONT_URL`: allowed storefront origin.
- Funding reconciliation must provide `fundingStatus=available`; held orders remain blocked.
- Supplier-specific variants, stock, prices, spending limits, and payment authorization must be configured and reviewed.
- Real supplier integrations are intentionally not implemented as live payment paths. `supplierPurchasePlan` remains dry-run and declares `blocked_no_customer_card`.
- Notifications remain private in-app `notifications.jsonl` by default.
- A multi-instance deployment must replace the in-process per-order lock with a transactional database or distributed lock.

No supplier payment is submitted by the sandbox app, and no customer card details are passed to suppliers.
