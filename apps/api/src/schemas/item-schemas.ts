import { z } from 'zod';

const jsonRecordSchema = z.record(z.string(), z.unknown());

export const itemPathParamsSchema = z.object({
  workspaceId: z.string().min(1),
  itemId: z.string().min(1)
});

export const workspaceItemsPathSchema = z.object({
  workspaceId: z.string().min(1)
});

export const createItemSchema = z.object({
  sourceUrl: z.string().url().nullable().optional(),
  pageUrl: z.string().url().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  storedImagePath: z.string().max(500).nullable().optional(),
  title: z.string().max(300).nullable().optional(),
  brand: z.string().max(200).nullable().optional(),
  merchant: z.string().max(200).nullable().optional(),
  price: z.string().max(50).nullable().optional(),
  currency: z.string().max(10).nullable().optional(),
  slotType: z.string().max(100).nullable().optional(),
  role: z.enum(['fixed', 'candidate']).optional(),
  metadataJson: jsonRecordSchema.optional().default({})
});

export const updateItemSchema = createItemSchema.partial();
