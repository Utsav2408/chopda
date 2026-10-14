import { randomBytes } from "node:crypto";

/**
 * Generate a request correlation id (B0-09): `req_` + 32 hex chars.
 */
export function generateRequestId(): string {
  return `req_${randomBytes(16).toString("hex")}`;
}
