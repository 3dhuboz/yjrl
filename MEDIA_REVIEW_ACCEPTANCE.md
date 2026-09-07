# Photo review release checks

The 2027 branch processes photos before storing them, holds every upload for review and checks consent when serving approved media. This is implemented and covered by isolated tests; it is not a completed production acceptance check.

## Release prerequisites

- Apply migration `worker/migrations/0006_reviewed_media.sql` after 0004 and 0005, before releasing this Worker. It adds processing/review information, the group-photo player list, review versions, cleanup status and media-preview access records. Player reads also depend on the new access-log columns.
- Deploy the Worker with the `IMAGES` binding declared in `worker/wrangler.toml`. Missing processing refuses uploads; there is no fallback to storing originals. Review the account's Images usage before release. Transformations use Cloudflare's existing platform, without an image URL, face detection or an AI analysis step. [Binding and setup reference](https://developers.cloudflare.com/images/optimization/binding/).
- Keep the R2 bucket private. Read-only Cloudflare checks on 7 September 2026 at approximately 02:41 UTC found no custom domains on `yjrl-uploads` and its managed `r2.dev` domain disabled. No settings or objects were changed. Verify those settings again during release; do not attach the old `UPLOADS_PUBLIC_URL` as a public bucket domain.
- Deploy the reviewed Worker before the matching client. Inventory legacy image references and old media caches. Previously stored originals lack processing/review evidence and will not be served or previewed by this Worker. Re-upload required photos and replace their references after review. Previously downloaded or externally shared copies cannot be withdrawn by the app.
- The existing HeadSnap Cloudflare workspace allowlist restriction still blocks the normal Wrangler packaging/deployment path. Resolve that restriction through the normal host administration process; do not bypass the wrapper.

## Intended behaviour

JPEG, PNG and WebP uploads are limited to 5 MiB and 40 megapixels. The Images binding validates/decodes the input, scales down within 1600 × 1600 pixels and emits a still WebP. Only that result is stored, under a random filename. Metadata/animation chunks and malformed output containers are rejected. Cloudflare documents that non-JPEG output discards metadata and applies source orientation/colour profiles during processing. [Metadata reference](https://developers.cloudflare.com/images/optimization/features/#metadata).

Every category, including general or unclassified photos, enters `pending_review`. Known linked players require consent at upload; unclassified content remains private until a reviewer classifies it. A reviewer must privately preview the exact stored image, state whether children are shown, identify every child and add notes. Every identified player needs current media consent. Known linked players cannot be removed by marking the image as showing no children. If a child cannot be identified, reject the image. This depends on the reviewer inspecting the actual image; the app does not identify faces automatically.

Preview access is restricted to administrators and recorded before returning bytes. Review versions prevent stale or simultaneous reviews from overwriting another decision. Public reads check current approval, processing evidence, the stored hash and every identified child's active status and media consent. Responses use `no-store`; withdrawing a consent blocks subsequent requests. Rejection withdraws public access before object deletion. A deletion failure remains visible as pending cleanup, with a retry action.

News and event image fields accept reviewed references. Public response images disappear when the referenced photo is no longer permitted. Existing unrelated external image URLs are hidden. The news editor can select an approved photo, which appears in the article detail view. Text about children still needs club editorial/consent review; this change only enforces the image path.

Photo, public-profile and public-statistics permissions are separate. Photo consent at sign-up does not grant either of the other permissions. Registrar API updates accept explicit booleans, work without an unrelated player edit and preserve omitted consent choices. A parent self-service withdrawal interface and versioned consent evidence remain future work; the registrar must handle requests through the agreed club process.

## Acceptance with designated test data

1. In a staging environment with separate D1/R2 resources, upload a designated test image containing EXIF GPS, owner/camera information and orientation. Do not use a real child's photo for this check. Verify correct orientation, a readable WebP, removed metadata and absence of the original bytes/filename in R2. Repeat with PNG/WebP and malformed, oversized and animated inputs. Confirm the account's real Images binding succeeds; the test suite mocks that service and does not prove its codec behaviour.
2. Use the safety panel to upload, privately preview, classify, identify subjects and approve a test image. Confirm anonymous/parent accounts cannot preview it, and no public URL works while review is pending. Verify the preview record names the reviewer and image hash without copying profile details into the log.
3. Use a two-player test photo. Withhold or withdraw either player's consent and verify approval/public reads are blocked. Confirm a string such as `"false"` cannot grant consent and that changing photo consent preserves public-statistics/public-profile choices.
4. Open the same pending review in two sessions. Complete one decision, then submit the stale decision from the other; it must refuse the stale update. Verify the selected approved news photo renders on desktop/mobile, and disappears on a new request after withdrawal/rejection. Check keyboard access, labels and multi-player selection.
5. Reject an image and verify that its old URL no longer serves bytes. Exercise a storage deletion failure, confirm the private pending-cleanup state and retry removal. Complete a retention/orphan reconciliation procedure for objects left by failed database/storage operations.

The isolated suite uses in-memory SQLite, fake R2 and a synthetic WebP container. It verifies authorization, storage boundaries, metadata-container rejection, consent changes, review conflicts and failure handling. No real Cloudflare transformations, uploads, customer messages or payments were performed.
