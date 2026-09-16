/* ============================================================
   Fluent RSS Reader 2.0 — клиентская логика
   Все сетевые запросы идут через собственные /api/* функции,
   поэтому нет CORS-прокси, нет «мёртвых» allorigins и нет CSP-дыр.
   ============================================================ */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };

  /* ---------- Хранилище ---------- */
  const LS = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {}
    }
  };

  const state = {
    // feeds: [{url, title, category, icon}]
    feeds: [],
    category: 'all',
    activeUrl: null,
    sort: 'date',
    items: [],
    cache: new Map(), // url -> {payload, ts}
    lang: 'ru'
  };

  const CACHE_TTL = 5 * 60 * 1000;
  const CHIP_COLORS = ['lavender', 'mint', 'apricot', 'rose', 'sky', 'lemon'];

  /** Стабильный пастельный цвет ленты по её домену */
  function chipVars(url) {
    let hash = 0;
    const host = hostOf(url);
    for (let i = 0; i < host.length; i++) hash = (hash * 31 + host.charCodeAt(i)) >>> 0;
    const name = CHIP_COLORS[hash % CHIP_COLORS.length];
    return `--chip: var(--${name}); --chip-soft: var(--${name}-soft);`;
  }

  const hostOf = (url) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url || '';
    }
  };

  /* ---------- Миграция со старой версии ---------- */
  function loadFeeds() {
    const modern = LS.get('frr.feeds', null);
    if (Array.isArray(modern)) return modern;

    const legacy = LS.get('rssFeeds', []);
    if (Array.isArray(legacy) && legacy.length) {
      const names = LS.get('feedNames', {});
      const cats = LS.get('feedCategories', {});
      return legacy.map((url) => ({
        url,
        title: names[url] || hostOf(url),
        category: cats[url] || t('no_category', 'Без категории')
      }));
    }
    return [];
  }

  const saveFeeds = () => LS.set('frr.feeds', state.feeds);

  /* ---------- i18n ---------- */
  const translations = window.translations || {};
  function t(key, fallback) {
    return translations?.[state.lang]?.[key] || translations?.ru?.[key] || fallback || key;
  }

  function applyTranslations() {
    document.documentElement.lang = state.lang;
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', location.origin + pathForLang(state.lang));
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      const value = t(node.dataset.i18n, node.textContent);
      if (value) node.textContent = value;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
      node.placeholder = t(node.dataset.i18nPlaceholder, node.placeholder);
    });
    document.querySelectorAll('[data-i18n-title]').forEach((node) => {
      node.title = t(node.dataset.i18nTitle, node.title);
    });
    $('sortSwitch').children[0].textContent = t('publication_date', 'По дате');
    $('sortSwitch').children[1].textContent = t('sort_by_name', 'По названию');
  }

  const LANG_NAMES = { ru: 'Русский', en: 'English', uk: 'Українська', pl: 'Polski', cs: 'Čeština', bg: 'Български', sr: 'Српски' };

  /** Язык страницы: /en/ → en, корень → ru. Путь важнее всего — он же канонический URL. */
  function langFromPath() {
    const segment = location.pathname.split('/').filter(Boolean)[0];
    return segment && translations[segment] ? segment : null;
  }

  function pathForLang(lang) {
    return lang === 'ru' ? '/' : `/${lang}/`;
  }

  function initLanguage() {
    const fromPath = langFromPath();
    const fromUrl = new URLSearchParams(location.search).get('lang');
    const saved = LS.get('frr.lang', null);
    const system = (navigator.language || 'ru').slice(0, 2);
    state.lang = [fromPath, fromUrl, saved, system].find((l) => l && translations[l]) || 'ru';

    const select = $('languageSelect');
    select.innerHTML = '';
    Object.keys(translations).forEach((code) => {
      const option = new Option(LANG_NAMES[code] || code, code, false, code === state.lang);
      select.append(option);
    });
    select.addEventListener('change', () => {
      const next = select.value;
      LS.set('frr.lang', next);
      // У каждого языка свой канонический адрес — переходим на него,
      // чтобы поисковик индексировал именно локализованную страницу.
      if (langFromPath() !== null || next !== 'ru') {
        location.assign(pathForLang(next));
        return;
      }
      state.lang = next;
      applyTranslations();
      renderRail();
      renderItems();
    });
  }

  /* ---------- Уведомления ---------- */
  function toast(message, type = 'success') {
    const node = el('div', 'toast', `<span>${escapeHtml(message)}</span>`);
    node.dataset.type = type;
    $('toasts').append(node);
    setTimeout(() => {
      node.style.opacity = '0';
      setTimeout(() => node.remove(), 250);
    }, 3200);
  }

  const escapeHtml = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Сетевой слой ---------- */
  async function api(path, options) {
    const res = await fetch(path, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`);
    return data;
  }

  async function fetchFeed(url, { fresh = false } = {}) {
    const cached = state.cache.get(url);
    if (!fresh && cached && Date.now() - cached.ts < CACHE_TTL) return cached.payload;

    const payload = await api(`/api/feed?url=${encodeURIComponent(url)}${fresh ? '&fresh=1' : ''}`);
    state.cache.set(url, { payload, ts: Date.now() });
    LS.set('frr.snapshot:' + url, { payload, ts: Date.now() }); // офлайн-копия
    return payload;
  }

  function offlineSnapshot(url) {
    const snap = LS.get('frr.snapshot:' + url, null);
    return snap?.payload || null;
  }

  /* ---------- Категории ---------- */
  /** Иконка Bootstrap Icons для категории (эмодзи в интерфейсе не используются) */
  const CATEGORY_ICONS = window.CATEGORY_ICONS || {};
  const iconFor = (category) =>
    `<i class="bi ${CATEGORY_ICONS[category] || 'bi-collection'}" aria-hidden="true"></i>`;

  const categoriesOf = () => {
    const set = new Set(state.feeds.map((f) => f.category || t('no_category', 'Без категории')));
    return [...set].sort((a, b) => a.localeCompare(b, state.lang));
  };

  function renderCategorySelect() {
    const select = $('categorySelect');
    const current = select.value;
    select.innerHTML = '';
    const list = categoriesOf();
    if (!list.length) list.push(t('no_category', 'Без категории'));
    list.forEach((c) => select.append(new Option(c, c)));
    select.append(new Option('+ ' + t('create_category', 'Новая категория'), '__new'));
    if (current && [...select.options].some((o) => o.value === current)) select.value = current;

    select.onchange = () => {
      if (select.value !== '__new') return;
      const name = prompt(t('category_name', 'Название категории'));
      select.value = list[0];
      if (!name?.trim()) return;
      select.append(new Option(name.trim(), name.trim()));
      select.value = name.trim();
    };
  }

  function renderChips() {
    const box = $('chips');
    box.innerHTML = '';
    const cats = categoriesOf();
    if (!state.feeds.length) return;

    const make = (label, value, icon) => {
      const chip = el('button', 'chip', (icon || '') + `<span>${escapeHtml(label)}</span>`);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(state.category === value));
      chip.onclick = () => {
        state.category = value;
        renderChips();
        renderRail();
        const visible = visibleFeeds();
        if (visible.length && !visible.some((f) => f.url === state.activeUrl)) openFeed(visible[0].url);
      };
      box.append(chip);
    };

    make(t('all_categories', 'Все ленты'), 'all', '<i class="bi bi-collection" aria-hidden="true"></i>');
    cats.forEach((c) => make(c, c, iconFor(c)));
  }

  const visibleFeeds = () =>
    state.category === 'all'
      ? state.feeds
      : state.feeds.filter((f) => (f.category || t('no_category', 'Без категории')) === state.category);

  /* ---------- Левый список лент ---------- */
  function renderRail() {
    const list = $('feedList');
    list.innerHTML = '';
    const feeds = visibleFeeds();

    $('allCount').textContent = String(feeds.length);
    $('feedStat').textContent = `${state.feeds.length} ${plural(state.feeds.length, ['лента', 'ленты', 'лент'])}`;

    if (!feeds.length) {
      list.append(el('p', 'row__sub', escapeHtml(t('no_feeds_message', 'Лент пока нет'))));
      return;
    }

    feeds.forEach((feed) => {
      const item = el('button', 'feed-item');
      item.type = 'button';
      item.style.cssText = chipVars(feed.url);
      item.setAttribute('aria-current', String(feed.url === state.activeUrl));
      item.innerHTML = `
        <img class="feed-item__icon" alt="" loading="lazy"
             src="https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(hostOf(feed.url))}">
        <span class="feed-item__text">${escapeHtml(feed.title || hostOf(feed.url))}</span>`;

      const more = el('button', 'feed-item__more', '<i class="bi bi-three-dots-vertical" aria-hidden="true"></i>');
      more.type = 'button';
      more.setAttribute('aria-label', t('feed_management_title', 'Управление лентой'));
      more.onclick = (event) => {
        event.stopPropagation();
        openFeedActions(feed);
      };

      item.append(more);
      item.onclick = () => {
        openFeed(feed.url);
        closeRail();
      };
      list.append(item);
    });
  }

  function plural(n, forms) {
    if (state.lang !== 'ru') return n === 1 ? forms[0] : forms[2];
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return forms[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
    return forms[2];
  }

  /* ---------- Дата ---------- */
  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const diff = (Date.now() - date.getTime()) / 1000;
    if (diff < 60) return t('just_now', 'только что');
    if (diff < 3600) return `${Math.floor(diff / 60)} ${t('minutes_ago', 'мин назад')}`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ${t('hours_ago', 'ч назад')}`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} ${t('days_ago', 'дн назад')}`;
    return date.toLocaleDateString(state.lang, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /* ---------- Лента: загрузка и отрисовка ---------- */
  function skeletons(count = 6) {
    const grid = el('div', 'grid');
    for (let i = 0; i < count; i++) grid.append(el('div', 'skeleton skeleton--card'));
    return grid;
  }

  function emptyState({ title, text, actions = [] }) {
    const box = el('div', 'state');
    box.innerHTML = `
      <div class="state__art" aria-hidden="true"><i class="bi bi-rss"></i></div>
      <h2 class="state__title">${escapeHtml(title)}</h2>
      <p class="state__text">${escapeHtml(text)}</p>`;
    if (actions.length) {
      const row = el('div', 'state__actions');
      actions.forEach(({ label, primary, onClick }) => {
        const button = el('button', 'btn' + (primary ? ' btn--primary' : ''), escapeHtml(label));
        button.type = 'button';
        button.onclick = onClick;
        row.append(button);
      });
      box.append(row);
    }
    return box;
  }

  async function openFeed(url, { fresh = false } = {}) {
    state.activeUrl = url;
    LS.set('frr.active', url);
    renderRail();

    const content = $('content');
    content.innerHTML = '';
    content.append(skeletons());

    const feed = state.feeds.find((f) => f.url === url);
    $('feedTitle').textContent = feed?.title || hostOf(url);
    $('feedMeta').textContent = t('loading_feed', 'Загружаем ленту…');

    try {
      const data = await fetchFeed(url, { fresh });
      applyFeedPayload(url, data);
    } catch (error) {
      const snapshot = offlineSnapshot(url);
      if (snapshot) {
        applyFeedPayload(url, snapshot);
        toast(t('network_error', 'Нет сети — показана сохранённая копия'), 'info');
        return;
      }
      content.innerHTML = '';
      content.append(
        emptyState({
          title: t('feed_load_error', 'Не удалось загрузить ленту'),
          text: String(error.message || error),
          actions: [
            { label: t('retry', 'Повторить'), primary: true, onClick: () => openFeed(url, { fresh: true }) },
            { label: t('remove_feed', 'Удалить ленту'), onClick: () => removeFeed(url) }
          ]
        })
      );
      $('feedMeta').textContent = t('error', 'Ошибка');
    }
  }

  function applyFeedPayload(url, data) {
    const feed = state.feeds.find((f) => f.url === url);
    if (feed && data.feed?.title && feed.title === hostOf(url)) {
      feed.title = data.feed.title;
      saveFeeds();
      renderRail();
    }
    state.items = data.items.map((i) => ({ ...i, source: data.feed.title, sourceUrl: url }));
    $('feedTitle').textContent = feed?.title || data.feed.title;
    $('feedMeta').textContent =
      `${data.items.length} ${plural(data.items.length, ['материал', 'материала', 'материалов'])} · ` +
      `${t('last_update', 'обновлено')} ${formatDate(data.fetchedAt)}`;
    renderItems();
  }

  function renderItems() {
    const content = $('content');
    content.innerHTML = '';

    if (!state.feeds.length) {
      content.append(
        emptyState({
          title: t('no_feeds_message', 'Здесь пока пусто'),
          text: t('rss_help', 'Вставьте ссылку на сайт — приложение само найдёт RSS-ленту.'),
          actions: [
            { label: t('recommendations', 'Открыть подборки'), primary: true, onClick: openRecommendations },
            { label: t('import_feeds', 'Импорт OPML'), onClick: openFiles }
          ]
        })
      );
      return;
    }

    if (!state.items.length) {
      content.append(emptyState({ title: t('no_articles', 'Нет материалов'), text: hostOf(state.activeUrl) }));
      return;
    }

    const items = [...state.items].sort((a, b) =>
      state.sort === 'title'
        ? a.title.localeCompare(b.title, state.lang)
        : new Date(b.pubDate || 0) - new Date(a.pubDate || 0)
    );

    const grid = el('div', 'grid');
    items.forEach((item, index) => grid.append(card(item, index)));
    content.append(grid);
  }

  function card(item, index) {
    const node = el('article', 'card');
    node.style.cssText = chipVars(item.sourceUrl);
    node.tabIndex = 0;
    node.setAttribute('role', 'button');

    const media = item.image
      ? `<div class="card__media"><img src="${escapeHtml(item.image)}" alt="" loading="lazy"></div>`
      : '';

    node.innerHTML = `${media}
      <div class="card__body">
        <h3 class="card__title">${escapeHtml(item.title)}</h3>
        ${item.excerpt ? `<p class="card__excerpt">${escapeHtml(item.excerpt)}</p>` : ''}
        <div class="card__foot">
          <span class="card__source">${escapeHtml(item.source || hostOf(item.sourceUrl))}</span>
          <span class="card__dot"></span>
          <span>${escapeHtml(formatDate(item.pubDate))}</span>
        </div>
      </div>`;

    // CSP запрещает inline-обработчики: битые картинки убираем через JS
    node.querySelectorAll('.card__media img').forEach((img) => {
      img.addEventListener('error', () => img.parentElement?.remove());
    });

    const open = () => openArticle(index);
    node.onclick = open;
    node.onkeydown = (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    };
    return node;
  }

  /* ---------- Универсальный шит ---------- */
  let lastFocused = null;

  function openSheet({ title, body, tools = [], footer = [], narrow = false }) {
    lastFocused = document.activeElement;
    $('sheetTitle').textContent = title || '';
    const bodyBox = $('sheetBody');
    bodyBox.innerHTML = '';
    bodyBox.scrollTop = 0;
    bodyBox.append(body);

    const toolBox = $('sheetTools');
    toolBox.innerHTML = '';
    tools.forEach((node) => toolBox.append(node));

    const footBox = $('sheetFoot');
    footBox.innerHTML = '';
    footBox.hidden = !footer.length;
    footer.forEach((node) => footBox.append(node));

    $('sheet').classList.toggle('sheet--narrow', narrow);
    $('overlay').dataset.open = 'true';
    document.body.style.overflow = 'hidden';
    $('sheetClose').focus();
  }

  function closeSheet() {
    $('overlay').dataset.open = 'false';
    document.body.style.overflow = '';
    $('sheetBody').innerHTML = '';
    lastFocused?.focus?.();
  }

  function button(label, { primary, danger, onClick, icon } = {}) {
    const node = el('button', 'btn' + (primary ? ' btn--primary' : danger ? ' btn--danger' : ''));
    node.type = 'button';
    node.innerHTML = (icon || '') + `<span>${escapeHtml(label)}</span>`;
    node.onclick = onClick;
    return node;
  }

  /* ---------- Статья ---------- */
  function openArticle(index) {
    const items = [...state.items].sort((a, b) =>
      state.sort === 'title'
        ? a.title.localeCompare(b.title, state.lang)
        : new Date(b.pubDate || 0) - new Date(a.pubDate || 0)
    );
    const item = items[index];
    if (!item) return;

    const body = el('div', 'article');
    body.innerHTML = `
      <h1 class="article__title">${escapeHtml(item.title)}</h1>
      <div class="article__meta">
        <span class="card__source">${escapeHtml(item.source || '')}</span>
        ${item.author ? `<span>${escapeHtml(item.author)}</span>` : ''}
        <span>${escapeHtml(formatDate(item.pubDate))}</span>
      </div>
      ${item.image ? `<div class="article__hero"><img src="${escapeHtml(item.image)}" alt=""></div>` : ''}
      <div class="article__content">${item.content || `<p>${escapeHtml(item.excerpt || '')}</p>`}</div>`;

    body.querySelectorAll('.article__hero img').forEach((img) => {
      img.addEventListener('error', () => img.parentElement?.remove());
    });

    const openSource = el('a', 'btn btn--primary', `<span>${escapeHtml(t('go_to_source', 'Открыть источник'))}</span>`);
    openSource.href = item.link;
    openSource.target = '_blank';
    openSource.rel = 'noopener noreferrer';

    openSheet({
      title: item.source || '',
      body,
      footer: [
        button(t('share', 'Поделиться'), { onClick: () => shareItem(item) }),
        button(t('copy_link', 'Скопировать ссылку'), { onClick: () => copy(item.link) }),
        openSource
      ]
    });
  }

  async function shareItem(item) {
    const payload = { title: item.title, text: item.excerpt?.slice(0, 120), url: item.link };
    if (navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch {}
    }
    copy(item.link);
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast(t('copy_link', 'Ссылка скопирована'));
    } catch {
      const area = el('textarea');
      area.value = text;
      document.body.append(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      toast(t('copy_link', 'Ссылка скопирована'));
    }
  }

  /* ---------- Добавление ленты (с автопоиском) ---------- */
  async function addFeedFlow(rawUrl, category) {
    const input = (rawUrl || '').trim();
    if (!input) return;

    const addButton = $('btnAdd');
    addButton.disabled = true;
    addButton.textContent = t('loading', 'Ищем…');

    try {
      const found = await api(`/api/discover?url=${encodeURIComponent(input)}`);
      const list = found.feeds || [];
      if (!list.length) throw new Error(t('feed_not_found', 'RSS-лента не найдена'));

      if (list.length === 1) {
        await addFeed(list[0].url, list[0].title, category);
      } else {
        chooseFeedSheet(list, category);
      }
    } catch (error) {
      toast(String(error.message || error), 'error');
    } finally {
      addButton.disabled = false;
      addButton.textContent = t('add_feed_btn', 'Добавить');
    }
  }

  function chooseFeedSheet(list, category) {
    const box = el('div', 'list');
    list.forEach((feed) => {
      const row = el('div', 'row');
      row.style.cssText = chipVars(feed.url);
      row.innerHTML = `<div class="row__text">
          <div class="row__title">${escapeHtml(feed.title)}</div>
          <div class="row__sub">${escapeHtml(feed.url)}</div>
        </div>`;
      const actions = el('div', 'row__actions');
      actions.append(
        button(t('add_feed', 'Добавить'), {
          primary: true,
          onClick: async () => {
            await addFeed(feed.url, feed.title, category);
            closeSheet();
          }
        })
      );
      row.append(actions);
      box.append(row);
    });
    openSheet({ title: t('recommended_rss_feeds', 'Найденные ленты'), body: box, narrow: true });
  }

  async function addFeed(url, title, category) {
    if (state.feeds.some((f) => f.url === url)) {
      toast(t('error_feed_exists', 'Лента уже добавлена'), 'info');
      return;
    }
    state.feeds.push({
      url,
      title: title || hostOf(url),
      category: category || $('categorySelect').value || t('no_category', 'Без категории')
    });
    saveFeeds();
    renderCategorySelect();
    renderChips();
    renderRail();
    $('rssUrl').value = '';
    toast(t('feed_added', 'Лента добавлена'));
    await openFeed(url, { fresh: true });
  }

  function removeFeed(url) {
    state.feeds = state.feeds.filter((f) => f.url !== url);
    state.cache.delete(url);
    localStorage.removeItem('frr.snapshot:' + url);
    saveFeeds();
    renderCategorySelect();
    renderChips();
    renderRail();
    toast(t('feed_removed', 'Лента удалена'));
    if (state.activeUrl === url) {
      const next = visibleFeeds()[0];
      if (next) openFeed(next.url);
      else {
        state.activeUrl = null;
        state.items = [];
        $('feedTitle').textContent = 'Fluent RSS Reader';
        $('feedMeta').textContent = t('no_feeds_message', 'Добавьте первую ленту');
        renderItems();
      }
    }
  }

  function openFeedActions(feed) {
    const body = el('div');

    const nameField = el('label', 'field',
      `<span class="field__label">${escapeHtml(t('edit_feed', 'Название ленты'))}</span>`);
    const nameInput = el('input');
    nameInput.value = feed.title;
    nameField.append(nameInput);

    const catField = el('label', 'field',
      `<span class="field__label">${escapeHtml(t('category_label', 'Категория'))}</span>`);
    const catSelect = el('select');
    const cats = new Set([...categoriesOf(), t('no_category', 'Без категории')]);
    cats.forEach((c) => catSelect.append(new Option(c, c)));
    catSelect.value = feed.category;
    catField.append(catSelect);

    const link = el('p', 'row__sub', escapeHtml(feed.url));

    body.append(nameField, catField, link);

    openSheet({
      title: t('feed_management_title', 'Настройки ленты'),
      body,
      narrow: true,
      footer: [
        button(t('delete', 'Удалить'), {
          danger: true,
          onClick: () => {
            removeFeed(feed.url);
            closeSheet();
          }
        }),
        button(t('save', 'Сохранить'), {
          primary: true,
          onClick: () => {
            feed.title = nameInput.value.trim() || feed.title;
            feed.category = catSelect.value;
            saveFeeds();
            renderCategorySelect();
            renderChips();
            renderRail();
            if (state.activeUrl === feed.url) $('feedTitle').textContent = feed.title;
            closeSheet();
            toast(t('settings_saved', 'Сохранено'));
          }
        })
      ]
    });
  }

  /* ---------- Библиотека лент ---------- */
  function openLibrary() {
    const body = el('div');
    if (!state.feeds.length) {
      body.append(el('p', 'row__sub', escapeHtml(t('no_feeds_message', 'Лент пока нет'))));
    }

    const grouped = new Map();
    state.feeds.forEach((feed) => {
      const key = feed.category || t('no_category', 'Без категории');
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(feed);
    });

    grouped.forEach((feeds, category) => {
      const group = el('div', 'cat-group');
      group.append(el('div', 'cat-group__title',
        iconFor(category) + `<span>${escapeHtml(category)}</span><span class="cat-group__count">${feeds.length}</span>`));
      const list = el('div', 'list');
      feeds.forEach((feed) => {
        const row = el('div', 'row');
        row.style.cssText = chipVars(feed.url);
        row.innerHTML = `<div class="row__text">
            <div class="row__title">${escapeHtml(feed.title)}</div>
            <div class="row__sub">${escapeHtml(hostOf(feed.url))}</div>
          </div>`;
        const actions = el('div', 'row__actions');
        actions.append(
          button(t('edit', 'Изменить'), { onClick: () => openFeedActions(feed) }),
          button(t('delete', 'Удалить'), {
            danger: true,
            onClick: () => {
              removeFeed(feed.url);
              openLibrary();
            }
          })
        );
        row.append(actions);
        list.append(row);
      });
      group.append(list);
      body.append(group);
    });

    openSheet({
      title: t('feed_management_title', 'Мои ленты'),
      body,
      footer: [
        button(t('export_feeds', 'Экспорт OPML'), { onClick: exportOpml }),
        button(t('import_feeds', 'Импорт'), { primary: true, onClick: openFiles })
      ]
    });
  }

  /* ---------- Подборки ---------- */
  function openRecommendations() {
    const catalog = window.RECOMMENDED_FEEDS || {};
    const body = el('div');

    const search = el('input');
    search.placeholder = t('search_placeholder', 'Поиск по подборкам…');
    const searchField = el('label', 'field');
    searchField.append(search);
    body.append(searchField);

    const results = el('div');
    body.append(results);

    const render = (query = '') => {
      results.innerHTML = '';
      const q = query.trim().toLowerCase();
      let total = 0;

      Object.entries(catalog).forEach(([category, feeds]) => {
        const matched = feeds.filter(
          (f) => !q || f.name.toLowerCase().includes(q) || (f.description || '').toLowerCase().includes(q) || f.domain?.includes(q)
        );
        if (!matched.length) return;
        total += matched.length;

        const group = el('div', 'cat-group');
        group.append(el('div', 'cat-group__title', iconFor(category) + `<span>${escapeHtml(category)}</span>`));
        const list = el('div', 'list');

        matched.forEach((feed) => {
          const added = state.feeds.some((f) => f.url === feed.url);
          const row = el('div', 'row');
          row.style.cssText = chipVars(feed.url);
          row.innerHTML = `<div class="row__text">
              <div class="row__title">${escapeHtml(feed.name)}</div>
              <div class="row__sub">${feed.country ? `<i class="bi bi-geo-alt" aria-hidden="true"></i> ${escapeHtml(feed.country)} · ` : ''}${escapeHtml(feed.description || '')}</div>
            </div>`;
          const actions = el('div', 'row__actions');
          const add = button(added ? t('added', 'Добавлено') : t('add_feed', 'Добавить'), {
            primary: !added,
            onClick: async () => {
              await addFeed(feed.url, feed.name, category);
              render(search.value);
            }
          });
          add.disabled = added;
          actions.append(add);
          row.append(actions);
          list.append(row);
        });

        group.append(list);
        results.append(group);
      });

      if (!total) results.append(el('p', 'row__sub', escapeHtml(t('no_search_results', 'Ничего не найдено'))));
    };

    let timer;
    search.oninput = () => {
      clearTimeout(timer);
      timer = setTimeout(() => render(search.value), 180);
    };
    render();

    openSheet({ title: t('recommended_rss_feeds', 'Рекомендуемые ленты'), body });
  }

  /* ---------- Файлы: OPML / JSON ---------- */
  function openFiles() {
    const body = el('div');

    const zone = el('div', 'dropzone',
      `<strong>${escapeHtml(t('import_feeds', 'Импорт лент'))}</strong><br>OPML · XML · JSON`);
    zone.tabIndex = 0;
    zone.onclick = () => $('fileInput').click();
    zone.onkeydown = (e) => { if (e.key === 'Enter') $('fileInput').click(); };
    zone.ondragover = (e) => { e.preventDefault(); zone.dataset.drag = 'true'; };
    zone.ondragleave = () => { zone.dataset.drag = 'false'; };
    zone.ondrop = (e) => {
      e.preventDefault();
      zone.dataset.drag = 'false';
      const file = e.dataTransfer?.files?.[0];
      if (file) importFile(file);
    };

    const info = el('p', 'row__sub',
      escapeHtml(t('footer_categories', 'Категории из OPML сохраняются автоматически. Дубликаты пропускаются.')));

    body.append(zone, el('div', null, '<br>'), info);

    openSheet({
      title: 'OPML / JSON',
      body,
      narrow: true,
      footer: [
        button(t('export', 'Экспорт JSON'), { onClick: exportJson }),
        button(t('export_feeds', 'Экспорт OPML'), { primary: true, onClick: exportOpml })
      ]
    });
  }

  async function importFile(file) {
    const text = await file.text();
    try {
      let imported = [];

      if (/^\s*[[{]/.test(text)) {
        // JSON-бэкап (в том числе из версии 1.x)
        const data = JSON.parse(text);
        const raw = Array.isArray(data) ? data : data.feeds || [];
        imported = raw.map((entry) =>
          typeof entry === 'string'
            ? { url: entry, title: hostOf(entry), category: t('no_category', 'Без категории') }
            : {
                url: entry.url,
                title: entry.title || entry.name || hostOf(entry.url),
                category: entry.category || t('no_category', 'Без категории')
              }
        );
      } else {
        const result = await api('/api/opml', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ xml: text })
        });
        imported = result.feeds;
      }

      const existing = new Set(state.feeds.map((f) => f.url));
      const fresh = imported.filter((f) => f?.url && !existing.has(f.url));
      state.feeds.push(...fresh);
      saveFeeds();
      renderCategorySelect();
      renderChips();
      renderRail();
      closeSheet();
      toast(`${t('feed_added', 'Импортировано')}: ${fresh.length} / ${imported.length}`);
      if (fresh.length && !state.activeUrl) openFeed(fresh[0].url);
    } catch (error) {
      toast(t('invalid_feed', 'Не удалось прочитать файл') + ': ' + error.message, 'error');
    }
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = el('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function exportOpml() {
    if (!state.feeds.length) return toast(t('no_feeds_message', 'Нет лент для экспорта'), 'info');
    try {
      const res = await fetch('/api/opml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'export', feeds: state.feeds, title: 'Fluent RSS Reader' })
      });
      if (!res.ok) throw new Error('export failed');
      download(await res.blob(), `fluent-rss-${new Date().toISOString().slice(0, 10)}.opml`);
      toast(t('export', 'Файл OPML сохранён'));
    } catch (error) {
      toast(String(error.message), 'error');
    }
  }

  function exportJson() {
    const payload = { version: 2, exportedAt: new Date().toISOString(), feeds: state.feeds };
    download(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
      `fluent-rss-${new Date().toISOString().slice(0, 10)}.json`);
    toast(t('export', 'Файл JSON сохранён'));
  }

  /* ---------- Обновление ---------- */
  async function refreshCurrent() {
    if (!state.activeUrl) return toast(t('no_feeds_message', 'Нет активной ленты'), 'info');
    await openFeed(state.activeUrl, { fresh: true });
    toast(t('refresh', 'Лента обновлена'));
  }

  /* ---------- Тема ---------- */
  function initTheme() {
    const saved = LS.get('frr.theme', null);
    const system = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.dataset.theme = saved || system;
  }

  function syncThemeIcon() {
    const dark = document.documentElement.dataset.theme === 'dark';
    $('themeIcon').className = `icon bi ${dark ? 'bi-sun' : 'bi-moon-stars'}`;
  }

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    LS.set('frr.theme', next);
    syncThemeIcon();
  }

  /* ---------- Прогресс чтения ---------- */
  function initProgress() {
    const bar = $('progress');
    const update = (scroller) => {
      const max = scroller.scrollHeight - scroller.clientHeight;
      const top = scroller === document.documentElement ? window.scrollY : scroller.scrollTop;
      bar.style.width = max > 0 ? `${Math.min(100, (top / max) * 100)}%` : '0';
    };
    addEventListener('scroll', () => update(document.documentElement), { passive: true });
    $('sheetBody').addEventListener('scroll', (e) => update(e.target), { passive: true });
  }

  /* ---------- Мобильное меню ---------- */
  const openRail = () => ($('rail').dataset.open = 'true');
  const closeRail = () => ($('rail').dataset.open = 'false');

  /* ---------- Инициализация ---------- */
  function bind() {
    $('composer').addEventListener('submit', (event) => {
      event.preventDefault();
      addFeedFlow($('rssUrl').value, $('categorySelect').value);
    });

    $('btnRefresh').onclick = refreshCurrent;
    $('mobRefresh').onclick = refreshCurrent;
    $('btnTheme').onclick = toggleTheme;
    $('btnRecommend').onclick = openRecommendations;
    $('mobRecommend').onclick = openRecommendations;
    $('btnLibrary').onclick = openLibrary;
    $('btnFiles').onclick = openFiles;
    $('openRail').onclick = openRail;
    $('mobFeeds').onclick = openRail;
    $('closeRail').onclick = closeRail;
    $('mobTop').onclick = () => scrollTo({ top: 0, behavior: 'smooth' });

    $('sheetClose').onclick = closeSheet;
    $('overlay').addEventListener('click', (event) => {
      if (event.target === $('overlay')) closeSheet();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if ($('overlay').dataset.open === 'true') closeSheet();
        else closeRail();
      }
      if (event.key === '/' && document.activeElement !== $('rssUrl')) {
        event.preventDefault();
        $('rssUrl').focus();
      }
      if (event.key.toLowerCase() === 'r' && (event.metaKey || event.ctrlKey) === false && document.activeElement === document.body) {
        refreshCurrent();
      }
    });

    $('fileInput').addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (file) importFile(file);
      event.target.value = '';
    });

    $('sortSwitch').addEventListener('click', (event) => {
      const button = event.target.closest('button[data-sort]');
      if (!button) return;
      state.sort = button.dataset.sort;
      [...$('sortSwitch').children].forEach((b) =>
        b.setAttribute('aria-pressed', String(b.dataset.sort === state.sort))
      );
      renderItems();
    });

    addEventListener('online', () => toast(t('now', 'Соединение восстановлено'), 'info'));
  }

  async function start() {
    initTheme();
    initLanguage();
    applyTranslations();

    state.feeds = loadFeeds();
    saveFeeds();

    renderCategorySelect();
    renderChips();
    renderRail();
    syncThemeIcon();
    bind();
    initProgress();

    // Лента из ссылки-приглашения: ?feed=<url>
    const shared = new URLSearchParams(location.search).get('feed');
    if (shared) {
      await addFeedFlow(shared);
      history.replaceState({}, '', location.pathname);
    }

    const saved = LS.get('frr.active', null);
    const first = state.feeds.find((f) => f.url === saved) || state.feeds[0];
    if (first) openFeed(first.url);
    else renderItems();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }

  document.addEventListener('DOMContentLoaded', start);
})();
