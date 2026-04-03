import type { Item, Render, RenderMode, RenderVote, RenderVoteValue, Workspace } from '@mvp/shared';

interface CaptureSettings {
  workspaceId?: string;
  workspaceTitle?: string;
  apiBaseUrl?: string;
}

interface WorkspaceListResponse {
  data: Workspace[];
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

interface ApiErrorResponse {
  error?: {
    message?: string;
  };
}

interface PopupState {
  workspaces: Workspace[];
  items: Item[];
  renders: Render[];
  selectedItemIds: Set<string>;
  activeWorkspaceId: string;
  activeWorkspaceTitle: string;
}

const SETTINGS_KEY = 'captureSettings';
const DEFAULT_API_BASE_URL = 'http://localhost:4000';
const DEFAULT_WORKSPACE_DOMAIN_TYPE = 'outfit';
const RENDER_POLL_INTERVAL_MS = 3000;

const settingsFormElement = document.querySelector<HTMLFormElement>('#settings-form');
const apiBaseUrlInputElement = document.querySelector<HTMLInputElement>('#api-base-url');
const workspacePickerElement = document.querySelector<HTMLSelectElement>('#workspace-picker');
const refreshWorkspaceListButtonElement =
  document.querySelector<HTMLButtonElement>('#refresh-workspace-list');
const createWorkspaceFormElement = document.querySelector<HTMLFormElement>('#create-workspace-form');
const newWorkspaceTitleElement = document.querySelector<HTMLInputElement>('#new-workspace-title');
const createWorkspaceButtonElement =
  document.querySelector<HTMLButtonElement>('#create-workspace-button');
const statusElementValue = document.querySelector<HTMLParagraphElement>('#status');
const workspaceNameElement = document.querySelector<HTMLElement>('#workspace-name');
const workspaceIdCaptionElement = document.querySelector<HTMLElement>('#workspace-id-caption');
const itemsSummaryElement = document.querySelector<HTMLElement>('#workspace-items-summary');
const itemsElement = document.querySelector<HTMLDivElement>('#workspace-items');
const refreshWorkspaceButtonElement = document.querySelector<HTMLButtonElement>('#refresh-workspace');
const deleteWorkspaceButtonElement = document.querySelector<HTMLButtonElement>('#delete-workspace');
const renderModeSelectElement = document.querySelector<HTMLSelectElement>('#render-mode');
const submitRenderButtonElement = document.querySelector<HTMLButtonElement>('#submit-render');
const refreshRendersButtonElement = document.querySelector<HTMLButtonElement>('#refresh-renders');
const rendersSummaryElement = document.querySelector<HTMLElement>('#workspace-renders-summary');
const rendersElement = document.querySelector<HTMLDivElement>('#workspace-renders');

if (
  !settingsFormElement ||
  !apiBaseUrlInputElement ||
  !workspacePickerElement ||
  !refreshWorkspaceListButtonElement ||
  !createWorkspaceFormElement ||
  !newWorkspaceTitleElement ||
  !createWorkspaceButtonElement ||
  !statusElementValue ||
  !workspaceNameElement ||
  !workspaceIdCaptionElement ||
  !itemsSummaryElement ||
  !itemsElement ||
  !refreshWorkspaceButtonElement ||
  !deleteWorkspaceButtonElement ||
  !renderModeSelectElement ||
  !submitRenderButtonElement ||
  !refreshRendersButtonElement ||
  !rendersSummaryElement ||
  !rendersElement
) {
  throw new Error('Popup UI is missing required elements.');
}

const settingsForm = settingsFormElement;
const apiBaseUrlInput = apiBaseUrlInputElement;
const workspacePicker = workspacePickerElement;
const refreshWorkspaceListButton = refreshWorkspaceListButtonElement;
const createWorkspaceForm = createWorkspaceFormElement;
const newWorkspaceTitleInput = newWorkspaceTitleElement;
const createWorkspaceButton = createWorkspaceButtonElement;
const statusElement = statusElementValue;
const workspaceName = workspaceNameElement;
const workspaceIdCaption = workspaceIdCaptionElement;
const workspaceItemsSummary = itemsSummaryElement;
const workspaceItems = itemsElement;
const refreshWorkspaceButton = refreshWorkspaceButtonElement;
const deleteWorkspaceButton = deleteWorkspaceButtonElement;
const renderModeSelect = renderModeSelectElement;
const submitRenderButton = submitRenderButtonElement;
const refreshRendersButton = refreshRendersButtonElement;
const workspaceRendersSummary = rendersSummaryElement;
const workspaceRenders = rendersElement;

const state: PopupState = {
  workspaces: [],
  items: [],
  renders: [],
  selectedItemIds: new Set<string>(),
  activeWorkspaceId: '',
  activeWorkspaceTitle: ''
};

let renderPollTimer: number | null = null;

function setStatus(message: string, isError = false): void {
  statusElement.textContent = message;
  statusElement.style.color = isError ? '#b91c1c' : '#166534';
}

function getApiBaseUrl(): string {
  return apiBaseUrlInput.value.trim() || DEFAULT_API_BASE_URL;
}

function getWorkspaceId(): string {
  return state.activeWorkspaceId;
}

function getActiveWorkspace(): Workspace | null {
  return state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId) ?? null;
}

