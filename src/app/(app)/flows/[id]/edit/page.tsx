import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAppUser } from "@/actions/auth";
import { getFlow, type FlowDetailDTO } from "@/actions/flows";
import { FlowBuilder } from "@/components/flows";
import { ErrorState } from "@/components/ui";
import { actionErrorMessage } from "@/lib/action-errors";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function FlowEditPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireAppUser(`/flows/${id}/edit`);
  const canEdit = user.role === "admin" || user.role === "builder";

  let flow: FlowDetailDTO | null = null;
  let loadError: string | null = null;

  try {
    flow = await getFlow(id);
  } catch (err) {
    const message = actionErrorMessage(err, "Unable to load this flow.");
    if (message === "Not found") {
      notFound();
    }
    loadError = message;
  }

  if (loadError || !flow) {
    return (
      <ErrorState
        title="Could not open flow builder"
        message={loadError ?? "Unable to load this flow."}
        action={
          <Link className="ui-btn ui-btn--ghost" href="/flows">
            Back to flows
          </Link>
        }
      />
    );
  }

  return <FlowBuilder initialFlow={flow} canEdit={canEdit} />;
}
