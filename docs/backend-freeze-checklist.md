# Backend freeze checklist (B9-11)

Tick every box before tagging `backend-freeze` and starting UI phases (U1–U5).
**Do not push the git tag from an agent session** — the owner tags after sign-off.

**In-house v1 (21 Oct 2026):** UI already shipped; owner waived the remaining
ops boxes and the freeze tag itself — see `DECISIONS.md` "In-house scope".
Keep this file as a checklist if you later want the tag for history.

## Code / CI (agent-deliverable)

- [x] B9-01 role matrix covers all ops (see `STATUS.md`)
- [x] B9-02 security headers + cookie flags automated check
- [x] B9-03 perf harness + `docs/perf-notes.md`
- [x] B9-04 concurrency tests (skip without DB)
- [x] B9-05 `docs/api-contract.md`
- [x] B9-06 `docs/privacy-fields.md`
- [x] B9-08d R2 adapter + mocked unit tests
- [x] B9-08e `workflow_dispatch` R2 contract workflow
- [x] B9-08f Cache-Control + shared-key purge tests
- [x] B9-08g `storage_ops_daily` + health alerts

## Owner-blocked (do not invent secrets)

- [~] **B9-07** Backup design + restore drill — **deferred** (in-house scope)
- [x] **B9-08a** Cloudflare account: R2 enabled, billing alert, provisioning token (private)
- [x] **B9-08b** Production bucket created/secured (`lifecycle list`, `dev-url get` evidence in STATUS)
- [x] **B9-08c** Bucket-scoped runtime keys in Vercel env (`R2_*`); secret scan clean
- [x] **B9-08e live** Contract suite green against test bucket (manual workflow with secrets)
- [x] **B9-08h** Production `STORAGE_PROVIDER=r2`; local refused; upload/download/delete E2E
- [~] **B9-08i** Backup to second provider/account — **deferred** (in-house scope)
- [~] **B9-09** Private runbook signed off — **deferred** (in-house scope)
- [~] **B9-10** Repo mirror/bundle backup + full history re-scan — **deferred** (in-house scope)
- [~] **B9-03 live** Fill real 5k p95 numbers — **deferred** (in-house scope)
- [~] **B9-11** Freeze tag — **waived** for in-house v1 (UI already shipped; optional later)

## After freeze

UI work (U1–U5) may start. No Phase 6 AI features until Phase 6 gates in `STATUS.md`.
