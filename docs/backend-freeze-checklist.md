# Backend freeze checklist (B9-11)

Tick every box before tagging `backend-freeze` and starting UI phases (U1–U5).
**Do not push the git tag from an agent session** — the owner tags after sign-off.

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

- [ ] **B9-07** Backup design + restore drill (private notes)
- [ ] **B9-08a** Cloudflare account: R2 enabled, billing alert, provisioning token (private)
- [ ] **B9-08b** Production bucket created/secured (`lifecycle list`, `dev-url get` evidence in STATUS)
- [ ] **B9-08c** Bucket-scoped runtime keys in Vercel env (`R2_*`); secret scan clean
- [ ] **B9-08e live** Contract suite green against test bucket (manual workflow with secrets)
- [ ] **B9-08h** Production `STORAGE_PROVIDER=r2`; local refused; upload/download/delete E2E
- [ ] **B9-08i** Backup to second provider/account (ties to B9-07)
- [ ] **B9-09** Private runbook signed off
- [ ] **B9-10** Repo mirror/bundle backup + full history re-scan clean
- [ ] **B9-03 live** Fill real 5k p95 numbers in `docs/perf-notes.md`
- [ ] **B9-11** Owner review: all above done → push tag `backend-freeze` (owner only)

## After freeze

UI work (U1–U5) may start. No Phase 6 AI features until Phase 6 gates in `STATUS.md`.
