# Invoice Tracker: Idea, Problem, Research and Solution

Draft dated 2026-10-11. Source doc: https://claude.ai/code/artifact/6bdf9415-ecde-4240-9b21-c6f13e90b01a

## Idea

A small private web app where our team defines its own step-by-step flows for invoices, then tracks every invoice through those flows with its documents attached.

The flow is the product, not the invoice. Different invoices need different steps, so the team builds a checklist-style flow once and reuses it. For example:

- **Standard delivery:** invoice raised, upload it, delivery challan uploaded, email sent, payment verified, completed.
- **Courier delivery:** invoice raised, upload it, delivery challan uploaded, courier arranged and email sent, payment verified, completed.

The two flows differ in one step. Users should be able to create, change and reuse flows without a developer, and fill in details on each step as real work gets done.

## Problem

We track a growing number of invoices in Excel sheets and folders on local laptops, and it has become overwhelming and time-consuming.

This setup works for a handful of invoices and strains as volume grows. Typical weak points are:

- **No single view of status.** Whether an invoice has been delivered, paid or is waiting on something means opening several files.
- **Documents live on individual laptops.** Challans, emails and proofs are scattered, hard to share and easy to lose.
- **Process lives in people's heads.** Each invoice follows steps that are not written down or enforced, and the steps differ by type.
- **No history.** It is hard to see who did what and when.

We do not own an invoice tracker and do not want to pay for one.

### Constraints

- Zero cost: open-source libraries, frameworks and free deployment spaces.
- Private: authenticated and authorised, so outsiders cannot easily get in.
- Small team: 3 to 5 users to start.

## Research

Existing open-source invoicing tools are built to create and send invoices, not to track a custom process around received paperwork, so none fits our need directly.

Findings are from web search results in October 2026 and were not re-checked on each vendor's own site.

### Existing tools

| Tool | Built for | Licence found |
| --- | --- | --- |
| [Invoice Ninja](https://www.opensourcealternatives.to/item/invoiceninja) | Invoices, quotes, expenses, time tracking, client portal, payment gateways | Elastic License 2.0 (source-available, not OSI open source) |
| [InvoiceShelf](https://github.com/InvoiceShelf/InvoiceShelf) | Invoices, estimates, expenses and payments; a maintained fork of the archived Crater | AGPL v3 |
| [InvoicePlane](https://selfhostedworld.com/software/invoiceplane) | Quotes, invoices, clients, payments | MIT |
| [SolidInvoice](https://selfhostedworld.com/software/solidinvoice) | Clients, quotes, invoices, online payments | MIT |

Larger suites such as ERPNext also handle recurring invoices but are far bigger than we need ([comparison](https://www.ssdnodes.com/learn/self-hosted-invoicing-software)). All of these assume a fixed billing workflow. None lets a team define its own step-by-step flow per invoice type.

One point from the same comparison applies to us: the invoice database is the one whose loss becomes a tax problem, so backups matter from day one.

### Free services

| Need | Option | Free allowance | Catch |
| --- | --- | --- | --- |
| App hosting | [Vercel Hobby](https://thesearchsherpa.com/?p=2188) | $0, one seat | Terms limit it to personal, non-commercial use; the site pauses at usage limits |
| Database | [Neon](https://neon.com/faqs/managed-postgres-databases-free-tier) | 0.5 GB, permanent | Cold starts after idle |
| Database | [Supabase](https://makerkit.dev/blog/md/saas/supabase-pricing) | 500 MB | Pauses after a week of inactivity |
| File storage | [Google Drive API](https://developers.google.com/drive/api/guides/limits?authuser=6) | Standard API use is free | [Service accounts have no storage of their own](https://docs.weweb.io/integrations/googledrive.html), and the OAuth setup takes more work than first expected |
| File storage (alternative) | [Cloudflare R2](https://agentdeals.dev/vendor/cloudflare-r2) | 10 GB, free egress | None noted |
| File storage (while building) | A local folder on the developer's machine | $0 | Test data only: no backups, and not kept on serverless hosting such as Vercel |

Takeaway: a zero-cost stack is possible, and every free option has limits that we should treat as known risks rather than surprises.

## Solution

Build a lean custom tracker around user-defined flows, on a zero-cost stack, for our own team of 3 to 5 people.

### What it does

- Lets users define reusable flows: an ordered list of steps, each asking for the right detail (an uploaded document, a few fields, a confirmation).
- Lets users start an invoice on a flow and complete its steps as work happens, attaching documents along the way.
- Shows the status of every invoice at a glance: where it is, what is waiting, what is done.
- Keeps a history of who completed each step and when.
- Emails are handled manually at first: the user sends the email themselves and records it on the step.

### Who uses it

Only our team, 3 to 5 people. Sign-in is by username and password, with role-based access so people see and do only what their role allows. Proposed roles, to be confirmed: an admin who manages users and flows, members who work on invoices, and viewers with read-only access.

### Starting choices

| Area | Decision for now |
| --- | --- |
| Application | Next.js |
| Hosting | Vercel Hobby |
| Files | A local folder while building, with the database holding only references to files. Before the app is deployed, we switch to a reliable store (Google Drive or Cloudflare R2) first, and only then proceed |
| Email | Manual, recorded on the step |
| Security | Username and password plus role-based access |
| Users | 3 to 5 |

### Phases

1. **Foundation:** sign-in, roles and the basic app.
2. **Core tracker:** build flows, run invoices through them, attach documents (stored in a local folder until deployment).
3. **Overview:** status views, due and payment reminders, moving existing Excel data in.
4. **Later:** stronger sign-in, automated emails, AI-assisted reading of invoices, and a change of hosting or storage if limits are hit.

A reliable file store must be in place before any deployment that accepts uploads, and before real data goes in.

### Risks and open items

- **Vercel Hobby terms.** The plan is limited to personal, non-commercial use, and using it for business invoices may breach it. We are proceeding for now, and the hosting choice should be revisited before real business data goes in.
- **Local file folder.** A local folder is for test data only. It has no backups, it is lost with the machine, and serverless hosting does not keep it between requests or deploys. We switch to a reliable store before deploying.
- **Go-live file store.** If Google Drive is chosen, service accounts have no storage of their own, so we must decide whose Drive account holds the files, and files tied to one person's account are a continuity risk. Cloudflare R2 is the alternative.
- **Private files.** Files must stay private, with access only through the app after a permission check.
- **Free database limits.** Free tiers can pause or start slowly after idle time.
- **Password-only sign-in** is a starting point, not the end state.
- **Backups** of data and files need a plan before real data goes in.

Open questions:

- [ ] Which roles and permissions do we need?
- [ ] Which reliable file store will we use at go-live (Google Drive or Cloudflare R2), and whose account holds it?
- [ ] How much existing invoice data must be imported?
