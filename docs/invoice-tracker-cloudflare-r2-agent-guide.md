# Invoice Tracker: Cloudflare R2 Guide for Agents

Draft dated 2026-10-14. Companion to `invoice-tracker-backend-first-task-breakdown.md` (tasks B6-01 to B6-03, B7-09, B7-11, B9-07, B9-08) and `invoice-tracker-database-and-security-architecture.md`.

Purpose: let an agent set up, operate and update our Cloudflare R2 storage through the CLI and APIs, while staying inside the free tier. Facts below come from Cloudflare's R2 docs fetched on 2026-10-14 (pricing page last updated 1 Oct 2026). Re-check the pricing page before go-live, because limits and prices change.

**Public repo rule.** This guide uses placeholders only. Never commit the account ID, bucket names tied to real data, access keys, API tokens or endpoint URLs containing the account ID. Keep the real values in Vercel env settings and the private notes (see GitHub checklist).

---

## 1. The free tier we are working inside

| Resource | Free per month | Notes |
| --- | --- | --- |
| Storage | 10 GB-month | Billed as the average of the daily *peak* over 30 days. Standard storage only. |
| Class A operations | 1,000,000 | Writes, lists, copies, multipart steps, bucket config changes |
| Class B operations | 10,000,000 | Reads, heads, bucket config reads |
| Egress to the internet | Free, unlimited | Applies to the S3 API, Workers API and `r2.dev` |

Rules that matter for optimisation:

- **The free tier only applies to Standard storage.** Do not use Infrequent Access: it has no free tier, a 30-day minimum storage charge, retrieval fees, and higher operation prices.
- **Overage is billed, not blocked.** Usage above the free tier is charged, with partial units rounded up (1,000,001 operations bills as 2 million, 1.1 GB-month bills as 2 GB-month). Set a billing alert in the Cloudflare dashboard so a bug cannot run up a surprise bill.
- **Failed-auth calls are free.** Requests rejected with HTTP 401 are not charged.
- **Deletes are free.** `DeleteObject`, `DeleteBucket` and `AbortMultipartUpload` cost nothing.

### Which operations are which class

| Class A (1M free, the scarce one) | Class B (10M free) | Free |
| --- | --- | --- |
| `PutObject`, `CopyObject`, `ListObjects/V2`, `ListBuckets`, `PutBucket`, `CreateMultipartUpload`, `UploadPart`, `UploadPartCopy`, `CompleteMultipartUpload`, `ListMultipartUploads`, `ListParts`, `PutBucketCors`, `PutBucketLifecycleConfiguration`, `PutBucketEncryption`, lifecycle storage-tier transition | `GetObject`, `HeadObject`, `HeadBucket`, `GetBucketCors`, `GetBucketLifecycleConfiguration`, `GetBucketLocation`, `GetBucketEncryption`, `UsageSummary` | `DeleteObject`, `DeleteBucket`, `AbortMultipartUpload` |

### Worked budget (assumptions, replace with real volumes)

Assume 200 invoices a month, 3 uploaded files each averaging 300 KB, and each file viewed 20 times.

| Item | Calculation | Result | Share of free tier |
| --- | --- | --- | --- |
| Class A (uploads) | 200 x 3 = 600 `PutObject` | 600 | 0.06% of 1M |
| Class B (views) | 600 x 20 = 12,000 `GetObject` | 12,000 | 0.12% of 10M |
| Storage growth | 600 x 0.3 MB = 180 MB/month | 0.18 GB | 10 GB lasts about 55 months |

At this scale operations are not the constraint, **storage is the only number that will eventually grow**. The optimisation rules below mainly protect against accidental waste (listing in loops, multipart for small files, leftover test data) rather than normal use.

---

## 2. Credential model (two separate credentials)

Never give the app the powerful credential. Use two tiers.

