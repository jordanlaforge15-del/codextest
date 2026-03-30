import { describe, expect, it } from 'vitest';
import type { Item, Workspace } from '@mvp/shared';
import { buildRenderPrompt } from '../src/services/render-prompt.js';

const workspace: Workspace = {
  id: 'workspace-1',
  title: 'Weekend Outfit',
  intentionText: 'Create a relaxed but polished spring outfit.',
  domainType: 'outfit',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const items: Item[] = [
  {
    id: 'item-1',
    workspaceId: workspace.id,
    sourceUrl: null,
    pageUrl: null,
    imageUrl: null,
    storedImagePath: '/tmp/shirt.png',
    title: 'Oxford Shirt',
    brand: 'Alex Mill',
    merchant: null,
    price: null,
    currency: null,
    slotType: 'top',
    role: 'fixed',
    metadataJson: { color: 'blue', material: 'cotton' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

describe('buildRenderPrompt', () => {
  it('includes workspace intention and item context', () => {
    const prompt = buildRenderPrompt(workspace, items);

    expect(prompt).toContain('Create a relaxed but polished spring outfit.');
    expect(prompt).toContain('slot/category: top');
    expect(prompt).toContain('role: fixed');
    expect(prompt).toContain('brand: Alex Mill');
    expect(prompt).toContain('metadata: color: blue, material: cotton');
    expect(prompt).toContain('not a body-specific try-on');
  });
});
