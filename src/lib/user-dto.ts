/** Client-safe user row (dates may be ISO strings after server-action serialization). */

export type ClientUser = {
  id: string;
  username: string;
  role: "admin" | "builder" | "viewer";
  isActive: boolean;
  displayName: string;
  email: string | null;
  phone: string | null;
  photoObjectKey: string | null;
  mustChangePassword: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
};
