import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('auth secret configuration', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('fails fast when AUTH_JWT_SECRET is missing', async () => {
    const original = process.env.AUTH_JWT_SECRET;
    delete process.env.AUTH_JWT_SECRET;

    try {
      const { meService } = await import('../src/services/auth-service.js');

      await expect(meService('user-id.9999999999.abcd')).rejects.toThrow('AUTH_JWT_SECRET must be set');
    } finally {
      process.env.AUTH_JWT_SECRET = original;
    }
  });
});
