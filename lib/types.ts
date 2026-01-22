export type UserRole = "admin" | "editor" | "author";

export interface UserWithRole {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
}
