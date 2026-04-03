import 'dotenv/config';
import express, { type Express } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import type { Item, Render, Workspace } from '@mvp/shared';
import { getPreferredWorkspaceThumbnail, normalizeBaseUrl, resolveAssetUrl } from './asset-url.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');
const port = Number(process.env.PORT ?? 3000);
const apiBaseUrl = normalizeBaseUrl(process.env.API_BASE_URL?.trim() || 'http://localhost:4000');
const authCookieName = 'mvp_auth_token';

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return header.split(';').reduce<Record<string, string>>((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

type Flash = { type: 'error' | 'success'; message: string } | null;

function getAuthToken(req: express.Request): string | null {
  const token = parseCookies(req.headers.cookie)[authCookieName];
  return typeof token === 'string' && token.length > 0 ? token : null;
}

async function fetchApi<T>(pathName: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${apiBaseUrl}${pathName}`, {
    ...init,
    headers
  });

  const payload = (await response.json().catch(() => null)) as { error?: { message?: string }; data?: T } | null;
  if (response.ok && response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    throw new Error(payload?.error?.message || `Request failed (${response.status})`);
  }

  return (payload?.data as T) ?? (undefined as T);
}

function htmlPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <main class="container">
      ${body}
    </main>
  </body>
</html>`;
}

function flashMarkup(flash: Flash): string {
  if (!flash) {
    return '';
  }

  return `<p class="flash flash-${flash.type}">${escapeHtml(flash.message)}</p>`;
}

function authFormPage(params: {
  title: string;
  heading: string;
  action: '/login' | '/signup';
  submitLabel: string;
  alternateHref: '/login' | '/signup';
  alternateLabel: string;
  flash: Flash;
  includeNameField?: boolean;
}): string {
  return htmlPage(
    params.title,
    `
      <section class="panel auth-panel">
        <h1>${params.heading}</h1>
        ${flashMarkup(params.flash)}
        <form method="post" action="${params.action}" class="stack">
          ${
            params.includeNameField
              ? '<label>Name (optional)<input type="text" name="name" autocomplete="name" /></label>'
              : ''
          }
          <label>Email<input type="email" name="email" autocomplete="email" required /></label>
          <label>Password<input type="password" name="password" autocomplete="current-password" minlength="8" required /></label>
          <button type="submit">${params.submitLabel}</button>
        </form>
        <p><a href="${params.alternateHref}">${params.alternateLabel}</a></p>
      </section>
    `
  );
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    if (char === '&') return '&amp;';
    if (char === '<') return '&lt;';
    if (char === '>') return '&gt;';
    if (char === '"') return '&quot;';
    return '&#39;';
  });
}

function getItemOriginalUrl(item: Item): string | null {
  return item.pageUrl ?? item.sourceUrl ?? null;
}

function parseSelectedItemIds(raw: unknown): string[] {
  if (typeof raw === 'string') {
    return [raw];
  }

  if (Array.isArray(raw)) {
    return raw.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
  }

  return [];
}

async function requireToken(req: express.Request, res: express.Response): Promise<string | null> {
  const token = getAuthToken(req);
  if (!token) {
    res.redirect('/login');
    return null;
  }

  try {
    await fetchApi('/auth/me', {}, token);
    return token;
  } catch {
    res.clearCookie(authCookieName);
    res.redirect('/login');
    return null;
  }
}

function groupRenders(renders: Render[]): Record<'up' | 'neutral' | 'down' | 'unvoted', Render[]> {
  return renders.reduce<Record<'up' | 'neutral' | 'down' | 'unvoted', Render[]>>(
    (groups, render) => {
      if (render.status === 'failed') {
        return groups;
      }

      const key = render.currentVote ?? 'unvoted';
      groups[key].push(render);
      return groups;
    },
    { up: [], neutral: [], down: [], unvoted: [] }
  );
}

function renderItemSummaryContent(item: Item): string {
  return `
    <img src="${escapeHtml(item.imageUrl || '')}" alt="${escapeHtml(item.title || 'item')}" onerror="this.style.display='none'" />
    <span>
      ${
        getItemOriginalUrl(item)
          ? `<strong><a href="${escapeHtml(getItemOriginalUrl(item) ?? '')}" target="_blank" rel="noreferrer">${escapeHtml(item.title || 'Untitled item')}</a></strong>`
          : `<strong>${escapeHtml(item.title || 'Untitled item')}</strong>`
      }<br />
      role: ${item.role} · slot: ${escapeHtml(item.slotType || 'none')}
    </span>
  `;
}

