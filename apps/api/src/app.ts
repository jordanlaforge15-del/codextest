import express from 'express';
import { errorHandler } from './middleware/error-handler.js';
import { itemRouter } from './routes/item-routes.js';
import { workspaceRouter } from './routes/workspace-routes.js';

export function createApp() {
  const app = express();

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'api',
      timestamp: new Date().toISOString()
    });
  });

  app.use(workspaceRouter);
  app.use(itemRouter);

  app.use(errorHandler);

  return app;
}
