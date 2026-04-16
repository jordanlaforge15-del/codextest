(function () {
  const browser = document.querySelector('[data-render-browser]');
  if (!(browser instanceof HTMLElement)) {
    return;
  }

  const workspaceId = browser.dataset.workspaceId;
  if (!workspaceId) {
    return;
  }

  const grid = browser.querySelector('[data-render-grid]');
  const undoButton = document.querySelector('[data-render-undo]');
  const narrowButton = document.querySelector('[data-render-narrow]');
  const filterButtons = Array.from(browser.querySelectorAll('[data-render-filter]'));
  const countElements = Array.from(browser.querySelectorAll('[data-render-count]'));
  const resetButtons = Array.from(browser.querySelectorAll('[data-render-reset]'));
  const emptyStates = Array.from(browser.querySelectorAll('[data-render-empty]'));
  const sidebar = document.querySelector('[data-workspace-sidebar]');
  const defaultSidebarView = sidebar?.querySelector('[data-sidebar-view="default"]');
  const detailSidebarView = sidebar?.querySelector('[data-sidebar-view="detail"]');
  const detailTitle = sidebar?.querySelector('[data-sidebar-detail-title]');
  const detailSubtitle = sidebar?.querySelector('[data-sidebar-detail-subtitle]');
  const detailItems = sidebar?.querySelector('[data-sidebar-detail-items]');
  const sidebarBackButton = sidebar?.querySelector('[data-sidebar-back]');
  const sidebarOpenButton = document.querySelector('[data-sidebar-open-toggle]');
  const sidebarCloseButton = sidebar?.querySelector('[data-sidebar-close]');
  const selectionForm = document.querySelector('[data-workspace-selection-form]');
  const itemsJsonElement = document.querySelector('[data-sidebar-items-json]');
  const history = [];
  let activeFilter = 'all';
  let expandedItemId = null;

  function parseSidebarItems() {
    if (!(itemsJsonElement instanceof HTMLScriptElement)) {
      return [];
    }

    try {
      const payload = JSON.parse(itemsJsonElement.textContent || '[]');
      return Array.isArray(payload) ? payload : [];
    } catch {
      return [];
    }
  }

  const itemsById = new Map(
    parseSidebarItems()
      .filter((item) => item && typeof item.id === 'string')
      .map((item) => [item.id, item])
  );

  function getCards() {
    return Array.from(browser.querySelectorAll('[data-render-card]'));
  }

  function normalizeVoteForState(state) {
    if (state === 'yes') return 'up';
    if (state === 'no') return 'down';
    return 'neutral';
  }

  function nextState(state) {
    if (state === 'maybe') return 'yes';
    if (state === 'yes') return 'no';
    return 'maybe';
  }

  function updateUndoButton() {
    if (!(undoButton instanceof HTMLButtonElement)) {
      return;
    }

    undoButton.hidden = history.length === 0;
    undoButton.textContent = history.length > 1 ? `Undo (${history.length})` : 'Undo';
  }

  function readSnapshot() {
    return getCards().map((card) => ({
      renderId: card.dataset.renderId || '',
      renderState: card.dataset.renderState || 'maybe',
      narrowedOut: card.dataset.narrowedOut || ''
    }));
  }

  function applySnapshot(snapshot) {
    const snapshotById = new Map(snapshot.map((entry) => [entry.renderId, entry]));
    for (const card of getCards()) {
      const previous = snapshotById.get(card.dataset.renderId || '');
      if (!previous) {
        continue;
      }

      card.dataset.renderState = previous.renderState;
      if (previous.narrowedOut) {
        card.dataset.narrowedOut = previous.narrowedOut;
      } else {
        delete card.dataset.narrowedOut;
      }

      const button = card.querySelector('[data-render-toggle]');
      if (button instanceof HTMLButtonElement) {
        button.setAttribute('aria-pressed', previous.renderState === 'yes' ? 'true' : 'false');
      }
    }
  }

  function updateCountsAndVisibility() {
    const cards = getCards();
    const counts = { all: 0, yes: 0, maybe: 0, no: 0 };

    for (const card of cards) {
      const state = card.dataset.renderState || 'maybe';
      const narrowedOut = card.dataset.narrowedOut === 'true';

      if (!narrowedOut && (state === 'yes' || state === 'maybe' || state === 'no')) {
        counts[state] += 1;
      }

      const shouldShow = !narrowedOut && (activeFilter === 'all' || state === activeFilter);
      card.hidden = !shouldShow;
    }

    counts.all = counts.yes + counts.maybe + counts.no;

    for (const element of countElements) {
      const key = element.getAttribute('data-render-count');
      if (key && key in counts) {
        element.textContent = String(counts[key]);
      }
    }

    const visibleCount = cards.filter((card) => !card.hidden).length;
    for (const emptyState of emptyStates) {
      emptyState.hidden = visibleCount > 0;
    }

    if (grid instanceof HTMLElement) {
      grid.hidden = visibleCount === 0;
    }

    if (narrowButton instanceof HTMLButtonElement) {
      narrowButton.disabled = counts.yes === 0;
    }
  }

  async function persistVote(renderId, vote) {
    const response = await fetch(
      `/workspaces/${encodeURIComponent(workspaceId)}/renders/${encodeURIComponent(renderId)}/vote`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ vote })
      }
    );

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error?.message || `Request failed (${response.status})`);
    }
  }

  async function setCardState(card, state) {
    const renderId = card.dataset.renderId;
    if (!renderId) {
      return;
    }

    const nextVote = normalizeVoteForState(state);
    await persistVote(renderId, nextVote);

    card.dataset.renderState = state;
    card.dataset.renderVote = nextVote;
    const button = card.querySelector('[data-render-toggle]');
    if (button instanceof HTMLButtonElement) {
      button.setAttribute('aria-pressed', state === 'yes' ? 'true' : 'false');
    }

    updateCountsAndVisibility();
  }

  function renderReadonlyItemCard(item) {
    const title = item.originalUrl
      ? `<a href="${item.originalUrl}" target="_blank" rel="noreferrer">${item.title}</a>`
      : `<strong>${item.title}</strong>`;
    const hasDetails = Boolean(item.brand || item.description || item.originalUrl);

    return `
      <article class="sidebar-item-card sidebar-item-card--readonly" data-sidebar-item-id="${item.id}">
        <div class="sidebar-item-card__checkbox sidebar-item-card__checkbox--placeholder" aria-hidden="true">
          <span></span>
        </div>
        <div class="sidebar-item-card__thumb">
          ${
            item.imageUrl
              ? `<img src="${item.imageUrl}" alt="${item.title}" />`
              : '<div class="sidebar-item-card__thumb-placeholder">No image</div>'
          }
        </div>
        <div class="sidebar-item-card__content">
          <div class="sidebar-item-card__title-row">${title}</div>
          ${
            item.brand || item.merchant
              ? `<p class="sidebar-item-card__subtle">${item.brand || item.merchant}</p>`
              : ''
          }
          ${
            hasDetails
              ? `
                <div class="sidebar-item-card__details" data-sidebar-item-details hidden>
                  <div class="sidebar-item-card__details-body">
                    ${
                      item.brand
                        ? `<div><p class="sidebar-item-card__details-label">Brand</p><p class="sidebar-item-card__details-copy">${item.brand}</p></div>`
                        : ''
                    }
                    ${
                      item.description
                        ? `<div><p class="sidebar-item-card__details-label">Description</p><p class="sidebar-item-card__details-copy">${item.description}</p></div>`
                        : ''
                    }
                  </div>
                </div>
              `
              : ''
          }
        </div>
        <div class="sidebar-item-card__actions">
          ${
            hasDetails
              ? '<button type="button" class="sidebar-item-card__icon-button" data-sidebar-item-expand aria-expanded="false" aria-label="Toggle item details">⌄</button>'
              : ''
          }
        </div>
      </article>
    `;
  }

  function setSidebarOpen(isOpen) {
    if (!(sidebar instanceof HTMLElement)) {
      return;
    }

    sidebar.classList.toggle('is-closed', !isOpen);
    if (sidebarOpenButton instanceof HTMLButtonElement) {
      sidebarOpenButton.hidden = isOpen;
    }
  }

  function resetExpandedItems(scope) {
    expandedItemId = null;
    if (!scope || typeof scope.querySelectorAll !== 'function') {
      return;
    }

    for (const button of scope.querySelectorAll('[data-sidebar-item-expand]')) {
      if (button instanceof HTMLButtonElement) {
        button.setAttribute('aria-expanded', 'false');
        button.textContent = '⌄';
      }
    }

    for (const card of scope.querySelectorAll('[data-sidebar-item-id]')) {
      if (card instanceof HTMLElement) {
        card.classList.remove('is-expanded');
      }
    }

    for (const details of scope.querySelectorAll('[data-sidebar-item-details]')) {
      if (details instanceof HTMLElement) {
        details.hidden = true;
      }
    }
  }

  function showDefaultSidebarView() {
    if (!(defaultSidebarView instanceof HTMLElement) || !(detailSidebarView instanceof HTMLElement)) {
      return;
    }

    resetExpandedItems(detailSidebarView);
    defaultSidebarView.hidden = false;
    detailSidebarView.hidden = true;
    setSidebarOpen(true);
    for (const card of getCards()) {
      card.classList.remove('is-inspected');
    }
  }

  function inspectRender(card) {
    if (
      !(defaultSidebarView instanceof HTMLElement) ||
      !(detailSidebarView instanceof HTMLElement) ||
      !(detailItems instanceof HTMLElement)
    ) {
      return;
    }

    const renderLabel = card.dataset.renderLabel || 'Render details';
    const selectedItemIds = JSON.parse(card.dataset.renderSelectedItemIds || '[]');
    const usedItems = Array.isArray(selectedItemIds)
      ? selectedItemIds.map((itemId) => itemsById.get(itemId)).filter(Boolean)
      : [];

    resetExpandedItems(defaultSidebarView);
    defaultSidebarView.hidden = true;
    detailSidebarView.hidden = false;
    setSidebarOpen(true);
    if (detailTitle instanceof HTMLElement) {
      detailTitle.textContent = renderLabel;
    }
    if (detailSubtitle instanceof HTMLElement) {
      detailSubtitle.textContent =
        usedItems.length > 0
          ? `${usedItems.length} item${usedItems.length === 1 ? '' : 's'} used in this render`
          : 'No items associated with this render';
    }

    detailItems.innerHTML =
      usedItems.length > 0
        ? usedItems.map((item) => renderReadonlyItemCard(item)).join('')
        : '<p class="empty">No items associated with this render.</p>';

    for (const candidate of getCards()) {
      candidate.classList.toggle('is-inspected', candidate === card);
    }
  }

  function toggleItemExpansion(card) {
    if (!(card instanceof HTMLElement)) {
      return;
    }

    const itemId = card.getAttribute('data-sidebar-item-id');
    const details = card.querySelector('[data-sidebar-item-details]');
    const button = card.querySelector('[data-sidebar-item-expand]');
    const container = card.closest('[data-sidebar-view]') || card.parentElement;

    if (!(details instanceof HTMLElement) || !(button instanceof HTMLButtonElement)) {
      return;
    }

    const shouldExpand = expandedItemId !== itemId;
    resetExpandedItems(container);

    if (shouldExpand && itemId) {
      details.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      button.textContent = '⌃';
      card.classList.add('is-expanded');
      expandedItemId = itemId;
    }
  }

  for (const button of filterButtons) {
    button.addEventListener('click', () => {
      activeFilter = button.getAttribute('data-render-filter') || 'all';
      for (const candidate of filterButtons) {
        candidate.classList.toggle(
          'is-active',
          candidate.getAttribute('data-render-filter') === activeFilter
        );
      }
      updateCountsAndVisibility();
    });
  }

  for (const resetButton of resetButtons) {
    resetButton.addEventListener('click', () => {
      activeFilter = 'all';
      for (const candidate of filterButtons) {
        candidate.classList.toggle(
          'is-active',
          candidate.getAttribute('data-render-filter') === activeFilter
        );
      }
      updateCountsAndVisibility();
    });
  }

  browser.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const inspectButton = target.closest('[data-render-inspect]');
    if (inspectButton instanceof HTMLButtonElement) {
      const card = inspectButton.closest('[data-render-card]');
      if (card instanceof HTMLElement) {
        inspectRender(card);
      }
      return;
    }

    const toggle = target.closest('[data-render-toggle]');
    if (!(toggle instanceof HTMLButtonElement)) {
      return;
    }

    const card = toggle.closest('[data-render-card]');
    if (!(card instanceof HTMLElement)) {
      return;
    }

    toggle.disabled = true;
    const previousState = card.dataset.renderState || 'maybe';

    try {
      await setCardState(card, nextState(previousState));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Failed to save render vote.');
    } finally {
      toggle.disabled = false;
    }
  });

  if (sidebarOpenButton instanceof HTMLButtonElement) {
    sidebarOpenButton.addEventListener('click', () => {
      showDefaultSidebarView();
    });
  }

  if (sidebarCloseButton instanceof HTMLButtonElement) {
    sidebarCloseButton.addEventListener('click', () => {
      setSidebarOpen(false);
    });
  }

  if (sidebarBackButton instanceof HTMLButtonElement) {
    sidebarBackButton.addEventListener('click', showDefaultSidebarView);
  }

  if (selectionForm instanceof HTMLFormElement) {
    selectionForm.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const expandButton = target.closest('[data-sidebar-item-expand]');
      if (expandButton instanceof HTMLButtonElement) {
        const card = expandButton.closest('[data-sidebar-item-id]');
        toggleItemExpansion(card);
        return;
      }

      const card = target.closest('[data-sidebar-item-id]');
      if (!(card instanceof HTMLElement)) {
        return;
      }

      if (
        target.closest('a') ||
        target.closest('button') ||
        target.closest('input') ||
        target.closest('.sidebar-item-card__checkbox') ||
        card.classList.contains('sidebar-item-card--readonly')
      ) {
        return;
      }

      const checkbox = card.querySelector('input[data-selected-item-checkbox]');
      if (checkbox instanceof HTMLInputElement) {
        checkbox.click();
      }
    });
  }

  if (detailSidebarView instanceof HTMLElement) {
    detailSidebarView.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const expandButton = target.closest('[data-sidebar-item-expand]');
      if (!(expandButton instanceof HTMLButtonElement)) {
        return;
      }

      const card = expandButton.closest('[data-sidebar-item-id]');
      toggleItemExpansion(card);
    });
  }

  if (undoButton instanceof HTMLButtonElement) {
    undoButton.addEventListener('click', () => {
      const previous = history.pop();
      updateUndoButton();
      if (!previous || previous.type !== 'snapshot') {
        return;
      }

      applySnapshot(previous.snapshot);
      updateCountsAndVisibility();
    });
  }

  if (narrowButton instanceof HTMLButtonElement) {
    narrowButton.addEventListener('click', () => {
      const cards = getCards();
      const selectedCards = cards.filter(
        (card) => card.dataset.renderState === 'yes' && card.dataset.narrowedOut !== 'true'
      );

      if (selectedCards.length === 0) {
        return;
      }

      history.push({
        type: 'snapshot',
        snapshot: readSnapshot()
      });
      updateUndoButton();

      activeFilter = 'all';
      for (const candidate of filterButtons) {
        candidate.classList.toggle(
          'is-active',
          candidate.getAttribute('data-render-filter') === activeFilter
        );
      }

      for (const card of cards) {
        if (card.dataset.renderState === 'yes' && card.dataset.narrowedOut !== 'true') {
          card.dataset.renderState = 'maybe';
          delete card.dataset.narrowedOut;
        } else {
          card.dataset.narrowedOut = 'true';
        }

        const button = card.querySelector('[data-render-toggle]');
        if (button instanceof HTMLButtonElement) {
          button.setAttribute('aria-pressed', 'false');
        }
      }

      showDefaultSidebarView();
      updateCountsAndVisibility();
    });
  }

  setSidebarOpen(false);
  updateCountsAndVisibility();
})();
