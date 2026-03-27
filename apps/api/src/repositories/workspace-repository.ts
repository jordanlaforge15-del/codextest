import type { Prisma, Workspace } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export async function createWorkspace(data: Prisma.WorkspaceCreateInput): Promise<Workspace> {
  return prisma.workspace.create({ data });
}

export async function listWorkspaces(): Promise<Workspace[]> {
  return prisma.workspace.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function getWorkspaceById(id: string): Promise<Workspace | null> {
  return prisma.workspace.findUnique({ where: { id } });
}

export async function updateWorkspaceById(
  id: string,
  data: Prisma.WorkspaceUpdateInput
): Promise<Workspace> {
  return prisma.workspace.update({ where: { id }, data });
}