| Credential | Used by | Permission | Where it lives |
| --- | --- | --- | --- |
| **Runtime S3 credentials** (Access Key ID + Secret Access Key) | The deployed app and the storage adapter | **Object Read & Write, scoped to the one bucket** | Vercel env only (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) |
| **Provisioning token** (Cloudflare API token) | An agent running setup or config changes (Wrangler or REST) | Account-level **Workers R2 Storage Write** (can create and delete buckets and edit config) | Private notes; exported into one shell session only while running setup; revoked or rotated afterwards |

Facts from the docs:

- Object-level permissions (Object Read & Write, Object Read only) work **only through the S3 API**, not the Cloudflare REST API.
- The S3 endpoint is `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`. The S3 region is `auto`.
- Account API tokens stay valid until revoked or until a preset expiry. User API tokens stop working if that user is removed from the account. For continuity, prefer **Account API tokens**.
- The secret access key is shown once at creation. Record it immediately.
- Managing lifecycle rules is a bucket-level action and needs the account-level `Workers R2 Storage Write` permission group.
- Jurisdictional buckets (EU, US, FedRAMP) need their own endpoint and client. We use the default jurisdiction, so this does not apply.

**Recommended bootstrap (least agent power):**

1. The owner creates the first token by hand in the dashboard (R2 object storage, then Account Details, Manage API Tokens). This is the provisioning token.
2. The owner creates the runtime S3 credentials by hand in the same screen: **Object Read & Write**, scoped to the one bucket, after the bucket exists.
3. The agent only ever receives the provisioning token, and only for setup runs.

**Optional: mint scoped tokens by API.** The docs allow creating tokens via the Cloudflare API. The Access Key ID is the token's `id`, and the Secret Access Key is the **SHA-256 hash of the token `value`**. The bucket resource key looks like `com.cloudflare.edge.r2.bucket.<ACCOUNT_ID>_default_<BUCKET_NAME>`, and the permission group for read/write on objects is `Workers R2 Storage Bucket Item Write`. Permission group IDs come from the Cloudflare API's list-permission-groups endpoint, so look them up rather than hard-coding them. Creating tokens this way needs a token that is itself allowed to create tokens, which is more power than we want an agent to hold. Use the manual route unless there is a reason not to.

### Environment variables

| Variable | Secret? | Purpose |
| --- | --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | No (but keep out of the public repo) | Used by Wrangler and REST calls |
| `CLOUDFLARE_API_TOKEN` | **Yes** | Provisioning token, setup runs only |
| `R2_ACCOUNT_ID` | No | Builds the S3 endpoint |
| `R2_BUCKET` | No | Bucket name |
| `R2_ACCESS_KEY_ID` | **Yes** | Runtime credential |
| `R2_SECRET_ACCESS_KEY` | **Yes** | Runtime credential |
| `STORAGE_PROVIDER` | No | `local` while building, `r2` at go-live |

None of these may ever be `NEXT_PUBLIC_`. The app must never hold `CLOUDFLARE_API_TOKEN`.

---

## 3. CLI: Wrangler

Wrangler is Cloudflare's CLI. Run it as `npx wrangler ...`. For non-interactive agent runs, authenticate with the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` environment variables instead of `wrangler login`.

### Bucket commands

```bash
# Create (set the location hint at creation; apac suits an India-based team)
npx wrangler r2 bucket create invoice-tracker-files --location apac --storage-class Standard

# Inspect, list, delete
npx wrangler r2 bucket info invoice-tracker-files --json
npx wrangler r2 bucket list
npx wrangler r2 bucket delete invoice-tracker-files        # destructive: needs owner approval
```

### Object commands (for smoke tests and ad hoc work, not for the app)

```bash
# Always pass --remote so the command acts on real R2, not the local simulator
npx wrangler r2 object put invoice-tracker-files/_healthcheck/probe.txt --file ./probe.txt --content-type text/plain --remote
npx wrangler r2 object get invoice-tracker-files/_healthcheck/probe.txt --file ./out.txt --remote
npx wrangler r2 object delete invoice-tracker-files/_healthcheck/probe.txt --remote
```

