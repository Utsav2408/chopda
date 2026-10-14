# API / service contract (B9-05)

Hand-written from Zod schemas and service signatures. **This is the UI agents'
only input** for backend operations. Roles are re-checked on every call; hiding
a button is never sufficient.

**Common errors:** `Unauthenticated` (401), `Forbidden` (403), `NotFound` (404),
`Validation` (400), `Conflict` (409), `RateLimited` (429), `Internal` (500).

**Actors:** `signed-out` | `viewer` | `builder` | `admin`.

---

## Auth

| Operation | Roles | Input | Output | Errors |
| --------- | ----- | ----- | ------ | ------ |
| `auth.login` | public | `{ username, password }` (`loginBodySchema`) | `{ token, user: VisibleUser, mustChangePassword }` + Set-Cookie | Validation, RateLimited, Unauthenticated (generic message) |
| `auth.logout` | cookie holder | session token (cookie) | void; clears cookie | — |
| `auth.logoutAll` | any authed | ctx | void (revokes all own sessions) | Unauthenticated |
| `sessions.listOwn` | any authed | ctx | `SessionListRow[]` | Unauthenticated |
| `sessions.revokeOwn` | any authed | `{ sessionId }` uuid | void | Unauthenticated, NotFound |

Routes: `POST /api/auth/login`, `POST /api/auth/logout`, `GET/DELETE /api/me/sessions`, `DELETE /api/me/sessions/[id]`.

---

## Users

| Operation | Roles | Input | Output | Notes |
| --------- | ----- | ----- | ------ | ----- |
| `users.create` | admin | `{ username, displayName, role: builder\|viewer, email?, phone? }` | `{ user, temporaryPassword }` | Temp password once; `mustChangePassword=true` |
| `users.list` | any authed | — | `VisibleUser[]` (no `passwordHash`) | |
| `users.get` | any authed | user id | `VisibleUser` | NotFound |
| `users.deactivate` / `reactivate` | admin | user id | `VisibleUser` | Cannot deactivate sole admin |
| `users.resetPassword` | admin | user id | `{ temporaryPassword }` | |
| `users.changeOwnPassword` | any authed | `{ oldPassword, newPassword }` | void | Min length from security constants |
| `users.transferAdmin` | admin | `{ newAdminUserId }` | `{ previousAdminId, newAdminId }` | Atomic; `one_admin` index |
| `users.updateOwnProfile` | any authed | `{ displayName?, email?, phone?, photoObjectKey?, prefs? }` | `VisibleUser` | |

Routes under `/api/users/**`, `/api/me/password`, `/api/me/profile`.

---

## Flows

| Operation | Roles | Input | Output |
| --------- | ----- | ----- | ------ |
| `flows.createDraft` | admin, builder | `{ name }` | `FlowDetail` |
| `flows.addStep` / `editStep` / `removeStep` / `reorderSteps` | admin, builder | draft flow id + step payload (`flowStepInputSchema`) | `FlowDetail` |
| `flows.publish` / `archive` / `duplicate` | admin, builder | flow id | `FlowDetail` |
| `flows.list` / `get` / `diffAgainst` | any authed | ids | list / detail / `{ differingStepNumbers }` |

Step fields: `{ key, label, type, required }` — types include text, number, date, confirm, file, email, etc. (`flowFieldsSchema`). Published steps are immutable (DB trigger).

---

## Invoices

| Operation | Roles | Input | Output |
| --------- | ----- | ----- | ------ |
| `invoices.create` | admin, builder | `{ invoiceNo, partyName, amountRupees, issueDate, dueDate?, ownerId, flowId, extra? }` | `InvoiceDetail` |
| `invoices.update` | admin, builder | id + patch (no flow change) | `InvoiceDetail` |
| `invoices.get` | any authed | id | `InvoiceDetail` (visibility: viewer may be limited by ownership rules) |
| `invoices.list` | any authed | `listInvoicesQuerySchema` (tab, filters, sort, cursor, limit≤100) | `{ items, nextCursor }` |
| `invoices.softDelete` | admin | id | void / detail |
| `invoices.undo` | admin | id | restored detail (≤30 days) |
| `invoices.listDeleted` | admin | — | deleted rows + days left |

Amounts: rupees string on the wire → paise `bigint` in DB.

---

## Steps

| Operation | Roles | Input | Output |
| --------- | ----- | ----- | ------ |
| `steps.complete` | admin, builder (+ step `allowedRole`) | `{ invoiceId, invoiceStepId, data }` | `InvoiceDetail` |

Errors: Conflict if wrong order, already completed, or concurrent loser (B9-04). Validation if `data` fails field schema / email rule.

Route: `POST /api/invoices/[id]/steps/complete`.

---

## Documents

| Operation | Roles | Input | Output |
| --------- | ----- | ----- | ------ |
| `documents.upload` | admin, builder (+ step role) | multipart + meta `{ invoiceStepId, filename, fieldKey? }` | `{ documentId, objectKey, mimeType, sizeBytes, sha256, duplicateOfExisting }` |
| `documents.download` | any authed (invoice visible) | document id | stream + `Cache-Control: private, max-age=31536000, immutable` |

No public URLs. Max size / MIME from `validate-upload`. Dedupe reuses `object_key` by sha256.

Routes: `POST /api/files/upload`, `GET /api/files/[id]`.

---

## Dashboard / history / reminders

| Operation | Roles | Notes |
| --------- | ----- | ----- |
| `dashboard.counts` | any authed | Cached ~45s |
| `dashboard.byStep` | any authed | |
| `dashboard.needsAttention` | any authed | |
| `dashboard.recentActivity` | any authed | |
| `history.forInvoice` | any authed | Audit rows for visible invoice |
| `reminders.compute` | any authed | Due-soon + waiting |
| `reminders.dismiss` | any authed | `{ key }` |

---

## Company

| Operation | Roles | Input | Notes |
| --------- | ----- | ----- | ----- |
| `company.get` | any authed | — | PAN omitted for non-admin |
| `company.update` | admin | `{ legalName?, gstin?, pan?, invoiceDefaults? }` | PAN encrypted at rest |
| `company.listBanks` | admin, builder | — | Account number / IFSC decrypted for allowed roles |
| `company.addBank` / `editBank` / `deactivateBank` / `setDefaultBank` | admin | bank schemas | IFSC format enforced |
| `company.summary` | any authed | — | Admin name + role counts |

---

## Jobs / purge / health

| Operation | Auth | Notes |
| --------- | ---- | ----- |
| `jobs.runPurge` | `CRON_SECRET` → admin ctx | Deletes files only when no live doc shares `object_key`; never purges audit |
| `reminders.runCronSweep` | cron | Clears stale reminder state |
| `health.check` | public (`GET /api/health`, `?full=1` for probes) | DB, storage HeadBucket/stat, `storageUsedBytes`, ops alerts (70%/90%), `backupStatus: "none"` until B9-07 |

Cron routes: `/api/cron/purge`, `/api/cron/reminders` — Bearer or `x-cron-secret`.

---

## Role matrix

Full allow/deny table: `tests/security/role-matrix.ts` (B9-01). Raw SQL as `app_user`: `tests/db/rls.test.ts`.
