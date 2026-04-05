import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ingestImageFromUrl } from '../src/services/image-ingestion-service.js';
import {
  getProfileImageDirectory,
  ingestProfileImageFromDataUrl,
  toProfileImageUrl
} from '../src/services/profile-image-service.js';

const originalEnv = {
  IMAGE_STORAGE_PATH: process.env.IMAGE_STORAGE_PATH,
  IMAGE_MAX_FILE_SIZE_BYTES: process.env.IMAGE_MAX_FILE_SIZE_BYTES,
  IMAGE_FETCH_TIMEOUT_MS: process.env.IMAGE_FETCH_TIMEOUT_MS,
  PROFILE_IMAGE_STORAGE_PATH: process.env.PROFILE_IMAGE_STORAGE_PATH,
  PROFILE_IMAGE_MAX_FILE_SIZE_BYTES: process.env.PROFILE_IMAGE_MAX_FILE_SIZE_BYTES
};

afterEach(async () => {
  vi.restoreAllMocks();
  process.env.IMAGE_STORAGE_PATH = originalEnv.IMAGE_STORAGE_PATH;
  process.env.IMAGE_MAX_FILE_SIZE_BYTES = originalEnv.IMAGE_MAX_FILE_SIZE_BYTES;
  process.env.IMAGE_FETCH_TIMEOUT_MS = originalEnv.IMAGE_FETCH_TIMEOUT_MS;
  process.env.PROFILE_IMAGE_STORAGE_PATH = originalEnv.PROFILE_IMAGE_STORAGE_PATH;
  process.env.PROFILE_IMAGE_MAX_FILE_SIZE_BYTES = originalEnv.PROFILE_IMAGE_MAX_FILE_SIZE_BYTES;
});

describe('ingestImageFromUrl', () => {
  it('downloads and stores an image to local storage', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'image-ingest-'));
    process.env.IMAGE_STORAGE_PATH = tempDir;

    const payload = Buffer.from('fake-image-data');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(payload, {
        status: 200,
        headers: {
          'content-type': 'image/png',
          'content-length': String(payload.length)
        }
      })
    );

    const result = await ingestImageFromUrl('https://example.com/image.png');
    const savedBytes = await readFile(result.storedImagePath);

    expect(savedBytes.equals(payload)).toBe(true);
    expect(result.storedImagePath.startsWith(tempDir)).toBe(true);

    await rm(tempDir, { recursive: true, force: true });
  });

  it('rejects non-image responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('not an image', {
        status: 200,
        headers: {
          'content-type': 'text/html'
        }
      })
    );

    await expect(ingestImageFromUrl('https://example.com/not-image')).rejects.toThrow(
      'Image URL does not point to an image resource'
    );
  });

  it('rejects payloads larger than configured max size', async () => {
    process.env.IMAGE_MAX_FILE_SIZE_BYTES = '5';

    const payload = Buffer.from('payload-too-large');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(payload, {
        status: 200,
        headers: {
          'content-type': 'image/jpeg',
          'content-length': String(payload.length)
        }
      })
    );

    await expect(ingestImageFromUrl('https://example.com/huge.jpg')).rejects.toThrow(
      'Image exceeds max allowed size (5 bytes)'
    );
  });
});

describe('ingestProfileImageFromDataUrl', () => {
  it('stores a base64 image payload for a user profile', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'profile-image-ingest-'));
    process.env.PROFILE_IMAGE_STORAGE_PATH = tempDir;

    const payload = Buffer.from('fake-profile-image');
    const imageDataUrl = `data:image/png;base64,${payload.toString('base64')}`;

    const result = await ingestProfileImageFromDataUrl('user-1', imageDataUrl);
    const savedBytes = await readFile(result.storedImagePath);

    expect(savedBytes.equals(payload)).toBe(true);
    expect(result.storedImagePath.startsWith(tempDir)).toBe(true);
    expect(getProfileImageDirectory()).toBe(tempDir);
    expect(toProfileImageUrl(result.storedImagePath)).toMatch(/^\/assets\/profile-images\//);

    await rm(tempDir, { recursive: true, force: true });
  });

  it('rejects invalid data URLs', async () => {
    await expect(ingestProfileImageFromDataUrl('user-1', 'https://example.com/image.png')).rejects.toThrow(
      'Profile image must be a base64-encoded image data URL'
    );
  });
});
