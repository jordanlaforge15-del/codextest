import assert from 'node:assert/strict';
import http from 'node:http';
import test, { mock } from 'node:test';
import { createApp } from '../src/index.js';

async function withServer(
  run: (baseUrl: string) => Promise<void>,
  app = createApp()
): Promise<void> {
  const server = await new Promise<http.Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Failed to resolve test server address');
  }

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

async function requestWithCookie(
  baseUrl: string,
  pathname: string,
  cookie: string
): Promise<{
  status: number;
  headers: http.IncomingHttpHeaders;
}> {
  const url = new URL(pathname, baseUrl);

  return await new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          Cookie: cookie
        }
      },
      (res) => {
        res.resume();
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers
          });
        });
      }
    );

    req.on('error', reject);
    req.end();
  });
}

test('GET / redirects to /login instead of serving static index', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/`, { redirect: 'manual' });

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/login');
  });
});

test('login flash messages are HTML-escaped', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/login?error=%3Cscript%3Ealert(1)%3C%2Fscript%3E`);
    const text = await response.text();

    assert.equal(response.status, 200);
    assert.match(text, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(text, /<script>alert\(1\)<\/script>/);
  });
});

test('invalid auth cookies are rejected by route guards', async () => {
  const restore = mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(JSON.stringify({ error: { message: 'Unauthorized' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
  );

  try {
    await withServer(async (baseUrl) => {
      const response = await requestWithCookie(baseUrl, '/home', 'mvp_auth_token=forged-token');

      assert.equal(response.status, 302);
      assert.equal(response.headers.location, '/login');
      assert.match(String(response.headers['set-cookie']), /mvp_auth_token=;/);
    });
  } finally {
    restore.mock.restore();
  }
});

test('GET /account renders profile image upload UI for authenticated users', async () => {
  const originalFetch = globalThis.fetch;
  const restore = mock.method(globalThis, 'fetch', async (input, init) => {
    const url = String(input);
    if (url.endsWith('/auth/me')) {
      return new Response(
        JSON.stringify({
          data: {
            id: 'user-1',
            email: 'user@example.com',
            name: 'Jordan',
            profileImageUrl: '/assets/profile-images/user-1.png',
            createdAt: new Date().toISOString()
          }
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return originalFetch(input, init);
  });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/account`, {
        headers: {
          Cookie: 'mvp_auth_token=valid-token'
        }
      });
      const text = await response.text();

      assert.equal(response.status, 200);
      assert.match(text, /Upload a photo of yourself/);
      assert.match(text, /account-profile\.js/);
      assert.match(text, /http:\/\/localhost:4000\/assets\/profile-images\/user-1\.png/);
    });
  } finally {
    restore.mock.restore();
  }
});

test('GET /home renders the workspace gallery layout', async () => {
  const originalFetch = globalThis.fetch;
  const restore = mock.method(globalThis, 'fetch', async (input, init) => {
    const url = String(input);
    const isApiRequest = url.startsWith('http://localhost:4000/');

    if (!isApiRequest) {
      return originalFetch(input, init);
    }

    if (url.endsWith('/auth/me')) {
      return new Response(
        JSON.stringify({
          data: {
            id: 'user-1',
            email: 'user@example.com',
            name: 'Jordan',
            profileImageUrl: null,
            createdAt: new Date().toISOString()
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.endsWith('/workspaces')) {
      return new Response(
        JSON.stringify({
          data: [
            {
              id: 'workspace-1',
              title: 'Trail Running',
              intentionText: null,
              domainType: 'outfit',
              selectedItemIds: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.endsWith('/workspaces/workspace-1/renders')) {
      return new Response(
        JSON.stringify({
          data: [
            {
              id: 'render-1',
              workspaceId: 'workspace-1',
              status: 'complete',
              renderMode: 'preview',
              selectedItemIds: ['item-1'],
              recommendationText: null,
              recommendationLabel: null,
              outputImagePath: '/tmp/render.png',
              outputImageUrl: '/assets/renders/render-1.png',
              errorMessage: null,
              currentVote: 'neutral',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    throw new Error(`Unexpected API fetch: ${url}`);
  });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/home`, {
        headers: {
          Cookie: 'mvp_auth_token=valid-token'
        }
      });
      const text = await response.text();

      assert.equal(response.status, 200);
      assert.match(text, /workspace-gallery/);
      assert.match(text, /Create workspace/);
      assert.match(text, /Trail Running/);
      assert.doesNotMatch(text, /workspace-gallery__delete/);
      assert.doesNotMatch(text, />Delete</);
    });
  } finally {
    restore.mock.restore();
  }
});

test('GET /workspace-renders.js omits role and slot metadata from readonly render item cards', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/workspace-renders.js`);
    const text = await response.text();

    assert.equal(response.status, 200);
    assert.doesNotMatch(text, /Role: \$\{item\.role\}/);
    assert.doesNotMatch(text, /Slot: \$\{item\.slotType \|\| 'none'\}/);
    assert.doesNotMatch(text, /View source/);
    assert.match(text, /data-sidebar-item-id="\$\{item\.id\}"/);
    assert.match(text, /card\.classList\.add\('is-expanded'\)/);
    assert.match(text, /target\.closest\('\.sidebar-item-card__checkbox'\)/);
  });
});

test('GET /styles.css preserves hidden sidebar views', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/styles.css`);
    const text = await response.text();

    assert.equal(response.status, 200);
    assert.match(text, /\.workspace-sidebar__view\[hidden\]\s*\{\s*display:\s*none;/);
    assert.match(text, /\.workspace-sidebar\s*\{[\s\S]*align-content:\s*start;/);
    assert.match(text, /\.workspace-sidebar\s*\{[\s\S]*grid-auto-rows:\s*max-content;/);
  });
});

test('GET /workspaces/:id renders the figma-style workspace shell', async () => {
  const originalFetch = globalThis.fetch;
  const restore = mock.method(globalThis, 'fetch', async (input, init) => {
    const url = String(input);
    const isApiRequest = url.startsWith('http://localhost:4000/');

    if (!isApiRequest) {
      return originalFetch(input, init);
    }

    if (url.endsWith('/auth/me')) {
      return new Response(
        JSON.stringify({
          data: {
            id: 'user-1',
            email: 'user@example.com',
            name: 'Jordan',
            profileImageUrl: null,
            createdAt: new Date().toISOString()
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.endsWith('/workspaces/workspace-1')) {
      return new Response(
        JSON.stringify({
          data: {
            id: 'workspace-1',
            title: 'Trail Running',
            intentionText: 'Pick the strongest outfit direction.',
            domainType: 'outfit',
            selectedItemIds: ['item-1'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.endsWith('/workspaces/workspace-1/items')) {
      return new Response(
        JSON.stringify({
          data: [
            {
              id: 'item-1',
              workspaceId: 'workspace-1',
              sourceUrl: 'https://example.com/item',
              pageUrl: 'https://example.com/item',
              imageUrl: 'https://example.com/item.jpg',
              storedImagePath: '/tmp/item.jpg',
              title: 'Capilene Shirt',
              brand: null,
              merchant: 'Patagonia',
              price: null,
              currency: null,
              slotType: 'shirt',
              role: 'candidate',
              metadataJson: {
                captureContext: {
                  altText: 'Lightweight technical base layer for trail runs'
                }
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.endsWith('/workspaces/workspace-1/renders')) {
      return new Response(
        JSON.stringify({
          data: [
            {
              id: 'render-1',
              workspaceId: 'workspace-1',
              status: 'complete',
              renderMode: 'preview',
              selectedItemIds: ['item-1'],
              recommendationText: null,
              recommendationLabel: null,
              outputImagePath: '/tmp/render.png',
              outputImageUrl: '/assets/renders/render-1.png',
              errorMessage: null,
              currentVote: 'up',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    throw new Error(`Unexpected API fetch: ${url}`);
  });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/workspaces/workspace-1`, {
        headers: {
          Cookie: 'mvp_auth_token=valid-token'
        }
      });
      const text = await response.text();

      assert.equal(response.status, 200);
      assert.match(text, /workspace-layout/);
      assert.match(text, /workspace-filter-tabs/);
      assert.match(text, /data-render-card/);
      assert.match(text, /data-render-inspect/);
      assert.match(text, /app-header__actions--workspace/);
      assert.match(text, /data-render-narrow/);
      assert.match(text, /data-sidebar-view="default"/);
      assert.match(text, /Items &amp; Renders/);
      assert.match(text, /workspace-renders\.js/);
      assert.match(text, /Brand/);
      assert.match(text, /Patagonia/);
      assert.match(text, /Description/);
      assert.match(text, /Lightweight technical base layer for trail runs/);
      assert.doesNotMatch(text, /sidebar-item-card__status/);
      assert.doesNotMatch(text, /Role: /);
      assert.doesNotMatch(text, /Slot: /);
      assert.doesNotMatch(text, /workspace-hero/);
      assert.doesNotMatch(text, /href="\/account"/);
      assert.doesNotMatch(text, /action="\/logout"/);
    });
  } finally {
    restore.mock.restore();
  }
});
