import "server-only";

// src/server/** is the only place allowed to talk to the database or the file
// storage adapter. Every module in this tree imports "server-only" (directly or
// transitively through this file) so Next.js fails the build if client-bundled
// code ever imports it — see docs/invoice-tracker-github-repo-checklist.md §6 and
// AGENTS.md "Where things live".
//
// Nothing is exported yet: the real data access layer (DAL) lands in Phase 1
// (P1-08 withUser(tx) helper, P1-13 audit writer, etc).
export const SERVER_ONLY_MARKER = true;
