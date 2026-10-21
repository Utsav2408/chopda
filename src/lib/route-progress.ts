/**
 * Programmatic signal for the top route progress bar.
 * Link clicks are handled by RouteProgress itself; call this before
 * router.push / router.replace so those navigations show the same bar.
 */
export const ROUTE_PROGRESS_START = "chopda:route-progress-start";

export function startRouteProgress(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ROUTE_PROGRESS_START));
}
