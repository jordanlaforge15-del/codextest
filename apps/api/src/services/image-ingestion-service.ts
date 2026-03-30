import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const DEFAULT_FETCH_TIMEOUT_MS = 8000;

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

function normalizeContentType(contentTypeHeader: string | null): string {
  return (contentTypeHeader ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
}

function extensionFromContentType(contentType: string): string {
  const [, subtype = 'bin'] = contentType.split('/');
  return subtype.replace(/[^a-z0-9.+-]/gi, '');
}

export interface ImageIngestionResult {
  storedImagePath: string;
}

export async function ingestImageFromUrl(imageUrl: string): Promise<ImageIngestionResult> {
  const baseStoragePath = path.resolve(
    process.env.IMAGE_STORAGE_PATH ?? path.join(process.cwd(), 'storage', 'images')
  );
  const maxSizeBytes = parsePositiveInt(
    process.env.IMAGE_MAX_FILE_SIZE_BYTES,
    DEFAULT_MAX_FILE_SIZE_BYTES
  );
  const timeoutMs = parsePositiveInt(process.env.IMAGE_FETCH_TIMEOUT_MS, DEFAULT_FETCH_TIMEOUT_MS);

  const response = await fetch(imageUrl, {
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    throw new Error(`Image request failed with status ${response.status}`);
  }

  const contentType = normalizeContentType(response.headers.get('content-type'));
  if (!contentType.startsWith('image/')) {
    throw new Error('Image URL does not point to an image resource');
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength) {
    const length = Number.parseInt(contentLength, 10);
    if (Number.isFinite(length) && length > maxSizeBytes) {
      throw new Error(`Image exceeds max allowed size (${maxSizeBytes} bytes)`);
    }
  }

  const bytes = Buffer.from(await response.arrayBuffer());

  if (bytes.length === 0) {
    throw new Error('Image payload is empty');
  }

  if (bytes.length > maxSizeBytes) {
    throw new Error(`Image exceeds max allowed size (${maxSizeBytes} bytes)`);
  }

  const extension = extensionFromContentType(contentType);
  const hash = createHash('sha256').update(imageUrl).digest('hex');
  const filename = `${hash}.${extension}`;

  await mkdir(baseStoragePath, { recursive: true });

  const absolutePath = path.join(baseStoragePath, filename);
  await writeFile(absolutePath, bytes);

  return {
    storedImagePath: absolutePath
  };
}