function buildStoredSettings(): CaptureSettings {
  const activeWorkspace = getActiveWorkspace();

  return {
    apiBaseUrl: getApiBaseUrl(),
    workspaceId: state.activeWorkspaceId || undefined,
    workspaceTitle: activeWorkspace?.title ?? state.activeWorkspaceTitle ?? undefined
  };
}

async function persistSettings(): Promise<void> {
  await chrome.storage.local.set({
    [SETTINGS_KEY]: buildStoredSettings()
  });
}

async function readSettings(): Promise<CaptureSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return (result[SETTINGS_KEY] ?? {}) as CaptureSettings;
}

async function getResponseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorResponse;
    if (body.error?.message) {
      return body.error.message;
    }
  } catch {
    // Ignore JSON parse failures.
  }

  return fallback;
}

function getReadyItems(items: Item[]): Item[] {
  return items.filter((item) => Boolean(item.imageUrl) && Boolean(item.storedImagePath));
}

function getSelectedReadyItems(): Item[] {
  return getReadyItems(state.items).filter((item) => state.selectedItemIds.has(item.id));
}

function getItemOriginalUrl(item: Item): string | null {
  return item.pageUrl ?? item.sourceUrl ?? null;
}

function createItemSummaryRow(item: Item): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'render-used-item';

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

  const title = document.createElement(getItemOriginalUrl(item) ? 'a' : 'p');
  title.className = 'item-card-title';
  title.textContent = item.title ?? 'Untitled item';
  if (title instanceof HTMLAnchorElement) {
    title.href = getItemOriginalUrl(item) ?? '#';
    title.target = '_blank';
    title.rel = 'noreferrer';
  }

  const meta = document.createElement('p');
  meta.className = 'item-card-meta';
  meta.textContent = `role: ${item.role} · slot: ${item.slotType ?? 'none'}`;

  details.append(title, meta);
  row.append(preview, details);

  return row;
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

function hasActiveRenders(renders: Render[]): boolean {
  return renders.some((render) => render.status === 'queued' || render.status === 'processing');
}

function clearRenderPollTimer(): void {
  if (renderPollTimer !== null) {
    window.clearTimeout(renderPollTimer);
    renderPollTimer = null;
  }
}

function scheduleRenderPolling(): void {
  clearRenderPollTimer();

  const workspaceId = getWorkspaceId();
  if (!workspaceId || !hasActiveRenders(state.renders)) {
    return;
  }

  renderPollTimer = window.setTimeout(() => {
    void pollQueuedRenders(workspaceId);
  }, RENDER_POLL_INTERVAL_MS);
}

function formatWorkspaceOption(workspace: Workspace): string {
  return `${workspace.title} · ${workspace.id.slice(0, 8)}`;
}

