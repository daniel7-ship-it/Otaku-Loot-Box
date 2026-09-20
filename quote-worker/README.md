# Experimental Jinx shipping worker

Separate from the deployed payment backend. No checkout integration, purchases,
credentials, CAPTCHA bypass, fallback shipping prices, or customer address storage.
Accepts only product 12, one item, US and a five-digit ZIP. Creates a fresh browser
context per quote. Returns integer USD cents, destination and five-minute expiry.
All results are listing estimates with checkoutEligible=false, not final cart totals.

## Status

September 20, 2026 runtime test: the actual standalone headless Playwright worker
received HTTP 403 from Etsy before any delivery calculator appeared. It cannot
currently supply unattended checkout quotes. The worker now detects unsuccessful
HTTP responses immediately and closes its isolated context. No challenge bypass,
cookie copying, or proxy workaround was attempted.

The interactive browser displayed $7.08 for one item to ZIPs 39759 (MS),
10001 (NY), 90210 (CA), and 99501 (AK). These are listing observations, not
evidence of nationwide rates or reliable automation. A temporary four-ZIP
sandbox rate-table deployment was rejected by automatic approval review and
was not applied. No shipping rates have been enabled on Render.

Interactive browser check on September 19, 2026: Etsy showed $7.08 for 39759 and
10001 on listing 1821496421. This does NOT prove all US ZIPs have that rate.
Parser/validation/cleanup unit tests are automated. The standalone headless worker
was subsequently run against Etsy as described above, but is not verified on Render. Its selectors and page-load
handling need a real runtime test before use. Existing checkout is unchanged.

## Next runtime test (developer instructions)

Use a separate Node 22+ worker environment with Chromium dependencies, not the
existing Alpine backend image. From this directory:

```sh
npm install
npx playwright install --with-deps chromium
node cli.mjs 10001
```

Commit the generated package-lock.json after resolving/testing the dependency.
Do not change the existing Render build/start commands to these worker commands.
No new paid service has been provisioned. Hosting requirements/cost are unverified.

Before checkout integration: validate repeated headless quotes for multiple ZIPs,
test blocked/stale pages, compare against supplier cart totals, add authenticated
server access with concurrency limits, and bind any accepted quote to the exact
cart and delivery destination. Address changes must invalidate the quote. Do not
generalize one-item estimates to combined carts or charge customers from test data.

Browser installation reference: https://playwright.dev/docs/browsers
