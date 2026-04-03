function getSurroundingText(image: HTMLImageElement): string | null {
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

interface SaveImageResponse {
  ok: boolean;
  error?: string;
}

const BUTTON_ID = 'workspace-capture-inline-button';
const BUTTON_BASE_TEXT = 'Save image';
const BUTTON_SUCCESS_TEXT = 'Saved ✓';
const BUTTON_ERROR_TEXT = 'Failed ✕';

let activeImage: HTMLImageElement | null = null;
let resetTimer: number | null = null;

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

function setButtonState(state: 'idle' | 'saving' | 'success' | 'error', errorMessage?: string): void {
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

function isEligibleImage(image: HTMLImageElement): boolean {
  const imageUrl = image.currentSrc || image.src;
  return Boolean(imageUrl) && image.width >= 80 && image.height >= 80;
}

function getButtonCoordinates(image: HTMLImageElement): { top: number; left: number } | null {
  const rect = image.getBoundingClientRect();
  if (rect.width < 20 || rect.height < 20) {
    return null;
  }

  const top = Math.max(8, rect.top + 8);
  const left = Math.max(8, rect.right - saveButton.offsetWidth - 8);
  return { top, left };
}

function hideButton(): void {
  saveButton.style.display = 'none';
  activeImage = null;
  setButtonState('idle');
}

function positionButton(image: HTMLImageElement): void {
  const coords = getButtonCoordinates(image);
  if (!coords) {
    hideButton();
    return;
  }

  saveButton.style.display = 'block';
  saveButton.style.top = `${coords.top}px`;
  saveButton.style.left = `${coords.left}px`;
}

function maybeShowButtonForTarget(target: EventTarget | null): void {
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

async function saveActiveImage(): Promise<void> {
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
  })) as SaveImageResponse;

  if (response.ok) {
    setButtonState('success');
    return;
  }

  setButtonState('error', response.error);
}

document.body.append(saveButton);

saveButton.addEventListener('click', () => {
  void saveActiveImage();
});

saveButton.addEventListener('mouseenter', () => {
  if (activeImage) {
    positionButton(activeImage);
  }
});

document.addEventListener(
  'mousemove',
  (event) => {
    maybeShowButtonForTarget(event.target);
  },
  true
);

document.addEventListener(
  'contextmenu',
  (event) => {
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
  },
  true
);

document.addEventListener(
  'mouseout',
  (event) => {
    if (!activeImage || !(event.target instanceof Element)) {
      return;
    }

    if (!event.target.closest('img') && event.target !== saveButton) {
      return;
    }

    const relatedTarget = event.relatedTarget;
    if (
      relatedTarget instanceof Element &&
      (relatedTarget.closest('img') === activeImage || relatedTarget === saveButton || saveButton.contains(relatedTarget))
    ) {
      return;
    }

    hideButton();
  },
  true
);

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
