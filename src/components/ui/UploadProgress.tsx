import "./ui.css";

export type UploadProgressProps = {
  label?: string;
};

/** Indeterminate thin bar for file uploads (loader type F). */
export function UploadProgress({ label = "Uploading…" }: UploadProgressProps) {
  return (
    <div className="ui-upload-progress-wrap" role="status" aria-live="polite" aria-busy="true">
      <p className="ui-hint" style={{ margin: "0.5rem 0 0" }}>
        {label}
      </p>
      <div className="ui-upload-progress" aria-hidden="true">
        <span className="ui-upload-progress__bar" />
      </div>
    </div>
  );
}
