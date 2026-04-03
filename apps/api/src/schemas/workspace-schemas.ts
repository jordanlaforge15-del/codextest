import { z } from 'zod';

export const workspaceIdParamSchema = z.object({
  workspaceId: z.string().min(1)
});

export const createWorkspaceSchema = z.object({
  title: z.string().min(1).max(200),
  intentionText: z.string().max(2000).nullable().optional(),
  domainType: z.string().min(1).max(100)
});

export const updateWorkspaceSchema = createWorkspaceSchema.partial();

export const updateWorkspaceSelectedItemsSchema = z.object({
  selectedItemIds: z.array(z.string().min(1)).max(500)
});
