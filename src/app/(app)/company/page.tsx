import { requireAppUser } from "@/actions/auth";
import { companyGetAction, companyListBanksAction, companySummaryAction } from "@/actions/company";
import { ErrorState } from "@/components/ui";
import type {
  ClientBankAccount,
  ClientCompanyProfile,
  ClientCompanySummary,
} from "@/lib/company-dto";
import type { AppRole } from "@/lib/nav";
import { CompanyView } from "./CompanyView";

export default async function CompanyPage() {
  const user = await requireAppUser("/company");

  let profile: ClientCompanyProfile | null = null;
  let summary: ClientCompanySummary | null = null;
  let banks: ClientBankAccount[] | null = null;
  let banksDenied = false;
  let loadError = false;

  try {
    const [profileRaw, summaryRaw] = await Promise.all([
      companyGetAction(),
      companySummaryAction(),
    ]);

    profile = {
      legalName: profileRaw.legalName,
      gstin: profileRaw.gstin,
      pan: profileRaw.pan,
      invoiceDefaults: profileRaw.invoiceDefaults,
      updatedAt: profileRaw.updatedAt,
    };

    summary = {
      admin: summaryRaw.admin
        ? {
            id: summaryRaw.admin.id,
            username: summaryRaw.admin.username,
            displayName: summaryRaw.admin.displayName,
            role: summaryRaw.admin.role,
          }
        : null,
      roleCounts: summaryRaw.roleCounts,
    };

    if (user.role === "viewer") {
      banksDenied = true;
    } else {
      try {
        const listed = await companyListBanksAction();
        banks = listed.map((b) => ({
          id: b.id,
          label: b.label,
          bankName: b.bankName,
          accountHolder: b.accountHolder,
          branch: b.branch,
          accountNumber: b.accountNumber,
          ifsc: b.ifsc,
          isDefault: b.isDefault,
          isActive: b.isActive,
          createdAt: b.createdAt,
          updatedAt: b.updatedAt,
        }));
      } catch {
        banksDenied = true;
      }
    }
  } catch {
    loadError = true;
  }

  if (loadError || !profile || !summary) {
    return (
      <ErrorState
        title="Could not load company profile"
        message="Refresh the page or try again in a moment."
      />
    );
  }

  return (
    <CompanyView
      role={user.role as AppRole}
      profile={profile}
      summary={summary}
      banks={banks}
      banksDenied={banksDenied}
    />
  );
}
