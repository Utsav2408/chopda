/**
 * Cloudflare R2 storage adapter (B9-08d).
 *
 * S3-compatible client rules (see docs/invoice-tracker-cloudflare-r2-agent-guide.md):
 * - One PutObject per file (never multipart / @aws-sdk/lib-storage Upload)
 * - GetObject streams; no HeadObject before get
 * - healthCheck = HeadBucket only (never list)
 * - StorageClass STANDARD only
 * - Deletes are free; still counted nowhere (Class A/B)
 */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { toObjectKey } from "./object-key.js";
import { incrementStorageOps } from "./ops-counter.js";
import type { StorageAdapter, StoragePutOptions } from "./types.js";

export type R2Env = {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export type R2AdapterOptions = {
  env?: R2Env;
  /** Injected client for unit tests. */
  client?: S3Client;
  /** When false, skip Postgres ops counter (tests). Default true. */
  trackOps?: boolean;
};

function resolveR2Env(env?: R2Env): R2Env {
  if (env) return env;
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 storage requires R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY",
    );
  }
  return { accountId, bucket, accessKeyId, secretAccessKey };
}

export function createR2S3Client(env: R2Env, overrides?: Partial<S3ClientConfig>): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${env.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
    // Avoid extra checksum headers that can break older R2 signatures.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    ...overrides,
  });
}

function toBuffer(data: Buffer | Uint8Array | string): Buffer {
  if (typeof data === "string") return Buffer.from(data, "utf8");
  return Buffer.isBuffer(data) ? data : Buffer.from(data);
}

export function createR2StorageAdapter(opts: R2AdapterOptions = {}): StorageAdapter {
  const env = resolveR2Env(opts.env);
  const client = opts.client ?? createR2S3Client(env);
  const trackOps = opts.trackOps !== false;
  const bucket = env.bucket;

  async function track(delta: { classA?: number; classB?: number }): Promise<void> {
    if (!trackOps) return;
    await incrementStorageOps(delta);
  }

  return {
    async put(key, data, options?: StoragePutOptions) {
      const objectKey = toObjectKey(key);
      const body = toBuffer(data);
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          Body: body,
          ContentType: options?.contentType,
          StorageClass: "STANDARD",
        }),
      );
      await track({ classA: 1 });
    },

    async getStream(key) {
      const objectKey = toObjectKey(key);
      try {
        const res = await client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: objectKey,
          }),
        );
        await track({ classB: 1 });
        const body = res.Body;
        if (!body) {
          throw new Error(`Object not found: ${key}`);
        }
        // AWS SDK v3 Body is AsyncIterable / Readable in Node.
        if (body instanceof Readable) {
          return body;
        }
        if (
          typeof (body as { transformToWebStream?: () => ReadableStream }).transformToWebStream ===
          "function"
        ) {
          return Readable.fromWeb(
            (
              body as { transformToWebStream: () => ReadableStream }
            ).transformToWebStream() as never,
          );
        }
        if (Symbol.asyncIterator in Object(body)) {
          return Readable.from(body as AsyncIterable<Uint8Array>);
        }
        throw new Error(`Unexpected GetObject body type for key: ${key}`);
      } catch (err) {
        const name = err instanceof Error ? err.name : "";
        const msg = err instanceof Error ? err.message : String(err);
        if (name === "NoSuchKey" || name === "NotFound" || /NoSuchKey|404|NotFound/i.test(msg)) {
          throw new Error(`Object not found: ${key}`);
        }
        throw err;
      }
    },

    async delete(key) {
      const objectKey = toObjectKey(key);
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: objectKey,
        }),
      );
      // Deletes are free — do not increment Class A/B.
    },

    async exists(key) {
      const objectKey = toObjectKey(key);
      try {
        await client.send(
          new HeadObjectCommand({
            Bucket: bucket,
            Key: objectKey,
          }),
        );
        await track({ classB: 1 });
        return true;
      } catch (err) {
        const name = err instanceof Error ? err.name : "";
        const msg = err instanceof Error ? err.message : String(err);
        if (
          name === "NotFound" ||
          name === "NoSuchKey" ||
          (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode === 404 ||
          /NotFound|NoSuchKey|404/i.test(msg)
        ) {
          await track({ classB: 1 });
          return false;
        }
        throw err;
      }
    },

    async healthCheck() {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      await track({ classB: 1 });
    },
  };
}
