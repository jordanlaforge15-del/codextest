import { Router, type Router as RouterType } from 'express';
import { createRenderSchema, renderPathParamsSchema, workspaceRendersPathSchema } from '../schemas/render-schemas.js';
import { createRenderService, getRenderService, listRendersService } from '../services/render-service.js';

export const renderRouter: RouterType = Router();

renderRouter.post('/workspaces/:workspaceId/renders', async (req, res, next) => {
  try {
    const { workspaceId } = workspaceRendersPathSchema.parse(req.params);
    const payload = createRenderSchema.parse(req.body);
    const render = await createRenderService(workspaceId, payload);
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
