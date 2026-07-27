import { User } from '../types';

export const hasRole = (user: Partial<User> | null | undefined, ...wanted: string[]): boolean => {
  if (!user) return false;
  const roles: string[] = (user as any).roles ?? ((user as any).role ? [(user as any).role] : []);
  return wanted.some(r => roles.includes(r));
};

export const primaryRole = (user: Partial<User> | null | undefined): string => {
  const roles: string[] = (user as any)?.roles ?? [];
  for (const r of ['owner', 'admin', 'technician']) if (roles.includes(r)) return r;
  return 'user';
};
