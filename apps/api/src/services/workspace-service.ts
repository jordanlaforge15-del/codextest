import type { Workspace } from '@mvp/shared';
import { HttpError } from '../errors/http-error.js';
import {
  createWorkspace,
  deleteWorkspaceById,
  getWorkspaceById,
  listWorkspaces,
  updateWorkspaceSelectedItemIdsById,
  updateWorkspaceById
} from '../repositories/workspace-repository.js';
import { listItemsByIds } from '../repositories/item-repository.js';

function parseSelectedItemIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

function toWorkspaceResponse(workspace: {
  id: string;
  title: string;
  intentionText: string | null;
  domainType: string;
  selectedItemIds: unknown;
  createdAt: Date;
  updatedAt: Date;
}): Workspace {
  return {
    id: workspace.id,
    title: workspace.title,
    intentionText: workspace.intentionText,
    domainType: workspace.domainType as Workspace['domainType'],
    selectedItemIds: parseSelectedItemIds(workspace.selectedItemIds),
    createdAt: workspace.createdAt.toISOString(),
    updatedAt: workspace.updatedAt.toISOString()
  };
}

export async function createWorkspaceService(input: {
  title: string;
  intentionText?: string | null;
  domainType: string;
}): Promise<Workspace> {
  const workspace = await createWorkspace({
    title: input.title,
    intentionText: input.intentionText ?? null,
    domainType: input.domainType
  });

  return toWorkspaceResponse(workspace);
}

export async function listWorkspacesService(): Promise<Workspace[]> {
  const workspaces = await listWorkspaces();
  return workspaces.map(toWorkspaceResponse);
}

export async function getWorkspaceService(workspaceId: string): Promise<Workspace> {
  const workspace = await getWorkspaceById(workspaceId);
  if (!workspace) {
    throw new HttpError(404, 'Workspace not found');
  }

  return toWorkspaceResponse(workspace);
}

export async function updateWorkspaceService(
  workspaceId: string,
  input: { title?: string; intentionText?: string | null; domainType?: string }
): Promise<Workspace> {
  await getWorkspaceService(workspaceId);

  const workspace = await updateWorkspaceById(workspaceId, {
    title: input.title,
    intentionText: input.intentionText,
    domainType: input.domainType
  });

  return toWorkspaceResponse(workspace);
}

export async function deleteWorkspaceService(workspaceId: string): Promise<void> {
  await getWorkspaceService(workspaceId);
  await deleteWorkspaceById(workspaceId);
}

export async function updateWorkspaceSelectedItemsService(
  workspaceId: string,
  input: { selectedItemIds: string[] }
): Promise<Workspace> {
  await getWorkspaceService(workspaceId);

  const selectedItemIds = Array.from(new Set(input.selectedItemIds));
  if (selectedItemIds.length > 0) {
    const items = await listItemsByIds(selectedItemIds);
    if (items.length !== selectedItemIds.length || items.some((item) => item.workspaceId !== workspaceId)) {
      throw new HttpError(400, 'Selected items must belong to the workspace');
    }
  }

  const workspace = await updateWorkspaceSelectedItemIdsById(workspaceId, selectedItemIds);
  return toWorkspaceResponse(workspace);
}