function renderSelectedItemsSummary(render: Render, items: Item[]): string {
  const selectedItems = render.selectedItemIds
    .map((itemId) => items.find((item) => item.id === itemId))
    .filter((item): item is Item => Boolean(item));

  if (selectedItems.length === 0) {
    return '<p class="empty">No selected items found for this render.</p>';
  }

  return `<div class="stack">${selectedItems
    .map((item) => `<div class="item-row render-item-row">${renderItemSummaryContent(item)}</div>`)
    .join('')}</div>`;
}

function renderWorkspacePage(params: {
  workspace: Workspace;
  items: Item[];
  renders: Render[];
  flash: Flash;
}): string {
  const groups = groupRenders(params.renders);

  return htmlPage(
    `${params.workspace.title} · Workspace`,
    `
      <header class="topbar">
        <a href="/home">← Home</a>
        <form method="post" action="/logout"><button type="submit">Log out</button></form>
      </header>
      <section class="panel">
        <h1>${escapeHtml(params.workspace.title)}</h1>
        <p>${escapeHtml(params.workspace.intentionText || 'No intention text provided.')}</p>
        ${flashMarkup(params.flash)}
      </section>

      <section class="grid-two">
        <section class="panel">
          <h2>Items</h2>
          <form method="post" action="/workspaces/${params.workspace.id}/renders" class="stack">
            <p>Selected items are used to request a render.</p>
            <p><strong>Total items:</strong> ${params.items.length}</p>
            ${
              params.items.length === 0
                ? '<p class="empty">No items in this workspace yet.</p>'
                : `<div class="stack">${params.items
                    .map(
                      (item) => `
                        <div class="item-row">
                          <input type="checkbox" name="selectedItemIds" value="${item.id}" />
                          ${renderItemSummaryContent(item)}
                          <button
                            type="submit"
                            formaction="/workspaces/${params.workspace.id}/items/${item.id}/delete"
                            formmethod="post"
                          >
                            Delete
                          </button>
                        </div>
                      `
                    )
                    .join('')}</div>`
            }
            <label>
              Render mode
              <select name="renderMode">
                <option value="preview">preview</option>
                <option value="high_quality">high_quality</option>
              </select>
            </label>
            <button type="submit" ${params.items.length === 0 ? 'disabled' : ''}>Request render</button>
          </form>
        </section>

        <section class="panel">
          <h2>Renders by vote</h2>
          ${(['up', 'neutral', 'down', 'unvoted'] as const)
            .map(
              (voteType) => `
                <section class="vote-group">
                  <h3>${voteType[0].toUpperCase()}${voteType.slice(1)}</h3>
                  ${
                    groups[voteType].length === 0
                      ? '<p class="empty">No renders in this category.</p>'
                      : groups[voteType]
                          .map(
                            (render) => `
                              <article class="render-row">
                                ${
                                  resolveAssetUrl(apiBaseUrl, render.outputImageUrl)
                                    ? `<img src="${escapeHtml(resolveAssetUrl(apiBaseUrl, render.outputImageUrl) ?? '')}" alt="render ${render.id}" />`
                                    : ''
                                }
                                <div>
                                  <strong>${render.id}</strong><br />
                                  <p>status: ${render.status} · vote: ${render.currentVote || 'unvoted'}</p>
                                  <p>created: ${new Date(render.createdAt).toLocaleString()}</p>
                                  ${
                                    voteType === 'unvoted'
                                      ? `
                                        <form method="post" action="/workspaces/${params.workspace.id}/renders/${render.id}/vote" class="render-vote-form">
                                          <button type="submit" name="vote" value="up">Up</button>
                                          <button type="submit" name="vote" value="neutral">Neutral</button>
                                          <button type="submit" name="vote" value="down">Down</button>
                                        </form>
                                      `
                                      : ''
                                  }
                                  <p><strong>Items in render</strong></p>
                                  ${renderSelectedItemsSummary(render, params.items)}
                                </div>
                              </article>
                            `
                          )
                          .join('')
                  }
                </section>
              `
            )
            .join('')}
        </section>
      </section>
    `
  );
}

