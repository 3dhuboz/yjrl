## Sizes, stocktake and venue search checkpoint — 7 September 2026, 09:38 UTC

Objective: add Google venue search/selection, product size tick boxes and linked admin stocktake; deploy. Single lead; branch `codex/2027-signup-readiness`. Latest application source `f88e4db7fec8f200660ca2973812f9860f51a98c`, pushed. Worker code is unchanged from `383f4d2`; the final source change increases map preview height to 220px.

**Live:** youth, men’s, women’s AU and adult/unisex size choices, preserved custom options and public size selection. Shop **View Stock** links to the new **Stocktake** tab. Counts start unknown, support per-size thresholds/reasons, retain removed sizes and reject stale writes. Outstanding paid/unpaid collections are separate from physical counts. A paid collection atomically deducts every tracked size once; insufficient counted stock rolls back the whole collection action. Product availability remains manually controlled; counts do not reserve stock or automatically stop checkout.

**Maps dependency:** admin search/select, Google Place ID destinations and automatic Embed API previews are implemented and deployed but have no live Google connection. Current admin fallback opens a typed Google Maps search in a new tab and accepts its Share link. No reusable Maps connection was found in YJRL or the inspected Norths checkout. See `ops/GOOGLE_MAPS_SETUP.md`; actual Places/Embed keys and provider/domain acceptance are still required. No keys were exposed or invented.

**Verification:** 90 API/SQLite tests passed (`hs-20260907093212-4056292-caaba96b`), Worker typecheck passed (`hs-20260907092809-4039440-951f2631`). Chrome suite `hs-20260907093409-4063807-611be78c` passed size save/reopen/public options, linked counts, real review collection deduction 10→8, mobile layout, real unconfigured Maps fallback and explicitly simulated Google result selection/public destination/embed. No real Google search, payment or email was sent. Browser source is `383f4d2`; final CSS-only map-height change passed build `hs-20260907093636-4070948-37744a1b`. Production HTTP checks `hs-20260907093802-4074457-22dc522d` passed current bundle, five routes, protected stock/search and closed ordering.

**Release:** migration 0011 applied in review and production, without historical seeds. Initial review migration failed on D1 parsing a CASE inside a trigger; read-only checks proved complete rollback. Separate validation and deduction triggers passed SQLite and remote D1. Review Worker `fdebc836-5f65-41dc-b064-eb4989cdd3b0`; production Worker `f353e754-bce1-4687-b502-c4ee570bc0f4`; Pages https://ec1fc387.yjrl.pages.dev, bundle `index-DB6Ofdu3.js`, alias https://yjrl.pages.dev. Recovery bookmark before 0011: `0000009e-00000000-000050df-66750f03e6df565c5d4a90c0917b34ba` (`hs-20260907093410-4063894-d7094e37`). Production application records were not changed by acceptance; synthetic review stock/order history remains after product removal. Sign-ups/member access and shop ordering remain closed.

**Changed files:** `ProductSizeFields`, `AdminStocktake`, `AdminShop`, admin tabs/CSS; migration 0011 and stock/shop routes; Maps routes/shared helper/config hook/location components; Google usage links in legal pages; API and browser checks; Nathan handover and setup guide.

**Next action:** Nathan’s testing, opening stock counts and catalogue details. Identify/configure an approved Google Maps Platform project and perform actual selection/map acceptance. Resume the remaining guardian, consent, payment/provider and season-opening work in the delivery guide. Do not claim live Maps selection is available until connected.

## Admin and shop delivery checkpoint — 7 September 2026, 08:09 UTC

Objective: complete Steve’s screenshot requests and uniforms/merchandise shop setup, deploy incrementally, and provide Nathan’s testing/input guide. Branch `codex/2027-signup-readiness`; application HEAD `fa7f355591122852a3af15a05c8e17dc6549d3af`, pushed. Single lead owns this checkout.

