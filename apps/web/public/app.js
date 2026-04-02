const config = window.__APP_CONFIG__ || {};
const apiBaseUrl = (config.apiBaseUrl || 'http://localhost:4000').replace(/\/$/, '');

const workspaceSelect = document.getElementById('workspace-select');
const renderModeSelect = document.getElementById('render-mode');
const refreshButton = document.getElementById('refresh-button');
const createRenderButton = document.getElementById('create-render-button');
const statusMessage = document.getElementById('status-message');
const workspaceMeta = document.getElementById('workspace-meta');
const itemsGrid = document.getElementById('items-grid');
const rendersList = document.getElementById('renders-list');

let selectedWorkspaceId = '';
let pollingHandle = null;

function setStatus(message) {
  statusMessage.textContent = message;
}

function resolveAssetUrl(relativeOrAbsolute) {
  if (!relativeOrAbsolute) {
    return null;
  }

  if (/^https?:\/\//.test(relativeOrAbsolute)) {
    return relativeOrAbsolute;
  }

  return `${apiBaseUrl}${relativeOrAbsolute}`;
}

async function fetchJson(path, options) {
  const response = await fetch(`${apiBaseUrl}${path}`, options);
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.error?.message || `Request failed (${response.status})`);
  }

  return body.data;
}

function renderEmptyState(target, message) {
  target.innerHTML = `<div class="empty-state">${message}</div>`;
}

function renderWorkspaceMeta(workspace) {
  if (!workspace) {
    workspaceMeta.textContent = '';
    return;
  }

  workspaceMeta.innerHTML = `
    <strong>${workspace.title}</strong><br />
    ${workspace.intentionText || 'No workspace intention provided.'}
  `;
}

function renderItems(items) {
  if (!items.length) {
    renderEmptyState(itemsGrid, 'No items in this workspace yet.');
    return;
  }

  itemsGrid.innerHTML = items
    .map((item) => {
      const previewImage = item.imageUrl || '';
      const storageState = item.storedImagePath ? 'Local image ready' : 'Missing local image';
      return `
        <article class="item-card">
          ${previewImage ? `<img src="${previewImage}" alt="${item.title || 'Workspace item'}" />` : ''}
          <div class="item-body">
            <label>
              <input type="checkbox" data-item-id="${item.id}" />
              <span>
                <h3>${item.title || 'Untitled item'}</h3>
                <div class="chips">
                  <span class="chip">${item.role}</span>
                  <span class="chip">${item.slotType || 'unslotted'}</span>
                </div>
                <div>${item.brand || item.merchant || 'Unknown brand'}</div>
                <div class="render-meta">${storageState}</div>
              </span>
            </label>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderRenders(renders) {
  if (!renders.length) {
    renderEmptyState(rendersList, 'No render jobs yet.');
    return;
  }

  rendersList.innerHTML = renders
    .map((render) => {
      const outputUrl = resolveAssetUrl(render.outputImageUrl);
      return `
        <article class="render-card">
          ${outputUrl ? `<img src="${outputUrl}" alt="Render output ${render.id}" />` : ''}
          <div class="render-body">
            <div class="chips">
              <span class="status-chip" data-status="${render.status}">${render.status}</span>
              <span class="chip">${render.renderMode}</span>
            </div>
            <h3>${render.id}</h3>
            <div class="render-meta">Selected items: ${render.selectedItemIds.length}</div>
            <div class="render-meta">Updated: ${new Date(render.updatedAt).toLocaleString()}</div>
            ${render.errorMessage ? `<p class="render-error">${render.errorMessage}</p>` : ''}
            ${render.recommendationText ? `<p class="render-meta">${render.recommendationText}</p>` : ''}
          </div>
        </article>
      `;
    })
    .join('');
}

async function loadWorkspaceData() {
  if (!selectedWorkspaceId) {
    renderEmptyState(itemsGrid, 'Select a workspace to load items.');
    renderEmptyState(rendersList, 'Select a workspace to view render jobs.');
    workspaceMeta.textContent = '';
    return;
  }

  setStatus('Refreshing workspace data...');

  const [workspace, items, renders] = await Promise.all([
    fetchJson(`/workspaces/${encodeURIComponent(selectedWorkspaceId)}`),
    fetchJson(`/workspaces/${encodeURIComponent(selectedWorkspaceId)}/items`),
    fetchJson(`/workspaces/${encodeURIComponent(selectedWorkspaceId)}/renders`)
  ]);

  renderWorkspaceMeta(workspace);
  renderItems(items);
  renderRenders(renders);
  setStatus(`Loaded ${items.length} items and ${renders.length} render job(s).`);
}

async function loadWorkspaces() {
  const workspaces = await fetchJson('/workspaces');

  if (!workspaces.length) {
    workspaceSelect.innerHTML = '<option value="">No workspaces available</option>';
    renderEmptyState(itemsGrid, 'Create a workspace first.');
    renderEmptyState(rendersList, 'Create a workspace first.');
    return;
  }

  workspaceSelect.innerHTML = workspaces
    .map(
      (workspace) =>
        `<option value="${workspace.id}">${workspace.title}</option>`
    )
    .join('');

  if (!selectedWorkspaceId || !workspaces.some((workspace) => workspace.id === selectedWorkspaceId)) {
    selectedWorkspaceId = workspaces[0].id;
    workspaceSelect.value = selectedWorkspaceId;
  }

  await loadWorkspaceData();
}

async function createRender() {
  if (!selectedWorkspaceId) {
    setStatus('Select a workspace first.');
    return;
  }

  const selectedItemIds = [...document.querySelectorAll('input[data-item-id]:checked')].map(
    (input) => input.dataset.itemId
  );

  if (!selectedItemIds.length) {
    setStatus('Select at least one item to render.');
    return;
  }

  createRenderButton.disabled = true;
  setStatus('Creating render job...');

  try {
    const render = await fetchJson(`/workspaces/${encodeURIComponent(selectedWorkspaceId)}/renders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        selectedItemIds,
        renderMode: renderModeSelect.value
      })
    });

    setStatus(`Queued render ${render.id}. The worker will process it asynchronously.`);
    await loadWorkspaceData();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Failed to create render');
  } finally {
    createRenderButton.disabled = false;
  }
}

workspaceSelect.addEventListener('change', async (event) => {
  selectedWorkspaceId = event.target.value;
  await loadWorkspaceData();
});

refreshButton.addEventListener('click', async () => {
  await loadWorkspaceData();
});

createRenderButton.addEventListener('click', async () => {
  await createRender();
});

async function bootstrap() {
  try {
    await loadWorkspaces();
    pollingHandle = window.setInterval(() => {
      void loadWorkspaceData();
    }, 5000);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Failed to load the app');
  }
}

void bootstrap();
