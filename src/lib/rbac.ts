export type Role = "OWNER" | "ADMIN" | "EDITOR" | "REVIEWER" | "VIEWER";

export const ROLE_RANK: Record<Role, number> = {
  VIEWER: 1,
  REVIEWER: 2,
  EDITOR: 3,
  ADMIN: 4,
  OWNER: 5,
};

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  EDITOR: "Editor",
  REVIEWER: "Reviewer",
  VIEWER: "Viewer",
};

export type Permission =
  | "workspace.manage"
  | "workspace.billing"
  | "skill.view"
  | "skill.create"
  | "skill.edit"
  | "skill.review"
  | "skill.publish"
  | "eval.run"
  | "admin.override"
  | "secrets.manage"
  | "audit.view";

const REQUIRED_RANK: Record<Permission, number> = {
  "workspace.manage": 4,
  "workspace.billing": 5,
  "skill.view": 1,
  "skill.create": 3,
  "skill.edit": 3,
  "skill.review": 2,
  "skill.publish": 3,
  "eval.run": 3,
  "admin.override": 4,
  "secrets.manage": 4,
  "audit.view": 4,
};

export function can(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= REQUIRED_RANK[permission];
}
