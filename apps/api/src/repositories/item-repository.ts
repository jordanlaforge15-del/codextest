import type { Item, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export async function createItem(data: Prisma.ItemUncheckedCreateInput): Promise<Item> {
  return prisma.item.create({ data });
}

export async function listItemsByWorkspace(workspaceId: string): Promise<Item[]> {
  return prisma.item.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' } });
}

export async function getItemById(id: string): Promise<Item | null> {
  return prisma.item.findUnique({ where: { id } });
}

export async function updateItemById(id: string, data: Prisma.ItemUpdateInput): Promise<Item> {
  return prisma.item.update({ where: { id }, data });
}

export async function deleteItemById(id: string): Promise<void> {
  await prisma.item.delete({ where: { id } });
}
