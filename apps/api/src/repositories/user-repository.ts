import type { Prisma, User } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export async function createUser(data: Prisma.UserCreateInput): Promise<User> {
  return prisma.user.create({ data });
}

export async function getUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } });
}

export async function getUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

export async function updateUserProfileImagePathById(
  id: string,
  profileImagePath: string
): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: { profileImagePath }
  });
}
