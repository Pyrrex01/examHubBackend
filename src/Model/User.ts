
export type UserRole = 'ADMIN' | 'STUDENT';

export const USER_ROLES: readonly UserRole[] = ['ADMIN', 'STUDENT'] as const;

export interface PublicUser {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface UserWithPassword extends PublicUser {
  passwordHash: string;
}

export function toPublicUser(user: UserWithPassword): PublicUser {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

export interface TokenPayload {
  sub: number;
  role: UserRole;
}

export interface AuthenticatedUser {
  id: number;
  role: UserRole;
  email: string;
  fullName: string;
}
