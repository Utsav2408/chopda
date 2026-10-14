import "./ui.css";

export type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label = "Loading…" }: LoadingStateProps) {
  return (
    <div className="ui-state" role="status" aria-live="polite" aria-busy="true">
      <div className="ui-state__title">{label}</div>
    </div>
  );
}
