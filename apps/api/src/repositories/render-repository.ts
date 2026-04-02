import type { Prisma, Render } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export async function createRender(data: Prisma.RenderUncheckedCreateInput): Promise<Render> {
  return prisma.render.create({ data });
}

export async function listRendersByWorkspace(workspaceId: string): Promise<Render[]> {
  return prisma.render.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getRenderById(id: string): Promise<Render | null> {
  return prisma.render.findUnique({ where: { id } });
}
