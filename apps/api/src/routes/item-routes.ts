import { Router, type Router as RouterType } from 'express';
import {
  createItemSchema,
  itemPathParamsSchema,
  updateItemSchema,
  workspaceItemsPathSchema
} from '../schemas/item-schemas.js';
import {
  createItemService,
  deleteItemService,
  listItemsService,
  updateItemService
} from '../services/item-service.js';

export const itemRouter: RouterType = Router();

itemRouter.post('/workspaces/:workspaceId/items', async (req, res, next) => {
  try {
    const { workspaceId } = workspaceItemsPathSchema.parse(req.params);
    const payload = createItemSchema.parse(req.body);
    const item = await createItemService(workspaceId, payload);
    console.log('Created item response', {
      workspaceId,
      item
    });
    res.status(201).json({ data: item });
  } catch (error) {
    next(error);
  }
});

itemRouter.get('/workspaces/:workspaceId/items', async (req, res, next) => {
  try {
    const { workspaceId } = workspaceItemsPathSchema.parse(req.params);
    const items = await listItemsService(workspaceId);
    res.status(200).json({ data: items });
  } catch (error) {
    next(error);
  }
});

itemRouter.patch('/workspaces/:workspaceId/items/:itemId', async (req, res, next) => {
  try {
    const { workspaceId, itemId } = itemPathParamsSchema.parse(req.params);
    const payload = updateItemSchema.parse(req.body);
    const item = await updateItemService(workspaceId, itemId, payload);
    res.status(200).json({ data: item });
  } catch (error) {
    next(error);
  }
});

itemRouter.delete('/workspaces/:workspaceId/items/:itemId', async (req, res, next) => {
  try {
    const { workspaceId, itemId } = itemPathParamsSchema.parse(req.params);
    await deleteItemService(workspaceId, itemId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
