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

## Verified Live

- Worker deployed at `https://yjrl-api.steve-700.workers.dev`.
- Latest Worker version verified in deploy output: `f37a55ad-7686-4147-b9f3-f53d38fea9ce`.
- Pages deployed at `https://yjrl.pages.dev`.
- `https://yjrl.pages.dev/api/registration-fees` now returns a 307 redirect to the Worker and resolves to JSON with `curl -L`.
- Production bundle uses `https://yjrl-api.steve-700.workers.dev/api`.
- `OPTIONS` from `https://not-yjrl.pages.dev` no longer receives an allowed origin.
- `OPTIONS` from `https://cb4d03c7.yjrl.pages.dev` receives its matching allowed origin.
- Client production build passes.
- Worker typecheck passes.
- Client and Worker production dependency audits report zero vulnerabilities.

## Blocking Before Customer Launch

- Implement adult-role approval: Blue Card or Working With Children Check status, expiry, linked organisation check, identity verification, safeguarding training, approval user, approval timestamp, and suspension state.
- Implement verified parent-child linking that does not depend only on matching guardian email text.
- Add parent-visible or administrator-visible communication for any child-facing chat, plus report, block, mute, delete, escalate, and incident-record workflows.
- Add immutable audit logs for login, role changes, adult approvals, child data access, uploads, chat sends/deletes, reports, and admin edits.
- Enforce first-class media consent for player photos, videos, stories, stats, team pages, news, uploads, and public sharing.
- Split player response data into public, player, parent, coach, and admin DTOs so guardian, emergency, medical, and coach-note data is only returned to roles with a genuine need.
- Harden uploads with file signature checks, image re-encoding or EXIF stripping, moderation, size limits, extension control, and team/player binding.
- Add login, registration, chat, upload, and report rate limiting.
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
