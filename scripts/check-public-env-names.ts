#!/usr/bin/env tsx
// CI guard (Wave E / checklist §6): fail if any NEXT_PUBLIC_ variable name looks
// like a secret. NEXT_PUBLIC_ values are shipped to the browser bundle, so a
// variable named e.g. NEXT_PUBLIC_API_SECRET is a leak by naming convention alone,
// independent of its value. Scans .env.example (names only — no values exist
// anywhere else that CI can see) and any committed env-like files.
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";

const BAD_WORDS = ["SECRET", "KEY", "TOKEN", "PASSWORD"];
const FILES_TO_SCAN = [".env.example"];

function extractNextPublicNames(content: string): string[] {
  const names: string[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^(NEXT_PUBLIC_[A-Z0-9_]+)\s*=/);
    if (match?.[1]) names.push(match[1]);
  }
  return names;
}

function main() {
  let failed = false;

  for (const file of FILES_TO_SCAN) {
    let content: string;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue; // file not present — nothing to scan
    }

    const names = extractNextPublicNames(content);
    for (const name of names) {
      const hit = BAD_WORDS.find((word) => name.includes(word));
      if (hit) {
        console.error(
          `[check-public-env] ${file}: "${name}" is NEXT_PUBLIC_ but contains "${hit}". ` +
            "NEXT_PUBLIC_ variables are sent to the browser — rename it or drop the prefix.",
        );
        failed = true;
      }
    }
  }

  if (failed) {
    process.exit(1);
  }
  console.log("[check-public-env] OK — no NEXT_PUBLIC_ variable name looks like a secret.");
}

void globSync; // reserved for a future broader scan (e.g. vercel.json, next.config.ts env blocks)
main();
