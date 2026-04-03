interface StoredSettings {
  workspaceId?: string;
  workspaceTitle?: string;
  apiBaseUrl?: string;
}

interface ImageContextMessage {
  type: 'IMAGE_CONTEXT_UPDATED';
  payload: {
    imageUrl: string;
    altText: string | null;
    surroundingText: string | null;
  };
}

interface SaveImageFromPageMessage {
  type: 'SAVE_IMAGE_FROM_PAGE';
  payload: {
    imageUrl: string;
    pageUrl: string | null;
    pageTitle: string | null;
    altText: string | null;
    surroundingText: string | null;
  };
}

interface SaveImageFromPageResponse {
  ok: boolean;
  error?: string;
}

interface ContextMenuInfo {
  menuItemId: string;
  mediaType?: string;
  pageUrl?: string;
  srcUrl?: string;
}

interface BrowserTab {
  id?: number;
  url?: string;
  title?: string;
}

const CONTEXT_MENU_ID = 'save-image-to-workspace';
const SETTINGS_KEY = 'captureSettings';
const DEFAULT_API_BASE_URL = 'http://localhost:4000';
const LOG_PREFIX = '[workspace-capture]';
const NOTIFICATION_ICON_URL =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiB2aWV3Qm94PSIwIDAgMTI4IDEyOCI+PHJlY3Qgd2lkdGg9IjEyOCIgaGVpZ2h0PSIxMjgiIHJ4PSIyNCIgZmlsbD0iIzI1NjNlYiIvPjxwYXRoIGQ9Ik0zNiA0NmMwLTYuNjI3IDUuMzczLTEyIDEyLTEyaDMyYzYuNjI3IDAgMTIgNS4zNzMgMTIgMTJ2MzZjMCA2LjYyNy01LjM3MyAxMi0xMiAxMkg0OGMtNi42MjcgMC0xMi01LjM3My0xMi0xMlY0NlpNNjQgNThjLTYuNjI3IDAtMTIgNS4zNzMtMTIgMTJoMjRjMC02LjYyNy01LjM3My0xMi0xMi0xMloiIGZpbGw9IiNmZmYiLz48L3N2Zz4=';

const tabImageContext = new Map<number, ImageContextMessage['payload']>();

function log(message: string, details?: unknown): void {
  if (details === undefined) {
    console.log(LOG_PREFIX, message);
    return;
  }

  console.log(LOG_PREFIX, message, details);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
}

function notifyUser(message: string): void {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: NOTIFICATION_ICON_URL,
    title: 'Workspace Capture',
    message
  });
}

async function getSettings(): Promise<{
  workspaceId: string;
  workspaceTitle: string;
  apiBaseUrl: string;
}> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const raw = (result[SETTINGS_KEY] ?? {}) as StoredSettings;

  log('Loaded extension settings', raw);

  return {
    workspaceId: raw.workspaceId?.trim() ?? '',
    workspaceTitle: raw.workspaceTitle?.trim() ?? '',
    apiBaseUrl: raw.apiBaseUrl?.trim() || DEFAULT_API_BASE_URL
  };
}

