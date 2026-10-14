/**
 * Map kernel AppError types to HTTP JSON responses for thin route handlers.
 */
import { NextResponse } from "next/server";
import {
  Conflict,
  Forbidden,
  Internal,
  NotFound,
  RateLimited,
  Unauthenticated,
  Validation,
} from "../kernel/errors.js";

export function jsonError(err: unknown): NextResponse {
  if (err instanceof Unauthenticated) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
  if (err instanceof RateLimited) {
    return NextResponse.json({ error: err.message }, { status: 429 });
  }
  if (err instanceof Validation) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  if (err instanceof Conflict) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
  // Forbidden and NotFound share the same public message (B0-09).
  if (err instanceof Forbidden || err instanceof NotFound) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (err instanceof Internal) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
