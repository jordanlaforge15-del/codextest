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
type AccountUser = {
  id: string;
  email: string;
  name: string | null;
  profileImageUrl: string | null;
  createdAt: string;
};

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

  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
    data?: T;
  } | null;
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

type RenderBrowserState = 'yes' | 'maybe' | 'no';

function getRenderBrowserState(render: Render): RenderBrowserState {
  if (render.currentVote === 'up') {
    return 'yes';
  }

  if (render.currentVote === 'down') {
    return 'no';
  }

  return 'maybe';
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

function renderWorkspaceRenderCard(render: Render): string {
  const imageUrl = resolveAssetUrl(apiBaseUrl, render.outputImageUrl);
  const browserState = getRenderBrowserState(render);
  const statusLabel = render.renderMode === 'high_quality' ? 'High quality' : 'Preview';

  return `
    <article
      class="workspace-render-card"
      data-render-card
      data-render-id="${render.id}"
      data-render-state="${browserState}"
      data-render-vote="${render.currentVote ?? ''}"
    >
      <button
        type="button"
        class="workspace-render-card__button"
        data-render-toggle
        aria-pressed="${browserState === 'yes' ? 'true' : 'false'}"
      >
        <span class="workspace-render-card__indicator workspace-render-card__indicator--yes" aria-hidden="true">✓</span>
        <span class="workspace-render-card__indicator workspace-render-card__indicator--no" aria-hidden="true">✕</span>
        <span class="workspace-render-card__image-frame">
          ${
            imageUrl
              ? `<img src="${escapeHtml(imageUrl)}" alt="Render ${render.id}" class="workspace-render-card__image" />`
              : `<span class="workspace-render-card__placeholder">${escapeHtml(render.status)}</span>`
          }
        </span>
        <span class="workspace-render-card__meta">
          <strong>${escapeHtml(statusLabel)} render</strong>
          <span>${new Date(render.createdAt).toLocaleString()}</span>
        </span>
      </button>
    </article>
  `;
}

function renderWorkspacePage(params: {
  workspace: Workspace;
  items: Item[];
  renders: Render[];
  flash: Flash;
}): string {
  const visibleRenders = params.renders.filter((render) => render.status !== 'failed');

  return htmlPage(
    `${params.workspace.title} · Workspace`,
    `
      <div class="workspace-shell">
        <header class="workspace-shell__topbar">
          <div class="topbar-links">
            <a href="/home">← Home</a>
            <a href="/account">Account</a>
          </div>
          <form method="post" action="/logout"><button type="submit">Log out</button></form>
        </header>

        <form
          method="post"
          action="/workspaces/${params.workspace.id}/renders"
          class="workspace-form"
          data-workspace-form
          data-workspace-id="${params.workspace.id}"
        >
          <header class="workspace-hero">
            <div class="workspace-hero__identity">
              <div class="workspace-hero__mark" aria-hidden="true">✦</div>
              <div class="workspace-hero__copy">
                <h1>${escapeHtml(params.workspace.title)}</h1>
                <p>${escapeHtml(params.workspace.intentionText || 'Select your favorites and request the next render.')}</p>
              </div>
            </div>
            <div class="workspace-hero__actions">
              <button type="button" class="workspace-action workspace-action--secondary" data-render-undo hidden>Undo</button>
              <button type="button" class="workspace-action workspace-action--primary" data-render-narrow disabled>Narrow Down</button>
            </div>
          </header>

          ${flashMarkup(params.flash)}
        </form>

        <section class="workspace-renders-browser panel" data-render-browser data-workspace-id="${params.workspace.id}">
          <nav class="workspace-filter-tabs" aria-label="Render filters">
            <button type="button" class="workspace-filter-tab is-active" data-render-filter="all">All <span data-render-count="all">0</span></button>
            <button type="button" class="workspace-filter-tab" data-render-filter="yes">Yes <span data-render-count="yes">0</span></button>
            <button type="button" class="workspace-filter-tab" data-render-filter="maybe">Maybe <span data-render-count="maybe">0</span></button>
            <button type="button" class="workspace-filter-tab" data-render-filter="no">No <span data-render-count="no">0</span></button>
          </nav>
          ${
            visibleRenders.length > 0
              ? `
                  <div class="workspace-render-grid" data-render-grid>${visibleRenders
                    .map((render) => renderWorkspaceRenderCard(render))
                    .join('')}</div>
                  <div class="workspace-empty-state" data-render-empty hidden>
                    <div class="workspace-empty-state__icon" aria-hidden="true">✦</div>
                    <p>No renders in this category.</p>
                    <button type="button" class="workspace-action workspace-action--link" data-render-reset>View all renders</button>
                  </div>
                `
              : `
                  <div class="workspace-empty-state" data-render-empty>
                    <div class="workspace-empty-state__icon" aria-hidden="true">✦</div>
                    <p>No renders in this category.</p>
                    <button type="button" class="workspace-action workspace-action--link" data-render-reset>View all renders</button>
                  </div>
                `
          }
        </section>

        <form
          method="post"
          action="/workspaces/${params.workspace.id}/renders"
          class="workspace-items-panel panel"
          data-workspace-form
          data-workspace-id="${params.workspace.id}"
        >
          <div class="workspace-items-panel__header">
            <div>
              <h2>Source Items</h2>
              <p>Selected items are used to request a render.</p>
            </div>
            <p><strong>Total items:</strong> ${params.items.length}</p>
          </div>
          ${
            params.items.length === 0
              ? '<p class="empty">No items in this workspace yet.</p>'
              : `<div class="workspace-items-grid">${params.items
                  .map(
                    (item) => `
                      <label class="workspace-item-card">
                        <input type="checkbox" name="selectedItemIds" value="${item.id}" data-selected-item-checkbox ${params.workspace.selectedItemIds.includes(item.id) ? 'checked' : ''} />
                        <span class="workspace-item-card__body">
                          <span class="workspace-item-card__summary">${renderItemSummaryContent(item)}</span>
                          <button
                            type="submit"
                            class="workspace-item-card__delete"
                            formaction="/workspaces/${params.workspace.id}/items/${item.id}/delete"
                            formmethod="post"
                          >
                            Delete
                          </button>
                        </span>
                      </label>
                    `
                  )
                  .join('')}</div>`
          }
          <div class="workspace-items-panel__footer">
            <label class="workspace-render-mode">
              <span>Render mode</span>
              <select name="renderMode">
                <option value="preview">Preview</option>
                <option value="high_quality">High Quality</option>
              </select>
            </label>
            <button type="submit" class="workspace-action workspace-action--primary" ${params.items.length === 0 ? 'disabled' : ''}>
              Request render
            </button>
          </div>
        </form>
      </div>
      <script src="/workspace-selection.js"></script>
      <script src="/workspace-renders.js"></script>
    `
  );
}

function renderAccountPage(params: { user: AccountUser; flash: Flash }): string {
  const profileImageUrl = resolveAssetUrl(apiBaseUrl, params.user.profileImageUrl);

  return htmlPage(
    'Account',
    `
      <header class="topbar">
        <div class="topbar-links">
          <a href="/home">← Home</a>
          <a href="/account">Account</a>
        </div>
        <form method="post" action="/logout"><button type="submit">Log out</button></form>
      </header>
      <section class="panel stack">
        <h1>Account</h1>
        <p>Upload a clear photo of yourself so outfit renders can place the selected clothing onto your body instead of a generic model.</p>
        ${flashMarkup(params.flash)}
      </section>
      <section class="panel stack">
        <h2>Profile</h2>
        <p><strong>Name:</strong> ${escapeHtml(params.user.name || 'Not set')}</p>
        <p><strong>Email:</strong> ${escapeHtml(params.user.email)}</p>
        <p><strong>Member since:</strong> ${new Date(params.user.createdAt).toLocaleString()}</p>
        <div class="profile-image-block">
          ${
            profileImageUrl
              ? `<img class="profile-image-preview" src="${escapeHtml(profileImageUrl)}" alt="Profile reference" />`
              : '<div class="profile-image-placeholder">No profile image uploaded yet.</div>'
          }
        </div>
        <form class="stack" data-profile-image-form>
          <label>
            Upload a photo of yourself
            <input type="file" name="profileImage" accept="image/*" required />
          </label>
          <p class="muted">
            Use a single-person photo with a clear face and preferably a full-body pose. Unsafe or irrelevant uploads should be ignored by the render prompt, but this is only a short-term safety layer.
          </p>
          <button type="submit">Upload profile image</button>
          <p class="status-message" data-profile-image-status aria-live="polite"></p>
        </form>
      </section>
      <script src="/account-profile.js"></script>
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
  app.use(express.json({ limit: '12mb' }));
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

    const flash = req.query.error
      ? { type: 'error' as const, message: String(req.query.error) }
      : null;
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

  app.get('/account', async (req, res) => {
    const token = await requireToken(req, res);
    if (!token) return;

    try {
      const user = await fetchApi<AccountUser>('/auth/me', {}, token);
      const flash = req.query.error
        ? { type: 'error' as const, message: String(req.query.error) }
        : req.query.success
          ? { type: 'success' as const, message: String(req.query.success) }
          : null;
      res.send(renderAccountPage({ user, flash }));
    } catch {
      res.status(500).send(htmlPage('Account', '<p>Failed to load account details.</p>'));
    }
  });

  app.post('/account/profile-image', async (req, res) => {
    const token = await requireToken(req, res);
    if (!token) return;

    try {
      const user = await fetchApi<AccountUser>(
        '/auth/profile-image',
        {
          method: 'PUT',
          body: JSON.stringify({
            imageDataUrl: String(req.body.imageDataUrl ?? '')
          })
        },
        token
      );

      res.status(200).json({
        data: {
          ...user,
          profileImageUrl: resolveAssetUrl(apiBaseUrl, user.profileImageUrl)
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload profile image';
      res.status(400).json({ error: { message } });
    }
  });

  app.get('/home', async (req, res) => {
    const token = await requireToken(req, res);
    if (!token) return;

    try {
      const workspaces = await fetchApi<Workspace[]>('/workspaces', {}, token);
      const rendersByWorkspaceId = new Map<string, Render[]>(
        await Promise.all(
          workspaces.map(async (workspace) => {
            const renders = await fetchApi<Render[]>(
              `/workspaces/${workspace.id}/renders`,
              {},
              token
            );
            return [workspace.id, renders] as const;
          })
        )
      );

      res.send(
        htmlPage(
          'Home',
          `
          <header class="topbar">
            <div class="topbar-links">
              <h1>Workspaces</h1>
              <a href="/account">Account</a>
            </div>
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
      const response = await fetchApi(
        `/workspaces/${workspaceId}/renders/${renderId}/vote`,
        {
          method: 'PUT',
          body: JSON.stringify({ vote })
        },
        token
      );

      const wantsJson =
        String(req.headers.accept || '').includes('application/json') ||
        String(req.headers['content-type'] || '').includes('application/json');

      if (wantsJson) {
        res.status(200).json({ data: response });
        return;
      }

      res.redirect(`/workspaces/${workspaceId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save render vote';
      const wantsJson =
        String(req.headers.accept || '').includes('application/json') ||
        String(req.headers['content-type'] || '').includes('application/json');

      if (wantsJson) {
        res.status(400).json({ error: { message } });
        return;
      }

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

      const flash = req.query.error
        ? { type: 'error' as const, message: String(req.query.error) }
        : null;
      res.send(renderWorkspacePage({ workspace, items, renders, flash }));
    } catch {
      res
        .status(404)
        .send(
          htmlPage(
            'Workspace',
            '<p>Workspace not found.</p><p><a href="/home">Back to home</a></p>'
          )
        );
    }
  });

  app.post('/workspaces/:workspaceId/selected-items', async (req, res) => {
    const token = await requireToken(req, res);
    if (!token) return;

    const workspaceId = req.params.workspaceId;
    const selectedItemIds = Array.isArray(req.body.selectedItemIds)
      ? req.body.selectedItemIds.filter(
          (value: unknown): value is string => typeof value === 'string' && value.length > 0
        )
      : [];

    try {
      const workspace = await fetchApi<Workspace>(
        `/workspaces/${workspaceId}/selected-items`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            selectedItemIds
          })
        },
        token
      );

      res.status(200).json({ data: workspace });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save selected items';
      res.status(400).json({ error: { message } });
    }
  });

  app.post('/workspaces/:workspaceId/renders', async (req, res) => {
    const token = await requireToken(req, res);
    if (!token) return;

    const workspaceId = req.params.workspaceId;
    const selectedItemIds = parseSelectedItemIds(req.body.selectedItemIds);

    if (selectedItemIds.length < 2) {
      res.redirect(
        `/workspaces/${workspaceId}?error=${encodeURIComponent('Select at least two items')}`
      );
      return;
    }

    try {
      await fetchApi(
        `/workspaces/${workspaceId}/selected-items`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            selectedItemIds
          })
        },
        token
      );

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
