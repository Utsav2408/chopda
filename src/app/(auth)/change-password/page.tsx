import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/actions/auth";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function ChangePasswordPage() {
  const user = await requireCurrentUser("/change-password");

  if (!user.mustChangePassword) {
    redirect("/dashboard");
  }

  return (
    <>
      <p className="auth-layout__brand">Chopda</p>
      <h1>Change password</h1>
      <p className="auth-layout__lede">
        Your account requires a new password before you can continue
        {user.displayName ? ` as ${user.displayName}` : ""}.
      </p>
      <ChangePasswordForm />
    </>
  );
}
