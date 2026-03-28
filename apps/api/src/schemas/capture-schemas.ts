import { z } from 'zod';

const jsonRecordSchema = z.record(z.string(), z.unknown());

export const workspaceCapturePathSchema = z.object({
  workspaceId: z.string().min(1)
});

export const createCaptureSchema = z.object({
  page_url: z.string().url(),
  image_url: z.string().url(),
  page_title: z.string().max(500).optional(),
  alt_text: z.string().max(500).nullable().optional(),
  surrounding_text: z.string().max(2000).nullable().optional(),
  raw_payload_json: jsonRecordSchema.optional().default({})
});
