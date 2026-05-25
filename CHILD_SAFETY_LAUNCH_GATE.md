# Child Safety Launch Gate

This app serves junior rugby league players and families. Child protection is a hard launch gate, not a nice-to-have. The app must not be opened to paying customers or broad member access until the safeguards below are implemented, verified, and signed off by Yeppoon Junior Rugby League.

## Baseline Rule

Protecting children from grooming, predatory behaviour, bullying, harassment, and unnecessary exposure of personal information takes priority over convenience, engagement, or growth features.

## Current Immediate Controls

- Public self-registration cannot create coach, admin, or developer accounts.
- Public team detail and public stats endpoints must not expose junior player surnames, photos, or detailed player identities.
- Public event endpoints must show only events marked public.
- Adults cannot post in junior player chat rooms; coaches should use parent/team-adult communication channels.
- The legal child-safety page must state safe communication, adult role approval, media consent, and concern escalation expectations.
- New registrations must create verified parent-child links and media consent records.
- Child-related uploads must require media consent, safe image type verification, authorised uploader checks, and review metadata.
- Chat messages must be reportable, and reports must be visible to authorised club administrators.

## Must Be Completed Before Paying Customers

- Admin UI and club sign-off workflow for adult-role approvals covering coaches, managers, volunteers, administrators, and staff.
- Parent-visible or administrator-visible communication model for any child-facing chat. No unobserved one-to-one adult-to-child messaging.
- Block, mute, delete, takedown, escalate, evidence-preservation, and incident-resolution workflows for chat, uploads, profiles, news, and events.
- Comprehensive immutable audit logging for every admin edit and child-data access, building on the current auth, registration, upload, chat, report, and adult-approval audit events.
- Consent enforcement for photos, videos, player stories, stats, team pages, news, uploads, and public sharing.
- Data-minimised response shapes for public, player, parent, coach, and admin contexts. Medical, guardian, emergency, and coach-note data must be returned only to roles with a genuine need.
- Upload hardening for image type verification, file size, file extension control, EXIF stripping or re-encoding, moderation, and team/player binding.
- Durable rate limiting and abuse monitoring for login, registration, chat, upload, and report endpoints.
- Legacy Express API must remain disabled in production unless it is separately hardened and approved.

## Operating Guidance

- Treat any grooming, predatory behaviour, boundary violation, child abuse, or credible safety concern as urgent.
- If a child is in immediate danger, call 000.
- Preserve evidence before deleting harmful messages or media when it is safe to do so.
- Use official club escalation pathways and external reporting channels where required.

## Reference Guidance

- Queensland Rugby League safeguarding children and young people: https://www.qrl.com.au/community/safeguarding-children--young-people/
- NRL / Play Rugby League child safety resources: https://www.playrugbyleague.com/safety/nrl/
- Sport Integrity Australia digital communication guidance: https://www.sportintegrity.gov.au/dos-and-donts/digital-communication
- eSafety Commissioner online safety for sports administrators: https://www.esafety.gov.au/communities/sport/administrators
- Queensland Child Safe Standards: https://www.qfcc.qld.gov.au/childsafe/standards/resources/getting-started
- Queensland Blue Card Services: https://www.justice.qld.gov.au/about-us/services/queensland-worker-screening-services/blue-card-services
