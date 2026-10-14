/** Public signed-in user shape for UI actions (U1 / U2). */

export type CurrentUser = {
  id: string;
  username: string;
  role: "admin" | "builder" | "viewer";
  displayName: string;
  mustChangePassword: boolean;
};
