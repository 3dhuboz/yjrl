# 2027 sign-up readiness

## Checkpoint — 6 September 2026

- Objective: prepare YJRL for 2027 sign-ups. Steve confirmed the season; an opening date has not been supplied.
- Owner: this task's lead, working alone in `/srv/headsnap/workspaces/yjrl`.
- Branch: `codex/2027-signup-readiness`; continuation base HEAD: `5dbcd133afcdb6bb17baf1a4edc71c4e5315085b`; draft PR: https://github.com/3dhuboz/yjrl/pull/2.
- Status: season rollover, required-field/consent validation, duplicate protection and registration/payment recovery implemented and verified; not a launch approval.
- Changed surfaces this continuation: shared registration validation, registration form/recovery, API 401 handling, registration/capture/resume routes, PayPal/email helpers, additive duplicate-claim migration, readiness check and regression tests.
- Verification: all 25 tests, Worker typecheck and client production build passed in HeadSnap job `hs-20260906232923-2528185-bcee860b`. Tests use synthetic records in in-memory SQLite with migrations 0001/0003/0004 and mocked PayPal/Resend responses. No production records, emails or payments were created. Browser interaction and real provider delivery have not been tested.
- Deployment check: the Cloudflare packaging dry-run was blocked by HeadSnap's project workspace allowlist (job `hs-20260906232730-2522593-691fb8a6`, exit 77). Do not bypass the wrapper or treat this as missing Cloudflare authentication; the attached Cloudflare API's read-only checks succeeded.
- Remaining risk: fees/dates and the adult account model are unconfirmed; routing, provider configuration and launch safeguards need completion. Migration 0004 must be applied before deploying this Worker.
- Exact next action: incorporate Steve's answer about adopting Norths' adult-only account model, then address the remaining safeguarding and operational launch checks below. Resume here instead of repeating discovery.

## Implemented

- `shared/season.json` supplies the 2027 season to the client and Worker, independent of the calendar year.
- Registration records, duplicate checks, responses and audit events use the selected season. Stale clients must refresh instead of creating a registration for an unintended season.
- Home, teams, fixtures, admin and member portals use the same season; past statistics are no longer presented as current-season statistics. Historical registration labels and payment details retain their actual season.
- Fees and age groups load from the API. Missing/stale/invalid fee data blocks progress with a retry action; the client no longer substitutes $140 and the API no longer substitutes $150 for an unknown age group. Zero-dollar fees remain valid if later configured.
- The old February 2026 early-bird cutoff is removed. The new cutoff is `null`, so no early-bird offer is active. The stored $20 discount and base fees are carried-over values requiring club confirmation.
- Existing PayPal and child-safety controls remain in force.
- Local Vite services bind to `127.0.0.1` under the HeadSnap execution policy.
- Client and server now share bounded validation for names, real past DOBs, guardian/emergency contacts, email, passwords and consent. Terms must be explicitly true; photo consent remains optional and rejects truthy strings. No age-group eligibility rule was invented while club eligibility remains unconfirmed.
- Submitted quotes must match the current server-calculated fee. Changed prices return a review/reload response before creating records or starting payment.
- Wrong existing-account passwords keep the form and current session intact. A saved registration can be recovered after password verification without a second registration.
- Migration 0004 adds atomic identity claims in the same D1 transaction as the registration, preventing concurrent duplicate player/guardian records without rewriting historical data. The admin readiness endpoint checks that this migration exists.
- PayPal cancellation has a saved-registration screen and a signed resume action for the existing order. Capture failures can be retried; amount/currency/capture status and account activity are checked before recording payment. Replayed confirmation does not re-send email or overwrite a concurrent administrative/refund status change. Expired links/orders require registrar assistance rather than silently starting another charge.
- Payment leaves club approval pending. Email failures do not erase successful registration; receipts show a reference and accurate email status. `sent` means the provider accepted the request, not inbox delivery. Registration emails use provider idempotency keys and bounded request timeouts.

## Norths Knights reference

Steve authorised using Norths Knights as context on 6 September. Read-only comparison used committed HEAD `8ae69848910a` in `/srv/headsnap/workspaces/Norths-Knights-website-forms`, specifically `docs/superpowers/specs/2026-08-19-norths-club-forms-design.md`, `packages/club-contracts/src/forms.ts` and `docs/checkpoints/2026-08-28-family-pwa-communications-ready.md`. The working tree has another task's active edits; none were copied or modified.

