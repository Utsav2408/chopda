/**
 * Coarse session-cookie gate (B2-10 / U2). Cookie presence only — never hits the DB.
 * Real auth/role checks live in server actions and route handlers.
 */
import { NextResponse, type NextRequest } from "next/server";
// No ".js" suffix: Turbopack middleware resolution does not remap it.
import { SESSION_COOKIE_NAME } from "./server/security/constants";

/** Paths that never require a session cookie. */
const PUBLIC_PATHS = new Set(["/api/health", "/health"]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  // Allow the marketing/home placeholder without a session for now.
  if (pathname === "/") return true;
  return false;
}

/** App-shell routes that require a session cookie (route groups are not in the URL). */
function isAppPath(pathname: string): boolean {
  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname.startsWith("/invoices") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/flows") ||
    pathname.startsWith("/company") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/users") ||
    pathname.startsWith("/settings")
  );
}

function redirectToLogin(request: NextRequest, pathname: string): NextResponse {
  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  // Signed-in (cookie present) users leave the login screen (U2-01).
  // Stale cookies are cleared via /api/auth/session-gone when resolve fails.
  if (pathname === "/login") {
    if (token) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // Forced password change requires a session (U2-02).
  if (pathname === "/change-password" || pathname.startsWith("/change-password/")) {
    if (!token) {
      return redirectToLogin(request, pathname);
    }
    return NextResponse.next();
  }

  if (isPublicPath(pathname) || !isAppPath(pathname)) {
    return NextResponse.next();
  }

  if (!token) {
    return redirectToLogin(request, pathname);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/change-password",
    "/change-password/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/invoices",
    "/invoices/:path*",
    "/admin",
    "/admin/:path*",
    "/flows",
    "/flows/:path*",
    "/company",
    "/company/:path*",
    "/profile",
    "/profile/:path*",
    "/users",
    "/users/:path*",
    "/settings",
    "/settings/:path*",
  ],
};
