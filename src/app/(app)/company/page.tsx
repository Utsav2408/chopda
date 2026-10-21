import { requireAppUser } from "@/actions/auth";
import { companyLoadPageAction } from "@/actions/company";
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
    const page = await companyLoadPageAction();

    profile = {
      legalName: page.profile.legalName,
      gstin: page.profile.gstin,
      pan: page.profile.pan,
      invoiceDefaults: page.profile.invoiceDefaults,
      updatedAt: page.profile.updatedAt,
    };

    summary = {
      admin: page.summary.admin
        ? {
            id: page.summary.admin.id,
            username: page.summary.admin.username,
            displayName: page.summary.admin.displayName,
            role: page.summary.admin.role,
          }
        : null,
      roleCounts: page.summary.roleCounts,
    };

    banksDenied = page.banksDenied;
    banks = page.banks
      ? page.banks.map((b) => ({
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
        }))
      : null;
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
