export function hasRole(user: any, role: string): boolean {
    if (!user || !user.role) return false;
    if (Array.isArray(user.role)) {
        return user.role.includes(role);
    }
    return user.role === role;
}

export function primaryRole(user: any): string {
    if (!user || !user.role) return 'member';
    if (Array.isArray(user.role)) {
        return user.role.length > 0 ? user.role[0] : 'member';
    }
    return user.role;
}
