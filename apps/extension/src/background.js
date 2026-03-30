const CONTEXT_MENU_ID = 'save-image-to-workspace';
const SETTINGS_KEY = 'captureSettings';
const DEFAULT_API_BASE_URL = 'http://localhost:3000';
const LOG_PREFIX = '[workspace-capture]';
const tabImageContext = new Map();
function log(message, details) {
    if (details === undefined) {
        console.log(LOG_PREFIX, message);
        return;
    }
    console.log(LOG_PREFIX, message, details);
}
function getErrorMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }
    return 'Unknown error';
}
async function getSettings() {
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    const raw = (result[SETTINGS_KEY] ?? {});
    log('Loaded extension settings', raw);
    return {
        workspaceId: raw.workspaceId?.trim() ?? '',
        apiBaseUrl: raw.apiBaseUrl?.trim() || DEFAULT_API_BASE_URL
    };
}
async function saveCapture(info, tab) {
    log('saveCapture invoked', { info, tab });
    const { workspaceId, apiBaseUrl } = await getSettings();
    if (!workspaceId) {
        log('Aborting save because workspaceId is missing');
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
        const responseBody = (await response.clone().json());
        log('Capture response body', responseBody);
    }
    catch {
        log('Capture response body was not valid JSON');
    }
    if (!response.ok) {
        let errorMessage = `Request failed (${response.status})`;
        try {
            const body = (await response.json());
            log('Capture response error body', body);
            if (body.error?.message) {
                errorMessage = body.error.message;
            }
        }
        catch {
            // Ignore JSON parse errors.
        }
        throw new Error(errorMessage);
    }
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
chrome.contextMenus.onClicked.addListener((info, tab) => {
    log('Context menu clicked', { info, tab });
    if (info.menuItemId !== CONTEXT_MENU_ID) {
        log('Ignoring context menu click for unrelated menu item', info.menuItemId);
        return;
    }
    saveCapture(info, tab).catch((error) => {
        log('saveCapture failed', getErrorMessage(error));
    });
});
chrome.runtime.onMessage.addListener((message, sender) => {
    const typedMessage = message;
    if (typedMessage.type !== 'IMAGE_CONTEXT_UPDATED' || !typedMessage.payload || !sender.tab?.id) {
        return;
    }
    log('Received image context update', {
        tabId: sender.tab.id,
        payload: typedMessage.payload
    });
    tabImageContext.set(sender.tab.id, typedMessage.payload);
});
export {};
