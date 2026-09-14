import type { Role } from '@prisma/client';

// Who is allowed to assign which role to someone else. Enforced server-side on
// every role-changing endpoint — never trust a frontend dropdown as the only
// control. See docs/rbac.md.
//
// PLATFORM_OWNER can assign any role, including minting another Platform
// Owner. COUNTRY_ADMIN may only create/manage CONTENT_MANAGER and HELPDESK
// accounts, and only within their own country (callers must additionally
// enforce the countryCode match — this map only encodes which roles are
// reachable at all). No other role may assign any role.
export const ASSIGNABLE_ROLES: Record<Role, Role[]> = {
  PLATFORM_OWNER: ['PLATFORM_OWNER', 'COUNTRY_ADMIN', 'COUNCIL_OFFICER', 'CONTENT_MANAGER', 'LEARNER', 'HELPDESK'],
  COUNTRY_ADMIN: ['CONTENT_MANAGER', 'HELPDESK'],
  COUNCIL_OFFICER: [],
  CONTENT_MANAGER: [],
  LEARNER: [],
  HELPDESK: [],
};

export function canAssignRole(actorRole: Role, targetRole: Role): boolean {
  return ASSIGNABLE_ROLES[actorRole]?.includes(targetRole) ?? false;
}
