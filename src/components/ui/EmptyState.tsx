import type { ReactNode } from "react";
import "./ui.css";

export type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="ui-state" role="status">
      <div className="ui-state__title">{title}</div>
      {description ? <p className="ui-state__body">{description}</p> : null}
      {action}
    </div>
  );
}
