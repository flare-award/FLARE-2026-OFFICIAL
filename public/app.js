(() => {
  'use strict';

  const data = window.FLARE_DATA;
  const config = window.FLARE_CONFIG || {};
  const supabaseUrl = String(config.supabaseUrl || '').replace(/\/+$/, '');
  const anonKey = String(config.supabaseAnonKey || '').trim();
  const backendReady = Boolean(supabaseUrl && anonKey && !/YOUR_PROJECT|PASTE_/i.test(supabaseUrl + anonKey));
  const totalNominations = data.nominations.length;
  const deadline = new Date(data.ballotDeadline);
  const storageKey = 'flare2026.session';

  const state = {
    user: null,
    votes: Object.create(null),
    selected: Object.create(null),
    completedAt: null,
    activeCategory: 'main',
    activeNominationId: null,
    pendingVote: null,
    busy: false,
    archive: { index: 0, locked: false, timer: null, track: null, viewport: null }
  };

  const el = (id) => document.getElementById(id);
  const nominationDialog = el('nominationDialog');
  const ballotDialog = el('ballotDialog');
  const authDialog = el('authDialog');
  const adminDialog = el('adminDialog');
  const toastRegion = el('toastRegion');

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function normalize(value) {
    return String(value || '').trim().toLocaleLowerCase('ru-RU');
  }

  function iconCloseButton(dialogId) {
    return `<button class="dialog-close" type="button" data-close-dialog="${escapeHtml(dialogId)}" aria-label="Закрыть окно">×</button>`;
  }

  function topbar(meta, dialogId) {
    return `<div class="dialog-topbar"><span class="dialog-brand"><span class="dialog-brand-mark">F</span> FLARE · 2026</span><span class="dialog-heading-meta">${escapeHtml(meta)}</span>${iconCloseButton(dialogId)}</div>`;
  }

  function setBodyDialogState() {
    document.body.classList.toggle('dialog-open', Boolean(document.querySelector('dialog[open]')));
  }

  document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.addEventListener('close', setBodyDialogState);
    dialog.addEventListener('cancel', () => {
      if (dialog.id === 'authDialog') state.pendingVote = null;
      window.setTimeout(setBodyDialogState, 0);
    });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) {
        if (dialog.id === 'authDialog') state.pendingVote = null;
        dialog.close();
      }
    });
  });

  function openDialog(dialog) {
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    setBodyDialogState();
  }

  function closeDialog(dialog) {
    if (!dialog || !dialog.open) return;
    dialog.close();
  }

  function toast(message, kind = 'success', timeout = 3600) {
    const item = document.createElement('div');
    item.className = `toast${kind === 'error' ? ' is-error' : ''}`;
    item.textContent = message;
    toastRegion.appendChild(item);
    window.setTimeout(() => {
      item.style.transition = 'opacity .22s ease, transform .22s ease';
      item.style.opacity = '0';
      item.style.transform = 'translateY(6px)';
      window.setTimeout(() => item.remove(), 250);
    }, timeout);
  }

  function friendlyError(message) {
    const source = String(message || 'Не удалось выполнить запрос. Попробуй ещё раз.');
    if (/email уже зарегистрирован|email уже существует/i.test(source)) return 'Этот email уже зарегистрирован. Войди в аккаунт или попроси организатора связать адрес с нужным профилем.';
    if (/аккаунт с таким email не найден/i.test(source)) return 'Аккаунт с таким email не найден. Проверь адрес или создай аккаунт.';
    if (/неверный email или pin/i.test(source)) return 'Не удалось войти: проверь email и PIN-код.';
    if (/слишком много попыток/i.test(source)) return 'Слишком много неудачных попыток. Подожди 15 минут и попробуй снова.';
    if (/ник уже используется|уже привязан к другому аккаунту/i.test(source)) return 'Этот ник уже привязан к другому аккаунту. Если это твой профиль, попроси организатора добавить email как дополнительный.';
    if (/сессия истекла/i.test(source)) return 'Сессия истекла. Войди ещё раз.';
    if (/голосование закрыто|дедлайн/i.test(source)) return 'Голосование уже закрыто. Изменить выбор больше нельзя.';
    if (/нельзя голосовать за себя/i.test(source)) return 'В этой номинации нельзя голосовать за себя. Выбери другого номинанта.';
    if (/выбери номинанта|номинация или номинант не найдены/i.test(source)) return 'Не удалось проверить этот выбор. Обнови страницу и попробуй снова.';
    if (/заполни все номинации|не все номинации/i.test(source)) return 'Для подтверждения нужно заполнить все номинации.';
    if (/организатор|доступ запрещён/i.test(source)) return 'Доступ к панели организатора закрыт.';
    if (/Failed to fetch|NetworkError|fetch/i.test(source)) return 'Не удалось связаться с Supabase. Проверь настройки проекта и подключение к интернету.';
    return source.length > 210 ? `${source.slice(0, 207)}…` : source;
  }

  async function rpc(functionName, parameters = {}) {
    if (!backendReady) throw new Error('Онлайн-голосование ещё не подключено.');
    const headers = {
      apikey: anonKey,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    };
    // Legacy anon keys are JWTs and can also be used as the bearer token.
    // New sb_publishable keys belong in apikey only; they are not JWTs.
    if (!anonKey.startsWith('sb_publishable_')) headers.Authorization = `Bearer ${anonKey}`;
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${encodeURIComponent(functionName)}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(parameters)
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = payload?.message || payload?.error_description || payload?.details || payload?.hint || 'Ошибка Supabase.';
      throw new Error(detail);
    }
    if (payload && typeof payload === 'object' && !Array.isArray(payload) && payload.error) {
      throw new Error(payload.error);
    }
    return payload;
  }

  function readStoredSession() {
    try {
      const session = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (session && typeof session.token === 'string' && typeof session.nickname === 'string') return session;
    } catch (_) { /* damaged storage is ignored */ }
    return null;
  }

  function storeSession(session) {
    state.user = {
      token: String(session.sessionToken || session.token || ''),
      nickname: String(session.nickname || ''),
      isAdmin: session.isAdmin === true,
      expiresAt: session.expiresAt || null
    };
    try { localStorage.setItem(storageKey, JSON.stringify(state.user)); } catch (_) { /* storage may be disabled */ }
    updateChrome();
  }

  function clearSession() {
    state.user = null;
    state.votes = Object.create(null);
    state.selected = Object.create(null);
    state.completedAt = null;
    try { localStorage.removeItem(storageKey); } catch (_) { /* ignore */ }
    updateChrome();
  }

  function nominationById(id) {
    return data.nominations.find((nomination) => nomination.id === id) || null;
  }

  function nomineeById(nomination, nomineeId) {
    return nomination?.nominees.find((nominee) => nominee.id === nomineeId) || null;
  }

  function displayNominationKind(kind) {
    return ({ participant: 'Участники', image: 'Изображения', video: 'Видео', mixed: 'Смешанный формат' })[kind] || 'Номинация';
  }

  function nomineeTypeLabel(nomination) {
    if (nomination.kind === 'participant') return 'Номинанты — участники';
    if (nomination.kind === 'video') return 'Видео-номинанты';
    if (nomination.kind === 'mixed') return 'Участники и коллективный вариант';
    return 'Изображения и групповые истории';
  }

  function categoryTitle(category) {
    return category === 'extra' ? 'Дополнительные номинации' : 'Основные номинации';
  }

  function categoryDescription(category) {
    return category === 'extra'
      ? 'Особые награды за индивидуальность, атмосферу и истории сообщества.'
      : 'Люди, игры и события, которыми запомнился год.';
  }

  function countByCategory(category) {
    return data.nominations.filter((nomination) => nomination.category === category).length;
  }

  function isClosed() {
    return Date.now() >= deadline.getTime();
  }

  function isSelfBlocked(nomination, nominee) {
    return Boolean(state.user && !nomination.selfVoteAllowed && nominee.personNickname && normalize(nominee.personNickname) === normalize(state.user.nickname));
  }

  function initials(name) {
    const parts = String(name).trim().split(/\s+/);
    if (parts.length > 1 && parts[1]) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return String(name).slice(0, 2).toUpperCase();
  }

  function hueFor(name) {
    let value = 0;
    for (const character of String(name)) value = (value * 31 + character.codePointAt(0)) % 360;
    return (value + 24) % 360;
  }

  function iconBadge(nomination, nominee) {
    if (isSelfBlocked(nomination, nominee)) return '<span class="self-badge" title="В этой номинации нельзя голосовать за себя">⌑ ЗА СЕБЯ НЕЛЬЗЯ</span>';
    if (state.votes[nomination.id] === nominee.id) return '<span class="selected-badge">ВАШ ГОЛОС</span>';
    return '';
  }

  function artMarkup(nomination, nominee, index) {
    const cover = String(nominee.cover || nomination.visual || 'default').replace(/[^a-z0-9-]/gi, '');
    const indexLabel = String(index + 1).padStart(2, '0');
    const safeVideoUrl = typeof nominee.videoUrl === 'string' && /^https:\/\//i.test(nominee.videoUrl) ? nominee.videoUrl : '';
    const playButton = nominee.type === 'video'
      ? (safeVideoUrl
          ? `<a class="play-link" data-ready="true" href="${escapeHtml(safeVideoUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Открыть видео: ${escapeHtml(nominee.label)}">▶</a>`
          : `<button class="play-link" type="button" data-video-id="${escapeHtml(nominee.id)}" aria-label="Ссылка на видео появится позже" title="Ссылка на видео будет добавлена организатором">▶</button>`)
      : '';
    return `<div class="candidate-art candidate-art--${cover}"><span class="art-index">${indexLabel} / FLARE 2026</span><span class="art-kicker">${nominee.type === 'video' ? 'VIDEO ARCHIVE' : 'NOMINEE'}</span><span class="art-title">${escapeHtml(nominee.coverTitle || nomination.title)}</span></div>${playButton}`;
  }

  function nomineeMarkup(nomination, nominee, index, selectedId) {
    const isParticipant = nominee.type === 'participant';
    const blocked = isSelfBlocked(nomination, nominee);
    const selected = selectedId === nominee.id && !blocked;
    const tileClass = `nominee-tile nominee-tile--${escapeHtml(nominee.type)}${selected ? ' is-selected' : ''}${blocked ? ' is-self-disabled' : ''}`;
    const visual = isParticipant
      ? `<div class="participant-visual"><span class="avatar-orbit" style="--avatar-hue:${hueFor(nominee.label)}"><span class="avatar-spark">✦</span><span class="avatar-initials">${escapeHtml(initials(nominee.label))}</span></span></div>`
      : artMarkup(nomination, nominee, index);
    const label = isParticipant ? `<span class="participant-name">${escapeHtml(nominee.label)}</span>` : `<span class="image-caption">${escapeHtml(nominee.label)}</span>`;
    return `<article class="${tileClass}">${iconBadge(nomination, nominee)}<span class="choice-mark" aria-hidden="true">✓</span><button class="choice-select" type="button" data-select-nominee="${escapeHtml(nominee.id)}" aria-pressed="${selected}"${blocked ? ' disabled aria-disabled="true"' : ''}>${visual}${label}</button></article>`;
  }

  function renderCategory(category) {
    const nominations = data.nominations.filter((nomination) => nomination.category === category);
    const savedCount = nominations.filter((nomination) => Boolean(state.votes[nomination.id])).length;
    const rows = nominations.map((nomination, index) => {
      const done = Boolean(state.votes[nomination.id]);
      const nominee = done ? nomineeById(nomination, state.votes[nomination.id]) : null;
      return `<button class="award-row" type="button" data-open-nomination="${escapeHtml(nomination.id)}">
        <span class="award-row-number">${String(index + 1).padStart(2, '0')}</span>
        <span class="award-row-copy"><strong>${escapeHtml(nomination.title)}</strong><span>${escapeHtml(nomination.description)}</span></span>
        <span class="award-row-side"><span class="award-count">${nomination.nominees.length} номин.</span><span class="award-status${done ? ' is-done' : ''}">${done ? escapeHtml(nominee?.label || 'Голос отдан') : 'ОЖИДАЕТ'}</span></span>
      </button>`;
    }).join('');
    el('nominationDialogContent').innerHTML = `${topbar(`${savedCount} ИЗ ${nominations.length} ГОЛОСОВ`, 'nominationDialog')}
      <div class="dialog-body">
        <div class="dialog-title-row"><div><span class="eyebrow"><span class="eyebrow-line"></span> ${category === 'extra' ? 'ОСОБЫЙ ВЫПУСК' : 'ГЛАВНАЯ ПРОГРАММА'}</span><h2 id="dialogHeading">${categoryTitle(category)}</h2><p>${categoryDescription(category)}</p></div><div class="dialog-note">Один голос в каждой номинации. Твой выбор можно изменить до 21 ноября.</div></div>
        <div class="award-list">${rows}</div>
      </div>`;
  }

  function renderNominationDetail(nomination) {
    if (!nomination) return;
    state.activeNominationId = nomination.id;
    let selectedId = Object.prototype.hasOwnProperty.call(state.selected, nomination.id)
      ? state.selected[nomination.id]
      : state.votes[nomination.id] || null;
    if (selectedId && isSelfBlocked(nomination, nomineeById(nomination, selectedId))) {
      selectedId = null;
      state.selected[nomination.id] = null;
    }
    const savedId = state.votes[nomination.id] || null;
    const savedNominee = nomineeById(nomination, savedId);
    const selectedNominee = nomineeById(nomination, selectedId);
    const sameAsSaved = Boolean(selectedId && selectedId === savedId);
    const typeClass = nomination.kind === 'participant' ? 'nominee-grid--participants' : '';
    const cards = nomination.nominees.map((nominee, index) => nomineeMarkup(nomination, nominee, index, selectedId)).join('');
    const statusText = savedNominee
      ? `Голос учтён: ${escapeHtml(savedNominee.label)}. ${isClosed() ? 'Голосование завершено.' : 'Выбор можно изменить до 21 ноября.'}`
      : 'Выбери одного номинанта, затем подтверди свой голос.';
    let buttonText = savedNominee ? 'Изменить голос' : 'Отдать голос';
    if (sameAsSaved) buttonText = 'Голос уже учтён';
    if (isClosed()) buttonText = 'Голосование закрыто';
    const selectedBlocked = selectedNominee && isSelfBlocked(nomination, selectedNominee);
    const disabled = !selectedId || sameAsSaved || Boolean(selectedBlocked) || isClosed() || !backendReady || state.busy;
    const helper = !backendReady
      ? 'Онлайн-голосование ещё не подключено.'
      : isClosed()
        ? 'Голосование завершено. Спасибо за участие.'
        : !state.user
          ? 'После входа выбор будет сохранён в твоём аккаунте.'
          : savedNominee && selectedId && selectedId !== savedId
            ? `Новый выбор: ${selectedNominee?.label || 'номинант'}. Предыдущий голос будет заменён.`
            : 'Голос анонимен для участников. Изменить его можно до дедлайна.';
    const noSelfVoteNote = !nomination.selfVoteAllowed
      ? '<p class="self-vote-note"><i>⌑</i> Номинант с твоим ником будет отмечен и недоступен для выбора.</p>'
      : '';
    el('nominationDialogContent').innerHTML = `${topbar('ВЫБОР НОМИНАНТА', 'nominationDialog')}
      <div class="dialog-body">
        <button class="dialog-back" type="button" data-back-category="${escapeHtml(nomination.category)}"><span aria-hidden="true">←</span> ${categoryTitle(nomination.category)}</button>
        <div class="dialog-title-row"><div><span class="eyebrow"><span class="eyebrow-line"></span> ${escapeHtml(nomination.category === 'extra' ? 'ДОПОЛНИТЕЛЬНАЯ НОМИНАЦИЯ' : 'ОСНОВНАЯ НОМИНАЦИЯ')}</span><h2 id="dialogHeading">${escapeHtml(nomination.title)}</h2><p class="detail-description">${escapeHtml(nomination.description)}</p></div><span class="type-chip">${escapeHtml(displayNominationKind(nomination.kind))}</span></div>
        <div class="detail-status${savedNominee ? ' is-saved' : ''}"><span class="status-indicator"></span><span>${statusText}</span></div>
        <div class="nominee-grid ${typeClass}">${cards}</div>
        ${noSelfVoteNote}
        <div class="vote-action-bar"><div class="vote-action-copy"><strong>${selectedNominee && !selectedBlocked ? `Выбрано: ${escapeHtml(selectedNominee.label)}` : 'Сначала выбери номинанта'}</strong><span>${escapeHtml(helper)}</span></div><button class="button button--gold" type="button" data-submit-vote="${escapeHtml(nomination.id)}"${disabled ? ' disabled' : ''}>${escapeHtml(buttonText)} <span aria-hidden="true">↗</span></button></div>
      </div>`;
  }

  function openCategory(category) {
    state.activeCategory = category === 'extra' ? 'extra' : 'main';
    state.activeNominationId = null;
    renderCategory(state.activeCategory);
    openDialog(nominationDialog);
  }

  function openNomination(nominationId, category) {
    const nomination = nominationById(nominationId);
    if (!nomination) return;
    state.activeCategory = category || nomination.category;
    renderNominationDetail(nomination);
    if (!nominationDialog.open) openDialog(nominationDialog);
  }

  function setAuthMode(mode) {
    const register = mode === 'register';
    el('loginForm').hidden = register;
    el('registerForm').hidden = !register;
    el('loginTab').classList.toggle('is-active', !register);
    el('registerTab').classList.toggle('is-active', register);
    el('loginTab').setAttribute('aria-selected', String(!register));
    el('registerTab').setAttribute('aria-selected', String(register));
    el('authMessage').textContent = '';
    el('authMessage').classList.remove('is-success');
  }

  function openAuth(mode = 'login') {
    if (!backendReady) {
      toast('Онлайн-голосование ещё не подключено. Организатору нужно настроить Supabase.', 'error', 4600);
      return;
    }
    setAuthMode(mode);
    openDialog(authDialog);
  }

  function setAuthMessage(message, success = false) {
    const messageEl = el('authMessage');
    messageEl.textContent = message;
    messageEl.classList.toggle('is-success', success);
  }

  async function refreshVotes(showErrors = true) {
    if (!state.user || !backendReady) return;
    try {
      const result = await rpc('flare_get_my_votes', { p_session_token: state.user.token });
      state.votes = Object.create(null);
      state.selected = Object.create(null);
      const list = Array.isArray(result?.votes) ? result.votes : [];
      for (const vote of list) {
        if (vote?.nominationId && vote?.nomineeId) {
          state.votes[vote.nominationId] = vote.nomineeId;
          state.selected[vote.nominationId] = vote.nomineeId;
        }
      }
      state.completedAt = result?.completedAt || null;
      if (result?.nickname) state.user.nickname = result.nickname;
      state.user.isAdmin = result?.isAdmin === true;
      try { localStorage.setItem(storageKey, JSON.stringify(state.user)); } catch (_) { /* ignore */ }
      updateChrome();
      return true;
    } catch (error) {
      if (/сессия истекла/i.test(String(error.message))) {
        clearSession();
        if (showErrors) toast('Сессия истекла. Войди снова, чтобы продолжить.', 'error');
      } else if (showErrors) {
        toast(friendlyError(error.message), 'error');
      }
      return false;
    }
  }

  async function finishAuthentication(result) {
    if (!result?.sessionToken) throw new Error('Не удалось создать защищённую сессию. Попробуй ещё раз.');
    storeSession(result);
    await refreshVotes(false);
    closeDialog(authDialog);
    updateChrome();
    toast(`Добро пожаловать, ${state.user.nickname}.`, 'success');
    const pending = state.pendingVote;
    state.pendingVote = null;
    if (pending) {
      const nomination = nominationById(pending.nominationId);
      const nominee = nomineeById(nomination, pending.nomineeId);
      if (nomination && nominee) {
        if (isSelfBlocked(nomination, nominee)) {
          state.selected[nomination.id] = null;
          toast('В этой номинации нельзя голосовать за себя. Выбери другого номинанта.', 'error');
        } else {
          state.selected[nomination.id] = nominee.id;
        }
        openNomination(nomination.id);
      }
    }
  }

  async function onLogin(event) {
    event.preventDefault();
    if (!backendReady) return setAuthMessage('Supabase ещё не подключён.');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const email = String(form.get('email') || '').trim().toLowerCase();
    const pin = String(form.get('pin') || '');
    const submit = formElement.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Проверяем данные…';
    setAuthMessage('');
    try {
      const result = await rpc('flare_login', { p_email: email, p_pin: pin });
      await finishAuthentication(result);
      formElement.reset();
    } catch (error) {
      setAuthMessage(friendlyError(error.message));
    } finally {
      submit.disabled = false;
      submit.innerHTML = 'Войти в бюллетень <span aria-hidden="true">↗</span>';
    }
  }

  async function onRegister(event) {
    event.preventDefault();
    if (!backendReady) return setAuthMessage('Supabase ещё не подключён.');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const email = String(form.get('email') || '').trim().toLowerCase();
    const nickname = String(form.get('nickname') || '').trim();
    const pin = String(form.get('pin') || '');
    const confirmPin = String(form.get('pinConfirm') || '');
    if (!/^[A-Za-z0-9]{4,32}$/.test(pin)) return setAuthMessage('PIN-код должен содержать от 4 до 32 латинских букв или цифр.');
    if (pin !== confirmPin) return setAuthMessage('PIN-коды не совпадают. Проверь оба поля.');
    if (!nickname) return setAuthMessage('Выбери свой ник из списка.');
    const submit = formElement.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Создаём аккаунт…';
    setAuthMessage('');
    try {
      const result = await rpc('flare_register', { p_email: email, p_pin: pin, p_nickname: nickname });
      await finishAuthentication(result);
      formElement.reset();
    } catch (error) {
      setAuthMessage(friendlyError(error.message));
    } finally {
      submit.disabled = false;
      submit.innerHTML = 'Создать аккаунт <span aria-hidden="true">↗</span>';
    }
  }

  async function submitVote(nominationId) {
    const nomination = nominationById(nominationId);
    const nomineeId = state.selected[nominationId];
    const nominee = nomineeById(nomination, nomineeId);
    if (!nomination || !nominee || state.busy) return;
    if (!backendReady) {
      toast('Онлайн-голосование ещё не подключено. Организатору нужно настроить Supabase.', 'error', 4600);
      return;
    }
    if (!state.user) {
      state.pendingVote = { nominationId, nomineeId };
      closeDialog(nominationDialog);
      openAuth('login');
      return;
    }
    if (isClosed()) {
      toast('Голосование закрыто. Изменить выбор больше нельзя.', 'error');
      return;
    }
    if (isSelfBlocked(nomination, nominee)) {
      state.selected[nominationId] = null;
      renderNominationDetail(nomination);
      toast('В этой номинации нельзя голосовать за себя.', 'error');
      return;
    }
    state.busy = true;
    renderNominationDetail(nomination);
    try {
      await rpc('flare_cast_vote', {
        p_session_token: state.user.token,
        p_nomination_id: nominationId,
        p_nominee_id: nomineeId
      });
      state.votes[nominationId] = nomineeId;
      state.selected[nominationId] = nomineeId;
      await refreshVotes(false);
      renderNominationDetail(nomination);
      updateChrome();
      toast('Голос сохранён. Его можно изменить до 21 ноября.', 'success');
    } catch (error) {
      toast(friendlyError(error.message), 'error');
      if (/сессия истекла/i.test(String(error.message))) clearSession();
      renderNominationDetail(nomination);
    } finally {
      state.busy = false;
      renderNominationDetail(nomination);
    }
  }

  function updateChrome() {
    const activeUser = Boolean(state.user && backendReady);
    const userAction = el('userAction');
    userAction.textContent = activeUser ? 'Выйти' : 'Войти';
    userAction.setAttribute('aria-label', activeUser ? `Выйти из аккаунта ${state.user.nickname}` : 'Войти или создать аккаунт');
    const adminAllowed = activeUser && state.user.isAdmin && normalize(state.user.nickname) === 'maronnix';
    el('adminButton').hidden = !adminAllowed;
    el('connectionNote').hidden = backendReady;

    const votesCount = Object.keys(state.votes).length;
    const percentage = totalNominations ? Math.min(100, Math.round(votesCount / totalNominations * 100)) : 0;
    const headerLabel = activeUser ? `Бюллетень ${votesCount}/${totalNominations}` : 'Мой бюллетень';
    el('headerProgressLabel').textContent = headerLabel;
    el('progressFill').style.width = `${percentage}%`;
    el('progressText').textContent = `${votesCount} / ${totalNominations}`;

    if (!activeUser) {
      el('overviewTitle').textContent = 'Твой бюллетень ждёт первого голоса';
      el('overviewSubtitle').textContent = backendReady
        ? 'Войди в аккаунт, чтобы выбрать номинантов и сохранить свой голос.'
        : 'Номинации доступны для просмотра. Голосование откроется после подключения базы.';
      el('overviewAction').innerHTML = 'Войти и голосовать <span aria-hidden="true">↗</span>';
      el('overviewAction').disabled = !backendReady;
    } else {
      el('overviewTitle').textContent = state.completedAt
        ? `Бюллетень подтверждён · ${state.user.nickname}`
        : `Привет, ${state.user.nickname}. Твой выбор уже сохранён.`;
      el('overviewSubtitle').textContent = state.completedAt
        ? (isClosed() ? 'Голосование завершено. Твой подтверждённый бюллетень сохранён.' : 'Голоса анонимны для участников. До 21 ноября можно изменить любой выбор.')
        : isClosed()
          ? `Голосование завершено. Сохранено ${votesCount} из ${totalNominations} голосов.`
          : `Заполнено ${votesCount} из ${totalNominations}. Голоса анонимны; менять выбор можно до 21 ноября.`;
      el('overviewAction').innerHTML = 'Открыть бюллетень <span aria-hidden="true">↗</span>';
      el('overviewAction').disabled = false;
    }
    if (state.user && !backendReady) {
      userAction.textContent = 'Войти';
    }
  }

  function openBallot() {
    if (!backendReady) {
      toast('Онлайн-голосование ещё не подключено. Номинации можно посмотреть без входа.', 'error', 4600);
      return;
    }
    if (!state.user) {
      openAuth('login');
      return;
    }
    renderBallot();
    openDialog(ballotDialog);
  }

  function renderBallot() {
    const votesCount = Object.keys(state.votes).length;
    const complete = votesCount === totalNominations;
    const categoryLabel = { main: 'Основные', extra: 'Дополнительные' };
    const rows = data.nominations.map((nomination, index) => {
      const nominee = nomineeById(nomination, state.votes[nomination.id]);
      const done = Boolean(nominee);
      return `<button class="ballot-item${done ? ' is-done' : ''}" type="button" data-ballot-nomination="${escapeHtml(nomination.id)}">
        <span><strong>${String(index + 1).padStart(2, '0')} · ${escapeHtml(nomination.title)}</strong><span>${done ? escapeHtml(nominee.label) : `${categoryLabel[nomination.category]} · голос ещё не отдан`}</span></span>
        <span class="ballot-state" aria-hidden="true">${done ? '✓' : '·'}</span>
      </button>`;
    }).join('');
    const stateCopy = isClosed()
      ? (state.completedAt ? 'Голосование завершено. Твой подтверждённый бюллетень сохранён.' : 'Голосование завершено. Сохранённые голоса остаются в бюллетене, но изменить или подтвердить его уже нельзя.')
      : state.completedAt
        ? 'Бюллетень подтверждён. До 21 ноября ты всё ещё можешь заменить любой из голосов.'
        : complete
          ? 'Все номинации заполнены. Подтверди бюллетень — ты сможешь вернуться и изменить выбор до дедлайна.'
          : `Чтобы подтвердить бюллетень, отдай голос ещё в ${totalNominations - votesCount} ${pluralVotes(totalNominations - votesCount)}.`;
    const finalLabel = state.completedAt ? 'Бюллетень подтверждён' : isClosed() ? 'Голосование закрыто' : 'Подтвердить бюллетень';
    const finalDisabled = !complete || Boolean(state.completedAt) || isClosed() || state.busy;
    el('ballotDialogContent').innerHTML = `${topbar('МОЙ БЮЛЛЕТЕНЬ', 'ballotDialog')}
      <div class="dialog-body">
        <div class="dialog-title-row"><div><span class="eyebrow"><span class="eyebrow-line"></span> ЛИЧНЫЙ ВЫБОР</span><h2 id="ballotHeading">Мой бюллетень</h2><p>${isClosed() ? 'Голосование завершено. Голоса скрыты от других участников.' : 'Все голоса скрыты от других участников. Изменить их можно до 21 ноября.'}</p></div><div class="dialog-note">Участник: <strong>${escapeHtml(state.user.nickname)}</strong></div></div>
        <div class="ballot-summary"><span class="ballot-circle">${votesCount}<small style="font-size:9px;color:#9d8c5d">/${totalNominations}</small></span><div><strong>${complete ? 'Все номинации заполнены' : 'Твой выбор — часть общей истории'}</strong><p>${escapeHtml(stateCopy)}</p></div></div>
        <div class="ballot-list">${rows}</div>
        <div class="ballot-finalize"><p>${state.completedAt ? (isClosed() ? '<strong>Голосование закрыто.</strong> Подтверждённый бюллетень сохранён.' : '<strong>Подтверждено.</strong> Голоса по-прежнему можно изменить до дедлайна.') : isClosed() ? '<strong>Голосование закрыто.</strong> Новый голос или подтверждение уже недоступны.' : '<strong>Финальное подтверждение</strong> доступно только после заполнения всех номинаций.'}</p><button class="button button--gold" type="button" data-finalize-ballot${finalDisabled ? ' disabled' : ''}>${escapeHtml(finalLabel)} <span aria-hidden="true">↗</span></button></div>
      </div>`;
  }

  function pluralVotes(count) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'номинации';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'номинациях';
    return 'номинациях';
  }

  async function finalizeBallot() {
    if (!state.user || state.busy) return;
    if (Object.keys(state.votes).length !== totalNominations) {
      toast('Сначала заполни все номинации.', 'error');
      return;
    }
    state.busy = true;
    renderBallot();
    try {
      const result = await rpc('flare_finalize_ballot', { p_session_token: state.user.token });
      state.completedAt = result?.completedAt || new Date().toISOString();
      renderBallot();
      updateChrome();
      toast('Бюллетень подтверждён. Спасибо за голос!', 'success');
    } catch (error) {
      toast(friendlyError(error.message), 'error');
      renderBallot();
    } finally {
      state.busy = false;
      renderBallot();
    }
  }

  async function signOut() {
    const token = state.user?.token;
    if (token && backendReady) {
      try { await rpc('flare_logout', { p_session_token: token }); } catch (_) { /* session is removed locally either way */ }
    }
    clearSession();
    toast('Ты вышел из аккаунта.', 'success');
  }

  function populateNicknames() {
    const select = el('registerNickname');
    const options = data.participants.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
    select.insertAdjacentHTML('beforeend', options);
  }

  function updateCountdown() {
    const output = el('countdown');
    const remaining = deadline.getTime() - Date.now();
    if (remaining <= 0) {
      output.textContent = 'Голосование завершено';
      document.querySelectorAll('.hero-countdown').forEach((node) => node.classList.add('is-closed'));
      return;
    }
    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    output.textContent = days > 0 ? `${days} дн. ${String(hours).padStart(2, '0')} ч.` : `${hours} ч. ${String(Math.floor((remaining % 3600000) / 60000)).padStart(2, '0')} мин.`;
  }

  function renderArchive() {
    const winners = Array.isArray(data.previousWinners) ? data.previousWinners : [];
    const host = el('winnerCarousel');
    const controls = el('carouselControls');
    if (!winners.length) {
      controls.hidden = true;
      host.innerHTML = `<div class="archive-empty"><div class="archive-empty-year">FLARE<br />2025</div><div class="archive-empty-copy"><span>АРХИВ ПРОШЛОГО ГОДА</span><strong>Истории победителей<br />скоро загорятся снова.</strong><p>Подборка победителей FLARE 2025 появится здесь. А пока — создаём новую историю вместе.</p></div></div>`;
      return;
    }
    if (winners.length === 1) {
      controls.hidden = true;
      host.innerHTML = `<div class="winner-track winner-track--single">${renderWinnerCard(winners[0])}</div>`;
      return;
    }
    controls.hidden = false;
    const cloneCount = Math.min(winners.length, window.innerWidth > 930 ? 3 : window.innerWidth > 680 ? 2 : 1);
    const slides = [winners[winners.length - 1], ...winners, ...winners.slice(0, cloneCount)];
    host.innerHTML = `<div class="winner-viewport"><div class="winner-track">${slides.map((winner, index) => renderWinnerCard(winner, index === 0 || index > winners.length)).join('')}</div></div>`;
    state.archive.index = 1;
    state.archive.track = host.querySelector('.winner-track');
    state.archive.viewport = host.querySelector('.winner-viewport');
    state.archive.cloneCount = cloneCount;
    state.archive.total = winners.length;
    state.archive.offset = 0;
    window.requestAnimationFrame(() => setCarouselTransform(false));
    updateCarouselCounter();
    startCarouselTimer();
  }

  function renderWinnerCard(winner, clone = false) {
    const award = escapeHtml(winner.award || winner.category || 'Победитель FLARE 2025');
    const name = escapeHtml(winner.winner || winner.name || 'Победитель');
    const caption = escapeHtml(winner.caption || winner.subtitle || 'История прошлого года');
    const year = escapeHtml(winner.year || '2025');
    return `<article class="winner-card"${clone ? ' aria-hidden="true"' : ''}><span class="winner-year">FLARE · ${year}</span><span class="winner-crown" aria-hidden="true">✦</span><span class="winner-award">${award}</span><strong class="winner-name">${name}</strong><span class="winner-caption">${caption}</span></article>`;
  }

  function carouselTransformPosition() {
    if (!state.archive.track || !state.archive.track.children.length) return 0;
    const first = state.archive.track.children[0].getBoundingClientRect();
    const second = state.archive.track.children[1]?.getBoundingClientRect();
    const gap = second ? Math.round(second.left - first.right) : 14;
    const width = first.width;
    state.archive.offset = width + gap;
    return -(state.archive.index * state.archive.offset);
  }

  function setCarouselTransform(animate = true) {
    const track = state.archive.track;
    if (!track) return;
    track.style.transition = animate ? 'transform .62s cubic-bezier(.2,.75,.25,1)' : 'none';
    track.style.transform = `translate3d(${carouselTransformPosition()}px,0,0)`;
  }

  function updateCarouselCounter() {
    const total = state.archive.total || 0;
    if (!total) return;
    const index = state.archive.index === total + 1 ? 1 : state.archive.index === 0 ? total : state.archive.index;
    el('carouselCounter').textContent = `${String(index).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
  }

  function clearCarouselTimer() {
    if (state.archive.timer) window.clearTimeout(state.archive.timer);
    state.archive.timer = null;
  }

  function startCarouselTimer() {
    clearCarouselTimer();
    if (!state.archive.total || state.archive.total < 2 || document.hidden) return;
    state.archive.timer = window.setTimeout(() => moveCarousel(1, false), 4800);
  }

  function moveCarousel(direction, manual = false) {
    if (!state.archive.track || state.archive.locked || !state.archive.total || state.archive.total < 2) return;
    clearCarouselTimer();
    state.archive.locked = true;
    state.archive.index += direction;
    setCarouselTransform(true);
    updateCarouselCounter();
    const finish = () => {
      if (!state.archive.locked) return;
      if (state.archive.index === state.archive.total + 1) {
        state.archive.index = 1;
        setCarouselTransform(false);
      } else if (state.archive.index === 0) {
        state.archive.index = state.archive.total;
        setCarouselTransform(false);
      }
      updateCarouselCounter();
      state.archive.locked = false;
      startCarouselTimer();
    };
    state.archive.track.addEventListener('transitionend', finish, { once: true });
    window.setTimeout(finish, 720);
  }

  function initArchiveControls() {
    el('carouselPrev').addEventListener('click', () => moveCarousel(-1, true));
    el('carouselNext').addEventListener('click', () => moveCarousel(1, true));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearCarouselTimer();
      else startCarouselTimer();
    });
    window.addEventListener('resize', () => {
      if (!state.archive.track) return;
      if (state.archive.locked) return;
      setCarouselTransform(false);
    }, { passive: true });
  }

  function initEvents() {
    document.addEventListener('click', (event) => {
      const target = event.target.closest('button, a');
      if (!target) return;

      const closeId = target.getAttribute('data-close-dialog');
      if (closeId) {
        if (closeId === 'authDialog') state.pendingVote = null;
        closeDialog(el(closeId));
        return;
      }
      const category = target.getAttribute('data-open-category');
      if (category) {
        openCategory(category);
        return;
      }
      const authMode = target.getAttribute('data-auth-mode');
      if (authMode) {
        setAuthMode(authMode);
        return;
      }
      const nominationId = target.getAttribute('data-open-nomination');
      if (nominationId) {
        openNomination(nominationId);
        return;
      }
      const backCategory = target.getAttribute('data-back-category');
      if (backCategory) {
        state.activeNominationId = null;
        renderCategory(backCategory);
        return;
      }
      const selectId = target.getAttribute('data-select-nominee');
      if (selectId) {
        const nomination = nominationById(state.activeNominationId);
        if (!nomination) return;
        const nominee = nomineeById(nomination, selectId);
        if (!nominee || isSelfBlocked(nomination, nominee)) return;
        state.selected[nomination.id] = nominee.id;
        renderNominationDetail(nomination);
        return;
      }
      const submitId = target.getAttribute('data-submit-vote');
      if (submitId) {
        submitVote(submitId);
        return;
      }
      if (target.hasAttribute('data-video-id')) {
        toast('Ссылка на это видео будет добавлена организатором.', 'error');
        return;
      }
      const ballotNomination = target.getAttribute('data-ballot-nomination');
      if (ballotNomination) {
        const nomination = nominationById(ballotNomination);
        closeDialog(ballotDialog);
        if (nomination) openCategory(nomination.category);
        window.setTimeout(() => openNomination(ballotNomination), 0);
        return;
      }
      if (target.hasAttribute('data-finalize-ballot')) {
        finalizeBallot();
        return;
      }
      if (target.hasAttribute('data-admin-export')) {
        exportAdminCsv();
      }
    });

    el('userAction').addEventListener('click', () => {
      if (state.user && backendReady) signOut();
      else openAuth('login');
    });
    el('ballotButton').addEventListener('click', openBallot);
    el('overviewAction').addEventListener('click', openBallot);
    el('adminButton').addEventListener('click', openAdmin);
    el('loginForm').addEventListener('submit', onLogin);
    el('registerForm').addEventListener('submit', onRegister);
    window.addEventListener('storage', (event) => {
      if (event.key === storageKey && backendReady) {
        state.user = readStoredSession();
        if (state.user) refreshVotes(false);
        else clearSession();
      }
    });
  }

  let adminRows = [];
  async function openAdmin() {
    if (!state.user || !state.user.isAdmin || normalize(state.user.nickname) !== 'maronnix') {
      toast('Доступ к панели организатора закрыт.', 'error');
      return;
    }
    el('adminDialogContent').innerHTML = `${topbar('ТОЛЬКО ДЛЯ ОРГАНИЗАТОРА', 'adminDialog')}<div class="dialog-body"><div class="dialog-title-row"><div><span class="eyebrow"><span class="eyebrow-line"></span> ЗАКРЫТАЯ ПАНЕЛЬ</span><h2 id="adminHeading">Результаты голосования</h2><p>Данные доступны только организатору. Участники не видят результаты до завершения премии.</p></div></div><div class="admin-empty">Загружаем результаты…</div></div>`;
    openDialog(adminDialog);
    try {
      const result = await rpc('flare_admin_results', { p_session_token: state.user.token });
      const nominations = Array.isArray(result) ? result : Array.isArray(result?.results) ? result.results : [];
      renderAdminResults(nominations);
    } catch (error) {
      el('adminDialogContent').innerHTML = `${topbar('ТОЛЬКО ДЛЯ ОРГАНИЗАТОРА', 'adminDialog')}<div class="dialog-body"><div class="admin-empty">${escapeHtml(friendlyError(error.message))}</div></div>`;
    }
  }

  function renderAdminResults(nominations) {
    const allVotes = [];
    const totalBallots = new Set();
    let totalVotes = 0;
    const summaries = data.nominations.map((nomination) => {
      const databaseRow = nominations.find((row) => row.nominationId === nomination.id || row.nomination_id === nomination.id);
      const votes = Array.isArray(databaseRow?.votes) ? databaseRow.votes : [];
      totalVotes += votes.length;
      votes.forEach((vote) => {
        allVotes.push({
          voter: String(vote.voter || vote.nickname || ''),
          nomination: nomination.title,
          nominee: String(vote.nominee || vote.nomineeLabel || ''),
          updatedAt: vote.updatedAt || vote.updated_at || ''
        });
        totalBallots.add(String(vote.voter || vote.nickname || ''));
      });
      const tally = new Map();
      votes.forEach((vote) => {
        const key = String(vote.nomineeId || vote.nominee_id || vote.nominee || '');
        tally.set(key, (tally.get(key) || 0) + 1);
      });
      const ranked = nomination.nominees.map((nominee) => ({ nominee, count: tally.get(nominee.id) || 0 })).sort((a, b) => b.count - a.count || a.nominee.label.localeCompare(b.nominee.label, 'ru'));
      return `<article class="admin-result-card"><h3>${escapeHtml(nomination.title)} <span style="color:#8c8378;font-weight:500">· ${votes.length}</span></h3>${ranked.map((item) => `<div class="admin-result-row"><span>${escapeHtml(item.nominee.label)}</span><strong>${item.count}</strong></div>`).join('')}</article>`;
    });
    adminRows = allVotes;
    const detailRows = allVotes
      .slice()
      .sort((a, b) => a.nomination.localeCompare(b.nomination, 'ru') || a.voter.localeCompare(b.voter, 'ru'))
      .map((row) => `<tr><td>${escapeHtml(row.voter)}</td><td>${escapeHtml(row.nomination)}</td><td>${escapeHtml(row.nominee)}</td><td>${escapeHtml(formatAdminDate(row.updatedAt))}</td></tr>`).join('');
    const table = allVotes.length
      ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>УЧАСТНИК</th><th>НОМИНАЦИЯ</th><th>ВЫБОР</th><th>ИЗМЕНЁН</th></tr></thead><tbody>${detailRows}</tbody></table></div>`
      : '<div class="admin-empty">Пока нет сохранённых голосов.</div>';
    el('adminDialogContent').innerHTML = `${topbar('ТОЛЬКО ДЛЯ ОРГАНИЗАТОРА', 'adminDialog')}
      <div class="dialog-body"><div class="dialog-title-row"><div><span class="eyebrow"><span class="eyebrow-line"></span> ЗАКРЫТАЯ ПАНЕЛЬ</span><h2 id="adminHeading">Результаты голосования</h2><p>${totalVotes} голосов · ${totalBallots.size} участников. Результаты доступны только аккаунту Maronnix.</p></div><div class="admin-toolbar"><button class="button button--outline" type="button" data-admin-export${allVotes.length ? '' : ' disabled'}>Экспорт CSV ↘</button></div></div><div class="admin-results-grid">${summaries.join('')}</div><div class="admin-detail"><h3>Все сохранённые голоса</h3>${table}</div></div>`;
  }

  function formatAdminDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Yekaterinburg' }).format(date);
  }

  function exportAdminCsv() {
    if (!adminRows.length) return;
    const rows = [['Участник', 'Номинация', 'Выбор', 'Изменён (UTC)'], ...adminRows.map((row) => [row.voter, row.nomination, row.nominee, row.updatedAt])];
    const csv = rows.map((line) => line.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `FLARE-2026-results-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function init() {
    populateNicknames();
    renderArchive();
    initArchiveControls();
    initEvents();
    setAuthMode('login');
    updateCountdown();
    window.setInterval(updateCountdown, 60_000);
    state.user = backendReady ? readStoredSession() : null;
    updateChrome();
    if (state.user) refreshVotes(false);
    if (isClosed()) {
      el('overviewSubtitle').textContent = 'Голосование завершено. Спасибо всем, кто принял участие.';
    }
  }

  init();
})();
