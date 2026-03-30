const SETTINGS_KEY = 'captureSettings';
const DEFAULT_API_BASE_URL = 'http://localhost:3000';
const formElement = document.querySelector('#settings-form');
const workspaceInputElement = document.querySelector('#workspace-id');
const apiBaseUrlInputElement = document.querySelector('#api-base-url');
const statusElementValue = document.querySelector('#status');
const workspaceNameElement = document.querySelector('#workspace-name');
const workspaceImagesElement = document.querySelector('#workspace-images');
const workspaceSummaryElement = document.querySelector('#workspace-images-summary');
const refreshWorkspaceButtonElement = document.querySelector('#refresh-workspace');
if (!formElement ||
    !workspaceInputElement ||
    !apiBaseUrlInputElement ||
    !statusElementValue ||
    !workspaceNameElement ||
    !workspaceImagesElement ||
    !workspaceSummaryElement ||
    !refreshWorkspaceButtonElement) {
    throw new Error('Popup UI is missing required elements.');
}
const form = formElement;
const workspaceInput = workspaceInputElement;
const apiBaseUrlInput = apiBaseUrlInputElement;
const statusElement = statusElementValue;
const workspaceName = workspaceNameElement;
const workspaceImages = workspaceImagesElement;
const workspaceImagesSummary = workspaceSummaryElement;
const refreshWorkspaceButton = refreshWorkspaceButtonElement;
function setStatus(message, isError = false) {
    statusElement.textContent = message;
    statusElement.style.color = isError ? '#b91c1c' : '#166534';
}
function setWorkspaceLoadingState(isLoading) {
    refreshWorkspaceButton.disabled = isLoading;
    refreshWorkspaceButton.textContent = isLoading ? 'Refreshing…' : 'Refresh workspace';
}
function renderWorkspaceImages(items) {
    workspaceImages.innerHTML = '';
    const imageUrls = items
        .map((item) => item.imageUrl)
        .filter((imageUrl) => Boolean(imageUrl));
    workspaceImagesSummary.textContent = `${imageUrls.length} image${imageUrls.length === 1 ? '' : 's'} from workspace items`;
    if (imageUrls.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.className = 'workspace-images-empty';
        emptyMessage.textContent = 'No item images found for this workspace yet.';
        workspaceImages.append(emptyMessage);
        return;
    }
    imageUrls.forEach((imageUrl, index) => {
        const imageElement = document.createElement('img');
        imageElement.src = imageUrl;
        imageElement.alt = `Workspace item image ${index + 1}`;
        imageElement.loading = 'lazy';
        workspaceImages.append(imageElement);
    });
}
async function fetchWorkspaceData(workspaceId, apiBaseUrl) {
    const workspaceUrl = `${apiBaseUrl.replace(/\/$/, '')}/workspaces/${encodeURIComponent(workspaceId)}`;
    const itemsUrl = `${apiBaseUrl.replace(/\/$/, '')}/workspaces/${encodeURIComponent(workspaceId)}/items`;
    const [workspaceResponse, itemsResponse] = await Promise.all([fetch(workspaceUrl), fetch(itemsUrl)]);
    if (!workspaceResponse.ok) {
        throw new Error(`Unable to load workspace (${workspaceResponse.status}).`);
    }
    if (!itemsResponse.ok) {
        throw new Error(`Unable to load workspace items (${itemsResponse.status}).`);
    }
    const workspacePayload = (await workspaceResponse.json());
    const itemsPayload = (await itemsResponse.json());
    workspaceName.textContent = workspacePayload.data.title;
    renderWorkspaceImages(itemsPayload.data);
}
async function refreshWorkspaceView() {
    const workspaceId = workspaceInput.value.trim();
    const apiBaseUrl = apiBaseUrlInput.value.trim() || DEFAULT_API_BASE_URL;
    if (!workspaceId) {
        workspaceName.textContent = 'Set a workspace ID to load details.';
        workspaceImagesSummary.textContent = '0 images from workspace items';
        workspaceImages.innerHTML = '';
        return;
    }
    try {
        setWorkspaceLoadingState(true);
        workspaceName.textContent = 'Loading workspace…';
        await fetchWorkspaceData(workspaceId, apiBaseUrl);
    }
    catch (error) {
        workspaceName.textContent = 'Unable to load workspace details.';
        workspaceImagesSummary.textContent = '0 images from workspace items';
        workspaceImages.innerHTML = '';
        setStatus(error instanceof Error ? error.message : 'Failed to load workspace details.', true);
    }
    finally {
        setWorkspaceLoadingState(false);
    }
}
async function loadSettings() {
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    const settings = (result[SETTINGS_KEY] ?? {});
    workspaceInput.value = settings.workspaceId ?? '';
    apiBaseUrlInput.value = settings.apiBaseUrl ?? DEFAULT_API_BASE_URL;
    await refreshWorkspaceView();
}
form.addEventListener('submit', (event) => {
    event.preventDefault();
    const workspaceId = workspaceInput.value.trim();
    const apiBaseUrl = apiBaseUrlInput.value.trim() || DEFAULT_API_BASE_URL;
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
        setStatus('Saved. Right-click any image and choose “Save image to workspace.”');
        return refreshWorkspaceView();
    })
        .catch((error) => {
        setStatus(error instanceof Error ? error.message : 'Failed to save settings.', true);
    });
});
refreshWorkspaceButton.addEventListener('click', () => {
    void refreshWorkspaceView();
});
void loadSettings();
export {};
