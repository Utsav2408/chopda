/**
 * Zod schemas for user administration (B3-05..11).
 */
import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "../security/constants.js";

export const creatableRoleSchema = z.enum(["builder", "viewer"]);

export const createUserSchema = z.object({
  username: z.string().trim().min(1).max(64),
  displayName: z.string().trim().min(1).max(120),
  role: creatableRoleSchema,
  email: z.string().trim().email().max(254).optional().nullable(),
  phone: z.string().trim().max(32).optional().nullable(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const changeOwnPasswordSchema = z.object({
  oldPassword: z.string().min(1).max(256),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH).max(256),
});

export type ChangeOwnPasswordInput = z.infer<typeof changeOwnPasswordSchema>;

export const transferAdminSchema = z.object({
  newAdminUserId: z.string().uuid(),
});

export type TransferAdminInput = z.infer<typeof transferAdminSchema>;

export const updateOwnProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().max(254).nullable().optional(),
  phone: z.string().trim().max(32).nullable().optional(),
  photoObjectKey: z.string().trim().min(1).max(512).nullable().optional(),
  prefs: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;
