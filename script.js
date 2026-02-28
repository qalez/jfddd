/* =========================
   BonusFera CREO (GitHub demo)
   - No backend
   - Always active / always buttons work
   - Hidden admin button over username
   - Create custom offer -> "Get offer" returns it
   - History stored in localStorage
   - Promo code auto-generated (letters+digits)
========================= */

(function () {
  const tg = window.Telegram?.WebApp;
  try { tg?.expand?.(); } catch (_) {}

  const $ = (id) => document.getElementById(id);

  const LS = {
    spins: "bf_creo_spins",
    offer: "bf_creo_offer",
    history: "bf_creo_history",
  };

  function safeText(v) {
    return v === null || v === undefined ? "" : String(v);
  }

  function parseISO(dateStr) {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatDateTimeRU(dateObj) {
    return dateObj.toLocaleString("ru-RU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDateRUFromYMD(ymd) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    if (!m) return ymd;
    return `${m[3]}.${m[2]}.${m[1]}`;
  }

  function tgAlert(text) {
    if (tg?.showAlert) tg.showAlert(text);
    else alert(text);
  }

  function showScreen(name) {
    document.querySelectorAll(".screen").forEach((el) => el.classList.add("hidden"));
    const target = $(`${name}-screen`);
    if (target) target.classList.remove("hidden");
  }

  function makeButton(label, classes, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = classes;
    btn.innerText = label;
    btn.addEventListener("click", onClick);
    return btn;
  }

  /* -----------------------
     Promo generator
  ------------------------ */
  function genPromoCode(len = 10) {
    // без похожих символов (O/0, I/1), чтобы читалось в видео
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const arr = new Uint32Array(len);
    (crypto?.getRandomValues ? crypto.getRandomValues(arr) : arr.fill(Date.now()));

    let out = "";
    for (let i = 0; i < len; i++) {
      out += alphabet[arr[i] % alphabet.length];
    }
    return out;
  }

  /* -----------------------
     State (localStorage)
  ------------------------ */
  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  const state = {
    username: "BONUSFERA",
    sub_active: true,
    spins: 3,
    offer: null,
    history: [],
  };

  function loadState() {
    const spins = Number(localStorage.getItem(LS.spins));
    state.spins = Number.isFinite(spins) && spins >= 0 ? spins : 3;

    state.offer = loadJSON(LS.offer, null);
    state.history = loadJSON(LS.history, []);
    if (!Array.isArray(state.history)) state.history = [];
  }

  function persistState() {
    localStorage.setItem(LS.spins, String(state.spins));
    saveJSON(LS.offer, state.offer);
    saveJSON(LS.history, state.history);
  }

  /* -----------------------
     Offer formatting
  ------------------------ */
  function buildValidityText(offer) {
    if (!offer) return "";
    if (offer.expired) return "Срок действия истёк";

    const expires = offer.expires_at;
    if (!expires || expires === "∞") return "Без срока действия";

    if (typeof expires === "string") {
      const s = expires.trim();
      if (s === "" || s === "∞") return "Без срока действия";

      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        return `Действует до: ${formatDateRUFromYMD(s)} (включительно, МСК)`;
      }

      const d = parseISO(s);
      if (d) return `Действует до: ${formatDateTimeRU(d)} (МСК)`;
    }

    return `Срок действия: ${safeText(expires)}`;
  }

  function isExpired(offer) {
    if (!offer) return false;
    const exp = offer.expires_at;
    if (!exp || exp === "∞") return false;

    if (/^\d{4}-\d{2}-\d{2}$/.test(exp)) {
      const [y, m, d] = exp.split("-").map(Number);
      // до конца дня по МСК (приблизительно)
      const dt = new Date(Date.UTC(y, m - 1, d, 20, 59, 59));
      return Date.now() > dt.getTime();
    }

    const d = parseISO(exp);
    if (!d) return false;
    return Date.now() > d.getTime();
  }

  /* -----------------------
     Main modal
  ------------------------ */
  function openOfferModal(offer) {
    const modal = $("prize-modal");
    if (!modal) return;

    const modalTitle = $("modal-title");
    const modalIcon = $("modal-icon");
    const offerName = $("modal-prize-name");
    const validityEl = $("modal-validity");

    const codeWrapper = $("modal-code-wrapper");
    const codeText = $("modal-promo-code");
    const actionBtn = $("modal-action-btn");

    const close = () => modal.classList.add("hidden");

    if (offer && offer._mode === "info") {
      modalTitle.innerText = "ИНФОРМАЦИЯ";
      modalIcon.innerText = "ℹ️";
      offerName.innerText = safeText(offer.message || "Информация");
      validityEl.innerText = "";
      codeWrapper.classList.add("hidden");
      actionBtn.innerText = "ПОНЯТНО";
      actionBtn.onclick = close;
      modal.classList.remove("hidden");
      return;
    }

    if (offer && offer.expired) {
      modalTitle.innerText = "ИНФОРМАЦИЯ";
      modalIcon.innerText = "ℹ️";
      offerName.innerText = "Срок действия истёк";
      validityEl.innerText = "Создайте новое предложение через скрытую кнопку над именем.";
      codeWrapper.classList.add("hidden");
      actionBtn.innerText = "ПОНЯТНО";
      actionBtn.onclick = close;
      modal.classList.remove("hidden");
      return;
    }

    modalTitle.innerText = "ВАШЕ ПРЕДЛОЖЕНИЕ";
    modalIcon.innerText = offer.icon || "📌";
    offerName.innerText = safeText(offer.title || "Предложение");
    validityEl.innerText = buildValidityText(offer);

    codeWrapper.classList.remove("hidden");
    codeText.innerText = offer.code || "---";

    actionBtn.innerText = "СКОПИРОВАТЬ ПРОМОКОД";
    actionBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(offer.code || "");
        actionBtn.innerText = "СКОПИРОВАНО!";
        setTimeout(() => (actionBtn.innerText = "СКОПИРОВАТЬ ПРОМОКОД"), 1200);
      } catch (e) {
        tgAlert("Не удалось скопировать. Скопируйте вручную.");
      }
    };

    modal.classList.remove("hidden");
  }

  /* -----------------------
     Admin modal (inject)
  ------------------------ */
  function ensureAdminModal() {
    if ($("admin-modal")) return;

    const wrap = document.createElement("div");
    wrap.id = "admin-modal";
    wrap.className = "modal hidden";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");

    wrap.innerHTML = `
      <div class="modal__content admin__content">
        <div class="modal__header">
          <span class="modal__spacer" aria-hidden="true"></span>
          <h2 class="modal__title">СОЗДАТЬ ПРЕДЛОЖЕНИЕ</h2>
          <button id="admin-close" class="modal__close" type="button" aria-label="Закрыть">×</button>
        </div>

        <div class="admin__body">
          <label class="admin__label">
            Название
            <input id="admin-title" class="admin__input" type="text" placeholder="Напр.: Скидка 500 ₽ на первый заказ" />
          </label>

          <label class="admin__label">
            Промокод (авто)
            <div class="admin__row2">
              <input id="admin-code" class="admin__input" type="text" />
              <button id="admin-gen" class="btn btn--secondary btn--small2" type="button">Сгенерировать</button>
            </div>
          </label>

          <label class="admin__label">
            Активен до (∞ или дата)
            <input id="admin-expires" class="admin__input" type="text" placeholder="∞ или 2026-03-31 или 2026-03-31T23:59" />
          </label>

          <div class="admin__row">
            <button id="admin-save" class="btn" type="button">СОХРАНИТЬ</button>
            <button id="admin-clear" class="btn btn--secondary" type="button">ОЧИСТИТЬ</button>
          </div>

          <p class="admin__hint">
            Нажми “Сгенерировать”, чтобы код был уникальным и читабельным в видео.
          </p>
        </div>
      </div>
    `;

    document.body.appendChild(wrap);

    $("admin-close").onclick = () => wrap.classList.add("hidden");
    wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.classList.add("hidden"); });

    $("admin-gen").onclick = () => {
      $("admin-code").value = genPromoCode(10);
    };

    $("admin-save").onclick = () => {
      const title = safeText($("admin-title").value).trim();
      const code = safeText($("admin-code").value).trim();
      const expires = safeText($("admin-expires").value).trim() || "∞";

      if (!title) return tgAlert("Введите название.");
      if (!code) return tgAlert("Сгенерируйте или введите промокод.");

      const offer = {
        id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
        title,
        code,
        expires_at: expires,
        icon: "📌",
        created_at: new Date().toISOString(),
      };

      state.offer = offer;
      persistState();
      updateUI();

      wrap.classList.add("hidden");
      tgAlert("Предложение сохранено. Теперь нажми «Получить предложение дня».");
    };

    $("admin-clear").onclick = () => {
      state.offer = null;
      persistState();
      updateUI();
      tgAlert("Текущее предложение очищено.");
    };
  }

  function openAdminModal() {
    ensureAdminModal();

    // Автогенерация при открытии (чтобы не думать)
    if (state.offer) {
      $("admin-title").value = state.offer.title || "";
      $("admin-code").value = state.offer.code || genPromoCode(10);
      $("admin-expires").value = state.offer.expires_at || "∞";
    } else {
      $("admin-title").value = "";
      $("admin-code").value = genPromoCode(10);
      $("admin-expires").value = "∞";
    }

    $("admin-modal").classList.remove("hidden");
  }

  /* -----------------------
     UI render
  ------------------------ */
  function updateUI() {
    const userNameEl = $("user-name");
    if (userNameEl) userNameEl.innerText = state.username;

    const spinsDisplay = $("spins-display");
    if (spinsDisplay) spinsDisplay.innerHTML = `ДОСТУПНО ПРЕДЛОЖЕНИЙ: <b>${state.spins}</b>`;

    const btnCont = $("btn-container");
    if (btnCont) {
      btnCont.innerHTML = "";
      btnCont.appendChild(makeButton("ПОЛУЧИТЬ ПРЕДЛОЖЕНИЕ ДНЯ", "btn", handleGetOffer));
      btnCont.appendChild(makeButton("ДОКУПИТЬ +1 (25 ₽)", "btn btn--secondary", () => addSpins(1)));
      btnCont.appendChild(makeButton("ДОКУПИТЬ +10 (200 ₽)", "btn btn--secondary", () => addSpins(10)));
    }

    const historyList = $("history-list");
    if (historyList) {
      historyList.innerHTML = "";

      if (state.history.length === 0) {
        const empty = document.createElement("div");
        empty.className = "history-item";
        empty.innerHTML = `<div class="history-item__left">
          <div class="history-item__title">История пока пуста</div>
          <div class="history-item__meta">Получите предложение — и оно появится здесь</div>
        </div>`;
        historyList.appendChild(empty);
      } else {
        state.history.slice().reverse().forEach((item) => {
          const row = document.createElement("div");
          row.className = "history-item";

          const left = document.createElement("div");
          left.className = "history-item__left";

          const title = document.createElement("div");
          title.className = "history-item__title";
          title.innerText = safeText(item.title);

          const meta = document.createElement("div");
          meta.className = "history-item__meta";

          if (item.expired) {
            meta.innerHTML = `<span class="badge-expired">истёк срок</span>`;
          } else {
            const exp = item.expires_at;
            if (!exp || exp === "∞") meta.innerText = "без срока действия";
            else {
              const d = parseISO(exp);
              meta.innerText = d ? `до ${formatDateTimeRU(d)} (МСК)` : `до ${exp}`;
            }
          }

          left.appendChild(title);
          left.appendChild(meta);

          const openBtn = makeButton("ОТКРЫТЬ", "btn btn--small", () => openOfferModal(item));
          row.appendChild(left);
          row.appendChild(openBtn);

          historyList.appendChild(row);
        });
      }
    }
  }

  function addSpins(n) {
    state.spins = Math.max(0, state.spins + n);
    persistState();
    updateUI();
    tgAlert(`✅ Добавлено +${n} предложений.`);
  }

  /* -----------------------
     Logic: get offer
  ------------------------ */
  function handleGetOffer() {
    if (state.spins <= 0) {
      openOfferModal({ _mode: "info", message: "Нет доступных предложений. Добавьте предложения кнопками ниже." });
      return;
    }

    if (!state.offer) {
      openOfferModal({ _mode: "info", message: "Сначала создайте предложение: нажмите на скрытую кнопку над именем." });
      return;
    }

    const offerToGive = { ...state.offer };
    if (isExpired(offerToGive)) offerToGive.expired = true;

    state.spins -= 1;

    state.history.push({ ...offerToGive, received_at: new Date().toISOString() });

    persistState();
    updateUI();
    openOfferModal(offerToGive);
  }

  /* -----------------------
     Init DOM events
  ------------------------ */
  document.addEventListener("DOMContentLoaded", () => {
    loadState();
    ensureAdminModal();

    $("to-profile")?.addEventListener("click", () => showScreen("profile"));
    $("back-to-main")?.addEventListener("click", () => showScreen("main"));

    $("close-modal")?.addEventListener("click", () => $("prize-modal")?.classList.add("hidden"));
    $("prize-modal")?.addEventListener("click", (e) => { if (e.target === $("prize-modal")) $("prize-modal").classList.add("hidden"); });

    const adminBtn = $("admin-trigger");
    if (adminBtn) {
      adminBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openAdminModal();
      });
    }

    updateUI();
  });
})();
