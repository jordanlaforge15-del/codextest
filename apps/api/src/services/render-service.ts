import type { Render as RenderDto } from '@mvp/shared';
import { HttpError } from '../errors/http-error.js';
import { listItemsByIds } from '../repositories/item-repository.js';
import { createRender, getRenderById, listRendersByWorkspace } from '../repositories/render-repository.js';
import { getWorkspaceById } from '../repositories/workspace-repository.js';
import { toRenderOutputUrl } from './render-asset-service.js';

function parseSelectedItemIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    return [];
  }

  return value;
}

function toRenderResponse(render: {
  id: string;
  workspaceId: string;
  status: 'queued' | 'processing' | 'complete' | 'failed';
  renderMode: 'preview' | 'high_quality';
  selectedItemIds: unknown;
  recommendationText: string | null;
  recommendationLabel: string | null;
  outputImagePath: string | null;
  errorMessage: string | null;
  vote?: {
    vote: 'up' | 'neutral' | 'down';
  } | null;
  createdAt: Date;
  updatedAt: Date;
}): RenderDto {
  return {
    id: render.id,
    workspaceId: render.workspaceId,
    status: render.status,
    renderMode: render.renderMode,
    selectedItemIds: parseSelectedItemIds(render.selectedItemIds),
    recommendationText: render.recommendationText,
    recommendationLabel: render.recommendationLabel,
    outputImagePath: render.outputImagePath,
    outputImageUrl: toRenderOutputUrl(render.outputImagePath),
    errorMessage: render.errorMessage,
    currentVote: render.vote?.vote ?? null,
    createdAt: render.createdAt.toISOString(),
    updatedAt: render.updatedAt.toISOString()
  };
}

async function assertWorkspaceExists(workspaceId: string): Promise<void> {
  const workspace = await getWorkspaceById(workspaceId);
  if (!workspace) {
    throw new HttpError(404, 'Workspace not found');
  }
}

export async function createRenderService(
  workspaceId: string,
  input: { selectedItemIds: string[]; renderMode: 'preview' | 'high_quality' }
): Promise<RenderDto> {
  await assertWorkspaceExists(workspaceId);

  const selectedItemIds = Array.from(new Set(input.selectedItemIds));
  const items = await listItemsByIds(selectedItemIds);
  if (items.length !== selectedItemIds.length || items.some((item) => item.workspaceId !== workspaceId)) {
    throw new HttpError(400, 'Selected items must belong to the workspace');
  }

  const render = await createRender({
    workspaceId,
    renderMode: input.renderMode,
    selectedItemIds,
    status: 'queued',
    outputImagePath: null,
    errorMessage: null
  });

  return toRenderResponse({ ...render, vote: null });
}

export async function listRendersService(workspaceId: string): Promise<RenderDto[]> {
  await assertWorkspaceExists(workspaceId);
  const renders = await listRendersByWorkspace(workspaceId);
  return renders.map(toRenderResponse);
}

export async function getRenderService(workspaceId: string, renderId: string): Promise<RenderDto> {
  await assertWorkspaceExists(workspaceId);

  const render = await getRenderById(renderId);
  if (!render || render.workspaceId !== workspaceId) {
    throw new HttpError(404, 'Render not found in workspace');
  }

  return toRenderResponse(render);
}
