/**
 * UI-facing user actions (U2). Thin wrappers so client components can import
 * server actions without barrel-re-exporting under `"use server"` (Turbopack).
 */
"use server";

import {
  usersListAction as listUsers,
  usersGetAction as getUser,
  usersGetOwnProfileAction as getOwnProfile,
  usersCreateAction as createUser,
  usersDeactivateAction as deactivateUser,
  usersReactivateAction as reactivateUser,
  usersResetPasswordAction as resetPassword,
  usersTransferAdminAction as transferAdmin,
  usersChangeOwnPasswordAction as changeOwnPassword,
  usersUpdateOwnProfileAction as updateOwnProfile,
  sessionsListOwnAction as listOwnSessions,
  sessionsRevokeOwnAction as revokeOwnSession,
  authLogoutAllAction as logoutAll,
} from "../server/actions/users.js";

export async function usersListAction() {
  return listUsers();
}

export async function usersGetAction(userId: string) {
  return getUser(userId);
}

export async function usersGetOwnProfileAction() {
  return getOwnProfile();
}

export async function usersCreateAction(raw: unknown) {
  return createUser(raw);
}

export async function usersDeactivateAction(userId: string) {
  return deactivateUser(userId);
}

export async function usersReactivateAction(userId: string) {
  return reactivateUser(userId);
}

export async function usersResetPasswordAction(userId: string) {
  return resetPassword(userId);
}

export async function usersTransferAdminAction(raw: unknown) {
  return transferAdmin(raw);
}

export async function usersChangeOwnPasswordAction(raw: unknown) {
  return changeOwnPassword(raw);
}

export async function usersUpdateOwnProfileAction(raw: unknown) {
  return updateOwnProfile(raw);
}

export async function sessionsListOwnAction() {
  return listOwnSessions();
}

export async function sessionsRevokeOwnAction(raw: unknown) {
  return revokeOwnSession(raw);
}

export async function authLogoutAllAction() {
  return logoutAll();
}
