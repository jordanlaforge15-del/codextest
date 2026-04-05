import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(100).optional()
});

export const loginSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(8).max(128)
});

export const updateProfileImageSchema = z.object({
  imageDataUrl: z.string().min(1)
});
