import assert from 'node:assert/strict';
import test from 'node:test';
import { getPreferredWorkspaceThumbnail, resolveAssetUrl } from '../src/asset-url.js';

test('resolveAssetUrl prefixes API base URL for relative asset paths', () => {
  assert.equal(
    resolveAssetUrl('http://localhost:4000', '/assets/renders/render-1.png'),
    'http://localhost:4000/assets/renders/render-1.png'
  );
});

test('resolveAssetUrl preserves absolute URLs', () => {
  assert.equal(
    resolveAssetUrl('http://localhost:4000', 'https://cdn.example.com/render-1.png'),
    'https://cdn.example.com/render-1.png'
  );
});

test('getPreferredWorkspaceThumbnail returns an up-voted render image when present', () => {
  assert.equal(
    getPreferredWorkspaceThumbnail([
      {
        id: 'render-1',
        workspaceId: 'workspace-1',
        status: 'complete',
        renderMode: 'preview',
        selectedItemIds: ['item-1', 'item-2'],
        recommendationText: null,
        recommendationLabel: null,
        outputImagePath: '/tmp/render-1.png',
        outputImageUrl: '/assets/renders/render-1.png',
        errorMessage: null,
        currentVote: 'up',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]),
    '/assets/renders/render-1.png'
  );
});