function renderWorkspacePicker(): void {
  workspacePicker.innerHTML = '';

  if (!state.workspaces.length) {
    workspacePicker.innerHTML = '<option value="">No workspaces available</option>';
    workspacePicker.value = '';
    workspacePicker.disabled = true;
    return;
  }

  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';
  placeholderOption.textContent = 'Choose a workspace';
  workspacePicker.append(placeholderOption);

  for (const workspace of state.workspaces) {
    const option = document.createElement('option');
    option.value = workspace.id;
    option.textContent = formatWorkspaceOption(workspace);
    workspacePicker.append(option);
  }

  workspacePicker.disabled = false;
  workspacePicker.value = state.activeWorkspaceId || '';
}

function renderActiveWorkspaceSummary(): void {
  const activeWorkspace = getActiveWorkspace();

  if (activeWorkspace) {
    workspaceName.textContent = activeWorkspace.title;
    workspaceIdCaption.textContent = activeWorkspace.id;
    return;
  }

  if (state.activeWorkspaceId && state.activeWorkspaceTitle) {
    workspaceName.textContent = state.activeWorkspaceTitle;
    workspaceIdCaption.textContent = `${state.activeWorkspaceId} (refreshing list…)`;
    return;
  }

  if (!state.workspaces.length) {
    workspaceName.textContent = 'No workspace selected';
    workspaceIdCaption.textContent = 'Create a workspace to start saving images.';
    return;
  }

  workspaceName.textContent = 'No workspace selected';
  workspaceIdCaption.textContent = 'Choose a workspace above to make it active.';
}

function updateSubmitButtonState(): void {
  const selectedReadyItems = getSelectedReadyItems();
  submitRenderButton.disabled = !getWorkspaceId() || selectedReadyItems.length < 2;
}

function setWorkspaceListLoadingState(isLoading: boolean): void {
  refreshWorkspaceListButton.disabled = isLoading;
  refreshWorkspaceListButton.textContent = isLoading ? 'Refreshing…' : 'Refresh list';
  workspacePicker.disabled = isLoading || !state.workspaces.length;
}

function setWorkspaceLoadingState(isLoading: boolean): void {
  const disabled = isLoading || !getWorkspaceId();
  refreshWorkspaceButton.disabled = disabled;
  refreshWorkspaceButton.textContent = isLoading ? 'Refreshing…' : 'Refresh workspace';
  deleteWorkspaceButton.disabled = disabled;
}

function setRenderLoadingState(isLoading: boolean): void {
  const disabled = isLoading || !getWorkspaceId();
  refreshRendersButton.disabled = disabled;
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

function setCreateWorkspaceState(isSubmitting: boolean): void {
  createWorkspaceButton.disabled = isSubmitting;
  createWorkspaceButton.textContent = isSubmitting ? 'Creating…' : 'Create workspace';
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

  if (!items.length) {
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

    const title = document.createElement(getItemOriginalUrl(item) ? 'a' : 'p');
    title.className = 'item-card-title';
    title.textContent = item.title ?? 'Untitled item';
    if (title instanceof HTMLAnchorElement) {
      title.href = getItemOriginalUrl(item) ?? '#';
      title.target = '_blank';
      title.rel = 'noreferrer';
    }

    const meta = document.createElement('p');
    meta.className = 'item-card-meta';
    meta.textContent = item.role === 'fixed' ? 'Fixed piece' : 'Candidate piece';

    const readiness = document.createElement('p');
    readiness.className = `item-card-status ${isReady ? 'is-ready' : 'is-blocked'}`;
    readiness.textContent = isReady ? 'Ready to render' : 'Missing stored image';

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'item-card-delete';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', async () => {
      await deleteWorkspaceItem(item.id);
    });

    details.append(title, meta, readiness, deleteButton);
    card.append(checkbox, preview, details);
    workspaceItems.append(card);
  }

  updateSubmitButtonState();
}

