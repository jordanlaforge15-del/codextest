import type { Prisma, Render, RenderVote } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export async function createRender(data: Prisma.RenderUncheckedCreateInput): Promise<Render> {
  return prisma.render.create({ data });
}

export interface RenderWithVote extends Render {
  vote: RenderVote | null;
}

export async function listRendersByWorkspace(workspaceId: string): Promise<RenderWithVote[]> {
  return prisma.render.findMany({
    where: { workspaceId },
    include: { vote: true },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getRenderById(id: string): Promise<RenderWithVote | null> {
  return prisma.render.findUnique({
    where: { id },
    include: { vote: true }
  });
}
