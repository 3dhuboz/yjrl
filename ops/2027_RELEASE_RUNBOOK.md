# 2027 incremental release procedure

Steve authorised ongoing deployment and the exact YJRL host workspace addition. That addition is applied; the wrapper remains root:root / 755. All Wrangler commands still run through `headsnap cloudflare yjrl`. Keep production registration/member opening closed until genuine club readiness and sign-off.

## Environments and current recovery references

| Environment | Resource | Current identifier |
| --- | --- | --- |
| Production | Website | https://yjrl.pages.dev/register |
| Production | API | https://yjrl-api.steve-700.workers.dev |
| Production | D1 `yjrl-db` | `690424d2-5985-4576-9d4c-62e643ae5ed3` |
| Production | Private R2 | `yjrl-uploads` |
| Production | Worker version | `83151c72-9a94-4086-b6d9-879fe8411019` |
| Production | Pages deployment | https://1171f88e.yjrl.pages.dev |
| Review | Password-protected app/API | https://yjrl-review.steve-700.workers.dev |
| Review | D1 `yjrl-review-db` | `bf4d3aa4-b8c7-4dda-810e-e58070b1a6db` |
| Review | Private R2 | `yjrl-review-uploads` |
| Review | Worker version after secrets | `90696a2e-b003-43a3-97d7-8e7bfec89e4d` |

Production source is `fa7f355591122852a3af15a05c8e17dc6549d3af`. The Worker and matching Pages build are live. Review ran the same application source, with a review-only gateway and same-origin client build. Keep source in the current task branch and PR; Pages production promotion does not merge Git `master`.

Before 0004–0008 were applied, the production D1 recovery bookmark was `00000082-00000000-000050df-c9f424892144a98ff21c9008244a39eb` at 03:57 UTC on 7 September (`hs-20260907035723-3308785-7c9a8a70`). Refresh recovery evidence before every subsequent production migration.

The historical production journal was empty even though the base/child-safety schema existed. The release successfully applied only 0004–0008 and recorded them in the journal. Do not invent baseline journal entries, replay 0001/0003, or run the legacy 0002 seed against live data. The old package `db:migrate` scripts execute that seed and must not be used for production.

Migrations 0009 (venue maps) and 0010 (shop) are now applied too. The latest pre-shop recovery bookmark is `00000096-00000000-000050df-72a0627feb24d1ad74bcfd98d5e40ee9` (`hs-20260907075616-3841354-afcd7958`). Shop settings remain `orders_open = 0`; no catalogue products were added to production. Do not open ordering before confirmed collection/policies/products and provider acceptance. Existing orders snapshot prices/options/policies; product removal retains order history. Current online integration reuses the existing PayPal provider, with production requiring live mode and a verified working return domain as an operational launch check.

The real-browser scripts use HeadSnap’s installed Playwright and project Chrome profile. Start/status Chrome with `headsnap browser start yjrl` / `headsnap browser status yjrl`, then run each script through `headsnap run yjrl --cwd /srv/headsnap/workspaces/yjrl/worker -- node scripts/accept-admin-browser.mjs` or `scripts/accept-shop-browser.mjs`. They target the isolated review hostname only, use synthetic content and restore the shop’s original settings. Provider payment tests in the unit suite are simulated; obtain designated sandbox accounts for real acceptance.

## Verify and release to review

Review has separate random JWT/admin/access secrets, no real email/payment providers and no cron. Its gateway checks every request, including static assets, fails closed when unconfigured, and creates an eight-hour Secure/HttpOnly/SameSite session after password authentication. Synthetic opening settings behind this gateway do not represent real club sign-off.

Run appropriate tests and Worker typecheck through HeadSnap. Then prepare the review build and staged schema:

```sh
headsnap run yjrl --cwd /srv/headsnap/workspaces/yjrl -- env VITE_API_URL=/api npm run build
headsnap run yjrl --cwd /srv/headsnap/workspaces/yjrl/worker -- node scripts/stage-review-assets.mjs
headsnap run yjrl --cwd /srv/headsnap/workspaces/yjrl/worker -- node scripts/stage-review-migrations.mjs
headsnap cloudflare yjrl --cwd /srv/headsnap/workspaces/yjrl/worker -- d1 migrations list yjrl-review-db --remote --config wrangler.review.toml
```

The asset staging helper rejects a bundle referencing the production API and removes the Pages wildcard rewrite, which loops under Worker Assets. The review schema staging includes 0001 and 0003 onward, without old seed data. Review pending SQL before applying it:

