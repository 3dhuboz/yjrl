# Customer Readiness Audit - 2026-05-25

## Decision

Not ready for paying customers yet.

The production Worker and Pages deployment are live, and several critical issues were fixed during this audit. The remaining blockers are concentrated around child safety, adult-role verification, production domain routing, real club content, and operational workflows.

## Fixed During Audit

- Production frontend API fallback now points to the live Cloudflare Worker in production builds.
- Pages `/api/*` requests now redirect to the Worker instead of serving the SPA HTML, protecting stale client bundles.
- Public self-registration can no longer create coach, admin, or developer accounts.
- Worker CORS now allows `yjrl.pages.dev` and `*.yjrl.pages.dev` preview hosts, not every `*.pages.dev` site.
- Public team detail no longer exposes junior player lists.
- Public stats endpoints no longer expose junior player surnames, photos, jersey numbers, or detailed player identity.
- Public fixture detail hides player stat rows by default.
- Public event endpoints only return events marked public.
- Fixture completion no longer double-counts team/player stats if the fixture was already completed.
- Bulk fixture player stats now ignore player IDs that do not belong to the fixture team.
- Coaches can no longer post in junior player chat rooms.
- Legacy Express API is disabled in production unless explicitly enabled.
- Child safety policy text was strengthened in the public legal page.
- A hard launch gate was added in `CHILD_SAFETY_LAUNCH_GATE.md`.
- Child-safety D1 tables were added for player consents, verified parent-child links, adult role approvals, safety reports, upload records, and audit events.
- New registrations now create a verified parent-child link and first-class media consent record.
- Parent child lookups and chat parent access now use verified links or direct registration ownership instead of matching guardian email text.
- Safety reports can be filed from chat and reviewed from the admin moderation view.
- Adult role approval APIs now record Blue Card/WWCC status, expiry, identity checks, safeguarding training, approval state, approval user, and audit events.
- Uploads now verify image file signatures, force safe extensions, require child media consent for child-related public media, bind player uploads to authorised coaches/admins, and record review metadata.
- Worker-side rate limits were added for login, registration, player registration, chat, upload, and safety report endpoints.
- Admin moderation now includes operable safety report actions, adult role approvals, upload review, and safeguarding audit history.
- Admins can create adult role approval requests for coaches/staff, and approval requires a verified Blue Card/WWCC status, future expiry, identity check, and safeguarding training.
- Rejected, expired, or suspended adult role approvals revoke coach access; suspended users are disabled.
- Team coach assignment is enforced server-side against current approved adult role records.
- Admins can assign players to teams, and parents now receive team training/venue/coach details for linked children.
- Child-related uploads no longer return public URLs while pending review; approved review issues the URL and rejected review removes the R2 object.
- Player photo fields now require an approved reviewed upload for that player.
- Approved media now streams through the Worker at `/api/media?key=...`, so child media no longer depends on the broken `uploads.yeppoonjrl.com.au` hostname.
- A child-safety incident playbook was added in `CHILD_SAFETY_INCIDENT_PLAYBOOK.md` for report triage, evidence handling, adult suspension/revocation, and club launch sign-off.
- Existing verified parent accounts can now register additional children with the same email after password verification, so the parent portal "Register Another Child" workflow is no longer blocked by duplicate-email rejection.
- PayPal registration now fails closed when live PayPal and child-safety sign-off are not ready; it no longer silently downgrades selected PayPal registrations into offline registrations.
- PayPal order creation now happens before registration rows are committed, preventing half-created player registrations when PayPal is unavailable.
- PayPal create/capture calls now use request IDs, validate approval URLs, and treat already-captured orders as reconcilable where PayPal returns that state.
- Offline and paid email templates are split, so offline families are told payment is still required and paid families are not asked to pay twice.
- Admin launch readiness checks were added for D1, R2, PayPal live mode, Resend, frontend/API domains, child-safety sign-off, high/critical reports, media review, ClickSend, and OpenRouter.
- Admin safety reports now require meaningful action notes before actioning or closing.
- Child media approval now re-checks current consent and requires reviewer notes before approval.
- Chat safety reporting now uses an in-app form with severity/details instead of a browser prompt.
- Parent registration success and portal onboarding copy now reflect actual payment/team status instead of assuming every registration is complete.
- Public/admin response DTOs for teams, fixtures, news, events, achievements, and player roster/detail views are now explicit, reducing accidental leakage of raw database columns.
- Public stats endpoints now require `stats_public_consent` and use non-database public row identifiers.
- Admin mutations across teams, fixtures, news, events, achievements, player changes, adult approvals, attendance, and admin auto-seeding now write richer audit events with key state transitions.

## Verified Live

