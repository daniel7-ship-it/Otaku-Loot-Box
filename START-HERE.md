# Otaku Loot Box: next steps

**Updated storage path:** Your Supabase project is created. Follow
[SUPABASE-SETUP.md](SUPABASE-SETUP.md) instead of section 1's paid-disk setup.

Current checkout takes fake money only. The code blocks real payments. These
instructions do not enable live payments. GitHub stores your code; GitHub Pages
shows the store; Render runs the backend; Stripe collects payments. A supplier
still needs to ship each product.

## 1. Save paid test orders

Open https://dashboard.render.com and select the EXISTING otaku-loot-box service.
In Disks, attach a persistent disk mounted at `/var/data` if none exists. Review
the cost before purchasing: this requires an eligible paid service. If an existing
disk has a different mount path, use that below. Keep one backend instance.

In Stripe, select Cassius sandbox. Open Workbench > Webhooks (or Developers >
Webhooks). Add an event destination for your account with this endpoint:

```text
https://otaku-loot-box.onrender.com/api/stripe/webhook
```

Select `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
Reveal its signing secret. In Render > Environment add all three together:

| Key | Value |
| --- | --- |
| ORDER_DATA_DIR | /var/data/otaku-orders |
| STRIPE_WEBHOOK_SECRET | The endpoint's signing secret starting whsec_ |
| ORDER_AGENT_TOKEN | A new random password of at least 32 characters from your password manager |

Keep existing settings. Secrets belong here, never in chat or GitHub. Save and
redeploy. Complete a NEW test purchase. In Stripe's webhook destination, confirm
the payment event delivery received HTTP 200. Resend failed events after fixing
configuration.

Open PowerShell on this PC and paste:

```powershell
powershell -NoProfile -File "C:\Users\Daniel\Documents\ChatGPT\Website\otaku-loot-box-stripe\Check-Store.ps1" -Orders
```

At the hidden prompt paste ORDER_AGENT_TOKEN. Confirm the new order appears.
Restart Render and check again to prove it survives restarts. The script never
charges or buys anything. If Windows blocks scripts, ask your next assistant to
run the equivalent read-only check; do not change machine-wide execution policy.
The new readiness status requires deploying the modified server; order listing
works with the existing backend once the queue is configured.

## 2. Verify one product before launching

Start with one product and one delivery country. Confirm exact supplier variant,
stock, shipping cost, tracking, delivery estimate, returns, and whether the seller
supports shipping directly to your customers. A product link is not an integration.

The local product-sources.json records Toji supplier cost as $58.18. The backend
also sells it for $58.18: no margin before shipping, fees, or refunds. That source
price is a historical snapshot, not a current quote. Recheck costs and choose
actual resale prices.

Start with manual fulfillment: confirm payment, order the verified product to the
customer's address, record the supplier order number, and send tracking. Never
purchase for sandbox orders. Automate later through a supported supplier
integration with duplicate-purchase protection. Money appearing in Stripe is not
proof it has reached your bank; arrange how supplier purchases will be funded.

## 3. Business details

In https://dashboard.stripe.com select the real account and complete business
verification and bank setup. Enter accurate details privately in Stripe.

Shipping means where you deliver, what customers pay, and a delivery estimate
you can meet. The existing worldwide addresses and zero shipping are test settings.

Tell your next assistant your business country/state and intended delivery
country before asking for tax instructions. Stripe Tax can calculate tax, but
required registrations and filing must also be arranged. Do not add a fictional
registration. A zero-tax calculation does not prove no tax is owed.

Publish a support contact and shipping, refund/return, and privacy policies that
match your actual operation.

## 4. Live code still needs implementation

Do not swap in a live key yet: current code will refuse to start. Live support
must cover account checks, checkout creation, signed webhooks, order storage,
status verification, and frontend messaging together. Require durable recording
for real payments; set verified shipping countries/charges and tax configuration.
Use a separate live webhook and live secrets. Deploy matching frontend/backend
changes, verify order handling, then advertise.

## Handoff prompt

Paste this into your next coding assistant. Give it the repository files if it
cannot access GitHub; exclude any .env files and other secrets.

```text
Help finish Otaku Loot Box. I am not a developer. Implement technical changes
and give exact dashboard steps for private business setup.
Repo: https://github.com/daniel7-ship-it/Otaku-Loot-Box
Backend: https://otaku-loot-box.onrender.com
Read actual code, README.md, ORDER-QUEUE.md and START-HERE.md. The latter and
Check-Store.ps1 may exist only in my local otaku-loot-box-stripe folder.
Current backend, webhook, storage and client are Cassius-sandbox-only.
Implement explicit test/live support end to end, keeping test as default.
Require persistent order recording for live mode; verify the intended account
and its payment capability. Reject wrong-mode sessions/events; verify signed
webhooks and paid status; preserve idempotency. Keep customer data private.
Update frontend messaging for the actual mode. Test and help deploy changes
to the existing Render service and GitHub Pages. Never claim deployment or
verification without evidence. Never ask for secrets in chat.
Ask my business country/state, initial delivery country and verified supplier
costs before choosing shipping/tax/prices. Toji currently sells at its recorded
supplier cost. Begin with manual fulfillment, not blind product-link purchases.
```

References checked for this guide:
- https://docs.stripe.com/get-started/account/set-up
- https://docs.stripe.com/tax/set-up
- https://render.com/docs/disks
