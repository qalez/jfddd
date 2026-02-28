(function () {
  const tg = window.Telegram?.WebApp;
  try { tg?.expand?.(); } catch (_) {}

  const $ = (id) => document.getElementById(id);

  // Колесо: 1..25 (можешь уменьшить)
  const WHEEL_SEGMENTS = Array.from({ length: 25 }, (_, i) => String(i + 1));

  const wheel = {
    canvas: null,
    ctx: null,
    rotation: 0,
    spinning: false,
    segCount: WHEEL_SEGMENTS.length
  };

  const LS = {
    spins: "bf_creo_spins",
    offer: "bf_creo_offer",
    history: "bf_creo_history",
  };

  function tgAlert(text) { tg?.showAlert ? tg.showAlert(text) : alert(text); }
  function safeText(v) { return v === null || v === undefined ? "" : String(v); }
  function showScreen(name) {
    document.querySelectorAll(".screen").forEach((el) => el.classList.add("hidden"));
    $(`${name}-screen`)?.classList.remove("hidden");
  }

  /* -----------------------
     Promo + title generators
  ------------------------ */
  function genPromoCode(len = 10) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const arr = new Uint32Array(len);
    (crypto?.getRandomValues ? crypto.getRandomValues(arr) : arr.fill(Date.now()));
    let out = "";
    for (let i = 0; i < len; i++) out += alphabet[arr[i] % alphabet.length];
    return out;
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function genTitle() {
    const brands = ["Яндекс Маркет", "Самокат", "Пятёрочка", "Магнит", "ВкусВилл", "Ozon", "Л'Этуаль", "KION", "Okko", "СберПрайм"];
    const types = [
      "Скидка {sum} ₽ на первый заказ",
      "{pct}% на первый заказ от {min} ₽",
      "Подарок к заказу от {min} ₽",
      "Подписка на {days} дней за 1 ₽",
      "Скидка {pct}% на повторный заказ",
      "Скидка {sum} ₽ от {min} ₽"
    ];
    const sum = pick([100, 200, 300, 500, 750, 1000, 1500]);
    const pct = pick([10, 15, 20, 25, 30, 40, 50]);
    const min = pick([700, 900, 1000, 1200, 1500, 2000, 3000, 5000]);
    const days = pick([7, 14, 30, 45, 60]);

    const tpl = pick(types)
      .replace("{sum}", String(sum))
      .replace("{pct}", String(pct))
      .replace("{min}", String(min))
      .replace("{days}", String(days));

    return `${pick(brands)} — ${tpl}`;
  }

  /* -----------------------
     State
  ------------------------ */
  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (_) { return fallback; }
  }
  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }

  const state = {
    username: "BONUSFERA",
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
     Wheel
  ------------------------ */
  function resizeCanvasForDPR(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  function drawWheel() {
    const canvas = wheel.canvas;
    if (!canvas) return;
    const ctx = wheel.ctx;
    const rect = canvas.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height);
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const radius = size / 2 - 8;

    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.beginPath();
    ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,.95)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(0,0,0,.18)";
    ctx.stroke();

    const segAngle = (Math.PI * 2) / wheel.segCount;

    for (let i = 0; i < wheel.segCount; i++) {
      const a0 = wheel.rotation + i * segAngle;
      const a1 = a0 + segAngle;

      const isEven = i % 2 === 0;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, a0, a1);
      ctx.closePath();
      ctx.fillStyle = isEven ? "rgba(89,200,154,.18)" : "rgba(198,169,232,.18)";
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a0) * radius, cy + Math.sin(a0) * radius);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(0,0,0,.10)";
      ctx.stroke();

      const label = WHEEL_SEGMENTS[i];
      const mid = a0 + segAngle / 2;

      const tx = cx + Math.cos(mid) * (radius * 0.55);
      const ty = cy + Math.sin(mid) * (radius * 0.55);

      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(mid + Math.PI / 2);

      ctx.fillStyle = "#000";
      ctx.font = "900 8px Inter, Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, 0, 0);

      ctx.restore();
    }

    // hub
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.16, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,.98)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(0,0,0,.25)";
    ctx.stroke();

    ctx.fillStyle = "#000";
    ctx.font = "900 12px Inter, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("B", cx, cy);
  }

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function hashToIndex(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h % wheel.segCount;
  }

  function spinToIndex(targetIndex) {
    if (wheel.spinning) return Promise.resolve();
    wheel.spinning = true;

    const segAngle = (Math.PI * 2) / wheel.segCount;
    const twoPi = Math.PI * 2;

    const start = wheel.rotation;
    const current = ((start % twoPi) + twoPi) % twoPi;

    const desired = ((-(targetIndex * segAngle + segAngle / 2)) % twoPi + twoPi) % twoPi;
    const delta = (desired - current + twoPi) % twoPi;

    const extraTurns = 7 + Math.floor(Math.random() * 4); // 7–10
    const end = start + extraTurns * twoPi + delta;

    const duration = 3500 + Math.floor(Math.random() * 700);
    const t0 = performance.now();

    return new Promise((resolve) => {
      function frame(now) {
        const t = Math.min(1, (now - t0) / duration);
        const k = easeOutCubic(t);
        wheel.rotation = start + (end - start) * k;
        drawWheel();

        if (t < 1) requestAnimationFrame(frame);
        else {
          wheel.spinning = false;
          resolve();
        }
      }
      requestAnimationFrame(frame);
    });
  }

  /* -----------------------
     Modals
  ------------------------ */
  function openOfferModal(offer) {
    const modal = $("prize-modal");
    if (!modal) return;

    $("modal-title").innerText = offer?._mode === "info" ? "ИНФОРМАЦИЯ" : "ВАШЕ ПРЕДЛОЖЕНИЕ";
    $("modal-icon").innerText = offer?._mode === "info" ? "ℹ️" : "📌";

    $("modal-prize-name").innerText = offer?._mode === "info" ? safeText(offer.message) : safeText(offer.title);
    $("modal-validity").innerText = offer?._mode === "info" ? "" : (offer.expires_at && offer.expires_at !== "∞" ? `Действует до: ${offer.expires_at}` : "Без срока действия");

    const codeWrapper = $("modal-code-wrapper");
    const codeText = $("modal-promo-code");
    const actionBtn = $("modal-action-btn");

    if (offer?._mode === "info") {
      codeWrapper.classList.add("hidden");
      actionBtn.innerText = "ПОНЯТНО";
      actionBtn.onclick = () => modal.classList.add("hidden");
    } else {
      codeWrapper.classList.remove("hidden");
      codeText.innerText = offer.code || "---";
      actionBtn.innerText = "СКОПИРОВАТЬ";
      actionBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(offer.code || "");
          actionBtn.innerText = "СКОПИРОВАНО!";
          setTimeout(() => (actionBtn.innerText = "СКОПИРОВАТЬ"), 1200);
        } catch (_) {
          tgAlert("Не удалось скопировать. Скопируйте вручную.");
        }
      };
    }

    modal.classList.remove("hidden");
  }

  function ensureAdminModal() {
    if ($("admin-modal")) return;

    const wrap = document.createElement("div");
    wrap.id = "admin-modal";
    wrap.className = "modal hidden";
    wrap.innerHTML = `
      <div class="modal__content admin__content">
        <div class="modal__header">
          <span class="modal__spacer" aria-hidden="true"></span>
          <h2 class="modal__title">СОЗДАТЬ ПРЕДЛОЖЕНИЕ</h2>
          <button id="admin-close" class="modal__close" type="button">×</button>
        </div>

        <div class="admin__body">
          <label class="admin__label">
            Название (шаблоны)
            <div class="admin__row2">
              <input id="admin-title" class="admin__input" type="text" />
              <button id="admin-title-gen" class="btn btn--secondary btn--small2" type="button">Сгенерировать</button>
            </div>
          </label>

          <label class="admin__label">
            Промокод (авто)
            <div class="admin__row2">
              <input id="admin-code" class="admin__input" type="text" />
              <button id="admin-code-gen" class="btn btn--secondary btn--small2" type="button">Сгенерировать</button>
            </div>
          </label>

          <label class="admin__label">
            Активен до (∞ или 2026-03-31)
            <input id="admin-expires" class="admin__input" type="text" value="∞" />
          </label>

          <div class="admin__row">
            <button id="admin-save" class="btn" type="button">СОХРАНИТЬ</button>
            <button id="admin-clear" class="btn btn--secondary" type="button">ОЧИСТИТЬ</button>
          </div>

          <p class="admin__hint">Подходит для записи крео: нажал — готово.</p>
        </div>
      </div>
    `;

    document.body.appendChild(wrap);

    $("admin-close").onclick = () => wrap.classList.add("hidden");
    wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.classList.add("hidden"); });

    $("admin-title-gen").onclick = () => $("admin-title").value = genTitle();
    $("admin-code-gen").onclick = () => $("admin-code").value = genPromoCode(10);

    $("admin-save").onclick = () => {
      const title = safeText($("admin-title").value).trim();
      const code = safeText($("admin-code").value).trim();
      const expires = safeText($("admin-expires").value).trim() || "∞";

      if (!title) return tgAlert("Сгенерируйте или введите название.");
      if (!code) return tgAlert("Сгенерируйте или введите промокод.");

      state.offer = { title, code, expires_at: expires, icon: "📌" };
      persistState();
      wrap.classList.add("hidden");
      tgAlert("Сохранено. Теперь нажми «Получить предложение дня».");
      updateUI();
    };

    $("admin-clear").onclick = () => {
      state.offer = null;
      persistState();
      tgAlert("Очищено.");
      updateUI();
    };
  }

  function openAdminModal() {
    ensureAdminModal();
    $("admin-title").value = state.offer?.title || genTitle();
    $("admin-code").value = state.offer?.code || genPromoCode(10);
    $("admin-expires").value = state.offer?.expires_at || "∞";
    $("admin-modal").classList.remove("hidden");
  }

  /* -----------------------
     UI
  ------------------------ */
  function updateUI() {
    $("user-name").innerText = state.username;
    $("spins-display").innerHTML = `ДОСТУПНО ПРЕДЛОЖЕНИЙ: <b>${state.spins}</b>`;

    const btnCont = $("btn-container");
    btnCont.innerHTML = "";

    const getBtn = document.createElement("button");
    getBtn.className = "btn";
    getBtn.type = "button";
    getBtn.innerText = "ПОЛУЧИТЬ ПРЕДЛОЖЕНИЕ";
    getBtn.onclick = handleGetOffer;
    btnCont.appendChild(getBtn);

    const add1 = document.createElement("button");
    add1.className = "btn btn--secondary";
    add1.type = "button";
    add1.innerText = "ДОКУПИТЬ +1";
    add1.onclick = () => { state.spins += 1; persistState(); updateUI(); };
    btnCont.appendChild(add1);

    const add10 = document.createElement("button");
    add10.className = "btn btn--secondary";
    add10.type = "button";
    add10.innerText = "ДОКУПИТЬ +10";
    add10.onclick = () => { state.spins += 10; persistState(); updateUI(); };
    btnCont.appendChild(add10);

    // history
    const historyList = $("history-list");
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
        row.innerHTML = `
          <div class="history-item__left">
            <div class="history-item__title">${item.title}</div>
            <div class="history-item__meta">${item.expires_at && item.expires_at !== "∞" ? "до " + item.expires_at : "без срока"}</div>
          </div>
        `;
        const open = document.createElement("button");
        open.className = "btn btn--small";
        open.type = "button";
        open.innerText = "ОТКРЫТЬ";
        open.onclick = () => openOfferModal(item);
        row.appendChild(open);
        historyList.appendChild(row);
      });
    }
  }

  async function handleGetOffer() {
    if (wheel.spinning) return;

    if (state.spins <= 0) {
      openOfferModal({ _mode: "info", message: "Нет доступных предложений. Нажми «докупить» (DEMO)." });
      return;
    }
    if (!state.offer) {
      openOfferModal({ _mode: "info", message: "Сначала создай предложение: нажми на скрытую кнопку над именем." });
      return;
    }

    // крутим колесо и показываем результат после остановки
    const key = `${state.offer.title}|${state.offer.code}|${state.offer.expires_at}`;
    const idx = hashToIndex(key);

    state.spins -= 1;

    await spinToIndex(idx);

    const offer = { ...state.offer };
    state.history.push(offer);
    persistState();
    updateUI();
    openOfferModal(offer);
  }

  /* -----------------------
     Init
  ------------------------ */
  document.addEventListener("DOMContentLoaded", () => {
    loadState();

    // wheel init
    wheel.canvas = $("wheel-canvas");
    wheel.ctx = resizeCanvasForDPR(wheel.canvas);
    drawWheel();
    window.addEventListener("resize", () => {
      wheel.ctx = resizeCanvasForDPR(wheel.canvas);
      drawWheel();
    });

    $("to-profile")?.addEventListener("click", () => showScreen("profile"));
    $("back-to-main")?.addEventListener("click", () => showScreen("main"));

    $("close-modal")?.addEventListener("click", () => $("prize-modal").classList.add("hidden"));
    $("prize-modal")?.addEventListener("click", (e) => { if (e.target === $("prize-modal")) $("prize-modal").classList.add("hidden"); });

    $("admin-trigger")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openAdminModal();
    });

    updateUI();
  });
})();