function renderWorkspaceRenders(renders: Render[], apiBaseUrl: string): void {
  workspaceRenders.innerHTML = '';
  workspaceRendersSummary.textContent = `${renders.length} render${renders.length === 1 ? '' : 's'} in this workspace`;

  if (!renders.length) {
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

    const usedItemsHeading = document.createElement('p');
    usedItemsHeading.className = 'render-card-meta';
    usedItemsHeading.innerHTML = '<strong>Items in render</strong>';
    card.append(usedItemsHeading);

    const usedItems = render.selectedItemIds
      .map((itemId) => state.items.find((item) => item.id === itemId))
      .filter((item): item is Item => Boolean(item));

    if (usedItems.length === 0) {
      const emptyUsedItems = document.createElement('p');
      emptyUsedItems.className = 'empty-state';
      emptyUsedItems.textContent = 'No selected items found for this render.';
      card.append(emptyUsedItems);
    } else {
      const usedItemsList = document.createElement('div');
      usedItemsList.className = 'render-used-items';
      for (const item of usedItems) {
        usedItemsList.append(createItemSummaryRow(item));
      }
      card.append(usedItemsList);
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

async function fetchWorkspaceRenders(workspaceId: string, apiBaseUrl: string): Promise<Render[]> {
  const rendersUrl = `${apiBaseUrl.replace(/\/$/, '')}/workspaces/${encodeURIComponent(workspaceId)}/renders`;
  const response = await fetch(rendersUrl);

  if (!response.ok) {
    throw new Error(
      await getResponseErrorMessage(response, `Unable to load renders (${response.status}).`)
    );
  }

  const payload = (await response.json()) as RenderListResponse;
  return payload.data;
}

async function pollQueuedRenders(workspaceId: string): Promise<void> {
  if (workspaceId !== getWorkspaceId()) {
    clearRenderPollTimer();
    return;
  }

  try {
    const renders = await fetchWorkspaceRenders(workspaceId, getApiBaseUrl());
    if (workspaceId !== getWorkspaceId()) {
      clearRenderPollTimer();
      return;
    }

    state.renders = renders;
    renderWorkspaceRenders(state.renders, getApiBaseUrl());
    scheduleRenderPolling();
  } catch (error) {
    clearRenderPollTimer();
    setStatus(error instanceof Error ? error.message : 'Failed to refresh queued renders.', true);
  }
}

async function submitRenderVote(renderId: string, vote: RenderVoteValue): Promise<RenderVote | null> {
  const workspaceId = getWorkspaceId();
  const apiBaseUrl = getApiBaseUrl();

  if (!workspaceId) {
    setStatus('Choose an active workspace before rating renders.', true);
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
      throw new Error(
        await getResponseErrorMessage(response, `Unable to save render vote (${response.status}).`)
      );
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

async function deleteWorkspaceItem(itemId: string): Promise<void> {
  const workspaceId = getWorkspaceId();
  const apiBaseUrl = getApiBaseUrl();

  if (!workspaceId) {
    setStatus('Set a workspace ID before deleting items.', true);
    return;
  }

  try {
    const response = await fetch(
      `${apiBaseUrl.replace(/\/$/, '')}/workspaces/${encodeURIComponent(workspaceId)}/items/${encodeURIComponent(itemId)}`,
      {
        method: 'DELETE'
      }
    );

    if (!response.ok) {
      throw new Error(`Unable to delete item (${response.status}).`);
    }

    state.selectedItemIds.delete(itemId);
    setStatus(`Deleted item ${itemId}.`);
    await refreshWorkspaceView();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Failed to delete item.', true);
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
    throw new Error(
      await getResponseErrorMessage(workspaceResponse, `Unable to load workspace (${workspaceResponse.status}).`)
    );
  }

  if (!itemsResponse.ok) {
    throw new Error(
      await getResponseErrorMessage(itemsResponse, `Unable to load workspace items (${itemsResponse.status}).`)
    );
  }

  if (!rendersResponse.ok) {
    throw new Error(
      await getResponseErrorMessage(rendersResponse, `Unable to load renders (${rendersResponse.status}).`)
    );
  }

  const workspacePayload = (await workspaceResponse.json()) as WorkspaceResponse;
  const itemsPayload = (await itemsResponse.json()) as ItemListResponse;
  const rendersPayload = (await rendersResponse.json()) as RenderListResponse;

  state.items = itemsPayload.data;
  state.renders = rendersPayload.data;

  workspaceName.textContent = workspacePayload.data.title;
  workspaceIdCaption.textContent = workspacePayload.data.id;
  renderWorkspaceItems(state.items);
  renderWorkspaceRenders(state.renders, apiBaseUrl);
  scheduleRenderPolling();
}

function resetWorkspaceView(message: string, detail = ''): void {
  clearRenderPollTimer();
  workspaceName.textContent = message;
  workspaceIdCaption.textContent = detail;
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

  renderActiveWorkspaceSummary();

  if (!workspaceId) {
    if (state.workspaces.length) {
      resetWorkspaceView('No workspace selected', 'Choose a workspace above to load items and renders.');
    } else {
      resetWorkspaceView('No workspace selected', 'Create a workspace to get started.');
    }
    return;
  }

  try {
    setWorkspaceLoadingState(true);
    setRenderLoadingState(true);
    workspaceName.textContent = 'Loading workspace…';
    workspaceIdCaption.textContent = workspaceId;
    await fetchWorkspaceData(workspaceId, apiBaseUrl);
  } catch (error) {
    resetWorkspaceView('Unable to load workspace details.');
    setStatus(error instanceof Error ? error.message : 'Failed to load workspace details.', true);
  } finally {
    setWorkspaceLoadingState(false);
    setRenderLoadingState(false);
  }
}

async function refreshWorkspaceList(options?: { preserveStatus?: boolean }): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();

  try {
    setWorkspaceListLoadingState(true);

    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/workspaces`);
    if (!response.ok) {
      throw new Error(
        await getResponseErrorMessage(response, `Unable to load workspaces (${response.status}).`)
      );
    }

    const payload = (await response.json()) as WorkspaceListResponse;
    state.workspaces = payload.data;

    const activeWorkspace = getActiveWorkspace();
    if (activeWorkspace) {
      state.activeWorkspaceTitle = activeWorkspace.title;
      await persistSettings();
    } else if (state.activeWorkspaceId) {
      state.activeWorkspaceId = '';
      state.activeWorkspaceTitle = '';
      await persistSettings();
    }

    renderWorkspacePicker();
    renderActiveWorkspaceSummary();

    if (!options?.preserveStatus) {
      if (!state.workspaces.length) {
        setStatus('No workspaces found yet. Create one to make it active.');
      } else if (!state.activeWorkspaceId) {
        setStatus('Select a workspace to make it active.');
      }
    }

    await refreshWorkspaceView();
  } catch (error) {
    state.workspaces = [];
    renderWorkspacePicker();
    resetWorkspaceView('Unable to load workspace details.');
    setStatus(error instanceof Error ? error.message : 'Failed to load workspaces.', true);
  } finally {
    setWorkspaceListLoadingState(false);
  }
}

async function setActiveWorkspace(workspaceId: string): Promise<void> {
  clearRenderPollTimer();
  state.activeWorkspaceId = workspaceId;
  state.activeWorkspaceTitle =
    state.workspaces.find((workspace) => workspace.id === workspaceId)?.title ?? '';
  renderWorkspacePicker();
  renderActiveWorkspaceSummary();
  await persistSettings();
  await refreshWorkspaceView();
}

async function submitRenderRequest(): Promise<void> {
  const workspaceId = getWorkspaceId();
  const apiBaseUrl = getApiBaseUrl();
  const selectedReadyItems = getSelectedReadyItems();

  if (!workspaceId) {
    setStatus('Choose an active workspace before creating a render.', true);
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
      throw new Error(
        await getResponseErrorMessage(response, `Unable to create render (${response.status}).`)
      );
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

async function createWorkspaceFromPopup(): Promise<void> {
  const title = newWorkspaceTitleInput.value.trim();
  const apiBaseUrl = getApiBaseUrl();

  if (!title) {
    setStatus('Workspace title is required.', true);
    return;
  }

  try {
    setCreateWorkspaceState(true);

    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title,
        domainType: DEFAULT_WORKSPACE_DOMAIN_TYPE
      })
    });

    if (!response.ok) {
      throw new Error(
        await getResponseErrorMessage(response, `Unable to create workspace (${response.status}).`)
      );
    }

    const payload = (await response.json()) as WorkspaceResponse;
    state.workspaces = [payload.data, ...state.workspaces.filter((workspace) => workspace.id !== payload.data.id)];
    newWorkspaceTitleInput.value = '';
    setStatus(`Created workspace "${payload.data.title}" and set it active.`);
    await setActiveWorkspace(payload.data.id);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Failed to create workspace.', true);
  } finally {
    setCreateWorkspaceState(false);
  }
}

async function deleteActiveWorkspace(): Promise<void> {
  const workspaceId = getWorkspaceId();
  const apiBaseUrl = getApiBaseUrl();

  if (!workspaceId) {
    setStatus('Choose an active workspace before deleting it.', true);
    return;
  }

  try {
    const response = await fetch(
      `${apiBaseUrl.replace(/\/$/, '')}/workspaces/${encodeURIComponent(workspaceId)}`,
      {
        method: 'DELETE'
      }
    );

    if (!response.ok) {
      throw new Error(
        await getResponseErrorMessage(response, `Unable to delete workspace (${response.status}).`)
      );
    }

    state.workspaces = state.workspaces.filter((workspace) => workspace.id !== workspaceId);
    state.activeWorkspaceId = state.workspaces[0]?.id ?? '';
    state.activeWorkspaceTitle = state.workspaces[0]?.title ?? '';
    await persistSettings();
    renderWorkspacePicker();
    renderActiveWorkspaceSummary();

    if (state.activeWorkspaceId) {
      await refreshWorkspaceView();
    } else {
      resetWorkspaceView('No workspace selected', 'Create a workspace to get started.');
    }

    setStatus('Workspace deleted.');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Failed to delete workspace.', true);
  }
}

async function loadSettings(): Promise<void> {
  const settings = await readSettings();

  apiBaseUrlInput.value = settings.apiBaseUrl?.trim() || DEFAULT_API_BASE_URL;
  state.activeWorkspaceId = settings.workspaceId?.trim() ?? '';
  state.activeWorkspaceTitle = settings.workspaceTitle?.trim() ?? '';

  renderWorkspacePicker();
  renderActiveWorkspaceSummary();
  await refreshWorkspaceList({ preserveStatus: true });
}

settingsForm.addEventListener('submit', (event) => {
  event.preventDefault();

  persistSettings()
    .then(async () => {
      setStatus('Saved API settings. Refreshing workspaces…');
      await refreshWorkspaceList({ preserveStatus: true });
    })
    .catch((error: unknown) => {
      setStatus(error instanceof Error ? error.message : 'Failed to save settings.', true);
    });
});

workspacePicker.addEventListener('change', () => {
  void setActiveWorkspace(workspacePicker.value.trim())
    .then(() => {
      if (workspacePicker.value) {
        setStatus('Active workspace updated.');
      } else {
        setStatus('Active workspace cleared.');
      }
    })
    .catch((error: unknown) => {
      setStatus(error instanceof Error ? error.message : 'Failed to update active workspace.', true);
    });
});

refreshWorkspaceListButton.addEventListener('click', () => {
  void refreshWorkspaceList();
});

createWorkspaceForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void createWorkspaceFromPopup();
});

refreshWorkspaceButton.addEventListener('click', () => {
  void refreshWorkspaceView();
});

deleteWorkspaceButton.addEventListener('click', () => {
  void deleteActiveWorkspace();
});

refreshRendersButton.addEventListener('click', () => {
  void refreshWorkspaceView();
});

submitRenderButton.addEventListener('click', () => {
  void submitRenderRequest();
});

renderWorkspacePicker();
renderActiveWorkspaceSummary();
updateSubmitButtonState();
void loadSettings();

window.addEventListener('unload', () => {
  clearRenderPollTimer();
});
