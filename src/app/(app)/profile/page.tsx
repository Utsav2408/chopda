import { requireAppUser } from "@/actions/auth";
import { sessionsListOwnAction, usersGetOwnProfileAction } from "@/actions/users";
import { ErrorState } from "@/components/ui";
import type { ClientSession, ProfileUser } from "@/lib/profile-dto";
import { ProfileView } from "./ProfileView";

export default async function ProfilePage() {
  await requireAppUser("/profile");

  let profile: ProfileUser | null = null;
  let sessions: ClientSession[] | null = null;
  let loadError = false;

  try {
    const [user, sessionResult] = await Promise.all([
      usersGetOwnProfileAction(),
      sessionsListOwnAction(),
    ]);

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

    sessions = sessionResult.sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ip: s.ip,
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      expiresAt: s.expiresAt,
      revokedAt: s.revokedAt,
      isCurrent: s.id === sessionResult.currentSessionId,
    }));
  } catch {
    loadError = true;
  }

  if (loadError || !profile || !sessions) {
    return (
      <ErrorState
        title="Could not load profile"
        message="Refresh the page or try again in a moment."
      />
    );
  }

  return <ProfileView user={profile} sessions={sessions} />;
}
