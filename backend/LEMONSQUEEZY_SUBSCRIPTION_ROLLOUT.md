# Lemon Squeezy subscription rollout (draft)

This branch is **not ready to deploy**. It adds the planned tier metadata and a signed webhook foundation, but does not yet connect subscription lifecycle events to user entitlements.

## Agreed prices (NOK, monthly)

| Tier | Price |
| --- | ---: |
| Launch (internal starter) | 99 |
| Accelerate (internal pro) | 199 |
| Command (internal agency) | 399 |

The previously proposed founding offer of NOK 199 for three months then NOK 299 is superseded. Keep the three existing public plan names and prices. Existing internal plan IDs remain starter/pro/agency for compatibility; verify the Launch entitlement against the current live implementation before deployment.

## Required before merging

1. Create monthly subscription products/variants in Lemon Squeezy test mode. Record exact store, product and variant IDs; keep public pricing aligned with Launch/Accelerate/Command.
2. Implement an authenticated checkout creation endpoint that attaches the logged-in application's user ID in checkout custom data; do not trust an arbitrary browser-supplied user ID.
3. Verify Lemon Squeezy signatures against the raw request body. Handle subscription_created, subscription_updated, subscription_payment_success, subscription_payment_failed, subscription_cancelled, subscription_expired and subscription_resumed as applicable. Store subscription IDs, variant IDs, status, renewal/expiry timestamps and webhook event IDs with idempotency. Never grant access based on a redirect alone.
4. Reconcile subscription state and payment status to existing users and plan flags. Protect against out-of-order events and avoid overwriting administrator-assigned access or unrelated Stripe subscriptions.
5. Add tests for invalid signatures, duplicate events, failed payments, cancellation, expiry, refunds, wrong product/variant, mismatched user identity and plan pricing consistency.
6. Configure Railway environment variables securely, then test the complete flow before enabling live mode. The existing NOK 399 one-time draft product is **not** the Command monthly subscription.

Existing Stripe billing in backend/routes/billing.js remains unchanged. Its checkout currently supports only Pro and Agency; do not expose Starter checkout until the Lemon Squeezy implementation is ready.
