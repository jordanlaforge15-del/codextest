import type { Item, Render, RenderMode, RenderVote, RenderVoteValue, Workspace } from '@mvp/shared';

interface CaptureSettings {
  workspaceId: string;
  apiBaseUrl: string;
}

interface WorkspaceResponse {
  data: Workspace;
}

interface ItemListResponse {
  data: Item[];
}

interface RenderListResponse {
  data: Render[];
}

interface RenderResponse {
  data: Render;
}

interface RenderVoteResponse {
  data: RenderVote | null;
}

interface PopupState {
  items: Item[];
  renders: Render[];
  selectedItemIds: Set<string>;
}

const SETTINGS_KEY = 'captureSettings';
const DEFAULT_API_BASE_URL = 'http://localhost:4000';

const formElement = document.querySelector<HTMLFormElement>('#settings-form');
const workspaceInputElement = document.querySelector<HTMLInputElement>('#workspace-id');
const apiBaseUrlInputElement = document.querySelector<HTMLInputElement>('#api-base-url');
const statusElementValue = document.querySelector<HTMLParagraphElement>('#status');
const workspaceNameElement = document.querySelector<HTMLElement>('#workspace-name');
const itemsSummaryElement = document.querySelector<HTMLElement>('#workspace-items-summary');
const itemsElement = document.querySelector<HTMLDivElement>('#workspace-items');
const refreshWorkspaceButtonElement = document.querySelector<HTMLButtonElement>('#refresh-workspace');
const renderModeSelectElement = document.querySelector<HTMLSelectElement>('#render-mode');
const submitRenderButtonElement = document.querySelector<HTMLButtonElement>('#submit-render');
const refreshRendersButtonElement = document.querySelector<HTMLButtonElement>('#refresh-renders');
const rendersSummaryElement = document.querySelector<HTMLElement>('#workspace-renders-summary');
const rendersElement = document.querySelector<HTMLDivElement>('#workspace-renders');

if (
  !formElement ||
  !workspaceInputElement ||
  !apiBaseUrlInputElement ||
  !statusElementValue ||
  !workspaceNameElement ||
  !itemsSummaryElement ||
  !itemsElement ||
  !refreshWorkspaceButtonElement ||
  !renderModeSelectElement ||
  !submitRenderButtonElement ||
  !refreshRendersButtonElement ||
  !rendersSummaryElement ||
  !rendersElement
) {
  throw new Error('Popup UI is missing required elements.');
}

const form = formElement;
const workspaceInput = workspaceInputElement;
const apiBaseUrlInput = apiBaseUrlInputElement;
const statusElement = statusElementValue;
const workspaceName = workspaceNameElement;
const workspaceItemsSummary = itemsSummaryElement;
const workspaceItems = itemsElement;
const refreshWorkspaceButton = refreshWorkspaceButtonElement;
const renderModeSelect = renderModeSelectElement;
const submitRenderButton = submitRenderButtonElement;
const refreshRendersButton = refreshRendersButtonElement;
const workspaceRendersSummary = rendersSummaryElement;
const workspaceRenders = rendersElement;

const state: PopupState = {
  items: [],
  renders: [],
  selectedItemIds: new Set<string>()
};

function setStatus(message: string, isError = false): void {
  statusElement.textContent = message;
  statusElement.style.color = isError ? '#b91c1c' : '#166534';
}

function getApiBaseUrl(): string {
  return apiBaseUrlInput.value.trim() || DEFAULT_API_BASE_URL;
}

function getWorkspaceId(): string {
  return workspaceInput.value.trim();
}

function getReadyItems(items: Item[]): Item[] {
  return items.filter((item) => Boolean(item.imageUrl) && Boolean(item.storedImagePath));
}

function getSelectedReadyItems(): Item[] {
  return getReadyItems(state.items).filter((item) => state.selectedItemIds.has(item.id));
}

