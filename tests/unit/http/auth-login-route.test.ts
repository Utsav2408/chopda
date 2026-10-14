import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/server/auth", async () => {
  const actual = await vi.importActual<typeof import("../../../src/server/auth/index.js")>(
    "../../../src/server/auth/index.js",
  );
  return {
    ...actual,
    login: vi.fn(),
  };
});

import { POST } from "../../../src/app/api/auth/login/route.js";
import { login, SESSION_COOKIE_NAME } from "@/server/auth";

describe("POST /api/auth/login (B3-03)", () => {
  beforeEach(() => {
    vi.mocked(login).mockReset();
  });

  it("returns 200 and sets session cookie on success", async () => {
    vi.mocked(login).mockResolvedValue({
      token: "session-token",
      sessionId: "22222222-2222-4222-8222-222222222222",
      expiresAt: new Date("2026-12-01T00:00:00.000Z"),
      user: {
        id: "11111111-1111-4111-8111-111111111111",
        username: "alice",
        role: "builder",
        displayName: "Alice",
        mustChangePassword: false,
      },
    });

    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost",
      },
      body: JSON.stringify({ username: "alice", password: "correct-password-long" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(SESSION_COOKIE_NAME);
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
    const body = (await response.json()) as { user: { username: string } };
    expect(body.user.username).toBe("alice");
  });

  it("returns 401 on failed login", async () => {
    const { Unauthenticated } = await import("../../../src/server/kernel/errors.js");
    vi.mocked(login).mockRejectedValue(new Unauthenticated("Invalid username or password"));

    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost",
      },
      body: JSON.stringify({ username: "alice", password: "wrong-password-xx" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });
});
