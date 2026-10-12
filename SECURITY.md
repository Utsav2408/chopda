# Security Policy

Chopda is a solo-maintained, public repository. Security reports are welcome and
taken seriously even though there is no dedicated security team.

## Reporting a vulnerability

**Do not open a public GitHub issue for a security vulnerability.**

Instead, use one of these private channels:

1. **Preferred:** use GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability)
   feature on this repository (Security tab → "Report a vulnerability"). This opens a
   private advisory visible only to the maintainer.
2. **Alternative:** email the maintainer with a description of the issue, steps to
   reproduce, and any proof-of-concept. Do not include real customer data, invoice
   contents, or credentials in the report — synthetic examples are fine.

## What to expect

- Acknowledgement: best effort within a few days.
- This is a side project maintained by one person; there is no formal SLA, but
  reports are prioritized over feature work.
- Please give a reasonable time window to fix the issue before any public disclosure.

## Scope

- This repository's application code, infrastructure-as-code, and CI/CD workflows.
- Out of scope: third-party services the app depends on (Vercel, Neon, GitHub) —
  report those directly to the vendor.

## Supported versions

Only the `main` branch is maintained. There are no released/tagged versions to
backport fixes to while the project is pre-1.0.
