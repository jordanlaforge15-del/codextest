interface StoredSettings {
  workspaceId?: string;
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
const DEFAULT_API_BASE_URL = 'http://localhost:3000';
const LOG_PREFIX = '[workspace-capture]';
const NOTIFICATION_ICON_URL =
  "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%23111827'/%3E%3Cpath d='M18 32l9 9 19-19' fill='none' stroke='%23f8fafc' stroke-linecap='round' stroke-linejoin='round' stroke-width='6'/%3E%3C/svg%3E";

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

async function getSettings(): Promise<Required<StoredSettings>> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const raw = (result[SETTINGS_KEY] ?? {}) as StoredSettings;

  log('Loaded extension settings', raw);

  return {
    workspaceId: raw.workspaceId?.trim() ?? '',
    apiBaseUrl: raw.apiBaseUrl?.trim() || DEFAULT_API_BASE_URL
  };
}

async function showNotification(title: string, message: string): Promise<void> {
  await new Promise<string>((resolve, reject) => {
    chrome.notifications.create(
      '',
      {
        type: 'basic',
        iconUrl: NOTIFICATION_ICON_URL,
        title,
        message
      },
      (notificationId: string) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }

        resolve(notificationId);
      }
    );
  });
}

async function saveCapture(info: ContextMenuInfo, tab?: BrowserTab): Promise<void> {
  log('saveCapture invoked', { info, tab });
  const { workspaceId, apiBaseUrl } = await getSettings();

  if (!workspaceId) {
    log('Aborting save because workspaceId is missing');
    await showNotification(
      'Workspace capture failed',
      'Set a workspace ID in the extension popup before saving images.'
    );
    return;
  }

  const imageUrl = info.srcUrl;
  if (!imageUrl) {
    log('Aborting save because srcUrl is missing', info);
    await showNotification('Workspace capture failed', 'No image URL found from context menu action.');
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

  await showNotification('Saved to workspace', `Image saved to workspace ${workspaceId}.`);
  log('Capture saved successfully', { workspaceId, imageUrl });
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

  saveCapture(info, tab).catch(async (error) => {
    log('saveCapture failed', getErrorMessage(error));
    await showNotification('Workspace capture failed', getErrorMessage(error));
  });
});

chrome.runtime.onMessage.addListener((message: unknown, sender: { tab?: BrowserTab }) => {
  const typedMessage = message as Partial<ImageContextMessage>;
  if (typedMessage.type !== 'IMAGE_CONTEXT_UPDATED' || !typedMessage.payload || !sender.tab?.id) {
    return;
  }

  log('Received image context update', {
    tabId: sender.tab.id,
    payload: typedMessage.payload
  });
  tabImageContext.set(sender.tab.id, typedMessage.payload);
});
