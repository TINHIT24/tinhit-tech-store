import { User } from '@prisma/client';

export type SafeUser = Omit<User, 'passwordHash'>;

export const sanitizeUser = (user: User): SafeUser => {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
};
