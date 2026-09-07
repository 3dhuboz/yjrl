# 2027 incremental release procedure

Deployment is authorised by Steve. The only pending host approval is the exact YJRL workspace addition in `headsnap-yjrl-workspace.patch`. All Wrangler operations go through HeadSnap; credentials remain in its wrapper. Do not run the legacy `db:migrate` scripts against production: they include the old seed.

## Current release state

Read-only Cloudflare checks on 7 September 2026 at approximately 03:22 UTC found:

- Production database `yjrl-db` (`690424d2-5985-4576-9d4c-62e643ae5ed3`) has the base and child-safety tables; registration claims, child access log, rate counters, processed media columns and adult attestation columns are absent. Apply **0004–0008**, in order, before the current Worker.
- Current production Worker deployment: `dcc5251e-6b59-4b71-981f-d9ec88501543`; version `4bf3a447-c76b-43c5-8a6e-957fa1e69178` at 100%, released 26 May 2026.
- Current production Pages deployment: `aecce5b3-c3ee-4d3c-ba54-33ddcd22cc85`; commit `1f3ef3ff4f0b057f6f2f588cc247dc9bf3e29aca`; https://aecce5b3.yjrl.pages.dev.
- No candidate has been deployed. No production database writes, object changes, payments or messages were made by this release preparation.

Refresh this evidence immediately before a real release. A previous version is a recovery reference, not evidence it is safe to restore: the May Worker lacks the new opening/access/media controls.

## 1. Restore the approved release path

After Steve approves the narrow host setting, have the authorised host operator apply only the supplied one-line patch to `/usr/local/libexec/headsnap-cloudflare-wrangler`, retaining root ownership, permissions and all other entries. Validate the wrapper syntax and retry:

```sh
headsnap cloudflare yjrl --cwd /srv/headsnap/workspaces/yjrl/worker -- deploy --dry-run --outdir .wrangler/release-check
```

Treat another enforced rejection as a stop on deployment; do not run from a different project's allowlisted directory or expose credentials.

## 2. Isolated review deployment

Create dedicated review D1 and private R2 resources and a separate review Worker/config. Use a unique JWT secret and only synthetic records. Keep real email/payment credentials and daily reminders absent. Configure the Images binding. Do not copy the production database, member records or secrets.

Configure access protection before opening a review frontend or enabling review registration. Use an exact review frontend origin and build `VITE_API_URL` against that review Worker. No test frontend may default to the production Worker. Baseline review tables come from 0001, 0003 and then 0004–0008; the production seed is unnecessary.

Record resource IDs, private access policy, applied migration names, deployed source commit and URL in the delivery ledger. Run provider-independent acceptance with synthetic records; verify real Images processing as described in `MEDIA_REVIEW_ACCEPTANCE.md`. Never describe a test environment's synthetic launch settings as actual club sign-off.

Review resources/config and access protection are **not yet provisioned** because the host deployment approval is pending.

## 3. Production promotion

1. Use the verified, pushed source from the isolated review release. Verify this checkout has no unrelated changes or other deployer.
2. Inspect the current schema/migration journal and record the D1 recovery bookmark before mutation through the supported HeadSnap Cloudflare path. Keep member exports out of Git and logs.
3. Apply only missing additive migrations in order. Use the D1 migration journal and verify its names against actual schema; do not blindly replay 0001/0002 or ALTER statements. Stop and reconcile an ambiguous migration result before retrying.
4. Deploy the Worker with production `REGISTRATIONS_OPEN=false`, `MEMBER_ACCESS_OPEN=false`, and `SEASON_DETAILS_CONFIRMED=""`. Do not set `CHILD_SAFETY_SIGNOFF=approved`. Existing provider secrets must not be replaced or exposed.
5. Verify health and the closed fee response, account/registration closure, staff login/readiness, exact CORS origins, private storage and current media behaviour. No real child or payment submission is needed for this release.
6. Deploy the matching client build to the existing `yjrl` Pages project with the exact pushed commit recorded. Its current production branch is `master`; use deliberate production promotion instead of accidentally creating an unprotected preview against production data.
7. Verify `/register` presents the preparation page, deep links resolve and adult login is clear. Record Worker/Pages deployment IDs and URLs in the guide. The branded domains remain a separate DNS task.

The latest successful checks are recorded in the guide; reuse them if source is unchanged. Any implementation change requires the relevant checks again.

## 4. Recovery

Prefer a forward fix with registration/member access still closed. After a successful gated release, retain its Worker and Pages deployment IDs as the rollback pair. Keep additive database changes when rolling back compatible code; do not delete new records or remove audit guards to restore an older schema.

Do not automatically restore the May Worker: that would remove adult-only access and consent/opening controls. If no compatible gated version exists, keep affected routes unavailable until the defect is fixed. Restore D1 to a recovery point only with a separately reviewed data-recovery plan that accounts for writes since that point.

## 5. Actual season opening

Work through the remaining delivery-guide items first. Only after genuine club confirmation and completed acceptance should the production season confirmation, safeguarding sign-off and opening controls change. An incremental deployment does not authorise inventing fees, dates, registrar details or sign-off.
