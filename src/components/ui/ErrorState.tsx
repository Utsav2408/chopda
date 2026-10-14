import type { ReactNode } from "react";
import "./ui.css";

export type ErrorStateProps = {
  title?: string;
  message: string;
  action?: ReactNode;
};

export function ErrorState({ title = "Something went wrong", message, action }: ErrorStateProps) {
  return (
    <div className="ui-state ui-state--error" role="alert">
      <div className="ui-state__title">{title}</div>
      <p className="ui-state__body">{message}</p>
      {action}
    </div>
  );
}
