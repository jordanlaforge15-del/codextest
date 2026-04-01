import { Router, type Router as RouterType } from 'express';
import {
  createWorkspaceService,
  getWorkspaceService,
  listWorkspacesService,
  updateWorkspaceService
} from '../services/workspace-service.js';
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  workspaceIdParamSchema
} from '../schemas/workspace-schemas.js';

export const workspaceRouter: RouterType = Router();

workspaceRouter.post('/workspaces', async (req, res, next) => {
  try {
    const payload = createWorkspaceSchema.parse(req.body);
    const workspace = await createWorkspaceService(payload);
    res.status(201).json({ data: workspace });
  } catch (error) {
    next(error);
  }
});

workspaceRouter.get('/workspaces', async (_req, res, next) => {
  try {
    const workspaces = await listWorkspacesService();
    res.status(200).json({ data: workspaces });
  } catch (error) {
    next(error);
  }
});

workspaceRouter.get('/workspaces/:workspaceId', async (req, res, next) => {
  try {
    const { workspaceId } = workspaceIdParamSchema.parse(req.params);
    const workspace = await getWorkspaceService(workspaceId);
    res.status(200).json({ data: workspace });
  } catch (error) {
    next(error);
  }
});

workspaceRouter.patch('/workspaces/:workspaceId', async (req, res, next) => {
  try {
    const { workspaceId } = workspaceIdParamSchema.parse(req.params);
    const payload = updateWorkspaceSchema.parse(req.body);
    const workspace = await updateWorkspaceService(workspaceId, payload);
    res.status(200).json({ data: workspace });
  } catch (error) {
    next(error);
  }
});
