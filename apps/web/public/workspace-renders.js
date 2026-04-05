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
  const history = [];
  let activeFilter = 'all';

  function getCards() {
    return Array.from(browser.querySelectorAll('[data-render-card]'));
  }

  function normalizeVoteForState(state) {
    if (state === 'yes') {
      return 'up';
    }

    if (state === 'no') {
      return 'down';
    }

    return 'neutral';
  }

  function nextState(state) {
    if (state === 'maybe') {
      return 'yes';
    }

    if (state === 'yes') {
      return 'no';
    }

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
      const renderId = card.dataset.renderId || '';
      const previous = snapshotById.get(renderId);
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
    const counts = {
      all: cards.length,
      yes: 0,
      maybe: 0,
      no: 0
    };

    for (const card of cards) {
      const state = card.dataset.renderState || 'maybe';
      const narrowedOut = card.dataset.narrowedOut === 'true';
      if (state === 'yes' || state === 'maybe' || state === 'no') {
        if (!narrowedOut) {
          counts[state] += 1;
        }
      }

      const shouldShow = !narrowedOut && (activeFilter === 'all' || state === activeFilter);
      card.hidden = !shouldShow;
    }

    counts.all = counts.yes + counts.maybe + counts.no;

    for (const element of countElements) {
      const key = element.getAttribute('data-render-count');
      if (!key || !(key in counts)) {
        continue;
      }

      element.textContent = String(counts[key]);
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

  if (undoButton instanceof HTMLButtonElement) {
    undoButton.addEventListener('click', async () => {
      const previous = history.pop();
      updateUndoButton();
      if (!previous) {
        return;
      }

      undoButton.disabled = true;
      try {
        if (previous.type === 'snapshot') {
          applySnapshot(previous.snapshot);
          updateCountsAndVisibility();
        }
      } catch (error) {
        history.push(previous);
        updateUndoButton();
        window.alert(error instanceof Error ? error.message : 'Failed to undo render vote.');
      } finally {
        undoButton.disabled = false;
      }
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

      updateCountsAndVisibility();
    });
  }

  updateCountsAndVisibility();
})();
