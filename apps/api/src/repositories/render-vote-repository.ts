import type { Prisma, RenderVote } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export async function getRenderVoteByRenderId(renderId: string): Promise<RenderVote | null> {
  return prisma.renderVote.findUnique({
    where: { renderId }
  });
}

export async function upsertRenderVote(
  workspaceId: string,
  renderId: string,
  vote: Prisma.RenderVoteUncheckedCreateInput['vote']
): Promise<RenderVote> {
  return prisma.renderVote.upsert({
    where: { renderId },
    create: {
      workspaceId,
      renderId,
      vote
    },
    update: {
      workspaceId,
      vote
    }
  });
}
