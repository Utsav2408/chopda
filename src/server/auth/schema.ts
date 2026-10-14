/**
 * Zod schemas for auth inputs (B3-01..03, B3-12).
 */
import { z } from "zod";

export const loginBodySchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(256),
});

export type LoginBody = z.infer<typeof loginBodySchema>;

export const revokeOwnSessionSchema = z.object({
  sessionId: z.string().uuid(),
});

export type RevokeOwnSessionInput = z.infer<typeof revokeOwnSessionSchema>;
