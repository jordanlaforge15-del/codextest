import { z } from 'zod';

export const workspaceRendersPathSchema = z.object({
  workspaceId: z.string().min(1)
});

export const renderPathParamsSchema = z.object({
  workspaceId: z.string().min(1),
  renderId: z.string().min(1)
});

export const createRenderSchema = z.object({
  selectedItemIds: z.array(z.string().min(1)).min(2),
  renderMode: z.enum(['preview', 'high_quality']).optional().default('preview')
});
