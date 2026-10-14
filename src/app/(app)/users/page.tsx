import { redirect } from "next/navigation";
import { requireAppUser } from "@/actions/auth";
import { usersListAction } from "@/actions/users";
import { ErrorState } from "@/components/ui";
import type { ClientUser } from "@/lib/user-dto";
import { UsersAdmin } from "./UsersAdmin";

export default async function UsersPage() {
  const user = await requireAppUser("/users");
  if (user.role !== "admin") {
    redirect("/dashboard");
  }

  let users: ClientUser[] | null = null;
  let loadError = false;

  try {
    users = (await usersListAction()) as ClientUser[];
  } catch {
    loadError = true;
  }

  if (loadError || !users) {
    return (
      <ErrorState
        title="Could not load users"
        message="Refresh the page or try again in a moment."
      />
    );
  }

  return <UsersAdmin initialUsers={users} currentUserId={user.id} />;
}
