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

## Admin testing requests — 7 September

These requests take priority over the remaining launch work above. Deploy through protected review, then production, in completed groups.

| Request | Status |
| --- | --- |
| Fixture creation explains missing opponent/date; edit existing fixtures | **Deployed:** `9360581` |
| Google venue search/select | **Implemented and deployed; connection pending.** No Places/Embed keys found; current fallback searches Google Maps in a new tab. Actual provider acceptance still required |
| Product size tick boxes and linked stocktake | **Deployed:** per-size counts/thresholds, pending collections and atomic collection deductions. Product ordering availability remains manual |
| Admin Google Maps destinations and optional clickable previews for training, fixtures and events | **Deployed:** `9360581` |
| Events tab with calendar, create/edit, drafts, publishing and removal | **Deployed:** `9360581` |
| Upload, privately preview, approve and select a news photo inside the article editor | **Deployed:** `9360581` |
| Clear Save Draft / Publish Article actions and Publish button on draft list | **Deployed:** `9360581`. Existing Test article is a draft |
| Add Player in admin and link to the public registration page | **Deployed:** `9360581`. Manual records stay pending; no junior login or payment is created |
| Remove audit-log/technical status panels from admin | **Deployed:** backend activity history retained |
| Search/sort chat rooms by age group, name or type | **Deployed:** numeric age ordering |
| Uniforms and merchandise shop: online payment and pay on collection | **Deployed:** catalogue, basket, collection orders, PayPal checkout/resume/capture and admin fulfilment. Orders closed; catalogue/provider/fulfilment details and real payment acceptance pending from Nathan |
| Nathan handover and test checklist | **Complete:** `NATHAN_TESTING_HANDOVER.md` contains the requested information list, test sequence and remaining acceptance checks |

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
| Isolated API/SQLite suite | **82 passed** — `hs-20260907075122-3831329-3113e2dc` |
| Worker typecheck | **Passed** — `hs-20260907080343-3856458-dbfd5402` |
| Production client build | **Passed** — `hs-20260907080515-3858927-46b95dad` |
| Real protected review acceptance | **Passed** — `hs-20260907035703-3308085-c9d18063`; synthetic registration/duplicate/guardian reads and real Images/R2 review/withdrawal/cleanup |
| Production API | **Passed** — `hs-20260907040049-3317846-2d0ef6b9`; health, season 2027, hidden fees and closed writes/checkout |
| Production frontend | **Passed** — `hs-20260907040128-3319035-abce104e`; home/register/login/parent deep links return the expected build with preparation/adult-login copy |

Real Chrome acceptance now passes for the requested admin and shop flows: `hs-20260907080410-3857159-68a953a9` and `hs-20260907080212-3852902-6bde1347`. Latest production checks passed in `hs-20260907080831-3865085-37125169` (seven routes, current bundle, closed empty shop, private admin endpoint and closed sign-ups). Broader parent/onboarding/provider acceptance remains outstanding. Existing production admin/JWT secret bindings were retained and checked by name/type only. No existing secret value was retrieved or rotated.

## Deployment ledger

| UTC, 7 Sep 2026 | Source / action | Result |
| --- | --- | --- |
| 09:35–09:38 | `f88e4db`, sizes/stocktake and Maps connection preparation | Migration 0011 applied; Worker `f353e754-bce1-4687-b502-c4ee570bc0f4`; Pages https://ec1fc387.yjrl.pages.dev; 90 tests, browser checks and live HTTP checks pass. Google provider setup pending; orders closed |
| 08:02–08:08 | `fa7f355`, shop and edit preservation | Migration 0010 applied; Worker `83151c72-9a94-4086-b6d9-879fe8411019`; Pages https://1171f88e.yjrl.pages.dev; 82 tests and both browser suites pass; shop closed with no products and online provider unconfigured |
| 07:34–07:36 | `9360581`, admin tools and maps | 69 tests/typecheck/build pass; Chrome acceptance `hs-20260907073407-3795159-89abc4c4`; migration 0009 applied; Worker `48709805-395b-45dd-9166-0ffd2d3464d0`; Pages https://d8385052.yjrl.pages.dev; live bundle verified |
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

**Next action:** connect the approved Google Maps project and run real-provider acceptance; obtain opening stock counts. Nathan’s admin testing and information collection using the handover. Resume guardian verification, recovery and form/consent versioning for season opening; complete real provider acceptance and confirmed catalogue/fulfilment setup before shop opening. Keep deployments incremental and this table current.

## 9 September follow-up: stock and communication

- [x] Stock quantities beside selected youth/men’s/women’s/custom sizes; atomic stocktake saves, pending-order reservations and checkout availability guards. Live at https://yjrl.pages.dev; Worker `bace9e8b-0da3-4662-a57a-41b50cc1842e`, Pages `a8e43605`, source `5f3c6ff`.
- [x] Implement adult team/coaches/committee communication, announcements/pins, saved reactions/read indicators and private group activities with attendance replies.
- [x] Add required versioned adult communication acknowledgement, recorded server-side; never treat it as a guarantee against liability.
- [x] Protected-review browser acceptance passed; communication and agreement deployed. Source `ac429d0ec94593d04a2a01546fe5819593389180`, Worker `2bec87d8-78ca-448d-9b9c-e895fde16b67`, Pages https://e2e1b887.yjrl.pages.dev, public alias verified.
- [ ] Nathan/club legal reviewer: confirm account responsibilities, conduct handling, escalation and approved wording before member access opens.
- [ ] Optional further Heja-style work: background notifications/reminders, polls, approved attachments and public-fixture synchronisation.

The previous stock note about manually controlling all order availability is superseded: on-hand counts minus pending orders now determine size availability automatically. Unknown stock is unavailable. Pending unpaid orders reserve stock until collected or eligible cancellation; do not manually double-deduct reservations.

Final validation for this delivery: 99 API/SQLite tests, Worker typecheck, production build, and protected-review Chrome tests passed. Production deep links serve the expected bundle; communication APIs require authentication and shop ordering stays closed. No real family messages, payments or emails were sent.

## Nathan’s simple content handover

- [x] Short eight-item checklist with the detailed test manual moved to `ops/ADMIN_TESTING_REFERENCE.md`.
- [x] Checklist notes, save-for-later/submission status and per-item private photo uploads; admin photo-review handover.
- [x] Private 90-day link with no admin/player access, hashed server storage and immediate revocation.
- [x] Protected-review Chrome acceptance: save/reload, real processed private photo upload, admin review handover, mobile layout and immediate link revocation (`hs-20260909063101-2203664-fba27f7f`). All 103 API/SQLite tests and Worker typecheck pass.
- [ ] Production deployment; hand one private link to Steve for Nathan.

The private link is not stored in this repository. Club admins can create/turn off links under **Website checklist**. Website content stays private until the usual admin publication/review steps.

Checkpoint, 9 September 06:32 UTC: checklist implementation ready for promotion on `codex/2027-signup-readiness` (base `fa5f756`). Changed files cover the shared eight-item list, private checklist route/component, admin entry, scoped API, migration 0014, acceptance tests and handover docs. Review Worker `4c9a951c-0282-43ef-b772-719ba44f1e81` passed browser acceptance. Production pre-0014 recovery bookmark is `000000e5-00000000-000050e1-14db8f86ac1fd1b24e39df86d3482a0c`; only 0014 is pending. Next: push the validated source, apply 0014, deploy matching Worker/Pages, provision the hashed Nathan invite and verify the live private link. Existing season-opening dependencies remain unchanged.
