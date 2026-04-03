(function () {
  const form = document.querySelector('[data-workspace-form]');
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const workspaceId = form.dataset.workspaceId;
  if (!workspaceId) {
    return;
  }

  const storageKey = `workspace-selected-items:${workspaceId}`;

  function getSelectedItemIdsFromForm() {
    return Array.from(form.querySelectorAll('input[data-selected-item-checkbox]:checked'))
      .map((input) => input.value)
      .filter((value) => value.length > 0);
  }

  function writeLocalSelection(selectedItemIds) {
    window.localStorage.setItem(storageKey, JSON.stringify(selectedItemIds));
  }

  function readLocalSelection() {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string' && value.length > 0) : [];
    } catch {
      return [];
    }
  }

  function applySelection(selectedItemIds) {
    const selectedSet = new Set(selectedItemIds);
    for (const checkbox of form.querySelectorAll('input[data-selected-item-checkbox]')) {
      checkbox.checked = selectedSet.has(checkbox.value);
    }
  }

  const localSelection = readLocalSelection();
  if (localSelection.length > 0) {
    applySelection(localSelection);
  } else {
    writeLocalSelection(getSelectedItemIdsFromForm());
  }

  async function persistSelectedItems() {
    const selectedItemIds = getSelectedItemIdsFromForm();
    writeLocalSelection(selectedItemIds);

    const response = await fetch(`/workspaces/${encodeURIComponent(workspaceId)}/selected-items`, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        selectedItemIds
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error?.message || `Request failed (${response.status})`);
    }
  }

  form.addEventListener('change', async (event) => {
    const target = event.target;
    if (
      !(target instanceof HTMLInputElement) ||
      target.type !== 'checkbox' ||
      !target.hasAttribute('data-selected-item-checkbox')
    ) {
      return;
    }

    const previousChecked = !target.checked;
    try {
      await persistSelectedItems();
    } catch (error) {
      target.checked = previousChecked;
      writeLocalSelection(getSelectedItemIdsFromForm());
      window.alert(error instanceof Error ? error.message : 'Failed to save selected items.');
    }
  });
})();