Note: the `object` subcommands accept both `--local` and `--remote`. Pass `--remote` explicitly every time, because a command that silently hits local storage looks like it worked but changes nothing in R2.

### Lifecycle commands

```bash
npx wrangler r2 bucket lifecycle list invoice-tracker-files

# Add one rule: abort incomplete multipart uploads after 1 day
npx wrangler r2 bucket lifecycle add invoice-tracker-files abort-stale-uploads "" --abort-multipart-days 1 --force

# Remove one rule by name
npx wrangler r2 bucket lifecycle remove invoice-tracker-files --name abort-stale-uploads

# Replace the whole configuration from a JSON file (DANGEROUS: overwrites every rule)
npx wrangler r2 bucket lifecycle set invoice-tracker-files --file lifecycle.json --force
```

`lifecycle set` and `cors set` **replace** the whole configuration. An agent must run `list` first, merge, show the owner the diff, and only then `set`.

### Other useful commands

```bash
npx wrangler r2 bucket cors list invoice-tracker-files
npx wrangler r2 bucket dev-url get invoice-tracker-files      # must report DISABLED: our bucket stays private
npx wrangler r2 bucket domain list invoice-tracker-files      # must be empty
```

Other Wrangler groups exist (`lock`, `notification`, `sippy`, `domain`, `dev-url enable`). **Do not use** `dev-url enable` or `domain add`: they make the bucket publicly reachable, which breaks our rule that files are only served through the app after a permission check.

---

## 4. REST API (Cloudflare API)

Base URL `https://api.cloudflare.com/client/v4`. Auth header `Authorization: Bearer $CLOUDFLARE_API_TOKEN`. Bucket creation, lifecycle and CORS are configuration calls and live here. Object reads and writes go through the S3 API (section 5), because object-scoped tokens do not work on the REST API.

```bash
# Create a bucket (needs Workers R2 Storage Write)
curl -sS "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/r2/buckets" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -d '{ "name": "invoice-tracker-files", "locationHint": "apac", "storageClass": "Standard" }'
```

Body fields: `name` (3 to 64 characters), optional `locationHint` (`apac`, `eeur`, `enam`, `weur`, `wnam`, `oc`), optional `storageClass` (`Standard` or `InfrequentAccess`; always `Standard` for us). Optional header `cf-r2-jurisdiction` selects a jurisdiction; omit it.

The API reference also lists list/get/delete bucket, get/set lifecycle rules, and get/set/delete CORS under R2 Buckets. Look up the exact paths and bodies in the API reference before use, and always check the `success` field in the JSON response.

---

## 5. S3 API (what the app and the storage adapter use)

R2 implements the S3 API, so the standard AWS SDK works. Install `@aws-sdk/client-s3` (and `@aws-sdk/s3-request-presigner` only if presigned URLs are ever needed).

### Client

```ts
import { S3Client } from "@aws-sdk/client-s3";

export const r2 = new S3Client({
  region: "auto", // required by the SDK, R2 uses "auto"
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});
```

Create one client per process and reuse it. If a newer SDK version causes checksum errors against R2, see the troubleshooting table.

### Operations the adapter needs (maps to `StorageAdapter` in B6-01)

```ts
import { PutObjectCommand, GetObjectCommand, HeadObjectCommand, HeadBucketCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const Bucket = process.env.R2_BUCKET!;

// put: ONE PutObject for every file (our cap is 10 MB). Class A x1.
await r2.send(new PutObjectCommand({
  Bucket, Key: `documents/${documentId}`, Body: bytes,
  ContentType: mimeType, ContentLength: bytes.length,
  CacheControl: "private, max-age=31536000, immutable",
}));

// getStream: Class B x1. Pipe Body to the response; never buffer large files.
const res = await r2.send(new GetObjectCommand({ Bucket, Key: `documents/${documentId}` }));
// res.Body is a stream: pass it to the route handler's Response

// exists: Class B x1. Prefer the documents table; only use this for repair jobs.
await r2.send(new HeadObjectCommand({ Bucket, Key: `documents/${documentId}` }));

// healthCheck: Class B x1. NEVER use a list call for this (that is Class A).
await r2.send(new HeadBucketCommand({ Bucket }));

// delete: free.
await r2.send(new DeleteObjectCommand({ Bucket, Key: `documents/${documentId}` }));
```

