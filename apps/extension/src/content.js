function getSurroundingText(image) {
    const container = image.closest('figure, article, section, div, li') ?? image.parentElement;
    if (!container) {
        return null;
    }
    const text = container.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    if (!text) {
        return null;
    }
    return text.slice(0, 280);
}
const BUTTON_ID = 'workspace-capture-inline-button';
const BUTTON_BASE_TEXT = 'Save image';
const BUTTON_SUCCESS_TEXT = 'Saved ✓';
const BUTTON_ERROR_TEXT = 'Failed ✕';
const BUTTON_MARGIN = 8;
const FALLBACK_BUTTON_WIDTH = 96;
const FALLBACK_BUTTON_HEIGHT = 32;
let activeImage = null;
let resetTimer = null;
const saveButton = document.createElement('button');
saveButton.id = BUTTON_ID;
saveButton.type = 'button';
saveButton.textContent = BUTTON_BASE_TEXT;
saveButton.style.position = 'fixed';
saveButton.style.zIndex = '2147483647';
saveButton.style.padding = '6px 10px';
saveButton.style.borderRadius = '999px';
saveButton.style.border = '1px solid #2563eb';
saveButton.style.background = '#2563eb';
saveButton.style.color = '#ffffff';
saveButton.style.font = '600 12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
saveButton.style.cursor = 'pointer';
saveButton.style.boxShadow = '0 3px 12px rgba(0, 0, 0, 0.2)';
saveButton.style.display = 'none';
function getButtonContainer() {
    if (document.body) {
        return document.body;
    }
    if (document.documentElement) {
        return document.documentElement;
    }
    return null;
}
function mountSaveButton() {
    const container = getButtonContainer();
    if (container) {
        container.append(saveButton);
        return;
    }
    document.addEventListener('DOMContentLoaded', () => {
        const readyContainer = getButtonContainer();
        if (readyContainer) {
            readyContainer.append(saveButton);
        }
    }, { once: true });
}
function setButtonState(state, errorMessage) {
    if (resetTimer !== null) {
        window.clearTimeout(resetTimer);
        resetTimer = null;
    }
    switch (state) {
        case 'idle':
            saveButton.textContent = BUTTON_BASE_TEXT;
            saveButton.style.background = '#2563eb';
            saveButton.style.borderColor = '#2563eb';
            saveButton.disabled = false;
            saveButton.title = '';
            break;
        case 'saving':
            saveButton.textContent = 'Saving…';
            saveButton.style.background = '#1d4ed8';
            saveButton.style.borderColor = '#1d4ed8';
            saveButton.disabled = true;
            saveButton.title = '';
            break;
        case 'success':
            saveButton.textContent = BUTTON_SUCCESS_TEXT;
            saveButton.style.background = '#15803d';
            saveButton.style.borderColor = '#15803d';
            saveButton.disabled = false;
            saveButton.title = '';
            resetTimer = window.setTimeout(() => setButtonState('idle'), 1600);
            break;
        case 'error':
            saveButton.textContent = BUTTON_ERROR_TEXT;
            saveButton.style.background = '#b91c1c';
            saveButton.style.borderColor = '#b91c1c';
            saveButton.disabled = false;
            saveButton.title = errorMessage ?? 'Unable to save image.';
            resetTimer = window.setTimeout(() => setButtonState('idle'), 2400);
            break;
    }
}
function isEligibleImage(image) {
    const imageUrl = image.currentSrc || image.src;
    return Boolean(imageUrl) && image.width >= 80 && image.height >= 80;
}
function getButtonCoordinates(image) {
    const rect = image.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) {
        return null;
    }
    const previousDisplay = saveButton.style.display;
    const previousVisibility = saveButton.style.visibility;
    if (previousDisplay === 'none') {
        saveButton.style.visibility = 'hidden';
        saveButton.style.display = 'block';
    }
    const buttonWidth = saveButton.offsetWidth || FALLBACK_BUTTON_WIDTH;
    const buttonHeight = saveButton.offsetHeight || FALLBACK_BUTTON_HEIGHT;
    if (previousDisplay === 'none') {
        saveButton.style.display = previousDisplay;
        saveButton.style.visibility = previousVisibility;
    }
    const maxTop = Math.max(BUTTON_MARGIN, window.innerHeight - buttonHeight - BUTTON_MARGIN);
    const maxLeft = Math.max(BUTTON_MARGIN, window.innerWidth - buttonWidth - BUTTON_MARGIN);
    const top = Math.min(Math.max(BUTTON_MARGIN, rect.top + BUTTON_MARGIN), maxTop);
    const left = Math.min(Math.max(BUTTON_MARGIN, rect.right - buttonWidth - BUTTON_MARGIN), maxLeft);
    return { top, left };
}
function hideButton() {
    saveButton.style.display = 'none';
    activeImage = null;
    setButtonState('idle');
}
function positionButton(image) {
    const coords = getButtonCoordinates(image);
    if (!coords) {
        hideButton();
        return;
    }
    saveButton.style.display = 'block';
    saveButton.style.top = `${coords.top}px`;
    saveButton.style.left = `${coords.left}px`;
}
function maybeShowButtonForTarget(target) {
    if (!(target instanceof Element)) {
        return;
    }
    const image = target.closest('img');
    if (!(image instanceof HTMLImageElement) || !isEligibleImage(image)) {
        return;
    }
    activeImage = image;
    positionButton(image);
}
async function saveActiveImage() {
    if (!activeImage) {
        return;
    }
    const imageUrl = activeImage.currentSrc || activeImage.src;
    if (!imageUrl) {
        setButtonState('error', 'No image URL found.');
        return;
    }
    setButtonState('saving');
    const response = (await chrome.runtime.sendMessage({
        type: 'SAVE_IMAGE_FROM_PAGE',
        payload: {
            imageUrl,
            pageUrl: location.href,
            pageTitle: document.title,
            altText: activeImage.alt?.trim() || null,
            surroundingText: getSurroundingText(activeImage)
        }
    }));
    if (response.ok) {
        setButtonState('success');
        return;
    }
    setButtonState('error', response.error);
}
mountSaveButton();
saveButton.addEventListener('click', (event) => {
    if (!event.isTrusted) {
        return;
    }
    void saveActiveImage();
});
saveButton.addEventListener('mouseenter', (event) => {
    if (!event.isTrusted) {
        return;
    }
    if (activeImage) {
        positionButton(activeImage);
    }
});
document.addEventListener('mousemove', (event) => {
    if (!event.isTrusted) {
        return;
    }
    maybeShowButtonForTarget(event.target);
}, true);
document.addEventListener('contextmenu', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLImageElement)) {
        return;
    }
    chrome.runtime.sendMessage({
        type: 'IMAGE_CONTEXT_UPDATED',
        payload: {
            imageUrl: target.currentSrc || target.src,
            altText: target.alt?.trim() || null,
            surroundingText: getSurroundingText(target)
        }
    });
}, true);
document.addEventListener('mouseout', (event) => {
    if (!activeImage || !(event.target instanceof Element)) {
        return;
    }
    if (!event.target.closest('img') && event.target !== saveButton) {
        return;
    }
    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Element &&
        (relatedTarget.closest('img') === activeImage || relatedTarget === saveButton || saveButton.contains(relatedTarget))) {
        return;
    }
    hideButton();
}, true);
window.addEventListener('scroll', () => {
    if (activeImage) {
        positionButton(activeImage);
    }
});
window.addEventListener('resize', () => {
    if (activeImage) {
        positionButton(activeImage);
    }
});
