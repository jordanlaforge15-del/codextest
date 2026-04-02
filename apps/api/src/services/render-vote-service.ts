import type { RenderVote as RenderVoteDto, RenderVoteValue } from '@mvp/shared';
import { HttpError } from '../errors/http-error.js';
import { getRenderById } from '../repositories/render-repository.js';
import { getRenderVoteByRenderId, upsertRenderVote } from '../repositories/render-vote-repository.js';
import { getWorkspaceById } from '../repositories/workspace-repository.js';

function toRenderVoteResponse(vote: {
  id: string;
  workspaceId: string;
  renderId: string;
  vote: RenderVoteValue;
  createdAt: Date;
  updatedAt: Date;
}): RenderVoteDto {
  return {
    id: vote.id,
    workspaceId: vote.workspaceId,
    renderId: vote.renderId,
    vote: vote.vote,
    createdAt: vote.createdAt.toISOString(),
    updatedAt: vote.updatedAt.toISOString()
  };
}

async function assertWorkspaceExists(workspaceId: string): Promise<void> {
  const workspace = await getWorkspaceById(workspaceId);
  if (!workspace) {
    throw new HttpError(404, 'Workspace not found');
  }
}

async function assertRenderInWorkspace(workspaceId: string, renderId: string): Promise<void> {
  const render = await getRenderById(renderId);
  if (!render || render.workspaceId !== workspaceId) {
    throw new HttpError(404, 'Render not found in workspace');
  }
}

export async function getRenderVoteService(
  workspaceId: string,
  renderId: string
): Promise<RenderVoteDto | null> {
  await assertWorkspaceExists(workspaceId);
  await assertRenderInWorkspace(workspaceId, renderId);

  const vote = await getRenderVoteByRenderId(renderId);
  return vote ? toRenderVoteResponse(vote) : null;
}

export async function upsertRenderVoteService(
  workspaceId: string,
  renderId: string,
  vote: RenderVoteValue
): Promise<RenderVoteDto> {
  await assertWorkspaceExists(workspaceId);
  await assertRenderInWorkspace(workspaceId, renderId);

  const savedVote = await upsertRenderVote(workspaceId, renderId, vote);
  return toRenderVoteResponse(savedVote);
}
