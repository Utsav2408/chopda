import type { FormEvent, ReactNode } from "react";
import "./ui.css";

export type FilterBarProps = {
  children: ReactNode;
  actions?: ReactNode;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  ariaLabel?: string;
};

export function FilterBar({ children, actions, onSubmit, ariaLabel = "Filters" }: FilterBarProps) {
  return (
    <form className="ui-filter-bar" aria-label={ariaLabel} onSubmit={onSubmit}>
      {children}
      {actions ? <div className="ui-filter-bar__actions">{actions}</div> : null}
    </form>
  );
}

export function FilterField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="ui-filter-bar__field">
      <label className="ui-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}