function formatRenderTimestamp(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function getRenderImageUrl(apiBaseUrl: string, render: Render): string | null {
  if (!render.outputImageUrl) {
    return null;
  }

  if (render.outputImageUrl.startsWith('http://') || render.outputImageUrl.startsWith('https://')) {
    return render.outputImageUrl;
  }

  return `${apiBaseUrl.replace(/\/$/, '')}${render.outputImageUrl}`;
}

function updateSubmitButtonState(): void {
  const selectedReadyItems = getSelectedReadyItems();
  submitRenderButton.disabled = selectedReadyItems.length < 2;
}

function setWorkspaceLoadingState(isLoading: boolean): void {
  refreshWorkspaceButton.disabled = isLoading;
  refreshWorkspaceButton.textContent = isLoading ? 'Refreshing…' : 'Refresh workspace';
}

function setRenderLoadingState(isLoading: boolean): void {
  refreshRendersButton.disabled = isLoading;
  refreshRendersButton.textContent = isLoading ? 'Refreshing…' : 'Refresh renders';
}

function setRenderSubmitState(isSubmitting: boolean): void {
  if (isSubmitting) {
    submitRenderButton.disabled = true;
    submitRenderButton.textContent = 'Submitting…';
    return;
  }

  submitRenderButton.textContent = 'Create render';
  updateSubmitButtonState();
}

function toggleItemSelection(itemId: string, isSelected: boolean): void {
  if (isSelected) {
    state.selectedItemIds.add(itemId);
  } else {
    state.selectedItemIds.delete(itemId);
  }

  updateSubmitButtonState();
}

function renderWorkspaceItems(items: Item[]): void {
  workspaceItems.innerHTML = '';

  const readyItemIds = new Set(getReadyItems(items).map((item) => item.id));
  for (const selectedItemId of Array.from(state.selectedItemIds)) {
    if (!readyItemIds.has(selectedItemId)) {
      state.selectedItemIds.delete(selectedItemId);
    }
  }

  workspaceItemsSummary.textContent = `${getReadyItems(items).length} render-ready item${getReadyItems(items).length === 1 ? '' : 's'} out of ${items.length}`;

  if (items.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'empty-state';
    emptyMessage.textContent = 'No items found for this workspace yet.';
    workspaceItems.append(emptyMessage);
    updateSubmitButtonState();
    return;
  }

  for (const item of items) {
    const card = document.createElement('label');
    card.className = 'item-card';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = state.selectedItemIds.has(item.id);

    const isReady = Boolean(item.imageUrl) && Boolean(item.storedImagePath);
    checkbox.disabled = !isReady;
    checkbox.addEventListener('change', () => {
      toggleItemSelection(item.id, checkbox.checked);
    });

    const preview = document.createElement('div');
    preview.className = 'item-card-preview';

    if (item.imageUrl) {
      const image = document.createElement('img');
      image.src = item.imageUrl;
      image.alt = item.title ?? 'Workspace item image';
      image.loading = 'lazy';
      preview.append(image);
    } else {
      const imagePlaceholder = document.createElement('div');
      imagePlaceholder.className = 'item-card-placeholder';
      imagePlaceholder.textContent = 'No image';
      preview.append(imagePlaceholder);
    }

    const details = document.createElement('div');
    details.className = 'item-card-details';

    const title = document.createElement('p');
    title.className = 'item-card-title';
    title.textContent = item.title ?? 'Untitled item';

    const meta = document.createElement('p');
    meta.className = 'item-card-meta';
    meta.textContent = item.role === 'fixed' ? 'Fixed piece' : 'Candidate piece';

    const readiness = document.createElement('p');
    readiness.className = `item-card-status ${isReady ? 'is-ready' : 'is-blocked'}`;
    readiness.textContent = isReady ? 'Ready to render' : 'Missing stored image';

    details.append(title, meta, readiness);
    card.append(checkbox, preview, details);
    workspaceItems.append(card);
  }

  updateSubmitButtonState();
}

function renderWorkspaceRenders(renders: Render[], apiBaseUrl: string): void {
  workspaceRenders.innerHTML = '';
  workspaceRendersSummary.textContent = `${renders.length} render${renders.length === 1 ? '' : 's'} in this workspace`;

  if (renders.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'empty-state';
    emptyMessage.textContent = 'No renders yet.';
    workspaceRenders.append(emptyMessage);
    return;
  }

  for (const render of renders) {
    const card = document.createElement('article');
    card.className = 'render-card';

    const header = document.createElement('div');
    header.className = 'render-card-header';

    const title = document.createElement('p');
    title.className = 'render-card-title';
    title.textContent = `${render.renderMode === 'high_quality' ? 'High quality' : 'Preview'} render`;

    const status = document.createElement('span');
    status.className = `render-status is-${render.status}`;
    status.textContent = render.status;

    header.append(title, status);

    const meta = document.createElement('p');
    meta.className = 'render-card-meta';
    meta.textContent = `${render.selectedItemIds.length} item${render.selectedItemIds.length === 1 ? '' : 's'} • ${formatRenderTimestamp(render.createdAt)}`;

    card.append(header, meta);

    const voteStatus = document.createElement('p');
    voteStatus.className = 'render-card-meta';
    voteStatus.textContent = `Vote: ${render.currentVote ?? 'not rated'}`;
    card.append(voteStatus);

    const imageUrl = getRenderImageUrl(apiBaseUrl, render);
    if (imageUrl) {
      const image = document.createElement('img');
      image.className = 'render-card-image';
      image.src = imageUrl;
      image.alt = 'Generated render preview';
      image.loading = 'lazy';
      card.append(image);

      const link = document.createElement('a');
      link.href = imageUrl;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = 'Open render image';
      card.append(link);
    }

    const voteControls = document.createElement('div');
    voteControls.className = 'vote-controls';

    for (const vote of ['up', 'neutral', 'down'] as RenderVoteValue[]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'vote-button';
      button.dataset.selected = render.currentVote === vote ? 'true' : 'false';
      button.textContent = vote;
      button.addEventListener('click', async () => {
        await submitRenderVote(render.id, vote);
      });
      voteControls.append(button);
    }

    card.append(voteControls);

    if (render.errorMessage) {
      const error = document.createElement('p');
      error.className = 'render-card-error';
      error.textContent = render.errorMessage;
      card.append(error);
    }

    workspaceRenders.append(card);
  }
}

async function submitRenderVote(renderId: string, vote: RenderVoteValue): Promise<RenderVote | null> {
  const workspaceId = getWorkspaceId();
  const apiBaseUrl = getApiBaseUrl();

  if (!workspaceId) {
    setStatus('Set a workspace ID before rating renders.', true);
    return null;
  }

  try {
    const response = await fetch(
      `${apiBaseUrl.replace(/\/$/, '')}/workspaces/${encodeURIComponent(workspaceId)}/renders/${encodeURIComponent(renderId)}/vote`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ vote })
      }
    );

    if (!response.ok) {
      let errorMessage = `Unable to save render vote (${response.status}).`;
      try {
        const body = (await response.json()) as { error?: { message?: string } };
        if (body.error?.message) {
          errorMessage = body.error.message;
        }
      } catch {
        // Ignore JSON parse failures.
      }

      throw new Error(errorMessage);
    }

    const payload = (await response.json()) as RenderVoteResponse;
    const targetRender = state.renders.find((render) => render.id === renderId);
    if (targetRender) {
      targetRender.currentVote = payload.data?.vote ?? null;
      renderWorkspaceRenders(state.renders, apiBaseUrl);
    }

    setStatus(`Saved ${vote} vote for render ${renderId}.`);
    return payload.data;
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Failed to save render vote.', true);
    return null;
  }
}