async function saveCapture(info: ContextMenuInfo, tab?: BrowserTab): Promise<void> {
  log('saveCapture invoked', { info, tab });
  const { workspaceId, apiBaseUrl } = await getSettings();

  if (!workspaceId) {
    log('Aborting save because workspaceId is missing');
    notifyUser('Choose an active workspace in the extension popup before saving images.');
    return;
  }

  const imageUrl = info.srcUrl;
  if (!imageUrl) {
    log('Aborting save because srcUrl is missing', info);
    return;
  }

  const tabId = tab?.id;
  const imageContext = tabId ? tabImageContext.get(tabId) : undefined;

  const pageUrl = info.pageUrl ?? tab?.url ?? '';
  const pageTitle = tab?.title ?? '';

  const payload = {
    page_url: pageUrl,
    image_url: imageUrl,
    page_title: pageTitle,
    alt_text: imageContext?.altText ?? null,
    surrounding_text: imageContext?.surroundingText ?? null,
    raw_payload_json: {
      context_menu: {
        mediaType: info.mediaType,
        pageUrl: info.pageUrl,
        srcUrl: info.srcUrl
      },
      tab: {
        id: tab?.id,
        url: tab?.url,
        title: tab?.title
      },
      captured_at: new Date().toISOString()
    }
  };

  const requestUrl = `${apiBaseUrl.replace(/\/$/, '')}/workspaces/${encodeURIComponent(workspaceId)}/captures`;
  log('Sending capture request', { requestUrl, payload });

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  log('Received capture response', {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText
  });

  try {
    const responseBody = (await response.clone().json()) as unknown;
    log('Capture response body', responseBody);
  } catch {
    log('Capture response body was not valid JSON');
  }

  if (!response.ok) {
    let errorMessage = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      log('Capture response error body', body);
      if (body.error?.message) {
        errorMessage = body.error.message;
      }
    } catch {
      // Ignore JSON parse errors.
    }

    throw new Error(errorMessage);
  }

  log('Capture saved successfully', { workspaceId, imageUrl });
}

async function saveCaptureFromPageMessage(payload: SaveImageFromPageMessage['payload']): Promise<void> {
  const { workspaceId, apiBaseUrl } = await getSettings();
  if (!workspaceId) {
    throw new Error('Choose an active workspace in the extension popup before saving images.');
  }

  if (!payload.imageUrl) {
    throw new Error('Could not determine image URL.');
  }

  const requestPayload = {
    page_url: payload.pageUrl ?? '',
    image_url: payload.imageUrl,
    page_title: payload.pageTitle ?? '',
    alt_text: payload.altText,
    surrounding_text: payload.surroundingText,
    raw_payload_json: {
      capture_source: 'inline-button',
      captured_at: new Date().toISOString()
    }
  };

  const requestUrl = `${apiBaseUrl.replace(/\/$/, '')}/workspaces/${encodeURIComponent(workspaceId)}/captures`;
  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestPayload)
  });

  if (!response.ok) {
    let errorMessage = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (body.error?.message) {
        errorMessage = body.error.message;
      }
    } catch {
      // Ignore JSON parse errors.
    }
    throw new Error(errorMessage);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  log('Extension installed or updated, creating context menu');
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: 'Save image to workspace',
    contexts: ['image']
  });
});

chrome.contextMenus.onClicked.addListener((info: ContextMenuInfo, tab: BrowserTab) => {
  log('Context menu clicked', { info, tab });
  if (info.menuItemId !== CONTEXT_MENU_ID) {
    log('Ignoring context menu click for unrelated menu item', info.menuItemId);
    return;
  }

  saveCapture(info, tab).catch((error) => {
    log('saveCapture failed', getErrorMessage(error));
    notifyUser(`Could not save image: ${getErrorMessage(error)}`);
  });
});

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    sender: { tab?: BrowserTab },
    sendResponse: (response: SaveImageFromPageResponse) => void
  ) => {
    const typedMessage = message as { type?: string; payload?: unknown };

    if (typedMessage.type === 'IMAGE_CONTEXT_UPDATED' && typedMessage.payload && sender.tab?.id) {
      const contextPayload = typedMessage.payload as ImageContextMessage['payload'];
      log('Received image context update', {
        tabId: sender.tab.id,
        payload: contextPayload
      });
      tabImageContext.set(sender.tab.id, contextPayload);
      return;
    }

    if (typedMessage.type !== 'SAVE_IMAGE_FROM_PAGE' || !typedMessage.payload) {
      return;
    }

    void saveCaptureFromPageMessage(typedMessage.payload as SaveImageFromPageMessage['payload'])
      .then(() => {
        sendResponse({ ok: true });
      })
      .catch((error) => {
        sendResponse({ ok: false, error: getErrorMessage(error) });
      });

    return true;
  }
);
