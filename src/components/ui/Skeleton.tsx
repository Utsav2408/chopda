import type { CSSProperties } from "react";
import "./ui.css";

export type SkeletonProps = {
  className?: string;
  width?: string | number;
  height?: string | number;
  /** Rounded pill vs block. Default block. */
  rounded?: "sm" | "md" | "full";
  style?: CSSProperties;
};

export function Skeleton({ className, width, height, rounded = "md", style }: SkeletonProps) {
  return (
    <span
      className={["ui-skeleton", `ui-skeleton--${rounded}`, className].filter(Boolean).join(" ")}
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  );
}
