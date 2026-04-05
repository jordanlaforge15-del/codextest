import { access } from 'node:fs/promises';
import type { Item, RenderMode, Workspace } from '@mvp/shared';
import { prisma } from '../config/prisma.js';
import { generateRenderPreview } from './openai-render-service.js';
import { saveGeneratedRender } from './render-storage-service.js';

interface ClaimedRenderJob {
  id: string;
  workspaceId: string;
  renderMode: RenderMode;
  selectedItemIds: string[];
  personImagePath: string | null;
}

interface LoadedRenderJob extends ClaimedRenderJob {
  workspace: Workspace;
  items: Item[];
}

export interface RenderProcessorDependencies {
  loadRenderJob(renderId: string): Promise<LoadedRenderJob>;
  generateRenderPreview(input: {
    workspace: Workspace;
    items: Item[];
    renderMode: RenderMode;
    personImagePath: string | null;
  }): Promise<{ imageBase64: string; revisedPrompt: string | null }>;
  saveGeneratedRender(renderId: string, imageBase64: string): Promise<string>;
  markRenderComplete(
    renderId: string,
    params: { outputImagePath: string; revisedPrompt: string | null }
  ): Promise<void>;
  markRenderFailed(renderId: string, errorMessage: string): Promise<void>;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown render error';
}

function parseSelectedItemIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error('Render selectedItemIds is invalid');
  }

  return value;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function claimNextQueuedRender(): Promise<ClaimedRenderJob | null> {
  const queuedRender = await prisma.render.findFirst({
    where: { status: 'queued' },
    orderBy: { createdAt: 'asc' }
  });

  if (!queuedRender) {
    return null;
  }

  const claimResult = await prisma.render.updateMany({
    where: {
      id: queuedRender.id,
      status: 'queued'
    },
    data: {
      status: 'processing',
      errorMessage: null
    }
  });

  if (claimResult.count === 0) {
    return null;
  }

  return {
    id: queuedRender.id,
    workspaceId: queuedRender.workspaceId,
    renderMode: queuedRender.renderMode,
    selectedItemIds: parseSelectedItemIds(queuedRender.selectedItemIds),
    personImagePath: queuedRender.personImagePath
  };
}

async function loadRenderJob(renderId: string): Promise<LoadedRenderJob> {
  const render = await prisma.render.findUnique({
    where: { id: renderId },
    include: { workspace: true }
  });

  if (!render) {
    throw new Error(`Render ${renderId} was not found`);
  }

  const selectedItemIds = parseSelectedItemIds(render.selectedItemIds);
  const items = await prisma.item.findMany({
    where: {
      workspaceId: render.workspaceId,
      id: { in: selectedItemIds }
    }
  });

  if (items.length !== selectedItemIds.length) {
    throw new Error('One or more selected items could not be loaded for the render');
  }

  const orderedItems = selectedItemIds.map((itemId) => {
    const item = items.find((candidate) => candidate.id === itemId);
    if (!item) {
      throw new Error(`Selected item ${itemId} was not found in the workspace`);
    }

    return {
      ...item,
      price: item.price ? String(item.price) : null,
      metadataJson: (item.metadataJson ?? {}) as Record<string, unknown>,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString()
    } satisfies Item;
  });

  for (const item of orderedItems) {
    if (!item.storedImagePath) {
      throw new Error(`Selected item "${item.title ?? item.id}" does not have a stored local image`);
    }

    if (!(await fileExists(item.storedImagePath))) {
      throw new Error(`Stored local image was not found for item "${item.title ?? item.id}"`);
    }
  }

  return {
    id: render.id,
    workspaceId: render.workspaceId,
    renderMode: render.renderMode,
    selectedItemIds,
    personImagePath: render.personImagePath,
    workspace: {
      id: render.workspace.id,
      title: render.workspace.title,
      intentionText: render.workspace.intentionText,
      domainType: render.workspace.domainType as Workspace['domainType'],
      selectedItemIds,
      createdAt: render.workspace.createdAt.toISOString(),
      updatedAt: render.workspace.updatedAt.toISOString()
    },
    items: orderedItems
  };
}

async function markRenderComplete(
  renderId: string,
  params: { outputImagePath: string; revisedPrompt: string | null }
): Promise<void> {
  await prisma.render.update({
    where: { id: renderId },
    data: {
      status: 'complete',
      outputImagePath: params.outputImagePath,
      recommendationText: params.revisedPrompt,
      recommendationLabel: 'AI-generated preview',
      errorMessage: null
    }
  });
}

async function markRenderFailed(renderId: string, errorMessage: string): Promise<void> {
  await prisma.render.update({
    where: { id: renderId },
    data: {
      status: 'failed',
      outputImagePath: null,
      errorMessage: errorMessage.slice(0, 1000)
    }
  });
}

const liveDependencies: RenderProcessorDependencies = {
  loadRenderJob,
  generateRenderPreview,
  saveGeneratedRender,
  markRenderComplete,
  markRenderFailed
};

export async function processClaimedRenderJob(
  job: ClaimedRenderJob,
  dependencies: RenderProcessorDependencies = liveDependencies
): Promise<void> {
  try {
    const loadedJob = await dependencies.loadRenderJob(job.id);
    const preview = await dependencies.generateRenderPreview({
      workspace: loadedJob.workspace,
      items: loadedJob.items,
      renderMode: loadedJob.renderMode,
      personImagePath: loadedJob.personImagePath
    });
    const outputImagePath = await dependencies.saveGeneratedRender(job.id, preview.imageBase64);
    await dependencies.markRenderComplete(job.id, {
      outputImagePath,
      revisedPrompt: preview.revisedPrompt
    });
  } catch (error) {
    await dependencies.markRenderFailed(job.id, getErrorMessage(error));
    console.error(`[render-worker] render ${job.id} failed`, error);
  }
}

export async function processNextQueuedRender(): Promise<boolean> {
  const job = await claimNextQueuedRender();
  if (!job) {
    return false;
  }

  await processClaimedRenderJob(job);
  return true;
}
