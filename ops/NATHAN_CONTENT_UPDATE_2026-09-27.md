# Nathan content update — 27 September 2026

Steve authorised applying the information Nathan saved on 15 September. Steve will send the response through Messenger; no email is to be sent.

## Applied content

- Shared public club details in `shared/club.json`: seven enquiry addresses, President/Secretary safety contacts, establishment in 1993, Mini Mods to U17 boys and girls and #UpTheGullies.
- New `/contact` directory, updated mail links and structured metadata. Facebook links reuse the pre-existing `YeppoonJuniorSeagulls` address from the website metadata. Facebook blocked automated fetching; Nathan should check the destination. No embedded feed or automatic reposting.
- `/register` sends new families to Play Rugby League/MySideline for official registration and payment. Expected U13–U17 opening in December 2026 is explicitly provisional, with QRL confirmation around mid-December. Fees and the exact 2027 club link are still needed. Historical checkout return/resume URLs remain supported. Never open the legacy local registration form/fees as a second registration process.
- Teams page displays the supplied Gold/Blue U6–U17, White U6–U9 and Girls U11/U13/U15/U17 groups. Existing team records/assignments were preserved; no guessed coach, colour allocation or training time was inserted.
- Events page lists the late-June CQ girls carnival, early-August U8s United in League carnival and presentations as provisional information. No invented dated calendar records.
- Public merchandise preview, exchange guidance and four unpublished editable product drafts. Unknown prices are represented by the existing zero-price draft value and displayed to admins as “Price to confirm”; publication still requires a positive confirmed price. Supplier size lists remain unconfirmed, except the supplied Kids/Adult bucket-hat categories. Stock remains uncounted, never invented.
- Square is the club's selected future merchandise provider. Existing unused PayPal ordering is disabled while orders remain closed. Square checkout, order import and stock synchronisation are not connected. Obtain the store link or an authorised integration contact before implementing provider operations; do not claim Square orders update local Stocktake.
- Checklist shows a dated per-section update and remaining requests, separately from Nathan’s original saved notes and status.
- Intended executive admin roles recorded: Secretary, President and Treasurer. No account or privilege grant from an email address alone; named adults and onboarding checks remain necessary.

## Data application

Run `headsnap run yjrl --cwd /srv/headsnap/workspaces/yjrl/worker -- node scripts/prepare-nathan-content.mjs` to generate `.wrangler/nathan-content.sql`. It inserts only absent drafts (stable IDs and a name check), fills only an empty exchange-policy field and retains existing product edits. It adds audit entries. Review the SQL, record a production D1 recovery bookmark, then apply through `headsnap cloudflare` to the appropriate D1 database. No migration is required.

## References and outstanding items

- Nathan's private checklist is the source of club information. Raw access links are kept outside Git.
- [Play Rugby League](https://www.playrugbyleague.com/) is the current destination of Nathan's supplied playnrl.com; its Register link uses MySideline.
- [Square payment links](https://squareup.com/help/au/en/article/6692-get-started-with-square-checkout-links) support a hosted payment route once the club provides its configured link. No connection has been assumed.
- Exchange wording preserves [Australian Consumer Law guarantees](https://www.accc.gov.au/consumers/buying-products-and-services/consumer-rights-and-guarantees); tags/bag conditions are limited to change-of-mind exchanges.
- Still needed: registration dates/fees/direct season link; exact product sizes/prices/photos/stock; Square connection; collection details; coaches/training/fixture locations; event dates; sponsor assets; named executives and club legal/safety review; domain/Google project operator.

## Checkpoint

Objective: apply confirmed content and prepare Steve's Messenger response. Branch `codex/2027-signup-readiness`, base HEAD `3e468ce0f9a7`. Changed files: shared club/review content, public pages/layout/contact/registration, shop/checklist admin copy, content preparation and browser acceptance scripts. Review build passes; data applied to isolated review (`hs-20260927025425-3223724-85926112`), Worker `f9a77d01-4beb-44ee-a54c-89a8ba52907b`. Next: finish review browser checks, push exact source, capture recovery bookmark, apply production content and deploy matching Pages; verify public routes and private checklist notes remain intact. Production API code and schema need no change. Keep membership/local registration/shop opening closed.

Review browser acceptance passed (`hs-20260927025514-3229195-f69aa626`): eight public routes at 390/1024/1440 widths, actionable contacts, official registration destination with no duplicate form, provisional events, Facebook links, admin drafts and checklist feedback. No browser errors or horizontal overflow. No new API/schema logic was introduced; the existing 103 API/SQLite tests were not repeated for this content-only release. Next action is production promotion and live verification.

## Released — 27 September, 02:58 UTC

- Pushed application source `ec77ce7370fd3ad70a2744aa4ad6af823b8883b4`; Pages https://cce60284.yjrl.pages.dev, public alias https://yjrl.pages.dev, bundle `index-DwLIG0IG.js`. Production Worker remains `6d87bfb9-7267-4688-8b26-42e02a86abe3`; no API/schema changes.
- Production pre-content recovery bookmark `000002f5-00000000-000050f3-86829a76cbbd05b827b0eef455ac0e4e` (`hs-20260927025614-3231116-b648d937`). Data applied once with audit history (`hs-20260927025659-3232479-c7673478`). Four drafts confirmed unpublished/unavailable, shop orders and unused PayPal option closed, exchange guidance saved. Checklist retains all eight records, seven with notes and its original 15 September last-edit timestamp (`hs-20260927025740-3233814-1d983171`).
- Production build passes (`hs-20260927025712-3232882-fad11698`); live Chrome acceptance passes (`hs-20260927025749-3234467-71081a6d`) on the eight routes and three viewport widths above. No production messages, registration, orders or payments were created.
- Next: Steve sends the supplied Messenger response. Nathan can add missing photos, catalogue details, Square link, collection and confirmed registration/training/event information through the existing private checklist. Executive onboarding and club safety/legal review remain required; do not automatically create accounts or open member access.