**Delivered and live:** all admin requests in the checkpoint below, plus shop product drafts/publishing, reviewed photos, sizes/colours/AUD prices, basket, private order receipts, pay on collection, PayPal creation/resume/capture/reconciliation and admin payment/collection recording. Team/fixture edits preserve results/records; coach assignment stays unchanged unless selected. Same-day games and ongoing events remain visible. Backend audit history remains recorded. Public shop: https://yjrl.pages.dev/shop; ordering closed, no products published, provider unconfigured. Public registrations/member access also remain closed.

**Verification:** 82 API/SQLite tests (`hs-20260907075122-3831329-3113e2dc`), final typecheck (`hs-20260907080343-3856458-dbfd5402`) and production build (`hs-20260907080515-3858927-46b95dad`) pass. Chrome admin suite passed on final source (`hs-20260907080410-3857159-68a953a9`); Chrome shop/team-edit suite passed (`hs-20260907080212-3852902-6bde1347`). These cover real Images/R2 article upload and review, public news/maps/events, manual player entry, room controls, shop catalogue/order/receipt/collection and mobile layout. PayPal is tested with provider simulations; no real payments or emails were sent. Synthetic review products/content removed; inactive players and completed synthetic collection orders retain audit history. Production HTTP checks passed (`hs-20260907080831-3865085-37125169`).

**Release:** migration 0010 applied to both DBs. Production Worker `83151c72-9a94-4086-b6d9-879fe8411019`; Pages https://1171f88e.yjrl.pages.dev (public alias verified), source `fa7f355591122852a3af15a05c8e17dc6549d3af`. Protected review Worker `90696a2e-b003-43a3-97d7-8e7bfec89e4d`. Before shop migration, production recovery bookmark was `00000096-00000000-000050df-72a0627feb24d1ad74bcfd98d5e40ee9`.

**Changed files:** `worker/src/routes/shop.ts`, migration 0010, index/rate-limit mounting, shop tests/browser acceptance; `AdminShop`, `YJRLShop`, shared photo uploader, navigation/login return and admin editing. `NATHAN_TESTING_HANDOVER.md` is the completed information list and testing sequence; `SIGNUP_2027_DELIVERY_GUIDE.md` retains the full remaining launch work.

**Remaining risk / next action:** obtain Nathan’s catalogue, prices, photos, exact venue links, collection/policy/provider and 2027 details. Run real designated PayPal sandbox/domain-return/operations acceptance before enabling online orders. Shop currently uses collection and admin-managed availability; clarify delivery, inventory, notifications and refund operations. Arrange named adult test access. Resume independent guardian verification/recovery and form/consent/medical-access launch work from the delivery guide before opening registrations. Keep production controls closed while these decisions/checks remain outstanding. League Bot remains Norths-only.

## Admin tools checkpoint — 7 September 2026, 07:36 UTC

Objective: finish Steve’s screenshot requests, deploy as we go, prepare Nathan’s testing guide, then resume the 2027 launch guide. Branch `codex/2027-signup-readiness`; application HEAD `93605816e6a75390846213848015745f97b8d3f7`, pushed. Lead-only checkout.

**Deployed:** fixture validation/editing, editable team/training locations, Google Maps destinations and copied optional embed previews, Events admin calendar/draft/publication/removal, news photo upload/private review within article form, truthful draft/publish controls, manual pending player entry/public registration link, room search/numeric sorting, removal of the audit-log and obsolete technical cards from admin. Backend audit recording retained. Files: shared maps/fixture validation, migration 0009, Worker teams/fixtures/events/players/upload, client admin/public pages and new components, API tests and browser acceptance script.

**Evidence:** 69 API/SQLite tests; typecheck; review and production builds. Real Chrome review acceptance passed (`hs-20260907073407-3795159-89abc4c4`) for fixture create/edit/validation, public game/training maps links, mobile Teams layout, event draft/publication, real Images upload/preview/review and public article visibility, manual pending player creation, room search/sort and no page exceptions. Synthetic review fixtures/events/news/images were removed; synthetic player audit history retained as inactive. No production sample data, payments or emails created.

