import { describe, expect, it } from "vitest";
import {
  storageBytesAlert,
  STORAGE_BYTES_ALERT_THRESHOLD,
  STORAGE_CLASS_A_MONTHLY_LIMIT,
  STORAGE_CLASS_B_MONTHLY_LIMIT,
} from "../../../src/server/storage/ops-counter.js";

describe("storage ops counter helpers (B9-08g)", () => {
  it("exposes free-tier limits", () => {
    expect(STORAGE_CLASS_A_MONTHLY_LIMIT).toBe(1_000_000);
    expect(STORAGE_CLASS_B_MONTHLY_LIMIT).toBe(10_000_000);
    expect(STORAGE_BYTES_ALERT_THRESHOLD).toBe(8 * 1024 * 1024 * 1024);
  });

  it("storageBytesAlert trips above 8GB", () => {
    expect(storageBytesAlert(0)).toBe(false);
    expect(storageBytesAlert(STORAGE_BYTES_ALERT_THRESHOLD)).toBe(false);
    expect(storageBytesAlert(STORAGE_BYTES_ALERT_THRESHOLD + 1)).toBe(true);
    expect(storageBytesAlert(String(STORAGE_BYTES_ALERT_THRESHOLD + 1))).toBe(true);
  });
});
