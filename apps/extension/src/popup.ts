interface CaptureSettings {
  workspaceId: string;
  apiBaseUrl: string;
}

const SETTINGS_KEY = 'captureSettings';
const DEFAULT_API_BASE_URL = 'http://localhost:3000';

const form = document.querySelector<HTMLFormElement>('#settings-form');
const workspaceInput = document.querySelector<HTMLInputElement>('#workspace-id');
const apiBaseUrlInput = document.querySelector<HTMLInputElement>('#api-base-url');
const statusElement = document.querySelector<HTMLParagraphElement>('#status');

if (!form || !workspaceInput || !apiBaseUrlInput || !statusElement) {
  throw new Error('Popup UI is missing required elements.');
}

function setStatus(message: string, isError = false): void {
  statusElement.textContent = message;
  statusElement.style.color = isError ? '#b91c1c' : '#166534';
}

async function loadSettings(): Promise<void> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const settings = (result[SETTINGS_KEY] ?? {}) as Partial<CaptureSettings>;

  workspaceInput.value = settings.workspaceId ?? '';
  apiBaseUrlInput.value = settings.apiBaseUrl ?? DEFAULT_API_BASE_URL;
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
    })
    .catch((error: unknown) => {
      setStatus(error instanceof Error ? error.message : 'Failed to save settings.', true);
    });
});

void loadSettings();
