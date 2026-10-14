import { requireAppUser } from "@/actions/auth";
import { listFlows, type FlowListItemDTO } from "@/actions/flows";
import { FlowLibrary } from "@/components/flows";
import { ErrorState } from "@/components/ui";
import type { AppRole } from "@/lib/nav";
import { actionErrorMessage } from "@/lib/action-errors";

export default async function FlowsPage() {
  const user = await requireAppUser("/flows");

  let flows: FlowListItemDTO[] | null = null;
  let loadError: string | null = null;

  try {
    flows = await listFlows();
  } catch (err) {
    loadError = actionErrorMessage(err, "Unable to load the flow library.");
  }

  if (loadError || !flows) {
    return (
      <ErrorState
        title="Could not load flows"
        message={loadError ?? "Unable to load the flow library."}
      />
    );
  }

  return <FlowLibrary initialFlows={flows} role={user.role as AppRole} />;
}
