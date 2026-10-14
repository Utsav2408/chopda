import { describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import { createR2StorageAdapter } from "../../../src/server/storage/r2.js";

function mockClient(handlers: Record<string, (input: unknown) => Promise<unknown>>) {
  return {
    send: vi.fn(async (command: { constructor: { name: string }; input: unknown }) => {
      const name = command.constructor.name;
      const handler = handlers[name];
      if (!handler) throw new Error(`Unexpected command: ${name}`);
      return handler(command.input);
    }),
  };
}

describe("R2StorageAdapter (B9-08d)", () => {
  const env = {
    accountId: "acct",
    bucket: "test-bucket",
    accessKeyId: "key",
    secretAccessKey: "secret",
  };

  it("put sends a single PutObject with STANDARD storage class", async () => {
    const client = mockClient({
      PutObjectCommand: async (input) => {
        expect(input).toMatchObject({
          Bucket: "test-bucket",
          Key: "documents/doc-1",
          StorageClass: "STANDARD",
          ContentType: "application/pdf",
        });
        return {};
      },
    });
    const adapter = createR2StorageAdapter({
      env,
      client: client as never,
      trackOps: false,
    });
    await adapter.put("doc-1", Buffer.from("%PDF"), { contentType: "application/pdf" });
    expect(client.send).toHaveBeenCalledTimes(1);
  });

  it("getStream returns a Readable from GetObject body", async () => {
    const payload = Buffer.from("hello-r2");
    const client = mockClient({
      GetObjectCommand: async () => ({
        Body: Readable.from([payload]),
      }),
    });
    const adapter = createR2StorageAdapter({
      env,
      client: client as never,
      trackOps: false,
    });
    const stream = await adapter.getStream("doc-1");
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    expect(Buffer.concat(chunks).equals(payload)).toBe(true);
  });

  it("healthCheck uses HeadBucket only", async () => {
    const client = mockClient({
      HeadBucketCommand: async (input) => {
        expect(input).toEqual({ Bucket: "test-bucket" });
        return {};
      },
    });
    const adapter = createR2StorageAdapter({
      env,
      client: client as never,
      trackOps: false,
    });
    await adapter.healthCheck();
    expect(client.send).toHaveBeenCalledTimes(1);
  });

  it("delete uses DeleteObject", async () => {
    const client = mockClient({
      DeleteObjectCommand: async (input) => {
        expect(input).toEqual({ Bucket: "test-bucket", Key: "documents/doc-x" });
        return {};
      },
    });
    const adapter = createR2StorageAdapter({
      env,
      client: client as never,
      trackOps: false,
    });
    await adapter.delete("doc-x");
  });

  it("exists uses HeadObject and maps 404 to false", async () => {
    const notFound = Object.assign(new Error("NotFound"), {
      name: "NotFound",
      $metadata: { httpStatusCode: 404 },
    });
    const client = mockClient({
      HeadObjectCommand: async () => {
        throw notFound;
      },
    });
    const adapter = createR2StorageAdapter({
      env,
      client: client as never,
      trackOps: false,
    });
    expect(await adapter.exists("missing")).toBe(false);
  });

  it("rejects path-traversal keys before any S3 call", async () => {
    const client = mockClient({});
    const adapter = createR2StorageAdapter({
      env,
      client: client as never,
      trackOps: false,
    });
    await expect(adapter.put("../escape", "nope")).rejects.toThrow(/outside the storage root/);
    expect(client.send).not.toHaveBeenCalled();
  });
});
