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
export {};
