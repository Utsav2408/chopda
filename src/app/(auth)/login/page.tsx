import { redirect } from "next/navigation";
import { getOptionalCurrentUser } from "@/actions/auth";
import { LoginForm } from "./LoginForm";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

function safeNextPath(raw: string | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  if (raw === "/login" || raw.startsWith("/login?")) return "/dashboard";
  return raw;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  const user = await getOptionalCurrentUser();

  if (user) {
    redirect(user.mustChangePassword ? "/change-password" : nextPath);
  }

  return (
    <>
      <p className="auth-layout__brand">Chopda</p>
      <h1>Sign in</h1>
      <p className="auth-layout__lede">
        Use the username and password your Admin gave you to open the tracker.
      </p>
      <LoginForm nextPath={nextPath} />
    </>
  );
}
