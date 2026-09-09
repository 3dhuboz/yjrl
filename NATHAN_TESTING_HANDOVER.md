# Nathan: website testing and information needed

Website: https://yjrl.pages.dev

The site is prepared for **2027**. Adults hold the accounts and parents/guardians manage children’s records. The admin tools are ready to test. Public registration and shop ordering remain closed while the club details and launch checks are completed.

## What Nathan needs to supply

| Area | Details needed |
| --- | --- |
| Testing access | Nathan’s email and whether he will test admin, parent features or both; other approved testers |
| Registration | Opening/closing dates, eligible age groups, each fee, discounts, payment plans, inclusions and any separate competition fees |
| Contacts and links | Registrar name/email/phone, public enquiries contact, official PlayHQ/competition registration link and the club’s domain administrator |
| Teams and training | Team names/age groups, coaches, training days/times and venue names |
| Fixtures | Confirmed draw: round, date, kick-off, home/away teams and venue |
| Google Maps | Identify the owner of the club’s Google Maps Platform project (or arrange one). In-admin result selection is built but awaits Places and Embed API connections; see `ops/GOOGLE_MAPS_SETUP.md`. Until connected, supply an exact Share link for each venue/entrance. For a visible map preview, also supply Google Maps → Share → Embed a map → Copy HTML from the same location |
| News and events | Approved copy, dates/times, venues and photos. Images of children require identified player records and current guardian media consent |
| Uniforms and merchandise | Supplier/existing shop link, product names/descriptions, approved photos, AUD prices, sizes/colours, size charts, availability/preorders and any personalisation choices/costs |
| Collection and delivery | Collection location/hours/contact, lead times and preorder cut-offs; confirm whether delivery is also required and its charges |
| Shop payments | Confirm the PayPal business account for the current integration, or identify the preferred alternative. Confirm payment methods accepted on collection and who reconciles orders/payments |
| Opening stock | Physical stock count for each product and size, low-stock thresholds, who counts deliveries and who marks orders collected |
| Shop operations | Approved ordering/exchange/refund wording, who fulfils orders, stock-management needs and order notification recipient. Current fulfilment is club collection. Confirm opening counts and low-stock thresholds for every size; pending orders reserve stock automatically |
| Season opening | Final registration/consent wording, club incident/escalation arrangements, approved adult administrators/coaches and designated provider test accounts/email recipient |

Supply account access through the agreed secure setup, rather than putting passwords or payment credentials in this document.

## Things to test now

Use synthetic player/contact details for testing. Full order and payment tests belong in the isolated review site; live ordering stays closed during preparation.

1. **Teams → Edit:** change training days/times/venue. Use the venue search box to open Google Maps, then paste the chosen Share link and optional embed code. Once the Google connection is configured, use **Search venues → Use this location** and save; the selected place automatically supplies the public destination and map preview. Check the public Teams page and click its location/map. The coach selector defaults to **Keep current coach** when editing.
2. **Fixtures → Add Fixture:** enter both teams, round, date/time and venue. Use **TBC** for an unknown opponent. Set whether Yeppoon is the home team. Save, edit and check the public Fixtures page and its map link. Missing details should produce a clear error.
3. **Events:** select a calendar date or use **Add Event**. Enter the title/date/time/venue and optional map. Save a draft, edit it, select public publication and save. Check the public Events page, then remove the test event.
4. **News:** upload a photo inside the article form, preview it, identify who is shown and approve it. **Save Draft** keeps the article in admin. Select **Publish immediately** and **Publish Article**, or use **Publish** beside a draft, to put it on the public News page. **Feature on homepage** applies to published articles. The existing Test article was saved as a draft.
5. **Players → Add Player:** enter a synthetic player and adult guardian details. The player remains pending registration review; this does not create a junior login, take a payment or grant photo consent. The **Public registration page** button opens `/register`, which currently explains that 2027 sign-ups are being prepared.
6. **Chat Safety → Active Chat Rooms:** search for a team and sort by age group, room name or room type. U6–U9 should appear before U10. The technical audit-log panel has been removed from this page.
7. **Shop → Add Product:** enter a draft uniform or merchandise item with price, tick-box sizes for youth, men, women and adult/unisex, plus any custom size/colour options and an optional uploaded photo. Reopen the product to check the selected sizes are retained. Drafts stay off the public site. Confirmed products can be marked available and published. Shop setup stores collection details, policies and both payment preferences.
8. **Shop order test in review:** select a size/colour, add quantity to the basket, place a pay-on-collection order and reload its receipt. In admin, record the simulated collection payment, then mark the order collected. Keep production ordering closed until the catalogue, fulfilment and provider checks are approved.

