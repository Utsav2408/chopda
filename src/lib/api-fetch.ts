/**
 * Same-origin fetch that sends cookies and, on 401, clears a stale session
 * via session-gone then lands on login (with optional next= path).
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  opts?: { nextPath?: string },
): Promise<Response> {
  const res = await fetch(input, {
    ...init,
    credentials: init?.credentials ?? "same-origin",
  });
  if (res.status === 401 && typeof window !== "undefined") {
    const next = opts?.nextPath ?? `${window.location.pathname}${window.location.search}`;
    const gone = next
      ? `/api/auth/session-gone?next=${encodeURIComponent(next)}`
      : "/api/auth/session-gone";
    window.location.assign(gone);
  }
  return res;
}
