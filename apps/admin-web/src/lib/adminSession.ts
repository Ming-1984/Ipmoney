export type AdminSessionInfo = {
  userId: string;
  isAdmin: boolean;
  role?: string;
  roleNames?: string[];
  roleIds?: string[];
  permissions?: string[];
  nickname?: string;
  displayName?: string;
};

export function isSuperAdminSession(session?: AdminSessionInfo | null): boolean {
  if (!session) return false;
  if ((session.permissions || []).includes('*')) return true;
  if (String(session.role || '').toLowerCase() === 'admin') return true;
  if ((session.roleNames || []).some((item) => String(item || '').toLowerCase() === 'admin')) return true;
  return (session.roleIds || []).some((item) => String(item || '') === 'role-admin');
}
