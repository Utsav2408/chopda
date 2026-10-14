import { redirect } from "next/navigation";
import { requireAppUser } from "@/actions/auth";
import { getSettingsHealthAction } from "@/actions/settings";
import { ErrorState } from "@/components/ui";
import { RoleMatrixPanel } from "./RoleMatrixPanel";
import { StorageBackupPanel } from "./StorageBackupPanel";
import "./settings.css";

export default async function SettingsPage() {
  const user = await requireAppUser("/settings");
  if (user.role !== "admin") {
    redirect("/dashboard");
  }

  let health;
  try {
    health = await getSettingsHealthAction();
  } catch {
    return (
      <ErrorState
        title="Could not load settings"
        message="Health probes failed. Refresh or check storage and database connectivity."
      />
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-page__intro">
        <h2>Settings</h2>
        <p>Team permissions and storage health for this deployment.</p>
      </div>
      <RoleMatrixPanel />
      <StorageBackupPanel health={health} />
    </div>
  );
}
