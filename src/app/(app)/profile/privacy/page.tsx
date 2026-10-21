import { requireAppUser } from "@/actions/auth";
import { sessionsListOwnAction } from "@/actions/users";
import { ErrorState } from "@/components/ui";
import type { ClientSession } from "@/lib/profile-dto";
import { PrivacyView } from "./PrivacyView";

export default async function ProfilePrivacyPage() {
  await requireAppUser("/profile/privacy");

  let sessions: ClientSession[] | null = null;
  let loadError = false;

  try {
    const sessionResult = await sessionsListOwnAction();
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

  if (loadError || !sessions) {
    return (
      <ErrorState
        title="Could not load privacy settings"
        message="Refresh the page or try again in a moment."
      />
    );
  }

  return <PrivacyView sessions={sessions} />;
}