**Release:** review Worker `92c5cb27-146d-4c7f-9666-04430f7142b6`; production Worker `48709805-395b-45dd-9166-0ffd2d3464d0`; production Pages https://d8385052.yjrl.pages.dev at https://yjrl.pages.dev. Migration 0009 applied to both databases. Pre-migration production recovery bookmark: `00000093-00000000-000050df-ac99c91ed1b257e43a07f233a8c124db`. Production registration/member switches remain false.

**Next action:** implement uniforms/merchandise catalogue and purchase setup with online payment and pay on collection, then deploy and finalise `NATHAN_TESTING_HANDOVER.md`. Nathan has not supplied products, prices, photos, sizes, supplier, fulfilment/payment information. Keep real ordering closed until configured. Original remaining sign-up work and Nathan’s full requested-input list remain in the delivery guide. Do not reopen public registrations from this admin release. Google destinations still need to be set/confirmed by the club; legacy venue names are not silently geocoded.

## Live release checkpoint — 7 September 2026, 04:05 UTC

Objective: execute the 2027 delivery guide sequentially and deploy verified milestones. Branch `codex/2027-signup-readiness`; application HEAD `46ea14cecf05b277d5863a9b31c2be4e6f7d7915`. This checkout has one lead owner. The current delivery guide supersedes earlier checkpoint statuses below.

**Production is deployed:** https://yjrl.pages.dev/register. Worker version `d66eebc8-4e34-4fff-a0a7-61f1dc5f8fc3`; Pages deployment `9cb8b591-e863-4640-919e-6e06f85b72af`. The matching client/Worker use 2027; fees and registration/member opening remain closed. Production migrations 0004–0008 are applied. Existing provider/admin/JWT secrets were retained; no real registrations, payments or messages were created. Closure probes wrote only operational request counters.

Changes this continuation: exact approved host workspace addition; protected isolated review Worker/config with static-asset staging; review and production migration staging that avoids the legacy seed; real synthetic review acceptance script; production promotion and ledger/runbook updates. 63 tests, typecheck and production build pass. Real staged registration/duplicate/guardian read and Images/R2 preview/review/withdrawal/cleanup passed. Deployed public API and frontend HTTP/build checks pass. See `SIGNUP_2027_DELIVERY_GUIDE.md` for exact receipts.

Remaining risk: independent identity/guardian verification and recovery, immutable forms and parent consent withdrawal, narrow medical permissions/wider access logging, remaining image/browser/provider acceptance, confirmed club season details and domains, actual safeguarding sign-off. Self-attestation remains distinct from verification. Production admin login was not tested with real credentials.

Exact next action: implement guardian verification and recovery, verify in the protected review environment, then promote the next milestone with production opening closed. League Bot remains Norths-only.

## Earlier checkpoints (historical)

## Release preparation checkpoint — 7 September 2026, 03:23 UTC

Objective: execute `SIGNUP_2027_DELIVERY_GUIDE.md` one step at a time and deploy verified milestones. Branch `codex/2027-signup-readiness`; previous pushed HEAD `b63b363`. The lead exclusively owns this checkout.

Changed files: opening policy (`worker/src/lib/launch.ts`, auth/registration/admin middleware and routes, Worker variables/cron/CORS), registration closed-state client and fee contract, tests, delivery guide and `ops/2027_RELEASE_RUNBOOK.md`. Also corrects the exact proposed workspace patch context. 61 tests, Worker typecheck and client build passed; receipts are in the guide. Existing adult-account and durable-limit work is pushed.

Deployment is still blocked by HeadSnap’s explicit approved-workspace list. The user-facing approval for the exact YJRL addition remains unanswered; the patch has not been applied and no deployment has succeeded. Read-only production schema/previous-release checks succeeded with zero database writes. Production requires migrations 0004–0008 before this Worker.

Remaining risk: independent guardian/identity verification, recovery, versioned forms/withdrawal, medical access roles and wider audit coverage, real media/provider acceptance, actual season details, branded domains and club safeguarding sign-off. Adult self-attestation is not independent verification. Opening controls remain closed until these are satisfied.