- Worker deployed at `https://yjrl-api.steve-700.workers.dev`.
- Latest Worker version verified in deploy output: `fa5d8f76-5958-4c6d-943e-939cfc9995e9`.
- Latest Worker version verified after payment/readiness controls: `22a4b6c5-d2e3-401a-8b8a-4fb9b63fdf69`.
- Latest Worker version verified after privacy/audit DTO hardening: `4bf3a447-c76b-43c5-8a6e-957fa1e69178`.
- Pages deployed at `https://yjrl.pages.dev`.
- Latest Pages preview deployed after payment/readiness controls: `https://415492c4.yjrl.pages.dev`.
- `https://yjrl.pages.dev/api/registration-fees` now returns a 307 redirect to the Worker and resolves to JSON with `curl -L`.
- Production bundle uses `https://yjrl-api.steve-700.workers.dev/api`.
- Latest Pages bundle verified as `assets/index-Cc7wLkWO.js`.
- `OPTIONS` from `https://not-yjrl.pages.dev` no longer receives an allowed origin.
- `OPTIONS` from `https://cb4d03c7.yjrl.pages.dev` receives its matching allowed origin.
- Client production build passes.
- Worker typecheck passes.
- Client and Worker production dependency audits report zero vulnerabilities.
- Source verification confirmed public team, fixture, event, news, achievement, player roster, and stats responses are data-minimised DTOs rather than raw row spreads.
- Live public endpoint smoke confirmed teams, fixtures, events, achievements, news, stats overview, and stats leaderboard return 200 without the audited raw sensitive field names; unauthenticated player roster access returns 401.
- Live smoke test confirmed registration creates parent-child link, consent row, safety report, and audit records; temporary smoke records were cleaned from production D1.
- Live smoke test confirmed adult invite creation, temporary-password return, expired approval rejection, unapproved coach assignment rejection, approved coach assignment, player team assignment, parent team details, pending upload URL/key withholding, unapproved photo rejection, reviewed Worker media serving, rejected upload R2 removal, safety report close workflow, non-admin chat-room listing denial, and adult approval revocation; temporary smoke records were cleaned from production D1/R2.
- Live smoke test confirmed a parent can register two children under one existing account, both verified parent-child links are created, `/my-children` returns both children, and using the wrong existing-account password is rejected with 401; temporary smoke records were cleaned from production D1.
- Live smoke test confirmed `/registration-fees` hides PayPal until launch sign-off, direct PayPal registration returns 503 with no customer registration created, offline registration still succeeds and issues a parent token, and temporary smoke records were cleaned from production D1.
- `https://415492c4.yjrl.pages.dev/register` and `https://yjrl.pages.dev/register` return the deployed app.

## Blocking Before Customer Launch

- Club committee must review, adapt, and sign off `CHILD_SAFETY_INCIDENT_PLAYBOOK.md`, including named reviewers and external reporting owners.
- Extend immutable audit logging to child-data read access and compliance exports; admin mutation logging now covers the core launch routes but read-access audit remains a future hardening step.
- Enforce media consent across news/story publishing and any future public player features; upload consent is enforced and public stats now require explicit stats-public consent.
- Keep role-based response DTOs under regression review as features are added, so public, player, parent, coach, and admin contexts continue to receive only what they need.
- Add image re-encoding or EXIF stripping; current upload hardening verifies signatures, extensions, size, consent, ownership, and review metadata.
- Replace isolate-local rate limits with durable/risk-scored limits if abuse traffic appears.
- Fix production domain routing: `yeppoonjrl.com.au` and `www.yeppoonjrl.com.au` are still not serving the Pages app (`/register` returned 403 during the latest check).
- Optional: configure `uploads.yeppoonjrl.com.au` later for branded media URLs. The launch path now uses Worker-reviewed media URLs instead.
- Add real club data: teams, fixtures, events, news, sponsors, and registration operating copy are currently empty or placeholder-light.
- Configure and verify Resend before relying on email confirmations.
- Configure live PayPal and set `CHILD_SAFETY_SIGNOFF=approved` only after club child-safety sign-off before claiming online payments are available; live registration is offline-payment only at audit time.

## Child Safety References

- Queensland Rugby League safeguarding children and young people: https://www.qrl.com.au/community/safeguarding-children--young-people/
- NRL / Play Rugby League child safety resources: https://www.playrugbyleague.com/safety/nrl/
- Sport Integrity Australia digital communication guidance: https://www.sportintegrity.gov.au/dos-and-donts/digital-communication
- eSafety Commissioner online safety for sports administrators: https://www.esafety.gov.au/communities/sport/administrators
- Queensland Child Safe Standards: https://www.qfcc.qld.gov.au/childsafe/standards/resources/getting-started
- Queensland Blue Card Services: https://www.justice.qld.gov.au/about-us/services/queensland-worker-screening-services/blue-card-services