```sh
headsnap cloudflare yjrl --cwd /srv/headsnap/workspaces/yjrl/worker -- d1 migrations apply yjrl-review-db --remote --config wrangler.review.toml
```

Commit and push the exact validated source before deployment:

```sh
headsnap cloudflare yjrl --cwd /srv/headsnap/workspaces/yjrl/worker -- deploy --config wrangler.review.toml
headsnap run yjrl --cwd /srv/headsnap/workspaces/yjrl/worker -- node scripts/accept-review.mjs
```

The acceptance script reads the existing restricted review-only credentials at `/home/steve/.local/share/yjrl/review-secrets.json`, never prints values, and targets only the fixed isolated review URL. It creates synthetic records and a coloured PNG, checks processing/review/withdrawal and deletes the test R2 object. Synthetic registration/audit rows are retained in review. Keep that secret file out of Git and logs; do not copy production credentials into it or repeatedly rotate working secrets.

## Promote to production

1. Keep one deployer and an exclusive checkout. Confirm the reviewed source is pushed, relevant checks pass, and the review environment accepted the application change.
2. Inspect the current schema and migration journal. Record a fresh recovery bookmark through `d1 time-travel info yjrl-db --json` using the wrapper. Do not export child records to Git or logs.
3. Stage only incremental migrations and inspect pending names:

```sh
headsnap run yjrl --cwd /srv/headsnap/workspaces/yjrl/worker -- node scripts/stage-production-migrations.mjs
headsnap cloudflare yjrl --cwd /srv/headsnap/workspaces/yjrl/worker -- d1 migrations list yjrl-db --remote --config wrangler.toml
headsnap cloudflare yjrl --cwd /srv/headsnap/workspaces/yjrl/worker -- d1 migrations apply yjrl-db --remote --config wrangler.toml
```

The production helper excludes 0001–0003. Stop and reconcile an ambiguous migration result before retrying. Never apply changed schema blindly to a partially migrated database.

4. Deploy the Worker, preserving existing runtime secrets/variables while applying the committed production settings:

```sh
headsnap cloudflare yjrl --cwd /srv/headsnap/workspaces/yjrl/worker -- deploy --config wrangler.toml --keep-vars
```

5. Verify health, 2027 fee response with `registrationOpen=false`, hidden prices, and `registration_closed` on account/player registration. Check configured origins and private media behaviour without creating real registrations or payments. Existing production administrator login requires the real operator; do not retrieve/rotate their password just to run a check.
6. Build the production frontend explicitly against the production API:

```sh
headsnap run yjrl --cwd /srv/headsnap/workspaces/yjrl -- env VITE_API_URL=https://yjrl-api.steve-700.workers.dev/api npm run build
```

7. Deploy `client/build` to the existing `yjrl` Pages project with `--branch master`, the exact pushed source SHA as `--commit-hash`, and truthful clean-tree metadata. Use `headsnap cloudflare yjrl --cwd /srv/headsnap/workspaces/yjrl -- pages deploy ...`. The branch option selects Pages production; it does not merge the source branch. Do not publish a review bundle pointed at production.
8. Verify the public alias and deep links serve the expected build and closed preparation flow. Record source, Worker/Pages IDs and URLs in the guide. Branded-domain configuration and full interaction/accessibility checks remain separate work.

## Recovery and actual opening

Prefer a forward fix while opening remains closed. Use the verified gated Worker/Pages pair above for a compatible rollback. Retain additive schema and new records; do not drop audit guards or delete data to fit old code. D1 point-in-time restoration requires a reviewed recovery plan accounting for writes since the bookmark.

Do not restore the May Worker by default: it lacks current adult-only, consent and opening controls. Its historical version was `4bf3a447-c76b-43c5-8a6e-957fa1e69178`, with Pages `aecce5b3-c3ee-4d3c-ba54-33ddcd22cc85`; these are historical references, not the preferred rollback pair.

Production stays `REGISTRATIONS_OPEN=false`, `MEMBER_ACCESS_OPEN=false`, and `SEASON_DETAILS_CONFIRMED=""`. Only after actual club details, complete acceptance and safeguarding sign-off should these settings change. Continue the outstanding guardian/identity, consent, medical, provider and domain work in the delivery guide.

References: [Worker Assets routing](https://developers.cloudflare.com/workers/static-assets/binding/), [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/), [D1 recovery](https://developers.cloudflare.com/d1/reference/time-travel/).