Exact next action: on approval, add only the proposed YJRL workspace entry, run the release runbook’s dry-run and isolated review deployment, record its URL/version, then resume the next guide item. Do not bypass the host wrapper or imply that a build/push is a deployment.

## Account boundary checkpoint — 7 September 2026, 03:17 UTC

Objective: work through the delivery guide and deploy verified milestones. Branch `codex/2027-signup-readiness`; prior pushed HEAD `92c4d65`. Adult-only changes span shared declaration/registration validation, Worker auth and checkout, migration 0008, login/navigation/registration copy and tests.

57 tests and typecheck pass (receipts in `SIGNUP_2027_DELIVERY_GUIDE.md`); client build passed in `hs-20260907031640-3196282-32033abd`. Adult self-attestation is explicit and versioned. Junior login/tokens and checkout access are blocked; historical player records are retained. Independent identity, guardian review and recovery remain outstanding.

Deployment remains blocked by the explicit host workspace list; the one-line addition is awaiting Steve’s answer. Next action: finish build/commit, then implement closed-by-default release controls while waiting.

## Delivery checkpoint — 7 September 2026, 03:11 UTC

Objective: complete the ordered `SIGNUP_2027_DELIVERY_GUIDE.md` and deploy each verified milestone. Branch: `codex/2027-signup-readiness`, prior pushed HEAD `13aa212`. This checkout has one lead owner.

Steve confirmed adult-only accounts; the club has not yet supplied season dates/fees/payment options/contact. The delivery guide records all remaining steps. Step 2 now has durable request limits (migration 0007, middleware, mounted routes, expiry cron, readiness check and regression tests). 53 tests and typecheck passed; see the guide for job receipts.

Deployment remains blocked by the root-owned HeadSnap Cloudflare workspace list. Exact one-line addition prepared in `ops/headsnap-yjrl-workspace.patch`; narrowly scoped approval is pending. No deployment has succeeded. No production data was changed.

Next action: implement adult-only accounts and keep the guide current; on host workspace approval, apply the exact addition and complete isolated review deployment. Season opening stays dependent on genuine club details and safeguarding sign-off.

# 2027 sign-up readiness

## Checkpoint — 7 September 2026

