import 'dotenv/config';
import path from 'node:path';

const DEFAULT_RENDER_OUTPUT_DIR = path.join('..', '..', 'storage', 'renders');
const DEFAULT_POLL_INTERVAL_MS = 3000;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export function getRenderOutputDirectory(): string {
  return path.resolve(process.cwd(), process.env.RENDER_OUTPUT_DIR ?? DEFAULT_RENDER_OUTPUT_DIR);
}

export function getWorkerPollIntervalMs(): number {
  return parsePositiveInt(process.env.RENDER_POLL_INTERVAL_MS, DEFAULT_POLL_INTERVAL_MS);
}

export function getOpenAIImageModel(): string {
  return process.env.OPENAI_IMAGE_MODEL?.trim() || 'gpt-image-1';
}

export function getOpenAIBaseUrl(): string | undefined {
  const value = process.env.OPENAI_BASE_URL?.trim();
  return value || undefined;
}

export function getOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error('OPENAI_API_KEY is required to process render jobs');
  }

  return key;
}
