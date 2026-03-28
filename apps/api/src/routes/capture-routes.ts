import { Router } from 'express';
import { createCaptureSchema, workspaceCapturePathSchema } from '../schemas/capture-schemas.js';
import { createCaptureService } from '../services/capture-service.js';

export const captureRouter = Router();

captureRouter.post('/workspaces/:workspaceId/captures', async (req, res, next) => {
  try {
    const { workspaceId } = workspaceCapturePathSchema.parse(req.params);
    const payload = createCaptureSchema.parse(req.body);

    const result = await createCaptureService(workspaceId, payload);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});