- Objective: prepare YJRL for 2027 sign-ups. Steve confirmed the season; an opening date has not been supplied.
- Owner: this task's lead, working alone in `/srv/headsnap/workspaces/yjrl`.
- Branch: `codex/2027-signup-readiness`; continuation base HEAD: `b826884c2ffbbcff6f17dd772214e0788ab52d29`; draft PR: https://github.com/3dhuboz/yjrl/pull/2. This checkpoint is committed with the photo review changes; use `git rev-parse HEAD` for the resulting commit.
- Status: season rollover, validation, duplicate/payment recovery, registration privacy, player access controls and reviewed photo handling implemented; not a launch approval.
- Changed surfaces this continuation: photo processing/upload/media routes; review and consent handling; news/event image references; media-preview access logging; migration 0006 and Images binding; admin upload/preview/subject review/news selection; news article photo display; readiness checks; shared test fixtures/media tests and release notes.
- Verification: all 47 tests and Worker typecheck passed in HeadSnap job `hs-20260907025753-3133624-21c8696f`. Client production build passed in `hs-20260907025622-3123069-7950700f`. Tests use synthetic records in in-memory SQLite with migrations 0001/0003/0004/0005/0006 and mocked PayPal/Resend/Images/R2. The image test uses a synthetic WebP container, not a real codec: processing, orientation and metadata removal still need a real staged Images binding check. No production records, objects, emails or payments were created. Browser interaction and real provider delivery have not been tested.
- Deployment check: the Cloudflare packaging dry-run was blocked by HeadSnap's project workspace allowlist (job `hs-20260906232730-2522593-691fb8a6`, exit 77). Do not bypass the wrapper or treat this as missing Cloudflare authentication; the attached Cloudflare API's read-only checks succeeded.
- Remaining risk: fees/dates and the adult account model are unconfirmed; routing, provider configuration and launch safeguards need completion. Apply migrations 0004–0006 before this Worker. Missing access-log columns deliberately prevent player/preview reads. Existing originals need re-upload/review, and `IMAGES` needs staged verification. Dedicated medical-review permissions, consent/form versioning, text/story consent and wider child-data access auditing remain incomplete. See `MEDIA_REVIEW_ACCEPTANCE.md` for precise photo coverage and limits.
- Exact next action: implement durable abuse controls for registration/login/upload from the existing isolate-local limiter in `worker/src/index.ts`, while retaining the pending adult-account decision. Use existing Cloudflare evidence until release prerequisites change; do not repeat provider probes or bypass the HeadSnap allowlist. Resume here instead of repeating discovery.

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
- Registration email subjects/bodies now use a registration reference, season and payment status/amount. Child names, age groups, DOBs, medical notes and guardian/emergency details are omitted. PayPal purchase descriptions also use the reference. Recipient addresses still necessarily go to the email provider, but are omitted from email-failure audit details. This change does not assert that all unrelated notifications are minimal.
- Player accounts cannot become guardians merely through `players.user_id` or a stored parent link: parent-detail and parent-chat access also require an adult account role. Legacy direct adult ownership still counts as a guardian relationship; self-registration still creates a verified link without external identity review, which remains a launch decision. Guardian detail views now select the correct parent scope. Bulk admin rosters omit medical notes; individual admin/guardian views retain existing medical access pending a dedicated review-permission model.
- The five player GET routes (roster, self, children, team and individual detail) save an access event before sending child data and return HTTP 503 if recording fails. Events store actor/resource IDs, role, action, scope and time without copying profile or medical content. Migration 0005 prevents ordinary update/delete/replacement; a database owner can still alter/drop the schema. This is not an external immutable archive, and chat/media/other child-data routes are not yet covered. Readiness checks the table and its three guards. Authenticated responses use `Cache-Control: no-store`; database/route failures no longer masquerade as invalid sessions.
- Coach approval is recalculated from the database on every authenticated coach request using the existing approval criteria: approved status, verified/unexpired Blue Card, identity check, training and active role. Player/team access, coaching mutations, fixture changes, uploads and coach/team chat require current approval. Separate verified guardian access survives missing/expired coach approval; explicit account suspension still disables the account. No approval is granted by this change.
- All photo uploads now enter private review. The Images binding decodes and emits bounded still WebP output before storage; malformed/metadata-bearing output is rejected. The original bytes and filename are not saved. Missing processing refuses uploads. Migration 0006 marks legacy uploads as unprocessed; they cannot be served or previewed until re-uploaded.
- Administrators can upload and privately preview photos, identify every child in a group image and review the exact image hash. Preview access is recorded before returning bytes. Approval requires current consent for all identified active players and uses a review version to reject stale decisions. Public media uses `no-store` and checks current consent on each request. Rejection withdraws access before storage deletion, with an explicit retry when cleanup fails.
- News/event image fields require reviewed references and hide unreviewed/revoked images. The news editor selects approved photos and displays them in article detail. This does not enforce consent for free-text player stories or already shared/downloaded images. Human reviewers must identify all children; no automated face identification is used.
- Photo, public-profile and public-statistics consent are independent. Registrar updates accept explicit booleans, work as consent-only changes and preserve omitted choices. Self-service parent withdrawal and versioned guardian evidence remain outstanding; the registrar must handle requests under the agreed club process.

## Norths Knights reference

Steve authorised using Norths Knights as context on 6 September. Read-only comparison used committed HEAD `8ae69848910a` in `/srv/headsnap/workspaces/Norths-Knights-website-forms`, specifically `docs/superpowers/specs/2026-08-19-norths-club-forms-design.md`, `packages/club-contracts/src/forms.ts` and `docs/checkpoints/2026-08-28-family-pwa-communications-ready.md`. The working tree has another task's active edits; none were copied or modified.

