import { describe, expect, it, vi } from 'vitest';
import { processClaimedRenderJob } from '../src/services/render-processor.js';

describe('processClaimedRenderJob', () => {
  it('marks the render failed when OpenAI generation fails', async () => {
    const markRenderFailed = vi.fn(async () => undefined);

    await processClaimedRenderJob(
      {
        id: 'render-1',
        workspaceId: 'workspace-1',
        renderMode: 'preview',
        selectedItemIds: ['item-1'],
        personImagePath: null
      },
      {
        loadRenderJob: async () => ({
          id: 'render-1',
          workspaceId: 'workspace-1',
          renderMode: 'preview',
          selectedItemIds: ['item-1'],
          personImagePath: null,
          workspace: {
            id: 'workspace-1',
            title: 'Test',
            intentionText: null,
            domainType: 'outfit',
            selectedItemIds: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          items: []
        }),
        generateRenderPreview: async () => {
          throw new Error('OpenAI unavailable');
        },
        saveGeneratedRender: async () => '/tmp/render-1.png',
        markRenderComplete: async () => undefined,
        markRenderFailed
      }
    );

    expect(markRenderFailed).toHaveBeenCalledWith('render-1', 'OpenAI unavailable');
  });
});
