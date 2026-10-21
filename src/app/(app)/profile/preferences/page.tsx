import { requireAppUser } from "@/actions/auth";
import { usersGetOwnProfileAction } from "@/actions/users";
import { ErrorState } from "@/components/ui";
import { parseReminderPrefs } from "@/lib/profile-dto";
import { PreferencesView } from "./PreferencesView";

export default async function ProfilePreferencesPage() {
  await requireAppUser("/profile/preferences");

  let prefs = parseReminderPrefs(null);
  let loadError = false;

  try {
    const user = await usersGetOwnProfileAction();
    prefs = parseReminderPrefs(user.prefs ?? null);
  } catch {
    loadError = true;
  }

  if (loadError) {
    return (
      <ErrorState
        title="Could not load preferences"
        message="Refresh the page or try again in a moment."
      />
    );
  }

  return <PreferencesView prefs={prefs} />;
}
