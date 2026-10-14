export function PagePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <div className="app-shell__placeholder">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}
