# YJRL 2027 sign-up delivery guide

Steve authorised working through the remaining work sequentially and deploying completed changes on 7 September 2026. Deployment permission persists: routine releases do not need another approval request. Club decisions and safeguarding sign-off must still be recorded accurately.

## Working order

| Step | Deliverable | Acceptance | Status |
| --- | --- | --- | --- |
| 1 | Establish incremental deployment | Register this workspace with the host deployment wrapper; prepare isolated review resources and a repeatable release/rollback procedure; deploy the already-tested branch and record its URL/version | In progress — host allowlist excludes YJRL |
| 2 | Durable abuse protection | Login, registration, checkout, chat, uploads and reports share limits across Worker instances; return useful retry information; test concurrent requests and failure handling; deploy | Implemented and tested — deployment waiting on workspace approval |
| 3 | Settle account and guardian onboarding | Implement adult-only accounts with parents managing children’s profiles, guardian verification and recovery; test unrelated/disabled accounts; deploy | Adult-only boundary implemented; independent identity/guardian verification and recovery still outstanding |
| 4 | Version forms and consent | Record the exact form/consent version submitted; separate photo/profile/stats permissions; provide an authenticated parent withdrawal path and registrar review history; deploy | Pending |
| 5 | Restrict medical review and complete access recording | Separate access to medical details from ordinary club administration; record remaining child-data reads and controlled exports without copying sensitive content into logs; deploy | Pending |
| 6 | Complete media acceptance | Verify real image processing, orientation and metadata removal using synthetic test images; check reviewer flow, group consent and withdrawal; handle legacy images/caches and cleanup; deploy fixes | Implementation complete; real provider and interaction checks outstanding |
| 7 | Finalise season details | Confirm opening date, fees, discounts, age eligibility, payment options, official competition registration link, registrar contact, teams/training and accurate public copy; deploy | Club details pending |
| 8 | Finish payment/email operations | Configure designated test providers/recipients, exercise sandbox payment and retry/reconciliation, verify message delivery, then configure live providers; deploy | Credentials/configuration and designated test recipient pending |
| 9 | Finish domains and release checks | Identify DNS operator, attach and verify club domains, deep links and checkout return URLs; complete parent/admin/mobile/accessibility acceptance and rollback checks; deploy | Branded domains currently return 404 |
| 10 | Open 2027 sign-ups | Record actual club safeguarding/incident-process sign-off, confirm opening settings and operational contacts, then enable registration/member access and verify the public journey | Held until preceding requirements pass |

The lead works on one implementation step at a time. When a step needs a club decision or an external change, record the precise dependency and continue the next independent step. Do not describe an unverified or undeployed step as complete.

## Deploying as work progresses

1. Keep the current Cloudflare Pages + Worker architecture and branch `codex/2027-signup-readiness`; draft PR: https://github.com/3dhuboz/yjrl/pull/2.
2. Use an isolated review deployment for test submissions, photos and provider checks. Do not point a review frontend at the production database. Restrict review access and use designated synthetic records.
3. Before each release, inspect migrations, run checks appropriate to that change, commit and push the exact source, then use `headsnap cloudflare yjrl --cwd ... -- ...`. Record the deployed commit, environment, URLs and migration state below.
4. Promote verified changes to the live application with registration/member opening controls kept closed until the club's launch requirements are satisfied. Publishing a build does not imply club sign-off or permission to invent dates/fees.
5. For production schema changes, check the existing schema and recovery point first. Apply additive migrations in order; never rerun the legacy seed against live data. Deploy the Worker before the matching client. Record the prior deployment for rollback.
6. After each milestone, update this guide and `SEASON_2027_READINESS.md` with verification, deployment evidence and the next action. Keep secrets and real child details out of these documents.

## Current release candidate

- Branch: `codex/2027-signup-readiness`; the latest pushed commit containing this guide is the candidate. Previous milestones: `13aa212` (media), `92c4d65` (guide/shared limits), `b63b363` (adult-only accounts).
- Completed implementation: shared 2027 season, validated fee/form handling, duplicate protection, checkout recovery, minimal notices, player/guardian boundaries, current coach approval, player read auditing, processed/reviewed photos, durable request limits, adult-only authentication and closed-by-default opening controls.
- Latest verification: 61 tests passed in `hs-20260907032009-3207831-8767ac93`; Worker typecheck passed in `hs-20260907032010-3208017-a7fd1c49`; client build passed in `hs-20260907032011-3208167-93426958`.
- Required migrations before the current Worker: **0004 through 0008**, after the existing baseline. Missing tables/columns deliberately block sensitive routes.
- Release procedure and known previous deployments: `ops/2027_RELEASE_RUNBOOK.md`.
- Photo release instructions: `MEDIA_REVIEW_ACCEPTANCE.md`. Real Images binding acceptance is still outstanding.

## Deployment ledger

