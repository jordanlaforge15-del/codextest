import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_MAX_PROFILE_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
const DATA_URL_PATTERN = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=]+)$/i;

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

function extensionFromContentType(contentType: string): string {
  const [, subtype = 'png'] = contentType.split('/');
  return subtype.replace(/[^a-z0-9.+-]/gi, '');
}

export function getProfileImageDirectory(): string {
  return path.resolve(
    process.env.PROFILE_IMAGE_STORAGE_PATH ?? path.join(process.cwd(), 'storage', 'profile-images')
  );
}

export function toProfileImageUrl(profileImagePath: string | null | undefined): string | null {
  if (!profileImagePath) {
    return null;
  }

  const filename = path.basename(profileImagePath);
  if (!filename) {
    return null;
  }

  return `/assets/profile-images/${encodeURIComponent(filename)}`;
}

export async function ingestProfileImageFromDataUrl(
  userId: string,
  imageDataUrl: string
): Promise<{ storedImagePath: string }> {
  const match = imageDataUrl.trim().match(DATA_URL_PATTERN);
  if (!match) {
    throw new Error('Profile image must be a base64-encoded image data URL');
  }

  const [, contentType, base64Payload] = match;
  const bytes = Buffer.from(base64Payload, 'base64');
  if (bytes.length === 0) {
    throw new Error('Profile image payload is empty');
  }

  const maxSizeBytes = parsePositiveInt(
    process.env.PROFILE_IMAGE_MAX_FILE_SIZE_BYTES,
    DEFAULT_MAX_PROFILE_IMAGE_SIZE_BYTES
  );
  if (bytes.length > maxSizeBytes) {
    throw new Error(`Profile image exceeds max allowed size (${maxSizeBytes} bytes)`);
  }

  const extension = extensionFromContentType(contentType);
  const filename = `${userId}-${createHash('sha256').update(bytes).digest('hex')}.${extension}`;
  const outputDir = getProfileImageDirectory();

  await mkdir(outputDir, { recursive: true });

  const storedImagePath = path.join(outputDir, filename);
  await writeFile(storedImagePath, bytes);

  return { storedImagePath };
}
