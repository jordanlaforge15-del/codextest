import type { Workspace } from '@mvp/shared';
import { HttpError } from '../errors/http-error.js';
import {
  createWorkspace,
  getWorkspaceById,
  listWorkspaces,
  updateWorkspaceById
} from '../repositories/workspace-repository.js';

function toWorkspaceResponse(workspace: {
  id: string;
  title: string;
  intentionText: string | null;
  domainType: string;
  createdAt: Date;
  updatedAt: Date;
}): Workspace {
  return {
    id: workspace.id,
    title: workspace.title,
    intentionText: workspace.intentionText,
    domainType: workspace.domainType as Workspace['domainType'],
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
