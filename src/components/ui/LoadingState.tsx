import "./ui.css";

export type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label = "Loading…" }: LoadingStateProps) {
  return (
    <div className="ui-loading" role="status" aria-live="polite" aria-busy="true">
      <span className="ui-loading__spinner" aria-hidden="true" />
      <div className="ui-loading__label">{label}</div>
    </div>
  );
}
