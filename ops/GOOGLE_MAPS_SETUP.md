# Connect Google venue search

The admin search/select flow is implemented for teams, fixtures and events. **Live Google results are not connected yet.** YJRL has no configured Maps/Places key. No reusable Maps integration was found in the Norths Knights checkout; its template production Worker name was not deployed in the accessible Cloudflare account. This does not establish whether someone owns an unconnected Google Cloud project.

Nathan/Steve needs to identify the club-approved Google Maps Platform project and its owner. Use separate API-restricted keys:

- `GOOGLE_PLACES_API_KEY`: server-only key for **Places API (New)**. Searches use Text Search with a six-result limit and a narrow field mask. Set project quotas/budget alerts appropriate to the club before activation.
- `GOOGLE_MAPS_EMBED_KEY`: public browser key restricted to **Maps Embed API**, with website referrers for `https://yjrl.pages.dev/*` and confirmed club domains. Use an appropriately restricted review key for `https://yjrl-review.steve-700.workers.dev/*` when performing provider acceptance.

Supply keys through secure configuration, never chat, Git, screenshots or the handover. The established HeadSnap path is `headsnap cloudflare yjrl --cwd /srv/headsnap/workspaces/yjrl/worker -- secret put KEY_NAME --config wrangler.toml`. Review uses `wrangler.review.toml`; do not copy production secrets into review by default.

The public `/api/yjrl/maps/config` returns only the intentionally public embed key and search availability. The Places key stays in the Worker. `/search` requires an administrator, validates input, limits searches and does not store returned names/addresses. Selecting a result saves its Place ID inside a standard Google Maps URL and the admin-entered search label. Public map previews derive from that same Place ID at render time. Existing Share links and copied embeds still work.

After connecting, verify an actual venue with two similarly named results: choose the correct address, save, reload and click the public map on desktop and mobile. Verify approved referrers, map visibility, blocked-key/quota feedback, and that no server key is returned. API and browser simulations exercise the integration but **do not replace this real-provider check**.

Without the connection, the admin form offers a venue query that opens Google Maps in a new tab and retains the Share-link workflow. It does not pretend those external results are automatically selected inside admin.

References: [Google Text Search](https://developers.google.com/maps/documentation/places/web-service/text-search), [Maps Embed](https://developers.google.com/maps/documentation/embed/embedding-map), [Maps URL destinations](https://developers.google.com/maps/documentation/urls/get-started), [Places attribution and storage](https://developers.google.com/maps/documentation/places/web-service/policies).
