import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAssetUrl } from '../src/asset-url.js';

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
