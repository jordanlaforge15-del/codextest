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

const tabImageContext = new Map<number, ImageContextMessage['payload']>();

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
}

async function getSettings(): Promise<Required<StoredSettings>> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const raw = (result[SETTINGS_KEY] ?? {}) as StoredSettings;

  return {
    workspaceId: raw.workspaceId?.trim() ?? '',
    apiBaseUrl: raw.apiBaseUrl?.trim() || DEFAULT_API_BASE_URL
  };
}

async function showNotification(title: string, message: string): Promise<void> {
  await chrome.notifications.create({
    type: 'basic',
    title,
    message
  });
}

async function saveCapture(info: ContextMenuInfo, tab?: BrowserTab): Promise<void> {
  const { workspaceId, apiBaseUrl } = await getSettings();

  if (!workspaceId) {
    await showNotification(
      'Workspace capture failed',
      'Set a workspace ID in the extension popup before saving images.'
    );
    return;
  }

  const imageUrl = info.srcUrl;
  if (!imageUrl) {
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

  const response = await fetch(
    `${apiBaseUrl.replace(/\/$/, '')}/workspaces/${encodeURIComponent(workspaceId)}/captures`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );

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

  await showNotification('Saved to workspace', `Image saved to workspace ${workspaceId}.`);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: 'Save image to workspace',
    contexts: ['image']
  });
});

chrome.contextMenus.onClicked.addListener((info: ContextMenuInfo, tab: BrowserTab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) {
    return;
  }

  saveCapture(info, tab).catch(async (error) => {
    await showNotification('Workspace capture failed', getErrorMessage(error));
  });
});

chrome.runtime.onMessage.addListener((message: unknown, sender: { tab?: BrowserTab }) => {
  const typedMessage = message as Partial<ImageContextMessage>;
  if (typedMessage.type !== 'IMAGE_CONTEXT_UPDATED' || !typedMessage.payload || !sender.tab?.id) {
    return;
  }

  tabImageContext.set(sender.tab.id, typedMessage.payload);
});