R2 S3 facts worth knowing:

- Supported and relevant: `PutObject`, `GetObject`, `HeadObject`, `DeleteObject`, `DeleteObjects`, `ListObjectsV2`, `CopyObject`, multipart operations, conditional headers (`If-Match`, `If-None-Match`, and so on) and `Range` reads.
- Not implemented: object tagging, bucket versioning, bucket policies, ACLs, object lock via S3, bucket notifications via S3. Do not design anything that needs them (there is no versioning, so a delete or overwrite is final).
- `ListObjectsV2` is the supported list call. Avoid the older `ListObjects`.
- `PutObject` is supported with storage class `STANDARD` or `STANDARD_IA`. Always send `STANDARD` (the default).
- Presigned URLs work for GET, HEAD, PUT and DELETE, expire between 1 second and 7 days, work only on the `r2.cloudflarestorage.com` domain, and are bearer tokens. We do **not** need them: downloads stream through `api/files/[id]` after a permission check, which also keeps every view in the audit log.

---

## 6. Optimisation playbook (rules for the adapter and for agents)

Each rule says what it saves.

| # | Rule | Saves |
| --- | --- | --- |
| 1 | **One `PutObject` per file. Never multipart.** With a 10 MB cap there is no reason to use it. Beware the SDK's `Upload` helper from `@aws-sdk/lib-storage`: it uses multipart above its default part size and every part is a Class A call. Use `PutObjectCommand` directly. | Class A |
| 2 | **Never list in request paths.** The `documents` table already knows every key. Listing is Class A and returns nothing the database lacks. Only repair or audit scripts may list, run manually, with `MaxKeys` set. | Class A |
| 3 | **Health checks use `HeadBucket`, and storage-used comes from Postgres.** For B7-11, compute storage used as `SUM(size_bytes)` over live `documents` rows. Poll `HeadBucket` no more often than once every 5 minutes, and cache the result. | Class A and B |
| 4 | **Do not `HeadObject` before `GetObject`.** Metadata (size, type, hash) is already in the `documents` row. Handle a missing object by catching the 404 from the `GetObject` itself. | Class B |
| 5 | **Dedupe before uploading.** Look up `sha256` in `documents` first (B6-04 already computes it). A duplicate becomes a new row pointing at the same key, with zero R2 calls. If sharing a key between rows, the purge job must only delete the object when no live row still references it. | Class A and storage |
| 6 | **Make browser caching work.** Files are immutable and keyed by document ID, so send `Cache-Control: private, max-age=<long>, immutable` on downloads. Repeat views by the same user then cost no R2 read. Use `private` so shared caches never store invoices. | Class B |
| 7 | **Stream, do not buffer.** Pipe the `GetObject` body to the response. | App memory |
| 8 | **Reject bad uploads before any R2 call.** Type by magic bytes, size cap and role check all run first (B6-04, B6-05). A rejected upload costs zero operations. | Class A |
| 9 | **Keep the 10 MB cap and the allowed types.** Encourage PDFs and compressed JPEGs. Consider resizing large photos in the browser before upload. This is the main lever on storage. | Storage |
| 10 | **Delete orphans immediately.** The orphan cleanup in B6-05 (file written but row insert failed) must run on every failure path. Deletes are free, but orphaned bytes still count toward the 10 GB. | Storage |
| 11 | **Purge uses `DeleteObject` per file.** It is documented as free. If the purge job (B7-09) wants batching with `DeleteObjects`, confirm that batch deletes are also free on the live pricing page first. The R2 pricing page lists only `DeleteObject`, `DeleteBucket` and `AbortMultipartUpload` as free. | Class A (if batch is billed) |
| 12 | **Add a lifecycle rule to abort stale multipart uploads after 1 day.** Buckets already abort them after 7 days by default. Since we never use multipart, this is cheap insurance against a stray client leaving billable parts behind. | Storage |
| 13 | **Stay on Standard.** Never transition to Infrequent Access or write with `STANDARD_IA`. A transition also costs a Class A operation. | Everything |
| 14 | **No public access.** Keep `r2.dev` access disabled and no custom domain. Beyond security, this keeps every read going through the app where it is permission-checked and audited. | Security |
| 15 | **Retry with backoff, cap retries at 2.** Each retried write is another Class A operation. Treat 4xx as final and do not retry them. | Class A |

