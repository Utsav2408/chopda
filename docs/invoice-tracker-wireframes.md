# Invoice Tracker: Wireframes

Draft dated 2026-10-11. Companion to `invoice-tracker-database-and-security-architecture.md`, `invoice-tracker-phasewise-implementation-plan.md` and `invoice-tracker-agentic-ui.md`.

Wireframe canvas (private to the owner until shared from the page's Share menu): https://claude.ai/artifact/SxdY9pWp1u4AahCD7sfEcf

The canvas holds 16 desktop screens, built to stack at phone width. **Screens 1 to 9 are Release 1 (Phases 0 to 5, no AI) and are described below. Screens 10 to 16 are the agentic layer, built later in Phase 6 (Release 2), and are described in `invoice-tracker-agentic-ui.md`.** All names, amounts and counts are sample data. Company details appear as placeholders such as `[GSTIN]`.

The sidebar in the canvas also shows an Agent group (Agent home, Review queue, Agent activity, Agent settings). In Release 1 that group is not built or shown.

## Design principles

- **The flow is the product.** Flows are built once in a builder, then every invoice runs through one, step by step.
- **One screen answers "where is this invoice?"** Every list and detail view shows the current step and who owns it.
- **Documents belong to the step that needed them.** Files attach to a step, and are opened only through the app after a permission check.
- **History is visible.** Each step records who completed it and when.
- **Roles shape what you see.** Controls a role cannot use are hidden or read-only, never just disabled without explanation.

## Roles

| Role | Count | Can do |
| --- | --- | --- |
| Admin | Exactly one | Everything: manage users, edit the company profile, build flows, export data, transfer the Admin role |
| Builder | Many | View, create invoices, complete steps and upload documents, build and publish flows, edit own profile |
| Viewer | Many | View invoices and documents, edit own profile and password |

Rules shown in the wireframes:

- The Admin cannot be deactivated. The role is handed over with "Transfer Admin role", which makes the previous Admin a Builder.
- Users are added as Builder or Viewer only.
- Enforce the single-Admin rule in the database, and re-check roles in server actions, not only in the interface.

## Screens 1 to 9 (Release 1)

| # | Screen | Next.js route | Who | What it shows |
| --- | --- | --- | --- | --- |
| 1 | Sign in | `(auth)/login` | Everyone | Username and password, error state, admin-managed password reset |
| 2 | Dashboard | `(app)/dashboard` | Everyone | Counts of open, waiting, overdue and completed invoices; needs-attention list; invoices by step; recent activity; storage and backup health |
| 3 | Invoices list | `(app)/invoices` | Everyone (create: Admin, Builder) | Tabs All, Mine, Waiting, Overdue, Completed; filters by flow, step, owner and date; table with progress and current step; quick-start strip |
| 4 | Invoice detail | `(app)/invoices/[id]` | Everyone (act: Admin, Builder) | Stepper of the flow. Done steps show who, when and files. The current step is an inline form. Side column has details, documents and history |
| 5 | Flow library | `(app)/flows` | Everyone (edit: Admin, Builder) | Flows as step chips with the differing step highlighted; draft and published states; versions; active invoice counts |
| 6 | Flow builder | `(app)/flows/[id]/edit` | Admin, Builder | Step list, step settings (name, instructions, who can complete, fields), live preview, publish creates a new version |
| 7 | Team, roles and storage | `(app)/admin/users` | Admin | Users table, role permission matrix, storage and backup settings (file store provider and account) |
| 8 | My profile | `(app)/profile` | Everyone, own data only | Photo, personal details, read-only username, change password, signed-in devices, preferences and in-app reminders |
| 9 | Company profile | `(app)/company` | Admin edits, others read-only | Logo, legal details, invoice defaults, optional bank details, current Admin, role counts, workspace info |

Screens 8 and 9 are two separate profiles under one tabbed header: "My profile" (only about you) and "Company profile" (shared by everyone).

## Screens 10 to 16 (Phase 6, later)

Agent home, Ask the agent, Invoice with agent beside it, Review queue, Agent activity, Flow builder with agent, Agent settings. See `invoice-tracker-agentic-ui.md`. Release 1 must work completely without them.

## Key design decisions

- **Flow versions.** Editing a published flow creates a new version. Invoices already running keep the version they started on. This was not in the original doc and was added so a flow edit cannot change invoices mid-process.
- **Manual email.** The courier step has a confirmation ("I have sent the email") and an optional email-proof upload, matching "email manually, record on the step."
- **Standard vs Courier** differ at step 4 only, and the flow library highlights exactly that step.
- **Reminders** (step waiting more than 3 days, payment due) appear as in-app preferences. Email reminders are marked "Coming later."
- **Two-step sign-in** is shown as "Coming later", in line with password-only sign-in being a starting point.
- **File storage.** While building, uploaded files sit in a local folder (test data only). The screens do not depend on where files live, so switching to a reliable store before deployment changes nothing for users. The storage health card on the dashboard and the storage settings on screen 7 show the active provider.

## Next.js structure implied by the wireframes

- Route groups `(auth)` and `(app)`. `middleware.ts` checks the session first, then the role per route group.
- Files have no public URLs. A route handler at `api/files/[id]` checks permission, then streams from the file store through a storage adapter: a local folder while building, and Google Drive or Cloudflare R2 once a reliable store is chosen (before any deployment that accepts uploads).
- Flow versions are stored, and each invoice stores the flow version it started on.
- Step completion, user management and the Admin transfer run as server actions that re-check the role.

## Not yet designed

- A full new-invoice form (the list shows only a quick-start strip)
- Bell and reminders list (Phase 4)
- Empty, loading and error states beyond sign-in
- Mobile-specific layouts

Excel import is out of scope; the database doc supersedes the original idea on that.

## Open items carried over from the main doc

- [ ] Which reliable file store will we use at go-live, Google Drive or Cloudflare R2? (screen 7 shows the provider; the canvas still reads `[account to confirm]`)
- [ ] Confirm the Builder permissions above. Builder is wider than the earlier "Member" proposal because it includes building flows.
- [ ] Decide whether bank details belong in the app at all (screen 9 has an optional card).
