import { describe, expect, it } from 'vitest';
import type { Item, Workspace } from '@mvp/shared';
import { buildRenderPrompt } from '../src/services/render-prompt.js';

const workspace: Workspace = {
  id: 'workspace-1',
  title: 'Weekend Outfit',
  intentionText: 'Create a relaxed but polished spring outfit.',
  domainType: 'outfit',
  selectedItemIds: [],
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

    expect(prompt).toContain('Highest priority: the final image must show the complete person from head to toe');
    expect(prompt).toContain('Create a relaxed but polished spring outfit.');
    expect(prompt).toContain('slot/category: top');
    expect(prompt).toContain('role: fixed');
    expect(prompt).not.toContain('brand: Alex Mill');
    expect(prompt).not.toContain('metadata:');
    expect(prompt).toContain('not a body-specific try-on');
    expect(prompt).toContain('straight-on full-body studio catalog image');
    expect(prompt).toContain('Preserve garment colors, visible materials, textures');
    expect(prompt).toContain('Do not invent different garment designs');
    expect(prompt).toContain('camera must be zoomed out enough to show the entire person from head to toe');
    expect(prompt).toContain('centered in frame and fully contained inside the image');
    expect(prompt).toContain('full head, hair, hands, arms, legs, and shoes visible');
    expect(prompt).toContain('white space above the head, below the feet, and on both sides');
    expect(prompt).toContain('70 to 80 percent of the image height');
    expect(prompt).toContain('Do not crop any part of the body, hair, hands, feet, shoes, or clothing');
    expect(prompt).toContain('Do not use a close-up, mid-shot, waist-up, knee-up, or tightly framed composition');
    expect(prompt).toContain('make the subject slightly smaller in frame');
    expect(prompt).toContain('plain white background');
    expect(prompt).toContain('should look happy');
    expect(prompt).toContain('must not contain any nudity');
    expect(prompt).toContain('must not be displaying any offensive hand gestures');
    expect(prompt).toContain('safe, non-explicit apparel image');
  });

  it('adds person-reference safety guidance when a profile photo is provided', () => {
    const prompt = buildRenderPrompt(workspace, items, { usePersonReference: true });

    expect(prompt).toContain('Use the provided person photo as the identity, body, face, hair, and pose reference');
    expect(prompt).toContain('render the supplied garments onto that same person');
    expect(prompt).toContain('ignore it and instead render a generic safe adult model');
    expect(prompt).toContain('shows more than one person');
  });
});
