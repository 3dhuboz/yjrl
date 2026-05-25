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

## Verified Live

- Worker deployed at `https://yjrl-api.steve-700.workers.dev`.
- Latest Worker version verified in deploy output: `fa5d8f76-5958-4c6d-943e-939cfc9995e9`.
- Pages deployed at `https://yjrl.pages.dev`.
- `https://yjrl.pages.dev/api/registration-fees` now returns a 307 redirect to the Worker and resolves to JSON with `curl -L`.
- Production bundle uses `https://yjrl-api.steve-700.workers.dev/api`.
- Latest Pages bundle verified as `assets/index-AtYtnBNf.js`.
- `OPTIONS` from `https://not-yjrl.pages.dev` no longer receives an allowed origin.
- `OPTIONS` from `https://cb4d03c7.yjrl.pages.dev` receives its matching allowed origin.
- Client production build passes.
- Worker typecheck passes.
- Client and Worker production dependency audits report zero vulnerabilities.
- Live smoke test confirmed registration creates parent-child link, consent row, safety report, and audit records; temporary smoke records were cleaned from production D1.

## Blocking Before Customer Launch

- Add admin UI for adult-role approvals and formal child-safety sign-off, not just the API foundation.
- Add block, mute, takedown, evidence-preservation, escalation, and incident-resolution workflows for safety reports.
- Make audit logging comprehensive across every admin mutation; current logging covers the highest-risk new flows but not every route.
- Enforce media consent across news/story publishing and any future public player features; upload consent is enforced, public stats remain anonymised.
- Continue splitting player response data into public, player, parent, coach, and admin DTOs so each role receives only what it needs.
- Add image re-encoding or EXIF stripping; current upload hardening verifies signatures, extensions, size, consent, ownership, and review metadata.
- Replace isolate-local rate limits with durable/risk-scored limits if abuse traffic appears.
- Fix production domain routing: `yeppoonjrl.com.au` and `www.yeppoonjrl.com.au` are still served by an nginx host, not the Pages app.
- Configure `uploads.yeppoonjrl.com.au` or change upload URLs to a working public asset host.
- Add real club data: teams, fixtures, events, news, sponsors, and registration operating copy are currently empty or placeholder-light.
- Configure and verify Resend before relying on email confirmations.
- Configure and verify PayPal before claiming online payments are available; live registration is offline-payment only at audit time.

## Child Safety References

- Queensland Rugby League safeguarding children and young people: https://www.qrl.com.au/community/safeguarding-children--young-people/
- NRL / Play Rugby League child safety resources: https://www.playrugbyleague.com/safety/nrl/
- Sport Integrity Australia digital communication guidance: https://www.sportintegrity.gov.au/dos-and-donts/digital-communication
- eSafety Commissioner online safety for sports administrators: https://www.esafety.gov.au/communities/sport/administrators
- Queensland Child Safe Standards: https://www.qfcc.qld.gov.au/childsafe/standards/resources/getting-started
- Queensland Blue Card Services: https://www.justice.qld.gov.au/about-us/services/queensland-worker-screening-services/blue-card-services
