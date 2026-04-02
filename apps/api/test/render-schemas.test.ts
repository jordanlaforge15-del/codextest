import { describe, expect, it } from 'vitest';
import { createRenderSchema } from '../src/schemas/render-schemas.js';

describe('createRenderSchema', () => {
  it('rejects requests with fewer than two selected items', () => {
    const result = createRenderSchema.safeParse({
      selectedItemIds: ['item-1'],
      renderMode: 'preview'
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected schema validation to fail');
    }

    expect(result.error.flatten().fieldErrors.selectedItemIds).toContain(
      'Array must contain at least 2 element(s)'
    );
  });

  it('accepts requests with two selected items', () => {
    const result = createRenderSchema.safeParse({
      selectedItemIds: ['item-1', 'item-2'],
      renderMode: 'preview'
    });

    expect(result.success).toBe(true);
  });
});
