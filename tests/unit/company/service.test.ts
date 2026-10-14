import { describe, expect, it, vi } from "vitest";
import { get, listBanks, update } from "../../../src/server/company/service.js";
import type { RequestContext } from "../../../src/server/db/with-user.js";
import { Forbidden, Unauthenticated } from "../../../src/server/kernel/errors.js";
import type { CompanyProfileRow } from "../../../src/server/company/repo.js";

function ctx(role: RequestContext["role"]): RequestContext {
  return {
    userId: "33333333-3333-4333-8333-333333333333",
    role,
    requestId: "req-company",
  };
}

const profileRow: CompanyProfileRow = {
  id: 1,
  legalName: "Chopda Trading",
  gstin: "22AAAAA0000A1Z5",
  panEncrypted: "v1:nonce:cipher",
  invoiceDefaults: {},
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("company.get / update (B8-01)", () => {
  it("signed-out get is Unauthenticated", async () => {
    await expect(get(null)).rejects.toBeInstanceOf(Unauthenticated);
  });

  it("admin get includes decrypted PAN; builder excludes PAN", async () => {
    const deps = {
      getCompanyProfile: async () => profileRow,
      decryptField: () => "ABCDE1234F",
    };
    const adminView = await get(ctx("admin"), deps);
    expect(adminView.pan).toBe("ABCDE1234F");
    expect(adminView).not.toHaveProperty("panEncrypted");
    expect(JSON.stringify(adminView)).not.toMatch(/cipher|panEncrypted|pan_encrypted/i);

    const builderView = await get(ctx("builder"), deps);
    expect(builderView).not.toHaveProperty("pan");
    expect(builderView.gstin).toBe("22AAAAA0000A1Z5");
    expect(JSON.stringify(builderView)).not.toMatch(/ABCDE1234F|cipher|panEncrypted/i);
  });

  it("viewer/builder cannot update; admin encrypts PAN", async () => {
    await expect(update(ctx("viewer"), { legalName: "X" })).rejects.toBeInstanceOf(Forbidden);
    await expect(update(ctx("builder"), { legalName: "X" })).rejects.toBeInstanceOf(Forbidden);

    const encryptField = vi.fn(() => "v1:n:c");
    const upsert = vi.fn(
      async (input: {
        legalName: string;
        gstin: string | null;
        panEncrypted: string | null;
        invoiceDefaults: Record<string, unknown>;
      }) => ({
        ...profileRow,
        legalName: input.legalName,
        gstin: input.gstin,
        panEncrypted: input.panEncrypted,
        invoiceDefaults: input.invoiceDefaults,
      }),
    );

    const result = await update(
      ctx("admin"),
      { legalName: "Chopda Trading", pan: "ABCDE1234F", gstin: "22AAAAA0000A1Z5" },
      {
        getCompanyProfile: async () => null,
        upsertCompanyProfile: upsert,
        encryptField,
        decryptField: () => "ABCDE1234F",
        writeAudit: async () => undefined,
      },
    );

    expect(encryptField).toHaveBeenCalledWith("ABCDE1234F");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        panEncrypted: "v1:n:c",
        gstin: "22AAAAA0000A1Z5",
      }),
    );
    expect(result.pan).toBe("ABCDE1234F");
    expect(result).not.toHaveProperty("panEncrypted");
  });
});

describe("company.listBanks (B8-02)", () => {
  it("viewer is Forbidden", async () => {
    await expect(listBanks(ctx("viewer"))).rejects.toBeInstanceOf(Forbidden);
  });

  it("builder receives decrypted fields, never ciphertext keys", async () => {
    const view = await listBanks(ctx("builder"), {
      listBankAccounts: async () => [
        {
          id: "55555555-5555-4555-8555-555555555555",
          label: "Ops",
          bankName: "State Bank",
          accountHolder: "Chopda Trading",
          branch: null,
          accountNumberEncrypted: "enc-acct",
          ifscEncrypted: "enc-ifsc",
          isDefault: true,
          isActive: true,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
      decryptField: (c) => (c === "enc-acct" ? "1234567890" : "SBIN0001234"),
    });
    expect(view).toHaveLength(1);
    expect(view[0]!.accountNumber).toBe("1234567890");
    expect(view[0]!.ifsc).toBe("SBIN0001234");
    expect(view[0]!).not.toHaveProperty("accountNumberEncrypted");
    expect(view[0]!).not.toHaveProperty("ifscEncrypted");
    expect(JSON.stringify(view)).not.toMatch(/Encrypted|ciphertext|_encrypted/i);
  });
});
