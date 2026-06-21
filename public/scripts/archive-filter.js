(() => {
  const scopes = Array.from(document.querySelectorAll('[data-filter-scope]'));

  scopes.forEach((scope) => {
    const input = scope.querySelector('[data-filter-input]');
    const options = Array.from(scope.querySelectorAll('[data-filter-option]'));
    const reset = scope.querySelector('[data-filter-reset]');
    const count = scope.querySelector('[data-filter-count]');
    const empty = scope.querySelector('[data-filter-empty]');
    const items = Array.from(scope.querySelectorAll('[data-filter-item]'));
    const filterParam = scope.dataset.filterParam || 'filter';
    const queryParam = scope.dataset.queryParam || 'q';
    const params = new URLSearchParams(window.location.search);
    let activeValue = 'all';
    const initialValue = normalize(params.get(filterParam) || '');
    const initialQuery = params.get(queryParam) || '';

    if (input && initialQuery) {
      input.value = initialQuery;
    }

    if (initialValue && options.some((option) => normalize(option.dataset.filterOption) === initialValue)) {
      activeValue = initialValue;
    }

    syncButtons();

    const apply = () => {
      const query = normalize(input?.value ?? '');
      let visible = 0;

      items.forEach((item) => {
        const text = normalize(item.dataset.filterText ?? item.textContent ?? '');
        const values = splitValues(item.dataset.filterValues);
        const matchesQuery = !query || text.includes(query);
        const matchesValue = activeValue === 'all' || values.includes(activeValue);
        const shouldShow = matchesQuery && matchesValue;

        item.hidden = !shouldShow;
        if (shouldShow) visible += 1;
      });

      if (count) {
        count.textContent = `${visible} / ${items.length}`;
      }

      if (empty) {
        empty.hidden = visible !== 0;
      }
    };

    input?.addEventListener('input', () => {
      updateUrl();
      apply();
    });

    options.forEach((option) => {
      option.addEventListener('click', () => {
        activeValue = option.dataset.filterOption || 'all';
        syncButtons();
        updateUrl();
        apply();
      });
    });

    reset?.addEventListener('click', () => {
      if (input) input.value = '';
      activeValue = 'all';
      syncButtons();
      updateUrl();
      apply();
      input?.focus();
    });

    apply();

    function syncButtons() {
      options.forEach((button) => {
        const selected = normalize(button.dataset.filterOption || 'all') === activeValue;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
    }

    function updateUrl() {
      const nextParams = new URLSearchParams(window.location.search);
      const query = input?.value.trim() || '';

      if (activeValue === 'all') {
        nextParams.delete(filterParam);
      } else {
        nextParams.set(filterParam, activeValue);
      }

      if (query) {
        nextParams.set(queryParam, query);
      } else {
        nextParams.delete(queryParam);
      }

      const nextQuery = nextParams.toString();
      const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
      window.history.replaceState(null, '', nextUrl);
    }
  });

  function normalize(value) {
    return String(value).trim().toLowerCase();
  }

  function splitValues(value) {
    return String(value || '')
      .split('|')
      .map((entry) => normalize(entry))
      .filter(Boolean);
  }
})();
