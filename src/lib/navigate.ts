"use client";

import { useRouter } from "next/navigation";
import { startRouteProgress } from "@/lib/route-progress";

/**
 * App Router helpers that start the top progress bar before navigating.
 * Prefer this over raw router.push/replace for in-app transitions.
 */
export function useAppNavigate() {
  const router = useRouter();

  return {
    push(href: string) {
      startRouteProgress();
      router.push(href);
    },
    replace(href: string) {
      startRouteProgress();
      router.replace(href);
    },
    refresh() {
      router.refresh();
    },
  };
}