Reusable decisions: typed field/consent validation, guardian-led completion, club review separate from payment, truthful submission/delivery receipts, atomic duplicate handling and minimal registration notifications. Norths has a materially stronger adult-only identity model, immutable versioned forms and restricted medical review. Those remain alignment work, not features claimed complete in YJRL. Steve confirmed adult-only YJRL accounts on 7 September. Implementation is the next delivery step; historical player profiles must be preserved. League Bot remains specific to Norths.

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

Read-only R2 settings checked on 7 September confirmed no custom domains on `yjrl-uploads` and its managed `r2.dev` domain disabled. No object contents were inspected and no bucket settings were changed. The bucket must stay private so uploads cannot bypass the Worker review gate.

## Before opening sign-ups

1. **Club decisions:** confirm the opening date, fees, eligible age groups, discount amount/cutoff, payment options and registrar contact. Verify the official competition registration link and whether this is a club application or the complete registration process; existing copy references PlayHQ without a verified club-specific link.
2. **Registration acceptance:** the validation, password-error, cancellation/retry, concurrency and truthful-email changes now pass isolated tests. Complete browser acceptance and real sandbox provider checks using designated test accounts. Agree the treatment of expired checkouts and consent wording/versioning before launch.
3. **Customer routing and release:** resolve the HeadSnap workspace allowlist for the normal Cloudflare deployment path; identify the club's DNS operator/account, attach and verify both club domains, registration deep links and checkout return URL. Apply migrations 0004, 0005 and 0006 before releasing the Worker, then release the matching client from the same reviewed commit. Verify the Images binding and complete `MEDIA_REVIEW_ACCEPTANCE.md`, including legacy images/caches and private bucket settings. Mixed season/quote versions deliberately refuse registration. Missing access logging deliberately refuses player reads. Do not point a preview frontend at production for test submissions.
4. **Email and payment:** verify delivery to a designated test recipient after authorisation to send; complete sandbox payment/cancellation/retry checks, then live setup when approved. Confirm offline payment instructions and registrar reconciliation.
5. **Safeguarding:** complete `CHILD_SAFETY_LAUNCH_GATE.md` and club adoption of `CHILD_SAFETY_INCIDENT_PLAYBOOK.md`. Player routes and media previews now require access recording; wider child-data route coverage, compliance exports, retention/archival policy, broader story/publishing consent and durable rate limiting remain unfinished. Photo processing/review is implemented but still needs the staged acceptance checks. Verify current status rather than treating the May audit as current proof. Confirm existing coaches have valid recorded approvals before release. Set `CHILD_SAFETY_SIGNOFF=approved` only after actual club sign-off.
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

## Checkpoint — 9 September 2026: inline stock and order availability

- Objective: counts beside ticked product sizes, shared with Stocktake; reserve pending orders and prevent overselling.
- Branch `codex/2027-signup-readiness`; deployed source `5f3c6ff069df309457d38c8352ff2597998c67db`.
- Changes: product size/editor/shop UI, shared stock writes, migration 0012 with atomic availability and version guards; API and browser acceptance.
- Verification: 93 API/SQLite tests, Worker typecheck, frontend build and protected-review Chrome acceptance passed. Review version `4eb4072b-6fd0-49e9-a72f-50c697a1283d`.
- Production migration 0012 applied; Worker `bace9e8b-0da3-4662-a57a-41b50cc1842e`, Pages https://a8e43605.yjrl.pages.dev, bundle `index-Dzmkd6l1.js`. D1 pre-migration bookmark `000000dc-00000000-000050e1-5dc0575c2d9af147cf0341f71f5fefc4`.
- Remaining risk: unpaid pending orders hold inventory until collection or eligible cancellation; PayPal credentials and payment reconciliation acceptance remain pending. No automatic reservation expiry. Production registration/member/shop gates remain closed.
- Next: implement the confirmed Heja-style adult group communication request (private team/coaches/committee groups, announcements, saved reactions/read indicators, activity attendance).