Reusable decisions: typed field/consent validation, guardian-led completion, club review separate from payment, truthful submission/delivery receipts and atomic duplicate handling. Norths has a materially stronger adult-only identity model, immutable versioned forms, restricted medical review and minimal notification payloads. Those remain alignment work, not features claimed complete in YJRL. A question about adopting adult-only YJRL accounts is pending; existing player accounts were not removed without that scope decision. League Bot remains specific to Norths.

## Current live evidence

Read-only HTTP checks at approximately 23:05 UTC on 6 September 2026:

| Surface | Observed result |
| --- | --- |
| `https://yjrl.pages.dev/register` | HTTP 200 |
| `https://yeppoonjrl.com.au/register` | HTTP 404 from nginx |
| `https://www.yeppoonjrl.com.au/register` | HTTP 404 from nginx |
| Worker `/api/registration-fees` | HTTP 200; old `2026-02-28` cutoff, PayPal false, offline true |

These describe the existing deployment, before this branch. At approximately 23:27 UTC, read-only Cloudflare API checks additionally confirmed:

- Pages project `yjrl` has production branch `master`, only `yjrl.pages.dev`, and no custom domains attached.
- No `yeppoonjrl.com.au` DNS zone is visible in the connected Cloudflare account. This does not establish ownership or availability in another DNS provider/account.
- The production Worker lists no `RESEND_API_KEY`, PayPal credentials/mode or `CHILD_SAFETY_SIGNOFF` binding. `FRONTEND_URL` still points to `https://yeppoonjrl.com.au`; `FROM_EMAIL` is `noreply@yeppoonjrl.com.au`.

Only binding names and the relevant non-secret URL/sender settings were inspected. No administrative password or secret value was retrieved, and no authenticated app readiness check was performed.

## Before opening sign-ups

1. **Club decisions:** confirm the opening date, fees, eligible age groups, discount amount/cutoff, payment options and registrar contact. Verify the official competition registration link and whether this is a club application or the complete registration process; existing copy references PlayHQ without a verified club-specific link.
2. **Registration acceptance:** the validation, password-error, cancellation/retry, concurrency and truthful-email changes now pass isolated tests. Complete browser acceptance and real sandbox provider checks using designated test accounts. Agree the treatment of expired checkouts and consent wording/versioning before launch.
3. **Customer routing and release:** resolve the HeadSnap workspace allowlist for the normal Cloudflare deployment path; identify the club's DNS operator/account, attach and verify both club domains, registration deep links and checkout return URL. Apply migration `worker/migrations/0004_registration_claims.sql` before the Worker release, then deploy client and API from the same reviewed commit. Mixed season/quote versions deliberately refuse registration. Do not point a preview frontend at production for test submissions.
4. **Email and payment:** verify delivery to a designated test recipient after authorisation to send; complete sandbox payment/cancellation/retry checks, then live setup when approved. Confirm offline payment instructions and registrar reconciliation.
5. **Safeguarding:** complete `CHILD_SAFETY_LAUNCH_GATE.md` and club adoption of `CHILD_SAFETY_INCIDENT_PLAYBOOK.md`. Outstanding items in the May audit include read-access auditing, broader publishing consent, image metadata removal and durable rate limiting. Verify current status rather than treating that audit as current proof. Set `CHILD_SAFETY_SIGNOFF=approved` only after actual club sign-off.
6. **Content and acceptance:** add confirmed 2027 teams, training information, contacts and season notices; verify parent/admin workflows and desktop/mobile accessibility before launch. Public club statistics and marketing claims need factual review.

## Verification commands

Run from the repository root:

```sh
headsnap run yjrl -- npm test
headsnap run yjrl -- npm run typecheck
headsnap run yjrl -- npm run build
```

Tests require Node 24's built-in SQLite and use Wrangler's installed bundler; they do not invoke Wrangler, access Cloudflare or require credentials. Install the existing client and Worker lockfiles with `npm ci` through `headsnap run` when dependencies are missing. Route actual Wrangler commands through `headsnap cloudflare`.

Provider reference checks: [PayPal Orders flow](https://developer.paypal.com/api/rest/integration/orders-api/) and [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys). Resend keys are a 24-hour provider deduplication window, not a permanent delivery guarantee; repeated capture is also suppressed in the application.
