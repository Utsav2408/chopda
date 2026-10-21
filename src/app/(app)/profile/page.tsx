import { requireAppUser } from "@/actions/auth";
import { usersGetOwnProfileAction } from "@/actions/users";
import { ErrorState } from "@/components/ui";
import type { ProfileUser } from "@/lib/profile-dto";
import { ProfileView } from "./ProfileView";

export default async function ProfilePage() {
  await requireAppUser("/profile");

  let profile: ProfileUser | null = null;
  let loadError = false;

  try {
    const user = await usersGetOwnProfileAction();
    profile = {
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.displayName,
      email: user.email,
      phone: user.phone,
      photoObjectKey: user.photoObjectKey,
      prefs: user.prefs ?? null,
    };
  } catch {
    loadError = true;
  }

  if (loadError || !profile) {
    return (
      <ErrorState
        title="Could not load profile"
        message="Refresh the page or try again in a moment."
      />
    );
  }

  return <ProfileView user={profile} />;
}
