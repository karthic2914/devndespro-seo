# Lemon Squeezy subscription rollout (draft)

This branch is **not ready to deploy**. It adds the planned tier metadata and a signed webhook foundation, but does not yet connect subscription lifecycle events to user entitlements.

## Agreed prices (NOK, monthly)

| Tier | Price |
| --- | ---: |
| Free | 0 |
| Starter | 149 |
| Pro | 299 |
| Agency | 699 |
| Founding Pro | 199 for the first three monthly billing cycles, then 299 |

Founding Pro is the **same feature tier as Pro**, not a fifth permanent entitlement tier. Implement the introductory price through a Lemon Squeezy discount or a documented billing migration that automatically charges 299 on the fourth billing cycle. **Do not** represent it as a permanent 199 subscription.

## Required before merging

1. Create monthly subscription products/variants in Lemon Squeezy test mode. Record exact store, product and variant IDs; ensure the founding discount lasts exactly three billing cycles.
2. Implement an authenticated checkout creation endpoint that attaches the logged-in application's user ID in checkout custom data; do not trust an arbitrary browser-supplied user ID.
3. Verify Lemon Squeezy signatures against the raw request body. Handle subscription_created, subscription_updated, subscription_payment_success, subscription_payment_failed, subscription_cancelled, subscription_expired and subscription_resumed as applicable. Store subscription IDs, variant IDs, status, renewal/expiry timestamps and webhook event IDs with idempotency. Never grant access based on a redirect alone.
4. Reconcile subscription state and payment status to existing users and plan flags. Protect against out-of-order events and avoid overwriting administrator-assigned access or unrelated Stripe subscriptions.
5. Add tests for invalid signatures, duplicate events, failed payments, cancellation, expiry, refunds, wrong product/variant, mismatched user identity and fourth-cycle price transition.
6. Configure Railway environment variables securely, then test the complete flow before enabling live mode. The existing NOK 399 one-time draft product is **not** one of the new monthly plans.

Existing Stripe billing in backend/routes/billing.js remains unchanged. Its checkout currently supports only Pro and Agency; do not expose Starter checkout until the Lemon Squeezy implementation is ready.
