import { describe, expect, it } from "vitest";
import {
  MAX_UPLOAD_BYTES,
  findDuplicateByHash,
  sha256Hex,
  validateUpload,
} from "../../src/server/storage/validate-upload.js";

function pdfBytes(extra = ""): Buffer {
  return Buffer.from(`%PDF-1.4\n1 0 obj<<>>endobj\n${extra}`, "utf8");
}

function pngBytes(): Buffer {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  ]);
}

function jpegBytes(): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
}

/** Minimal ZIP local-file header + ASCII path marker for OOXML detection. */
function zipWithPath(pathInside: string): Buffer {
  const name = Buffer.from(pathInside, "utf8");
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
  header.writeUInt16LE(name.length, 26);
  return Buffer.concat([header, name, Buffer.from("payload")]);
}

describe("validateUpload (B6-04)", () => {
  it("accepts PDF, PNG, JPEG by magic bytes", () => {
    expect(validateUpload({ bytes: pdfBytes(), filename: "a.pdf" }).mimeType).toBe(
      "application/pdf",
    );
    expect(validateUpload({ bytes: pngBytes(), filename: "a.png" }).mimeType).toBe("image/png");
    expect(validateUpload({ bytes: jpegBytes(), filename: "a.jpg" }).mimeType).toBe("image/jpeg");
  });

  it("accepts DOCX and XLSX via ZIP + path markers", () => {
    expect(
      validateUpload({ bytes: zipWithPath("word/document.xml"), filename: "a.docx" }).mimeType,
    ).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(
      validateUpload({ bytes: zipWithPath("xl/workbook.xml"), filename: "a.xlsx" }).mimeType,
    ).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  });

  it("refuses wrong / unknown types", () => {
    expect(() => validateUpload({ bytes: Buffer.from("hello"), filename: "x.bin" })).toThrow(
      /not allowed/,
    );
  });

  it("refuses spoofed extension (text named .pdf)", () => {
    expect(() =>
      validateUpload({ bytes: Buffer.from("not a pdf"), filename: "invoice.pdf" }),
    ).toThrow(/not allowed/);
  });

  it("refuses oversize uploads", () => {
    const big = Buffer.alloc(MAX_UPLOAD_BYTES + 1, 0x25); // start with '%' so PDF-ish but size wins
    big[0] = 0x25;
    big[1] = 0x50;
    big[2] = 0x44;
    big[3] = 0x46;
    expect(() => validateUpload({ bytes: big, filename: "big.pdf" })).toThrow(/size cap/);
  });

  it("computes stable sha256", () => {
    const bytes = pdfBytes("stable");
    const result = validateUpload({ bytes });
    expect(result.sha256).toBe(sha256Hex(bytes));
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("findDuplicateByHash detects matching hashes", () => {
    const hash = sha256Hex(pdfBytes());
    expect(findDuplicateByHash(hash, [hash])).toBe(true);
    expect(findDuplicateByHash(hash, ["other"])).toBe(false);
  });
});
