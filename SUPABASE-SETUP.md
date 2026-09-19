# Save test orders in Supabase

Use this instead of the Render disk instructions in START-HERE.md. No Render
persistent disk is needed. Payments and supplier purchasing remain test-only/disabled.

## Database

Project: https://supabase.com/dashboard/project/isteepszoexdyogicgnn

Run `backend/supabase-schema.sql` in the project's SQL Editor. It creates
`otaku_orders`, enables row-level security, and denies public/customer access.
The backend uses a secret key. Do not add public read policies.

## Render settings

Deploy the updated backend files before adding these environment variables.
Open your existing service at https://dashboard.render.com > Environment.
Keep STRIPE_SECRET_KEY, STOREFRONT_URL, HOST and PORT as they are.
Add all four settings together:

| Name | Value |
| --- | --- |
| SUPABASE_URL | https://isteepszoexdyogicgnn.supabase.co |
| SUPABASE_SECRET_KEY | Existing secret key beginning sb_secret_ from Supabase Project Settings > API Keys |
| STRIPE_WEBHOOK_SECRET | Signing secret beginning whsec_ for the Stripe sandbox webhook below |
| ORDER_AGENT_TOKEN | Random password of at least 32 characters, generated with your password manager |

Remove ORDER_DATA_DIR if you previously added it: select only one storage method.
The Supabase key is NOT the database password or a publishable key. Copy it
directly into Render's private settings; never into chat, GitHub or frontend code.
Supabase recommends secret keys for backend access:
https://supabase.com/docs/guides/getting-started/api-keys

In the Cassius Stripe sandbox, add an event destination for your account:

```text
https://otaku-loot-box.onrender.com/api/stripe/webhook
```

Events: `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
Use that destination's signing secret for STRIPE_WEBHOOK_SECRET above.
Save Render settings and redeploy. Startup checks that the database table can be
read; missing tables, incorrect keys, or unreachable storage prevent startup.

## Verify

1. Open https://otaku-loot-box.onrender.com/api/readiness and check
   `orderRecordingConfigured` is true. This is configuration status, not a live
   database health check.
2. Complete a NEW sandbox checkout on the storefront.
3. In Supabase Table Editor > otaku_orders, confirm its `cs_test_` order appears.
   The payload contains the purchased items and customer details. Keep it private.
4. Resend the same event from Stripe: there should still be exactly one row.
5. Restart Render and confirm the row remains. If delivery fails, fix the issue
   and resend the event from Stripe. Storage failures return an error so Stripe
   can retry instead of silently losing the order.

Orders can also be read privately with Check-Store.ps1 -Orders. Supabase results
are newest-first, up to 100. The existing disk implementation retains its original
session-ID ordering. No supplier purchase or live charge is made by these steps.

Free Supabase projects can pause after inactivity and lack automatic backups.
Plan private backups and service availability before launch:
https://supabase.com/pricing