| Time (UTC) | Candidate | Environment/action | Result |
| --- | --- | --- | --- |
| 2026-09-07 03:02 | `13aa212` | HeadSnap Cloudflare packaging dry-run | Blocked, exit 77: `Cloudflare commands are limited to approved project workspaces`; job `hs-20260907030222-3151647-d2ba60dd` |

Host readiness reports Cloudflare CLI/MCP and GitHub ready. The failure is the explicit workspace list in `/usr/local/libexec/headsnap-cloudflare-wrangler`, which excludes `/srv/headsnap/workspaces/yjrl`. The exact proposed one-line workspace addition is saved in `ops/headsnap-yjrl-workspace.patch`. Apply only that approved addition; preserve the wrapper and all credential/execution boundaries. No new deployment has yet succeeded.

## Decisions needed from Steve/the club

- **Confirmed:** adult-only accounts like Norths Knights, with parents managing children’s profiles.
- **Awaiting the club:** 2027 opening date, fees/discounts, payment options, age eligibility and registrar contact; Steve has not received these yet.
- Official competition registration destination and which steps the club application completes.
- Designated provider test accounts/recipient and authority over the branded-domain DNS.
- Named safeguarding reviewers, retention/incident operations and actual final club sign-off.

These are decisions or external prerequisites, not reasons to stop unrelated implementation work. League Bot remains specific to Norths Knights.

## Step 2 implementation checkpoint — 7 September 2026

- Shared D1 counters replace instance-local memory. Admission is one atomic upsert, so concurrent server instances cannot each grant a fresh allowance. Only keyed address digests are stored; forwarded headers cannot supply an alternate identity.
- Login, account creation, registration, checkout, chat, uploads and reports are covered. Blocked requests return `Retry-After`; unavailable counters return 503 before sensitive work. Counters expire and hourly scheduled cleanup removes up to 10,000 expired rows per run. This is an application limit, not a volumetric DDoS defence.
- Migration 0007 is additive and required before the Worker. The admin readiness page detects a missing counter table.
- Verification: 53 tests passed in `hs-20260907031025-3174923-5ec991b8`; typecheck passed in `hs-20260907031026-3175144-c8d693df`. Tests include independent instances, concurrent admissions, expiry, spoofed forwarding headers, outage behaviour and every mounted route.
- Deployment: waiting on Steve’s narrowly scoped approval to register this workspace in the host wrapper. No provider credentials or other project workspace were used to bypass the rejection.
- Next: implement the confirmed adult-only account model while deployment approval is pending.

Implementation references: [Cloudflare D1 prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/) and [Cloudflare visitor headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/).

## Step 3 account boundary checkpoint — 7 September 2026

- Public account creation accepts parent accounts only and requires an explicit adult declaration. Registration records the same declaration and version. Login requires the adult’s declaration after password verification. This is self-attestation, not independent proof of age or relationship.
- Legacy junior credentials and JWTs are refused. Existing adult sessions must sign in again after migration 0008 to record the declaration. Checkout resume/capture also checks the current adult account before issuing a session or proceeding with payment. Historical child profiles and accounts are retained without converting child accounts into adults.
- The active client contains parent, coach and admin portals. Old player-portal bookmarks lead to the parent login flow. Public copy explains the adult-only arrangement. Parent account names no longer borrow a child’s surname.
- Remaining in step 3: verified adult identity/email, registrar-approved guardian links, restricted onboarding access and account recovery. The existing registration-created guardian link is still marked verified without independent review; this must be corrected before broad member opening.
- Verification: 57 tests passed in `hs-20260907031638-3195920-c6c01bda`; typecheck passed in `hs-20260907031639-3196096-37b5a8df`. Client build passed in `hs-20260907031640-3196282-32033abd`. Deployment still awaits the host workspace approval.
- Next: add explicit closed-by-default launch controls so incremental releases can be published while club details, identity onboarding and safeguarding sign-off remain outstanding.

## Step 1 opening controls checkpoint — 7 September 2026

- `REGISTRATIONS_OPEN=false` and `MEMBER_ACCESS_OPEN=false` are committed production defaults. Member access requires actual safeguarding sign-off; registration additionally requires the exact confirmed season in `SEASON_DETAILS_CONFIRMED`. Missing settings keep the service closed.
- While closed, the fee API hides carried-over prices/payment methods and the client shows a 2027 preparation page. Both public account creation and player registration refuse writes. Non-admin member sessions and checkout are closed; administrators can still sign in to prepare the service. Event reminders stay off while member access is closed.
- New-registration closure is separate from member access, so after launch the club can stop accepting applications without preventing established members from finishing existing checkout.
- Production CORS permits explicit origins, including the configured frontend. Arbitrary Pages previews and localhost are no longer implicitly trusted.
- Verification: 61 tests, typecheck and client build passed; see current candidate receipts above. Read-only production checks confirmed migrations 0004–0008 are absent and recorded the existing Worker/Pages versions for release planning. No member records or secret values were retrieved.
- Next action: obtain the pending host workspace approval, apply the exact one-line addition, then run the packaging and isolated deployment procedure. Keep season opening and member access closed in production.
