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

async function requestWithCookie(baseUrl: string, pathname: string, cookie: string): Promise<{
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
  const restore = mock.method(globalThis, 'fetch', async () =>
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
