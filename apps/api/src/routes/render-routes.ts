import { Router, type Router as RouterType } from 'express';
import {
  createRenderSchema,
  renderPathParamsSchema,
  renderVoteSchema,
  workspaceRendersPathSchema
} from '../schemas/render-schemas.js';
import { authenticateToken } from '../services/auth-service.js';
import { createRenderService, getRenderService, listRendersService } from '../services/render-service.js';
import { getRenderVoteService, upsertRenderVoteService } from '../services/render-vote-service.js';

export const renderRouter: RouterType = Router();

renderRouter.post('/workspaces/:workspaceId/renders', async (req, res, next) => {
  try {
    const { workspaceId } = workspaceRendersPathSchema.parse(req.params);
    const payload = createRenderSchema.parse(req.body);
    const authorization = req.headers.authorization;
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    const user = token ? await authenticateToken(token) : null;
    const render = await createRenderService(workspaceId, {
      ...payload,
      personImagePath: user?.profileImagePath ?? null
    });
    res.status(201).json({ data: render });
  } catch (error) {
    next(error);
  }
});

renderRouter.get('/workspaces/:workspaceId/renders', async (req, res, next) => {
  try {
    const { workspaceId } = workspaceRendersPathSchema.parse(req.params);
    const renders = await listRendersService(workspaceId);
    res.status(200).json({ data: renders });
  } catch (error) {
    next(error);
  }
});

renderRouter.get('/workspaces/:workspaceId/renders/:renderId', async (req, res, next) => {
  try {
    const { workspaceId, renderId } = renderPathParamsSchema.parse(req.params);
    const render = await getRenderService(workspaceId, renderId);
    res.status(200).json({ data: render });
  } catch (error) {
    next(error);
  }
});

renderRouter.get('/workspaces/:workspaceId/renders/:renderId/vote', async (req, res, next) => {
  try {
    const { workspaceId, renderId } = renderPathParamsSchema.parse(req.params);
    const vote = await getRenderVoteService(workspaceId, renderId);
    res.status(200).json({ data: vote });
  } catch (error) {
    next(error);
  }
});

renderRouter.put('/workspaces/:workspaceId/renders/:renderId/vote', async (req, res, next) => {
  try {
    const { workspaceId, renderId } = renderPathParamsSchema.parse(req.params);
    const payload = renderVoteSchema.parse(req.body);
    const vote = await upsertRenderVoteService(workspaceId, renderId, payload.vote);
    res.status(200).json({ data: vote });
  } catch (error) {
    next(error);
  }
});