### Test and CI hygiene (shares the same free tier)

- Run the storage contract suite (B6-02) against R2 **only** in a manually triggered or nightly job, never on every pull request. A contract run should use under 50 operations.
- Use a **separate test bucket** with a lifecycle rule that expires everything under it after 1 day. Test objects count toward the same 10 GB and the same operation totals, since the free tier is per account.
- Smoke tests write to a `_healthcheck/` prefix and delete what they create.

### Usage monitoring (cheap and local)

- Keep a small counter in Postgres (for example a `storage_ops_daily` table: date, class A count, class B count) incremented by the adapter. Surface it on the dashboard health card.
- Alert at 70% and 90% of any monthly limit, and when storage in the DB exceeds 8 GB.
- Also set a billing alert in the Cloudflare dashboard as a second line of defence.

---

## 7. Agent runbook: setup and routine operations

### Permission levels for agents

| Action | Agent may do on its own | Needs owner approval first |
| --- | --- | --- |
| Read bucket info, list lifecycle/CORS config, check `dev-url`, run smoke test in the test bucket | Yes | |
| Create the test bucket and its 1-day expiry rule | Yes | |
| Create the production bucket | | **Yes** (one time) |
| Add a lifecycle rule (after `list`, showing the diff) | | **Yes** |
| `lifecycle set` or `cors set` (replaces all rules) | | **Yes**, with a before/after diff |
| Delete any bucket, delete any object in the production bucket outside the app's purge job | | **Yes**, always |
| Enable `dev-url` or add a custom domain | **Never** | Not allowed by project rules |
| Create or revoke API tokens | | **Yes** |
| Print or log any secret | **Never** | |

### One-time production setup (idempotent script outline)

Run only with the provisioning token exported for this session.

1. `npx wrangler r2 bucket list`: if `invoice-tracker-files` already exists, **stop and report**; do not recreate.
2. Create the bucket (section 3), then `bucket info --json` and record the creation date in `STATUS.md` (no account ID).
3. Add the lifecycle rule `abort-stale-uploads` (1 day). Run `lifecycle list` and paste the output as evidence.
4. Verify privacy: `dev-url get` shows disabled and `domain list` is empty.
5. **Owner step:** create the runtime Object Read & Write token scoped to this bucket, and add the two keys to Vercel env.
6. Run the smoke test through the adapter (put, head, get, delete of a probe object under `_healthcheck/`) and confirm the byte round trip.
7. Confirm production start-up fails with `STORAGE_PROVIDER=local` and succeeds with `r2` (B6-03 / B9-08 evidence).
8. Revoke or rotate the provisioning token if it will not be needed again soon.

### Routine operations

- **Check the bucket is healthy:** `HeadBucket` through the adapter. If it fails, the dashboard health card turns red (B7-11).
- **Rotate runtime keys:** the owner creates a new scoped token, updates Vercel env, redeploys, verifies a download, then revokes the old token.
- **Change retention:** only the app's purge job deletes files. Do not add `Expiration` lifecycle rules on `documents/`, because retention is app-controlled (30-day undo window, Admin-only delete). Lifecycle expiry is acceptable for `_healthcheck/`, test buckets and backup prefixes only.

### Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `403` / `AccessDenied` on put or get | Token lacks Object Read & Write, or is scoped to a different bucket | Recreate the runtime token scoped to the right bucket |
| `SignatureDoesNotMatch` | Wrong secret, wrong endpoint, or a custom domain used with a presigned URL | Check `R2_ACCOUNT_ID`, region `auto`, and use the `r2.cloudflarestorage.com` endpoint |
| `NoSuchBucket` | Bucket name typo, or a jurisdictional bucket accessed on the default endpoint | Check the name and jurisdiction |
| Errors mentioning checksums after an SDK upgrade | Newer AWS SDK versions send extra checksum headers by default | Pin an earlier SDK version, or configure the client to compute checksums only when required (check the SDK's current option name). R2 supports CRC-64/NVME for full-object checksums and other algorithms in composite form |
| Wrangler object command "worked" but nothing is in R2 | It ran against local storage | Re-run with `--remote` |
| Class A count climbing fast | A loop is listing, or the SDK is using multipart | Search for `ListObjects`, `lib-storage` and `Upload` usage; fix per rules 1 and 2 |
| Lifecycle change seems ignored | Rules apply asynchronously | Objects are typically actioned within 24 hours; existing objects can take longer |

---

## 8. Suggested task changes in the backend plan

B9-08 ("reliable file store") is too large for one task now that R2 is the likely choice. Replace it with these atomic tasks. IDs reuse the B9 series.

| ID | Task | Lane | Needs | Done when |
| --- | --- | --- | --- | --- |
| B9-08a | Owner creates the Cloudflare account setup: R2 enabled, billing alert set, provisioning token created and stored privately | OPS | B0-01 | Owner confirms; no values in repo |
| B9-08b | Production bucket created and secured: private, lifecycle `abort-stale-uploads`, `dev-url` disabled, no domains (section 7 steps 1 to 4) | OPS | B9-08a | `lifecycle list`, `dev-url get` outputs in `STATUS.md` |
| B9-08c | Owner creates bucket-scoped Object Read & Write token and adds `R2_*` vars to Vercel env | OPS | B9-08b | Env present; secret scan clean |
| B9-08d | `R2StorageAdapter` implementing `StorageAdapter` with S3 client (single `PutObject`, `HeadBucket` health, streamed get) | SVC | B6-02 | Compiles; unit tests with a mocked S3 client |
| B9-08e | Adapter passes the B6-02 contract suite against a **test bucket** with 1-day expiry, in a nightly or manual job | TEST | B9-08d, B9-08b | Suite green; op count logged under 50 |
| B9-08f | Cache-Control and dedupe-aware purge: downloads send immutable private cache headers; purge deletes an object only when no live row references the key | SVC | B9-08d | Tests for shared-key purge and header presence |
| B9-08g | Ops counter and health card: `storage_ops_daily` increments in the adapter; alerts at 70% and 90%; storage-used from `SUM(size_bytes)` | SVC | B9-08d, B7-11 | Counter matches a scripted run of known size |
| B9-08h | Go-live switch: `STORAGE_PROVIDER=r2` in production, production start-up with `local` refuses, upload through the deployed app lands in R2 | OPS | B9-08c, B9-08e | Upload, download and delete verified end to end |
| B9-08i | Backups go to a **second provider or account** (for example Backblaze B2's free 10 GB), with an expiry rule on the backup prefix | OPS | B9-07 | Restore drill reads the backup from the second provider |

Then B9-08 is done when B9-08a to B9-08h are done, and B9-07 is done when B9-08i is.

---

## Sources

- [R2 pricing](https://developers.cloudflare.com/r2/pricing/) (last updated 1 Oct 2026)
- [R2 API tokens and authentication](https://developers.cloudflare.com/r2/api/tokens/)
- [R2 Wrangler commands](https://developers.cloudflare.com/r2/reference/wrangler-commands/)
- [R2 object lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)
- [R2 S3 API compatibility](https://developers.cloudflare.com/r2/api/s3/api/)
- [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [Cloudflare API: create R2 bucket](https://developers.cloudflare.com/api/resources/r2/subresources/buckets/methods/create/)