9. **Stocktake:** open the tab or **View Stock** beside a shop product. Every selected size appears, initially **Not counted**. Record the physical total, a low-stock threshold and a reason. Include items already set aside for collection in this count. Check product/size search and the low-stock filter.
10. **Stock and collections in review:** count ten units, order two, then mark the paid test order collected. Stock should become eight and the awaiting-collection count should fall by two. Removed products/sizes retain their stock records. Available stock is the physical count minus pending orders. Zero or uncounted sizes cannot be ordered, and the server rejects simultaneous orders for the last unit. Pending unpaid orders also reserve stock until collection or eligible cancellation; PayPal reconciliation must be tested before online ordering opens.

## What still needs a separate acceptance check

- Real PayPal sandbox approval, cancellation, return, reconciliation and the agreed refund workflow using designated test accounts. Automated provider simulations pass; no real payment was made.
- Confirm the working public/payment-return domain before enabling live online payments. The working site is currently `yjrl.pages.dev`.
- Connect Google Maps and verify actual search results, selection and map loading on the approved domains. Search and map-provider browser fixtures have passed; real Google acceptance remains pending.
- Confirm any automatic shop email notifications, delivery, preorder and automatic out-of-stock ordering requirements. Current order receipts are shown on the site and orders are managed in admin.
- Complete the remaining guardian/account verification, registration consent, medical-access and launch requirements listed in `SIGNUP_2027_DELIVERY_GUIDE.md` before opening sign-ups.

The two payment choices are supported in the implementation. An online payment option appears for customers only after the provider is configured; all shop orders are currently closed.

## Group communication and account responsibility

The Heja reference is its [team messaging, updates, seen indicators and activity attendance](https://help.heja.io/en/articles/2483013-heja-s-main-features), adapted to adult-only accounts here.

- **Admin → Messages** or **Portals → Team Messages**: read the adult communication agreement and tick the unchecked declaration. Acceptance records the adult account, version, full wording and date. Changing the policy version requires fresh acceptance.
- Parents see their assigned teams; approved coaches see their assigned team families, coaching staff groups and All coaches. Admins can use **Manage Committee** to select active adult accounts for the private Committee group. Removing a committee member, guardian link or coach approval removes the corresponding access.
- Send a message, react, reload, and check the reaction remains. Post as **Announcement**, pin the update and find it in **Announcements** or **Pinned updates**. Unread badges and read indicators are saved; there is no simulated online count.
- **Schedule → Add Activity**: create training, game, meeting or event details, an AEST time and optional Google Maps destination. Adults reply Going, Maybe or Unavailable; each account supplies one reply, and parents reply for their family. Organisers can inspect names, edit or cancel the activity. These private group activities are separate from the published club calendar and fixtures.
- Use **Report** on a message for a conduct concern. Reporting remains available through the API without accepting the communication agreement; the acceptance screen also directs urgent concerns to a club official.

Nathan to provide: committee membership, approved team coaches and managers, who responds to reports and suspected account misuse, response/escalation arrangements, retention expectations, and a club solicitor/insurer review of the account-responsibility wording before opening member access.

The checkbox sets account-security and conduct expectations. It is not a blanket liability waiver and does not replace safeguarding, appropriate moderation or rights that cannot legally be excluded. Reference: [eSafety guidance for sport parents](https://www.esafety.gov.au/communities/sport/parents) and [ACCC consumer rights](https://www.accc.gov.au/consumers/buying-products-and-services/consumer-rights-and-guarantees).

This delivery uses in-app polling while open. Native/background push notifications, automatic reminders, individual child RSVPs, private direct messages, polls, document/video sharing and automatic public-fixture synchronisation are not part of this release. No real messages, emails or notifications were sent to club families during testing.
