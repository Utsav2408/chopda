import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        maxWidth: "36rem",
        margin: "4rem auto",
        padding: "0 1rem",
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "2.5rem",
          color: "var(--brand-800)",
          marginBottom: "0.5rem",
        }}
      >
        Chopda
      </h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "1.5rem" }}>
        Private invoice tracker. Sign in to open the app shell.
      </p>
      <p>
        <Link className="ui-btn" href="/login">
          Sign in
        </Link>
      </p>
    </main>
  );
}