function renderWorkspaceList(params: {
  workspaces: Workspace[];
  rendersByWorkspaceId: Map<string, Render[]>;
}): string {
  if (params.workspaces.length === 0) {
    return '<p class="empty">No workspaces yet.</p>';
  }

  return `<div class="workspace-list">${params.workspaces
    .map((workspace) => {
      const thumbnailUrl = resolveAssetUrl(
        apiBaseUrl,
        getPreferredWorkspaceThumbnail(params.rendersByWorkspaceId.get(workspace.id) ?? [])
      );

      return `
        <article class="workspace-card">
          <a class="workspace-card-link" href="/workspaces/${workspace.id}">
            ${
              thumbnailUrl
                ? `<img src="${escapeHtml(thumbnailUrl)}" alt="${escapeHtml(workspace.title)} thumbnail" />`
                : '<div class="workspace-card-placeholder" aria-hidden="true">No preview</div>'
            }
            <div>
              <strong>${escapeHtml(workspace.title)}</strong>
            </div>
          </a>
          <form method="post" action="/home/workspaces/${workspace.id}/delete">
            <button type="submit">Delete</button>
          </form>
        </article>
      `;
    })
    .join('')}</div>`;
}

export function createApp(): Express {
  const app: Express = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.static(publicDir, { index: false }));

  app.get('/', async (req, res) => {
    const token = getAuthToken(req);
    if (!token) {
      res.redirect('/login');
      return;
    }

    try {
      await fetchApi('/auth/me', {}, token);
      res.redirect('/home');
    } catch {
      res.clearCookie(authCookieName);
      res.redirect('/login');
    }
  });

  app.get('/login', async (req, res) => {
    const token = getAuthToken(req);
    if (token) {
      try {
        await fetchApi('/auth/me', {}, token);
        res.redirect('/home');
        return;
      } catch {
        res.clearCookie(authCookieName);
      }
    }

    const flash = req.query.error ? { type: 'error' as const, message: String(req.query.error) } : null;
    res.send(
      authFormPage({
        title: 'Login',
        heading: 'Log in',
        action: '/login',
        submitLabel: 'Log in',
        alternateHref: '/signup',
        alternateLabel: 'Create account',
        flash
      })
    );
  });

  app.post('/login', async (req, res) => {
  try {
    const data = await fetchApi<{ token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: String(req.body.email ?? ''),
        password: String(req.body.password ?? '')
      })
    });

    res.cookie(authCookieName, data.token, { httpOnly: true, sameSite: 'lax' });
    res.redirect('/home');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    res.redirect(`/login?error=${encodeURIComponent(message)}`);
  }
  });

  app.get('/signup', (req, res) => {
  const flash = req.query.error
    ? { type: 'error' as const, message: String(req.query.error) }
    : req.query.success
      ? { type: 'success' as const, message: String(req.query.success) }
      : null;

  res.send(
    authFormPage({
      title: 'Create account',
      heading: 'Create account',
      action: '/signup',
      submitLabel: 'Create account',
      alternateHref: '/login',
      alternateLabel: 'Already have an account? Log in',
      flash,
      includeNameField: true
    })
  );
  });

  app.post('/signup', async (req, res) => {
  try {
    await fetchApi('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        name: String(req.body.name ?? '').trim() || undefined,
        email: String(req.body.email ?? ''),
        password: String(req.body.password ?? '')
      })
    });

    res.redirect('/login?error=' + encodeURIComponent('Account created. You can log in now.'));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Signup failed';
    res.redirect(`/signup?error=${encodeURIComponent(message)}`);
  }
  });

  app.post('/logout', (_req, res) => {
    res.clearCookie(authCookieName);
    res.redirect('/login');
  });

  app.get('/home', async (req, res) => {
  const token = await requireToken(req, res);
  if (!token) return;

  try {
    const workspaces = await fetchApi<Workspace[]>('/workspaces', {}, token);
    const rendersByWorkspaceId = new Map<string, Render[]>(
      await Promise.all(
        workspaces.map(async (workspace) => {
          const renders = await fetchApi<Render[]>(`/workspaces/${workspace.id}/renders`, {}, token);
          return [workspace.id, renders] as const;
        })
      )
    );

    res.send(
      htmlPage(
        'Home',
        `
          <header class="topbar">
            <h1>Workspaces</h1>
            <form method="post" action="/logout"><button type="submit">Log out</button></form>
          </header>
          <section class="panel">
            <h2>Existing workspaces</h2>
            ${renderWorkspaceList({ workspaces, rendersByWorkspaceId })}
          </section>
          <section class="panel stack">
            <h2>Create workspace</h2>
            <form method="post" action="/home/workspaces" class="stack">
              <label>Title<input name="title" required /></label>
              <label>Intention text (optional)<input name="intentionText" /></label>
              <button type="submit">Create workspace</button>
            </form>
          </section>
        `
      )
    );
  } catch {
    res.status(500).send(htmlPage('Home', '<p>Failed to load workspaces.</p>'));
  }
  });

  app.post('/home/workspaces', async (req, res) => {
  const token = await requireToken(req, res);
  if (!token) return;

  try {
    const workspace = await fetchApi<Workspace>(
      '/workspaces',
      {
        method: 'POST',
        body: JSON.stringify({
          title: String(req.body.title ?? '').trim(),
          intentionText: String(req.body.intentionText ?? '').trim() || null,
          domainType: 'other'
        })
      },
      token
    );

    res.redirect(`/workspaces/${workspace.id}`);
  } catch {
    res.redirect('/home');
  }
  });

  app.post('/home/workspaces/:workspaceId/delete', async (req, res) => {
  const token = await requireToken(req, res);
  if (!token) return;

  const workspaceId = req.params.workspaceId;

  try {
    await fetchApi(
      `/workspaces/${workspaceId}`,
      {
        method: 'DELETE'
      },
      token
    );

    res.redirect('/home');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete workspace';
    res.redirect(`/home?error=${encodeURIComponent(message)}`);
  }
  });

  app.post('/workspaces/:workspaceId/items/:itemId/delete', async (req, res) => {
  const token = await requireToken(req, res);
  if (!token) return;

  const workspaceId = req.params.workspaceId;
  const itemId = req.params.itemId;

  try {
    await fetchApi(
      `/workspaces/${workspaceId}/items/${itemId}`,
      {
        method: 'DELETE'
      },
      token
    );

    res.redirect(`/workspaces/${workspaceId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete item';
    res.redirect(`/workspaces/${workspaceId}?error=${encodeURIComponent(message)}`);
  }
  });

  app.post('/workspaces/:workspaceId/renders/:renderId/vote', async (req, res) => {
  const token = await requireToken(req, res);
  if (!token) return;

  const workspaceId = req.params.workspaceId;
  const renderId = req.params.renderId;
  const vote = String(req.body.vote ?? '');

  if (!['up', 'neutral', 'down'].includes(vote)) {
    res.redirect(`/workspaces/${workspaceId}?error=${encodeURIComponent('Invalid render vote')}`);
    return;
  }

  try {
    await fetchApi(
      `/workspaces/${workspaceId}/renders/${renderId}/vote`,
      {
        method: 'PUT',
        body: JSON.stringify({ vote })
      },
      token
    );

    res.redirect(`/workspaces/${workspaceId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save render vote';
    res.redirect(`/workspaces/${workspaceId}?error=${encodeURIComponent(message)}`);
  }
  });

  app.get('/workspaces/:workspaceId', async (req, res) => {
  const token = await requireToken(req, res);
  if (!token) return;

  const workspaceId = req.params.workspaceId;
  try {
    const [workspace, items, renders] = await Promise.all([
      fetchApi<Workspace>(`/workspaces/${workspaceId}`, {}, token),
      fetchApi<Item[]>(`/workspaces/${workspaceId}/items`, {}, token),
      fetchApi<Render[]>(`/workspaces/${workspaceId}/renders`, {}, token)
    ]);

    const flash = req.query.error ? { type: 'error' as const, message: String(req.query.error) } : null;
    res.send(renderWorkspacePage({ workspace, items, renders, flash }));
  } catch {
    res.status(404).send(htmlPage('Workspace', '<p>Workspace not found.</p><p><a href="/home">Back to home</a></p>'));
  }
  });

  app.post('/workspaces/:workspaceId/renders', async (req, res) => {
  const token = await requireToken(req, res);
  if (!token) return;

  const workspaceId = req.params.workspaceId;
  const selectedItemIds = parseSelectedItemIds(req.body.selectedItemIds);

  if (selectedItemIds.length < 2) {
    res.redirect(`/workspaces/${workspaceId}?error=${encodeURIComponent('Select at least two items')}`);
    return;
  }

  try {
    await fetchApi(
      `/workspaces/${workspaceId}/renders`,
      {
        method: 'POST',
        body: JSON.stringify({
          selectedItemIds,
          renderMode: req.body.renderMode === 'high_quality' ? 'high_quality' : 'preview'
        })
      },
      token
    );
    res.redirect(`/workspaces/${workspaceId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to request render';
    res.redirect(`/workspaces/${workspaceId}?error=${encodeURIComponent(message)}`);
  }
  });

  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const app = createApp();

  app.listen(port, () => {
    console.log(`Web app listening on http://localhost:${port}`);
  });
}
