export const APP_ROLES = [
  "recordmanager",
  "proceseigenaar",
  "archivaris",
  "functioneel_beheerder",
  "auditor",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export function isAppRole(role: string): role is AppRole {
  return APP_ROLES.includes(role as AppRole);
}
