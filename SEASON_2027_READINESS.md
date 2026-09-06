# 2027 sign-up readiness

## Checkpoint — 6 September 2026

- Objective: prepare YJRL for 2027 sign-ups. Steve confirmed the season; an opening date has not been supplied.
- Owner: this task's lead, working alone in `/srv/headsnap/workspaces/yjrl`.
- Branch: `codex/2027-signup-readiness`; base HEAD: `1f3ef3ff4f0b` from `origin/master`.
- Status: first season rollover and fee reliability pass implemented and verified; not a launch approval.
- Changed surfaces: shared season settings; registration API/form; season defaults in teams, fixtures, statistics and portals; parent payment lookup; local development bindings; regression tests.
- Verification: client build and Worker typecheck passed in HeadSnap job `hs-20260906230900-2455279-e1162b05`; six isolated tests passed in `hs-20260906231037-2460558-8b181ad2`. Tests use synthetic records in in-memory SQLite with the checked-in migrations. No production records, emails or payments were created.
- Remaining risk: fees and dates are unconfirmed; routing and launch safeguards need completion. This was a focused registration pass, not a complete security or visual audit.
- Exact next action: review this pass, then complete server-side required-field/consent validation and registration recovery before the operational checks below. Resume here instead of repeating discovery.

## Implemented

- `shared/season.json` supplies the 2027 season to the client and Worker, independent of the calendar year.
- Registration records, duplicate checks, responses and audit events use the selected season. Stale clients must refresh instead of creating a registration for an unintended season.
- Home, teams, fixtures, admin and member portals use the same season; past statistics are no longer presented as current-season statistics. Historical registration labels and payment details retain their actual season.
- Fees and age groups load from the API. Missing/stale/invalid fee data blocks progress with a retry action; the client no longer substitutes $140 and the API no longer substitutes $150 for an unknown age group. Zero-dollar fees remain valid if later configured.
- The old February 2026 early-bird cutoff is removed. The new cutoff is `null`, so no early-bird offer is active. The stored $20 discount and base fees are carried-over values requiring club confirmation.
- Existing PayPal and child-safety controls remain in force.
- Local Vite services bind to `127.0.0.1` under the HeadSnap execution policy.

## Current live evidence

Read-only HTTP checks at approximately 23:05 UTC on 6 September 2026:

| Surface | Observed result |
| --- | --- |
| `https://yjrl.pages.dev/register` | HTTP 200 |
| `https://yeppoonjrl.com.au/register` | HTTP 404 from nginx |
| `https://www.yeppoonjrl.com.au/register` | HTTP 404 from nginx |
| Worker `/api/registration-fees` | HTTP 200; old `2026-02-28` cutoff, PayPal false, offline true |

These describe the existing deployment, before this branch. The fee response cannot establish whether email delivery or club sign-off is configured. No administrative credentials were retrieved and no authenticated readiness check was performed.

## Before opening sign-ups

1. **Club decisions:** confirm the opening date, fees, eligible age groups, discount amount/cutoff, payment options and registrar contact. Verify the official competition registration link and whether this is a club application or the complete registration process; existing copy references PlayHQ without a verified club-specific link.
2. **Registration reliability:** validate DOB, guardian/emergency details and terms acceptance server-side. The API's required-field validation is narrower than the form's. Verify existing-account password errors, PayPal cancellation/retry, concurrent duplicate submissions and email-failure recovery. The global Axios 401 handler redirects to login; confirmation copy promises email even when sending is skipped.
3. **Customer routing:** connect and verify both club domains, registration deep links and the checkout return URL. Deploy client and API from the same reviewed commit in a controlled release; mixed season versions deliberately refuse registration. Do not point a preview frontend at production for test submissions.
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
