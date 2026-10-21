import type { ReactNode } from "react";
import { Suspense } from "react";
import { RouteProgress } from "@/components/shell/RouteProgress";
import "./auth.css";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-layout">
      <Suspense fallback={null}>
        <RouteProgress />
      </Suspense>
      <div className="auth-layout__panel">{children}</div>
    </div>
  );
}