async function fetchWorkspaceData(workspaceId: string, apiBaseUrl: string): Promise<void> {
  const baseUrl = apiBaseUrl.replace(/\/$/, '');
  const workspaceUrl = `${baseUrl}/workspaces/${encodeURIComponent(workspaceId)}`;
  const itemsUrl = `${baseUrl}/workspaces/${encodeURIComponent(workspaceId)}/items`;
  const rendersUrl = `${baseUrl}/workspaces/${encodeURIComponent(workspaceId)}/renders`;

  const [workspaceResponse, itemsResponse, rendersResponse] = await Promise.all([
    fetch(workspaceUrl),
    fetch(itemsUrl),
    fetch(rendersUrl)
  ]);

  if (!workspaceResponse.ok) {
    throw new Error(`Unable to load workspace (${workspaceResponse.status}).`);
  }

  if (!itemsResponse.ok) {
    throw new Error(`Unable to load workspace items (${itemsResponse.status}).`);
  }

  if (!rendersResponse.ok) {
    throw new Error(`Unable to load renders (${rendersResponse.status}).`);
  }

  const workspacePayload = (await workspaceResponse.json()) as WorkspaceResponse;
  const itemsPayload = (await itemsResponse.json()) as ItemListResponse;
  const rendersPayload = (await rendersResponse.json()) as RenderListResponse;

  state.items = itemsPayload.data;
  state.renders = rendersPayload.data;

  workspaceName.textContent = workspacePayload.data.title;
  renderWorkspaceItems(state.items);
  renderWorkspaceRenders(state.renders, apiBaseUrl);
}