## Checkpoint — 9 September 2026: communication ready for browser acceptance

- Objective: confirmed Heja-style adult group communication, plus Steve’s required adult account-security/conduct checkbox. Branch `codex/2027-signup-readiness`, base HEAD `5f3c6ff`; communication changes are not yet committed.
- Files: migration 0013; shared chat agreement; chat room access, communication routes and agreement middleware; CommunicationHub, GroupSchedule, ChatAgreement, rewritten YJRLChat and portal wiring; focused API/browser tests and handover.
- Evidence: 99 API/SQLite tests pass (`hs-20260909054008-2088834-ec359444`), typecheck passes (`hs-20260909054009-2089047-3335cbf0`), review build passes (`hs-20260909054011-2089221-db99f147`).
- Review migration 0013 applied. Review Worker `9f5fa3d3-7803-43d5-888b-09f5f962411c` with bundle `index-COD6PMkI.js`. First browser run found slow checkbox feedback in committee management; fixed with immediate selection feedback and disabled Done until persistence completes.
- Remaining: rerun browser acceptance, then commit/push, fresh production recovery bookmark, stage/apply only 0013, deploy Worker and production-targeted Pages build. Do not change public opening flags.
- Legal risk: acknowledgement is drafted product wording, not a blanket waiver or solicitor approval. Nathan’s checklist now requests legal/insurer review and report-response ownership before opening member access.

## Checkpoint — 9 September 2026, 05:48 UTC: stock, communication and account agreement deployed

- Objective completed: inline per-size stock linked to Stocktake and ordering; Heja-style adult team/coaches/committee communication; Steve’s recorded legal/account-responsibility checkbox.
- Branch `codex/2027-signup-readiness`; application source/HEAD `ac429d0ec94593d04a2a01546fe5819593389180` pushed to GitHub. Subsequent checkpoint edits are documentation only.
- Changed files: migration 0012/stock routes and editor; migration 0013, shared `chatAgreement.json`, `chatRooms`, `communication`/chat routes, agreement middleware, CommunicationHub/ChatAgreement/GroupSchedule/YJRLChat, portal/legal wiring and focused tests.
- Verification: 99 API/SQLite tests (`hs-20260909054008-2088834-ec359444`), typecheck (`hs-20260909054009-2089047-3335cbf0`), production build (`hs-20260909054545-2104202-a143fc46`) and final real Chrome acceptance (`hs-20260909054558-2105846-b89dd241`) all pass. Tests cover agreement enforcement/snapshot, membership removal, message retries, older announcements, reactions, read markers, private schedules, attendance and cancellation.
- Review: `56194d26-090d-4b6c-95df-666e2cb60e55`, synthetic committee users/content only; test committee access removed and synthetic pins cleared, activities cancelled. Browser screenshots are in `worker/.wrangler/chat-browser/`.
- Production: migration 0013 applied after recovery bookmark `000000e0-00000000-000050e1-d0b718703477cf46f426b2506d7382f5`. Worker `2bec87d8-78ca-448d-9b9c-e895fde16b67`; Pages https://e2e1b887.yjrl.pages.dev; live bundle `index-DjTEnEi0.js`. Live messages/legal deep links and closed shop verified; unauthenticated chat channels/agreement return 401 via curl. Python urllib probe returned an edge 403, so it was not used as application evidence.
- Boundaries: registration/member/shop gates remain closed. No Google/PayPal/email credentials introduced. Chat uses foreground polling, no background notifications. Group schedule is separate from published fixtures/events; RSVP counts are adult accounts/families, not individual children.
- Legal limitation: versioned acknowledgement is not a blanket liability waiver or legal sign-off; Nathan must arrange club legal/insurer review and confirm safeguarding/report handling before member opening.
- Exact next action: use `NATHAN_TESTING_HANDOVER.md` for club testing and outstanding details; next engineering launch item is independent guardian verification/account recovery in `SIGNUP_2027_DELIVERY_GUIDE.md`. Do not infer legal approval or launch permission from test acceptance.
