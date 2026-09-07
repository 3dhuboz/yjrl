# YJRL 2027 sign-up delivery guide

Updated 7 September 2026 after the first production release. Steve authorised completing the work sequentially and deploying verified milestones. Adult-only accounts are confirmed; opening date, fees/payment options and registrar details are still awaited from the club.

## Current public version

**Live:** https://yjrl.pages.dev/register

The application now presents the 2027 preparation page. New registrations and member access remain closed, provisional fees are hidden, and administrators retain preparation access. Publishing this release does not constitute club safeguarding sign-off or opening the season.

Production source: `46ea14cecf05b277d5863a9b31c2be4e6f7d7915` on `codex/2027-signup-readiness`. Draft PR: https://github.com/3dhuboz/yjrl/pull/2. Production remains Cloudflare Pages + Worker. League Bot remains specific to Norths Knights.

## Work through these in order

| Step | Work | Current status / acceptance still needed |
| --- | --- | --- |
| 1 | Establish incremental deployment | **Done:** host workspace registered, isolated protected review service deployed, production migrated and released, recovery procedure recorded |
| 2 | Durable abuse protection | **Deployed:** shared atomic counters, useful retry responses, fail-closed outages and hourly expiry cleanup; concurrency and deployed route checks pass |
| 3 | Adult accounts and guardian onboarding | **Adult-only boundary deployed. Next:** independent adult/email verification, registrar-approved guardian relationships, limited onboarding access and account recovery. Registration currently marks its own guardian link verified; correct this before member opening |
| 4 | Version forms and consent | Photo/profile/stats choices are separate. Still needed: immutable form/consent versions, parent withdrawal flow, registrar decision history and approved final wording |
| 5 | Medical permissions and access recording | Player reads and private photo previews are recorded. Still needed: a distinct medical-review permission, remaining child-data read coverage, controlled exports and agreed retention/archival operations |
| 6 | Complete media acceptance | Real PNG→WebP processing, synthetic metadata removal, private preview/review, stale review denial, withdrawal and deletion **passed in review**. Still needed: JPEG EXIF/GPS/orientation, other image variants and full reviewer/mobile/keyboard acceptance; see `MEDIA_REVIEW_ACCEPTANCE.md` |
| 7 | Finalise 2027 club details | Awaiting opening date, fees/discounts, eligible age groups, payment options, registrar contact, official competition registration destination, teams/training and verified public copy |
| 8 | Payment/email operations | Awaiting designated provider test accounts and test recipient. Complete real sandbox payment/retry/reconciliation and email delivery, then live configuration. No real email or payment was sent during this work |
| 9 | Domains and complete acceptance | Identify the DNS operator and attach/verify club domains and return URLs. Complete parent/admin/browser/mobile/accessibility and recovery checks. The working public address is currently `yjrl.pages.dev` |
| 10 | Open sign-ups | Only after the preceding launch requirements and actual club safeguarding/incident-process sign-off. Keep production opening controls closed until then |

When a step needs a club decision or external change, record the dependency and continue independent implementation. Deploy a verified milestone through review first, then promote with opening controls closed. Do not equate a build or Git push with a deployment.

## What is already implemented

- Shared 2027 season and strict fee/form validation; unknown fees are never guessed and changed quotes require review.
- Atomic duplicate registration claims, saved receipt recovery, PayPal cancellation/resume/capture retry and minimal truthful registration notices.
- Adult-only account creation/login/checkout sessions with a versioned self-declaration. Existing adults sign in again; junior sessions are refused and historical player records are preserved. Self-declaration is **not** independent proof of age or guardianship.
- Current coach approval checks, player/guardian access boundaries, required player read logging and private media-preview logging.
- Processed photos only, private review, group consent, hash/version checks, revoked-image suppression and rejected-object cleanup.
- Shared request limits and separate registration/member opening switches. Public registration requires actual safeguarding sign-off and the exact confirmed season; the committed production switches are false.

## Verification evidence

| Check | Result / receipt |
| --- | --- |
| Isolated API/SQLite suite | **63 passed** — `hs-20260907035215-3292621-41ca92e1` |
| Worker typecheck | **Passed** — `hs-20260907035216-3292887-8be77553` |
| Production client build | **Passed** — `hs-20260907040029-3315989-3ef47c93` |
| Real protected review acceptance | **Passed** — `hs-20260907035703-3308085-c9d18063`; synthetic registration/duplicate/guardian reads and real Images/R2 review/withdrawal/cleanup |
| Production API | **Passed** — `hs-20260907040049-3317846-2d0ef6b9`; health, season 2027, hidden fees and closed writes/checkout |
| Production frontend | **Passed** — `hs-20260907040128-3319035-abce104e`; home/register/login/parent deep links return the expected build with preparation/adult-login copy |

The frontend checks inspect deployed HTTP/build responses; full interactive browser acceptance and real production administrator login remain outstanding. Existing production admin/JWT secret bindings were retained and checked by name/type only. No existing secret value was retrieved or rotated.

## Deployment ledger

| UTC, 7 Sep 2026 | Source / action | Result |
| --- | --- | --- |
| 03:02 | `13aa212`, packaging attempt | Host workspace list rejected YJRL; no deployment |
| 03:48 | Approved one-line YJRL workspace addition | Applied to root wrapper; root:root / 755 retained, syntax valid; packaging passed in `hs-20260907034858-3284376-d2a78491` |
| 03:52 | Review database setup | Seven schema migrations, 0001 and 0003–0008, applied without old seed; `hs-20260907035206-3292188-335a5ef3` |
| 03:53 | First review deployment attempt | Pages wildcard rewrite rejected by Worker Assets; fixed in review-only asset staging |
| 03:55 | `51712ce`, protected review | Live at https://yjrl-review.steve-700.workers.dev; version after isolated secrets: `f9ebe00a-a95f-4035-86cb-5cabb839c6f6` |
| 03:59 | Production schema | Migrations 0004–0008 applied successfully; `hs-20260907035935-3312773-559ac938`; no old schema/seed replay |
| 04:00 | `46ea14c`, production Worker | Version `d66eebc8-4e34-4fff-a0a7-61f1dc5f8fc3` at 100%; `hs-20260907035958-3314370-3c240be8` |
| 04:01 | `46ea14c`, production Pages | Deployment `9cb8b591-e863-4640-919e-6e06f85b72af`; https://9cb8b591.yjrl.pages.dev; public alias verified |

## Release controls and next action

Use `ops/2027_RELEASE_RUNBOOK.md` for exact resources, build/migration commands and recovery evidence. Review has its own D1/R2, JWT/admin/access credentials, same-origin frontend/API and no payment/email providers or cron. Its synthetic launch settings do not apply to production. Both buckets have public managed access disabled and no custom domains.

Production has `REGISTRATIONS_OPEN=false`, `MEMBER_ACCESS_OPEN=false`, and `SEASON_DETAILS_CONFIRMED=""`. Do not set actual safeguarding sign-off until the club adopts the incident playbook and approves launch.

**Next implementation:** guardian verification and account recovery, then form/consent versioning and parent withdrawal. Keep deployments incremental and this table current.
