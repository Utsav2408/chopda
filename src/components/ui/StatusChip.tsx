import type { ReactNode } from "react";
import "./ui.css";

export type StatusTone = "neutral" | "muted" | "info" | "success" | "warning" | "danger";

export type StatusChipProps = {
  children: ReactNode;
  tone?: StatusTone;
  title?: string;
};

export function StatusChip({ children, tone = "neutral", title }: StatusChipProps) {
  return (
    <span className={`ui-status-chip ui-status-chip--${tone}`} title={title}>
      {children}
    </span>
  );
}
