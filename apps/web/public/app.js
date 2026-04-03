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

  if (response.ok && response.status === 204) {
    return undefined;
  }

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

function getItemOriginalUrl(item) {
  return item.pageUrl || item.sourceUrl || null;
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
      const extraction = item.metadataJson?.extraction || {};
      const derived = extraction.derived || {};
      const priceLabel = item.price ? `${item.currency ? `${item.currency} ` : ''}${item.price}` : 'No price';
      const originalUrl = getItemOriginalUrl(item);
      return `
        <article class="item-card">
          ${previewImage ? `<img src="${previewImage}" alt="${item.title || 'Workspace item'}" />` : ''}
          <div class="item-body">
            <label>
              <input type="checkbox" data-item-id="${item.id}" />
              <span>
                <h3>${originalUrl ? `<a href="${originalUrl}" target="_blank" rel="noreferrer">${item.title || 'Untitled item'}</a>` : item.title || 'Untitled item'}</h3>
                <div class="chips">
                  <span class="chip">${item.role}</span>
                  <span class="chip">${item.slotType || 'unslotted'}</span>
                </div>
                <div>${item.brand || item.merchant || 'Unknown brand'}</div>
                <div class="render-meta">${item.merchant || 'Unknown merchant'} · ${priceLabel}</div>
                <div class="render-meta">${storageState}</div>
                ${
                  derived.colorName || derived.sku
                    ? `<div class="render-meta">${[derived.colorName, derived.sku].filter(Boolean).join(' · ')}</div>`
                    : ''
                }
              </span>
            </label>
            <div class="item-editor">
              <label>
                Title
                <input data-field="title" data-item-id="${item.id}" value="${item.title || ''}" />
              </label>
              <label>
                Brand
                <input data-field="brand" data-item-id="${item.id}" value="${item.brand || ''}" />
              </label>
              <label>
                Merchant
                <input data-field="merchant" data-item-id="${item.id}" value="${item.merchant || ''}" />
              </label>
              <label>
                Price
                <input data-field="price" data-item-id="${item.id}" value="${item.price || ''}" />
              </label>
              <label>
                Currency
                <input data-field="currency" data-item-id="${item.id}" value="${item.currency || ''}" />
              </label>
              <label>
                Slot type
                <input data-field="slotType" data-item-id="${item.id}" value="${item.slotType || ''}" />
              </label>
              <button class="save-item-button" type="button" data-action="save-item" data-item-id="${item.id}">
                Save metadata
              </button>
              <button class="delete-item-button" type="button" data-action="delete-item" data-item-id="${item.id}">
                Delete item
              </button>
            </div>
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
      const voteOptions = ['up', 'neutral', 'down'];
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
            <div class="vote-controls" role="group" aria-label="Vote on render ${render.id}">
              ${voteOptions
                .map(
                  (vote) => `
                    <button
                      type="button"
                      class="vote-button"
                      data-action="vote-render"
                      data-render-id="${render.id}"
                      data-vote="${vote}"
                      aria-pressed="${render.currentVote === vote ? 'true' : 'false'}"
                      data-selected="${render.currentVote === vote ? 'true' : 'false'}"
                    >
                      ${vote}
                    </button>
                  `
                )
                .join('')}
            </div>
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

  if (selectedItemIds.length < 2) {
    setStatus('Select at least two items to render.');
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

async function updateItem(itemId) {
  if (!selectedWorkspaceId) {
    setStatus('Select a workspace first.');
    return;
  }

  const fields = ['title', 'brand', 'merchant', 'price', 'currency', 'slotType'];
  const payload = {};

  for (const field of fields) {
    const input = itemsGrid.querySelector(`input[data-item-id="${itemId}"][data-field="${field}"]`);
    if (!input) {
      continue;
    }

    const rawValue = input.value.trim();
    payload[field] = rawValue || null;
  }

  setStatus(`Saving metadata for ${itemId}...`);

  try {
    await fetchJson(
      `/workspaces/${encodeURIComponent(selectedWorkspaceId)}/items/${encodeURIComponent(itemId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    setStatus(`Saved metadata for ${itemId}.`);
    await loadWorkspaceData();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Failed to update item metadata');
  }
}

async function deleteItem(itemId) {
  if (!selectedWorkspaceId) {
    setStatus('Select a workspace first.');
    return;
  }

  setStatus(`Deleting ${itemId}...`);

  try {
    await fetchJson(
      `/workspaces/${encodeURIComponent(selectedWorkspaceId)}/items/${encodeURIComponent(itemId)}`,
      {
        method: 'DELETE'
      }
    );

    setStatus(`Deleted ${itemId}.`);
    await loadWorkspaceData();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Failed to delete item');
  }
}

async function voteOnRender(renderId, vote) {
  if (!selectedWorkspaceId) {
    setStatus('Select a workspace first.');
    return;
  }

  setStatus(`Saving ${vote} vote for ${renderId}...`);

  try {
    await fetchJson(
      `/workspaces/${encodeURIComponent(selectedWorkspaceId)}/renders/${encodeURIComponent(renderId)}/vote`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ vote })
      }
    );

    setStatus(`Saved ${vote} vote for ${renderId}.`);
    await loadWorkspaceData();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Failed to save render vote');
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

itemsGrid.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.dataset.action;
  const itemId = target.dataset.itemId;
  if (!itemId) {
    return;
  }

  if (action === 'save-item') {
    await updateItem(itemId);
    return;
  }

  if (action === 'delete-item') {
    await deleteItem(itemId);
  }
});

rendersList.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.dataset.action;
  const renderId = target.dataset.renderId;
  const vote = target.dataset.vote;
  if (action !== 'vote-render' || !renderId || !vote) {
    return;
  }

  await voteOnRender(renderId, vote);
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
