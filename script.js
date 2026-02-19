/* =========================
   BonusFera WebApp script.js
   - Stable init
   - Platega payments (redirect)
   - Offers modal
========================= */

(function () {
  const tg = window.Telegram?.WebApp;
  if (!tg) {
    console.warn("Telegram WebApp API not found");
  } else {
    tg.expand();
  }

  /* -----------------------
     Helpers
  ------------------------ */
  const $ = (id) => document.getElementById(id);

  function showScreen(name) {
    document.querySelectorAll(".screen").forEach((el) => el.classList.add("hidden"));
    const target = $(`${name}-screen`);
    if (target) target.classList.remove("hidden");
  }

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

  function buildValidityText(offer) {
    if (offer && offer.expired) return "Срок действия истёк";

    // back-compat: expires_at или valid_until
    const expires = offer?.expires_at || offer?.valid_until;

    if (expires === null || expires === undefined || expires === "∞") return "Без срока действия";

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

  function makeButton(label, classes, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = classes;
    btn.innerText = label;
    btn.addEventListener("click", onClick);
    return btn;
  }

  function tgAlert(text) {
    if (tg?.showAlert) tg.showAlert(text);
    else alert(text);
  }

  function openLink(url) {
    if (!url) return;
    if (tg?.openLink) tg.openLink(url);
    else window.location.href = url;
  }

  function getInitData() {
    // tg.initData может быть пустым при открытии вне Telegram
    return tg?.initData || "";
  }

  async function apiPost(path, payload) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      // если вернулось не json
      data = { error: "bad_json" };
    }

    return { ok: res.ok, status: res.status, data };
  }

  /* -----------------------
     UI render
  ------------------------ */
  function updateUI(data) {
    const userNameEl = $("user-name");
    if (userNameEl) userNameEl.innerText = (data.username || "Пользователь").toUpperCase();

    const spinsDisplay = $("spins-display");
    if (spinsDisplay) spinsDisplay.innerHTML = `ДОСТУПНО ПРЕДЛОЖЕНИЙ: <b>${data.spins || 0}</b>`;

    const btnCont = $("btn-container");
    if (btnCont) {
      btnCont.innerHTML = "";

      if (!data.sub_active) {
        btnCont.appendChild(makeButton("ОФОРМИТЬ ДОСТУП (100 ₽)", "btn", () => startPayment("access")));
      } else {
        btnCont.appendChild(makeButton("ПОЛУЧИТЬ ПРЕДЛОЖЕНИЕ ДНЯ", "btn", handleGetOffer));
        btnCont.appendChild(
          makeButton("ДОКУПИТЬ +1 ПРЕДЛОЖЕНИЕ (25 ₽)", "btn btn--secondary", () => startPayment("single"))
        );
        btnCont.appendChild(
          makeButton("ДОКУПИТЬ +10 ПРЕДЛОЖЕНИЙ (200 ₽)", "btn btn--secondary", () => startPayment("pack_10"))
        );
      }
    }

    const historyList = $("history-list");
    if (historyList) {
      historyList.innerHTML = "";

      if (Array.isArray(data.history) && data.history.length > 0) {
        data.history.forEach((item) => {
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
            const expires = item.expires_at || item.valid_until || item.active_until;
            if (expires) {
              const d = parseISO(expires);
              meta.innerText = d ? `до ${formatDateTimeRU(d)} (МСК)` : "без срока действия";
            } else {
              meta.innerText = "без срока действия";
            }
          }

          left.appendChild(title);
          left.appendChild(meta);

          const openBtn = makeButton("ОТКРЫТЬ", "btn btn--small", () => openOfferModal(item));

          row.appendChild(left);
          row.appendChild(openBtn);
          historyList.appendChild(row);
        });
      } else {
        const empty = document.createElement("div");
        empty.className = "history-item";
        empty.innerHTML = `<div class="history-item__left">
          <div class="history-item__title">История пока пуста</div>
          <div class="history-item__meta">Получите предложение — и оно появится здесь</div>
        </div>`;
        historyList.appendChild(empty);
      }
    }
  }

  /* -----------------------
     Modal
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

    // Истёкшее из истории
    if (offer && offer.expired) {
      modalTitle.innerText = "ИНФОРМАЦИЯ";
      modalIcon.innerText = "ℹ️";
      offerName.innerText = "Срок действия истёк";
      validityEl.innerText =
        "Это предложение больше не актуально. Мы покажем новые актуальные предложения, как только они появятся.";
      codeWrapper.classList.add("hidden");
      actionBtn.innerText = "ПОНЯТНО";
      actionBtn.onclick = close;
      modal.classList.remove("hidden");
      return;
    }

    // Инфо режим
    if (offer && offer._mode === "info") {
      modalTitle.innerText = "ИНФОРМАЦИЯ";
      modalIcon.innerText = "ℹ️";
      offerName.innerText = safeText(offer.message || "Информация недоступна.");
      validityEl.innerText = "";
      codeWrapper.classList.add("hidden");
      actionBtn.innerText = "ПОНЯТНО";
      actionBtn.onclick = close;
      modal.classList.remove("hidden");
      return;
    }

    // Нормальное предложение
    modalTitle.innerText = "ВАШЕ ПРЕДЛОЖЕНИЕ";
    modalIcon.innerText = offer.icon || "📌";
    offerName.innerText = safeText(offer.title || "Предложение");
    validityEl.innerText = buildValidityText(offer);

    // Ссылка
    if (offer.link && offer.link !== "None") {
      codeWrapper.classList.add("hidden");
      actionBtn.innerText = "ОТКРЫТЬ ПРЕДЛОЖЕНИЕ";
      actionBtn.onclick = () => openLink(offer.link);
    } else {
      // Промокод
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
    }

    modal.classList.remove("hidden");
  }

  /* -----------------------
     API actions
  ------------------------ */
  async function initApp() {
    const { ok, data } = await apiPost("/api/init", { initData: getInitData() });
    if (!ok || data?.error) {
      tgAlert("Не удалось загрузить данные. Перезайдите в приложение.");
      return;
    }
    updateUI(data);
  }

  async function handleGetOffer() {
    const { ok, data } = await apiPost("/api/spin", { initData: getInitData() });

    if (!ok) {
      tgAlert("Ошибка сервера. Попробуйте позже.");
      return;
    }

    if (data?.error === "empty") {
      tgAlert(
        data.message ||
          "Сейчас нет доступных предложений. Дождитесь начисления (после 08:00 МСК) или приобретите дополнительные."
      );
      return;
    }

    if (data?.error === "no_prizes_left") {
      openOfferModal({
        _mode: "info",
        message: data.message || "На данный момент все предложения уже просмотрены. Скоро добавим новые — загляните позже!",
      });
      return;
    }

    openOfferModal(data);
    await initApp();
  }

  async function startPayment(type) {
    // UI блокировка кнопок на время запроса
    const btnCont = $("btn-container");
    const oldHTML = btnCont ? btnCont.innerHTML : null;
    if (btnCont) btnCont.innerHTML = `<button class="btn" disabled>СОЗДАЁМ ОПЛАТУ...</button>`;

    try {
      const { ok, data } = await apiPost("/api/create_payment", { initData: getInitData(), pay_type: type });

      if (!ok) {
        tgAlert("Не удалось создать оплату. Попробуйте позже.");
        return;
      }

      if (data?.error) {
        tgAlert(data.error === "Payment is not configured (missing env)"
          ? "Оплата временно недоступна. Попробуйте позже."
          : "Не удалось создать оплату. Попробуйте позже.");
        return;
      }

      // ТЕСТОВЫЙ режим (если когда-нибудь вернёшь)
      if (data?.test_mode) {
        tgAlert(data.message || "Готово!");
        await initApp();
        return;
      }

      // ✅ Platega: главное поле — redirect
      const payUrl = data.redirect || data.confirmation_url || data.payment_url;
      if (payUrl) {
        openLink(payUrl);
        return;
      }

      tgAlert("Не удалось создать оплату. Попробуйте позже.");
    } finally {
      if (btnCont && oldHTML !== null) {
        // восстановим кнопки по актуальным данным
        await initApp();
      }
    }
  }

  /* -----------------------
     Init DOM events
  ------------------------ */
  document.addEventListener("DOMContentLoaded", async () => {
    await initApp();

    const closeBtn = $("close-modal");
    if (closeBtn) closeBtn.onclick = () => $("prize-modal")?.classList.add("hidden");

    const toProfile = $("to-profile");
    if (toProfile) toProfile.onclick = () => showScreen("profile");

    const backToMain = $("back-to-main");
    if (backToMain) backToMain.onclick = () => showScreen("main");

    const modal = $("prize-modal");
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.classList.add("hidden");
      });
    }
  });
})();
