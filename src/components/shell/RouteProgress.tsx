"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ROUTE_PROGRESS_START } from "@/lib/route-progress";
import "./shell.css";

/**
 * Thin top progress bar for App Router navigations. Starts on internal link
 * click, programmatic startRouteProgress(), or browser back/forward; clears
 * when the URL settles. Complements `loading.tsx` Suspense UI.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const [active, setActive] = useState(false);
  const skipFirst = useRef(true);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!anchor || !(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname && url.search === window.location.search) {
          return;
        }
      } catch {
        return;
      }
      setActive(true);
    }

    function onStart() {
      setActive(true);
    }

    function onPopState() {
      setActive(true);
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener(ROUTE_PROGRESS_START, onStart);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(ROUTE_PROGRESS_START, onStart);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    setActive(false);
  }, [pathname, search]);

  return (
    <div className="route-progress" data-active={active ? "true" : "false"} aria-hidden="true" />
  );
}