function resetWorkspaceView(message: string): void {
  workspaceName.textContent = message;
  workspaceItemsSummary.textContent = '0 render-ready items out of 0';
  workspaceItems.innerHTML = '';
  workspaceRendersSummary.textContent = '0 renders in this workspace';
  workspaceRenders.innerHTML = '';
  state.items = [];
  state.renders = [];
  state.selectedItemIds.clear();
  updateSubmitButtonState();
}

async function refreshWorkspaceView(): Promise<void> {
  const workspaceId = getWorkspaceId();
  const apiBaseUrl = getApiBaseUrl();

  if (!workspaceId) {
    resetWorkspaceView('Set a workspace ID to load details.');
    return;
  }

  try {
    setWorkspaceLoadingState(true);
    setRenderLoadingState(true);
    workspaceName.textContent = 'Loading workspace…';
    await fetchWorkspaceData(workspaceId, apiBaseUrl);
  } catch (error) {
    resetWorkspaceView('Unable to load workspace details.');
    setStatus(error instanceof Error ? error.message : 'Failed to load workspace details.', true);
  } finally {
    setWorkspaceLoadingState(false);
    setRenderLoadingState(false);
  }
}

async function submitRenderRequest(): Promise<void> {
  const workspaceId = getWorkspaceId();
  const apiBaseUrl = getApiBaseUrl();
  const selectedReadyItems = getSelectedReadyItems();

  if (!workspaceId) {
    setStatus('Workspace ID is required before creating a render.', true);
    return;
  }

  if (selectedReadyItems.length < 2) {
    setStatus('Select at least two render-ready items.', true);
    return;
  }

  try {
    setRenderSubmitState(true);
    const response = await fetch(
      `${apiBaseUrl.replace(/\/$/, '')}/workspaces/${encodeURIComponent(workspaceId)}/renders`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          selectedItemIds: selectedReadyItems.map((item) => item.id),
          renderMode: renderModeSelect.value as RenderMode
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Unable to create render (${response.status}).`);
    }

    const renderPayload = (await response.json()) as RenderResponse;
    setStatus(`Render ${renderPayload.data.id} submitted. Refreshing renders…`);
    await refreshWorkspaceView();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Failed to create render.', true);
  } finally {
    setRenderSubmitState(false);
  }
}

async function loadSettings(): Promise<void> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const settings = (result[SETTINGS_KEY] ?? {}) as Partial<CaptureSettings>;

  workspaceInput.value = settings.workspaceId ?? '';
  apiBaseUrlInput.value = settings.apiBaseUrl ?? DEFAULT_API_BASE_URL;

  await refreshWorkspaceView();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const workspaceId = getWorkspaceId();
  const apiBaseUrl = getApiBaseUrl();

  if (!workspaceId) {
    setStatus('Workspace ID is required.', true);
    return;
  }

  chrome.storage.local
    .set({
      [SETTINGS_KEY]: {
        workspaceId,
        apiBaseUrl
      }
    })
    .then(() => {
      setStatus('Saved workspace settings.');
      return refreshWorkspaceView();
    })
    .catch((error: unknown) => {
      setStatus(error instanceof Error ? error.message : 'Failed to save settings.', true);
    });
});

refreshWorkspaceButton.addEventListener('click', () => {
  void refreshWorkspaceView();
});

refreshRendersButton.addEventListener('click', () => {
  void refreshWorkspaceView();
});

submitRenderButton.addEventListener('click', () => {
  void submitRenderRequest();
});

updateSubmitButtonState();
void loadSettings();
