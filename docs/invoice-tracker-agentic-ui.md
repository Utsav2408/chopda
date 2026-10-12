# Invoice Tracker: Agentic UI

Draft dated 2026-10-11. Companion to `invoice-tracker-wireframes.md`, `invoice-tracker-database-and-security-architecture.md` and `invoice-tracker-phasewise-implementation-plan.md`.

Wireframe canvas (screens 10 to 16 are the agentic layer; private to the owner until shared): https://claude.ai/artifact/SxdY9pWp1u4AahCD7sfEcf

**Status: planned for Phase 6 (Release 2), decided 11 Oct 2026.** Release 1 is Phases 0 to 5 with screens 1 to 9 and no AI. Phase 6 starts only after Release 1 is live and the gates in the implementation plan are met (work items P6-01 to P6-18, including the decisions on provider, spending cap, privacy and first capabilities, and an explicit go-ahead). With the agent off, screens 1 to 9 work exactly as before.

## Idea in one line

The agent does the reading, drafting and chasing. People keep the decisions. Everything the agent produces waits for a person to approve it, shows its evidence, and can be traced and undone.

## Design principles

1. **Violet means agent-made, blue means confirmed.** Agent output is visually distinct and never becomes data without a person.
2. **The agent acts with the permissions of the person who asked, never more.**
3. **Propose, review, apply, undo.** Suggestions are shown first, applied after approval, and reversible.
4. **Show sources, confidence and what the agent could see.** Confidence is written in words and numbers, not colour alone.
5. **Locked by design:** sending email, publishing flows, completing steps, deleting or purging, changing users, roles, company profile or bank details.
6. **One pause switch, one spending cap, every run traced.**

## Screens (numbers continue from the main wireframes)

| # | Screen | Route | Purpose |
| --- | --- | --- | --- |
| 10 | Agent home | `(app)/agent` | Greeting, one input to ask or tell the agent, a prioritised briefing with evidence links and action buttons, a short review list, what the agent is doing now, a 7-day trust check |
| 11 | Ask the agent (command bar) | Ctrl K overlay | Natural-language question, answer with a source table, a proposed action that needs approval, follow-up chips, keyboard hints |
| 12 | Invoice with agent beside it | `(app)/invoices/[id]` agent rail | Document viewer with numbered evidence boxes, step form with suggested values and confidence, mismatch warning, drafted email for the person to copy, agent rail showing what it can and cannot see |
| 13 | Review queue | `(app)/agent/review` | List of pending proposals by type, a field-by-field comparison of current value and suggestion, per-field apply, Reject all, Edit in step, Apply selected |
| 14 | Agent activity and run trace | `(app)/agent/activity` | Every run with status and who it acted for; step-by-step trace, what was shared with the model, usage, audit entry, revert |
| 15 | Flow builder with agent | `(app)/flows/[id]/edit` agent panel | Describe a process in words, get a draft flow shown as a comparison against an existing version (new, changed, unchanged), one clarifying question, preview of new steps |
| 16 | Agent settings (Admin only) | `(app)/agent/settings` | Master on and pause switch, autonomy level per capability with locked rows, what the agent may see, model, monthly spending cap, trace retention |

The sidebar in the canvas shows an Agent group: Agent home, Review queue (with a count), Agent activity, Agent settings. In Release 1 this group is not built or shown; it appears when Phase 6 ships.

## How it fits the existing docs

- **Review before data.** The database doc says extracted values never overwrite confirmed data and land in a review table first. Screens 12 and 13 follow that rule.
- **Least data to the model.** The database doc says send a model only what the acting user may already see, never bank or password data. Screens 12, 14 and 16 state this and make the exclusion list locked.
- **Attributable actions.** The database doc says `audit_log` should record whether an actor was a person or a job. Screens 11, 13 and 14 show "Agent, for Asha K." entries.
- **Manual email stays manual.** The agent drafts email text. A person copies it, sends it, and confirms on the step.
- **Roles unchanged.** Admin, Builder and Viewer keep their current meaning. Only the Admin can change agent settings.
- **Excel import.** The Import from Excel button was removed from screen 3 to match the database doc.

## What this adds to the build (Phase 6)

The implementation plan (P6-02, migration 005) defines the tables; this doc follows it. In outline:

- `document_extractions` and `ai_jobs`, plus optionally `document_chunks` and `invoice_search` if document search is taken up.
- `agent_proposals`: pending, accepted, edited, rejected, with the evidence, confidence and who reviewed.
- `agent_runs` and `agent_run_steps`: the trace shown on screen 14, with the acting user and what was shared.
- `agent_settings` and `agent_capabilities`: per-capability level, spending cap, trace retention.
- `audit_log.actor_type` (person or agent) and an "on behalf of" column.

Next.js shape: a route handler streams answers (server-sent events); a model gateway applies redaction and a budget check before every call; agent tools come from a registry that excludes the locked actions and call the same permission-checked server actions people use; applying a proposal runs the normal action.

## Risks and open decisions (settled at the Phase 6 gate)

- [ ] **Cost.** The project is zero-cost, and model APIs are usually not free. Choose a provider or local model, and set a hard monthly cap before enabling anything.
- [ ] **Provider and privacy.** Documents and field names leave the system when sent to a model. Decide the provider and whether this is acceptable for business invoices. This is general information, not legal advice.
- [ ] **Accuracy.** Reading handwriting and scans will make mistakes. The design leaves low-confidence fields blank and flags mismatches, but each field still needs a person's check.
- [ ] **Autonomy creep.** The trust check on screen 10 is there to catch rising edits and rejections. Decide who watches it.
- [ ] **First capabilities.** Pick which capabilities ship first (for example document reading, then briefing).
- [x] The agent is Phase 6 (Release 2), not earlier. Decided 11 Oct 2026.
- Sample data: all names, amounts, counts and percentages in the wireframes are made up.

## Not yet designed

- Mobile layouts for the agent screens
- Empty, loading and failure states (for example the agent being paused or over its cap)
- Notifications when a run needs review
- Multi-invoice batch actions
