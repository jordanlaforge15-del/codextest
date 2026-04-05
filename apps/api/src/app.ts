import 'dotenv/config';
import path from 'node:path';
import cors from 'cors';
import express, { type Express } from 'express';
import { authRouter } from './routes/auth-routes.js';
import { errorHandler } from './middleware/error-handler.js';
import { captureRouter } from './routes/capture-routes.js';
import { itemRouter } from './routes/item-routes.js';
import { renderRouter } from './routes/render-routes.js';
import { workspaceRouter } from './routes/workspace-routes.js';
import { getProfileImageDirectory } from './services/profile-image-service.js';
import { getRenderOutputDirectory } from './services/render-asset-service.js';

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '12mb' }));
  app.use('/assets/profile-images', express.static(path.resolve(getProfileImageDirectory())));
  app.use('/assets/renders', express.static(path.resolve(getRenderOutputDirectory())));

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'api',
      timestamp: new Date().toISOString()
    });
  });

  app.use(authRouter);
  app.use(workspaceRouter);
  app.use(itemRouter);
  app.use(captureRouter);
  app.use(renderRouter);

  app.use(errorHandler);

  return app;
}
