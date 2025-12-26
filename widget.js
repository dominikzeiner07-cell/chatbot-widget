(() => {
  // --- 1) Script-Base (damit wir style.css von derselben GitHub-Pages URL laden können)
  const currentScript = document.currentScript;
  const scriptSrc = currentScript?.src || "";
  const base = scriptSrc ? scriptSrc.split("/").slice(0, -1).join("/") : "";

  // --- 2) CSS einhängen (nur einmal)
  if (base && !document.querySelector('link[data-cw-style="1"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${base}/style.css`;
    link.setAttribute("data-cw-style", "1");
    document.head.appendChild(link);
  }

  // --- 3) HTML einfügen (nur einmal)
  if (!document.getElementById("cw-launcher-wrap")) {
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div id="cw-launcher-wrap">
        <div id="cw-greeting">
          <span class="cw-greeting-text"></span>
          <button class="cw-greeting-close" type="button">×</button>
        </div>

        <button id="cw-launcher" type="button" aria-label="Chat öffnen"></button>

        <div id="cw-window" class="cw-hidden">
          <div id="cw-header" class="cw-header">
            <div id="cw-title" class="cw-title">Support</div>
            <button id="cw-close" type="button" aria-label="Chat schließen">×</button>
          </div>

          <div id="cw-body"></div>

          <form id="cw-form">
            <input id="cw-input" type="text" placeholder="Schreib eine Nachricht…" autocomplete="off" />
            <button id="cw-send" type="submit">Senden</button>
          </form>
        </div>
      </div>
    `.trim();
    document.body.appendChild(wrap);
  }

  // --- 4) AB HIER: dein bisheriger script.js Code (leicht angepasst, damit er erst NACH dem Inject läuft)

  // ELEMENTE REFERENZIEREN -----------------------------------------
  const launcherWrap = document.getElementById("cw-launcher-wrap");
  const greetingEl = document.getElementById("cw-greeting");
  const greetingCloseBtn = greetingEl?.querySelector(".cw-greeting-close");

  const launcherBtn = document.getElementById("cw-launcher");
  const chatWindow = document.getElementById("cw-window");
  const closeBtn = document.getElementById("cw-close");

  const bodyEl = document.getElementById("cw-body");
  const formEl = document.getElementById("cw-form");
  const inputEl = document.getElementById("cw-input");
  const sendBtn = document.getElementById("cw-send");

  // KONFIG ----------------------------------------------------------
  const API_BASE =
    window.CHATBOT_API_BASE ||
    (window.CHATBOT_CONFIG && window.CHATBOT_CONFIG.apiBase) ||
    "http://localhost:5051";

  const API_BASE_CLEAN = API_BASE.replace(/\/+$/, "");

  const ASK_URL = API_BASE_CLEAN.endsWith("/ask") ? API_BASE_CLEAN : `${API_BASE_CLEAN}/ask`;
  const CONFIG_URL = `${API_BASE_CLEAN}/widget/config`;

  const WIDGET_KEY =
    window.CHATBOT_WIDGET_KEY ||
    (window.CHATBOT_CONFIG && window.CHATBOT_CONFIG.widgetKey) ||
    "";

  const widgetState = {
    settings: {
      bot_name: null,
      user_label: "DU",
      greeting_text: null,
      first_message: "Hallo! Wie kann ich helfen?",
      header_color: null,
      accent_color: null,
      text_color_mode: "auto",
      avatar_url: null,
    },
    configLoaded: false,
  };

  function normalizeHexColor(c) {
    const s = String(c || "").trim();
    if (!s) return null;
    if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
    if (/^#[0-9a-fA-F]{3}$/.test(s)) {
      return "#" + s.slice(1).split("").map((ch) => ch + ch).join("");
    }
    return null;
  }

  function hexToRgb(hex) {
    const h = normalizeHexColor(hex);
    if (!h) return null;
    const v = h.slice(1);
    return {
      r: parseInt(v.slice(0, 2), 16),
      g: parseInt(v.slice(2, 4), 16),
      b: parseInt(v.slice(4, 6), 16),
    };
  }

  function luminance({ r, g, b }) {
    const srgb = [r, g, b]
      .map((v) => v / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  }

  function pickTextColorMode(headerHex, mode) {
    const m = String(mode || "auto").toLowerCase();
    if (m === "light" || m === "dark") return m;
    const rgb = hexToRgb(headerHex);
    if (!rgb) return "dark";
    return luminance(rgb) < 0.42 ? "light" : "dark";
  }

  function findHeaderEl() {
    return document.getElementById("cw-header") || document.querySelector(".cw-header") || null;
  }

  function findHeaderTitleEl() {
    return document.getElementById("cw-title") || document.querySelector(".cw-title") || null;
  }

  function findGreetingTextEl() {
    if (!greetingEl) return null;
    return greetingEl.querySelector(".cw-greeting-text") || null;
  }

  function applyThemeColors({ header_color, accent_color, text_color_mode }) {
    const headerHex = normalizeHexColor(header_color);
    const accentHex = normalizeHexColor(accent_color);

    const headerEl = findHeaderEl();
    const resolvedTextMode = pickTextColorMode(headerHex, text_color_mode);

    if (headerEl && headerHex) headerEl.style.backgroundColor = headerHex;

    const headerTitle = findHeaderTitleEl();
    const headerTextColor = resolvedTextMode === "light" ? "#ffffff" : "#111827";

    if (headerTitle) headerTitle.style.color = headerTextColor;
    if (closeBtn) closeBtn.style.color = headerTextColor;

    if (accentHex) {
      if (launcherBtn) launcherBtn.style.backgroundColor = accentHex;
      if (sendBtn) sendBtn.style.backgroundColor = accentHex;
    }

    if (headerHex) document.documentElement.style.setProperty("--cw-header-color", headerHex);
    if (accentHex) document.documentElement.style.setProperty("--cw-accent-color", accentHex);
    document.documentElement.style.setProperty("--cw-header-text-color", headerTextColor);
  }

  function normalizeIncomingSettings(obj) {
    if (!obj || typeof obj !== "object") return null;
    const pick = (keys) => {
      for (const k of keys) if (typeof obj[k] !== "undefined" && obj[k] !== null) return obj[k];
      return undefined;
    };
    return {
      bot_name: pick(["bot_name", "botName", "name"]),
      user_label: pick(["user_label", "userLabel"]),
      greeting_text: pick(["greeting_text", "launcherText", "launcher_text"]),
      first_message: pick(["first_message", "botGreeting", "bot_greeting"]),
      header_color: pick(["header_color", "headerBg", "header_bg"]),
      accent_color: pick(["accent_color", "accent"]),
      text_color_mode: pick(["text_color_mode", "textColorMode"]),
      avatar_url: pick(["avatar_url", "botAvatarUrl", "bot_avatar_url"]),
    };
  }

  function mergeSettings(base, incoming) {
    const out = { ...base };
    if (!incoming || typeof incoming !== "object") return out;
    const keys = ["bot_name","user_label","greeting_text","first_message","header_color","accent_color","text_color_mode","avatar_url"];
    for (const k of keys) {
      if (typeof incoming[k] !== "undefined" && incoming[k] !== null) out[k] = incoming[k];
    }
    return out;
  }

  function createMessageRow({ sender, text }) {
    const row = document.createElement("div");
    row.className = "cw-row";
    if (sender === "user") row.classList.add("cw-row-user");

    const avatar = document.createElement("div");
    avatar.className = "cw-avatar";

    if (sender === "user") {
      avatar.classList.add("cw-avatar-user");
      avatar.textContent = widgetState.settings.user_label || "DU";
    } else {
      const url = String(widgetState.settings.avatar_url || "").trim();
      if (url) {
        avatar.textContent = "";
        avatar.style.backgroundImage = `url("${url}")`;
        avatar.style.backgroundSize = "cover";
        avatar.style.backgroundPosition = "center";
        avatar.style.backgroundRepeat = "no-repeat";
      } else {
        avatar.textContent = "AI";
      }
    }

    const bubble = document.createElement("div");
    bubble.className = "cw-msg";
    bubble.textContent = text;

    row.appendChild(avatar);
    row.appendChild(bubble);
    return row;
  }

  function appendMessage(sender, text) {
    const row = createMessageRow({ sender, text });
    bodyEl.appendChild(row);
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  let typingEl = null;
  function showTypingIndicator() {
    if (typingEl) return;

    const row = document.createElement("div");
    row.className = "cw-typing-row";

    const avatar = document.createElement("div");
    avatar.className = "cw-avatar";

    const url = String(widgetState.settings.avatar_url || "").trim();
    if (url) {
      avatar.textContent = "";
      avatar.style.backgroundImage = `url("${url}")`;
      avatar.style.backgroundSize = "cover";
      avatar.style.backgroundPosition = "center";
      avatar.style.backgroundRepeat = "no-repeat";
    } else {
      avatar.textContent = "AI";
    }

    const bubble = document.createElement("div");
    bubble.className = "cw-typing-bubble";

    const dotsWrapper = document.createElement("div");
    dotsWrapper.className = "cw-dots";

    for (let i = 0; i < 3; i++) {
      const dot = document.createElement("div");
      dot.className = "cw-dot";
      dotsWrapper.appendChild(dot);
    }

    bubble.appendChild(dotsWrapper);
    row.appendChild(avatar);
    row.appendChild(bubble);

    typingEl = row;
    bodyEl.appendChild(row);
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function hideTypingIndicator() {
    if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
    typingEl = null;
  }

  async function fetchBotReply(userText) {
    try {
      const headers = { "Content-Type": "application/json" };
      if (WIDGET_KEY) headers["X-Widget-Key"] = WIDGET_KEY;

      const res = await fetch(ASK_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({ message: userText, widget_key: WIDGET_KEY || undefined }),
      });

      if (!res.ok) {
        if (res.status === 401) return "Auth-Fehler – Widget-Key prüfen.";
        if (res.status === 429) return "Zu viele Anfragen / Rate-Limit.";
        let fallback = `Serverfehler (${res.status}).`;
        try {
          const errData = await res.json();
          if (errData && (errData.error || errData.message)) fallback = errData.message || errData.error;
        } catch {}
        return fallback;
      }

      const data = await res.json();
      return data.reply || (data.error ? "Fehler: " + data.error : "Keine Antwort erhalten.");
    } catch (err) {
      console.error("Fetch-/Netzwerkfehler:", err);
      return "Netzwerkfehler – bitte später erneut versuchen.";
    }
  }

  async function fetchWidgetConfig() {
    if (!WIDGET_KEY) return null;
    const headers = { "X-Widget-Key": WIDGET_KEY };

    try {
      const res = await fetch(`${CONFIG_URL}?widget_key=${encodeURIComponent(WIDGET_KEY)}`, { method: "GET", headers });
      if (!res.ok) return null;

      const data = await res.json();
      if (!data || data.ok !== true) return null;

      return data.widget_settings || data.settings || null;
    } catch {
      return null;
    }
  }

  function applyWidgetSettings(settings) {
    const normalized = normalizeIncomingSettings(settings) || settings;
    widgetState.settings = mergeSettings(widgetState.settings, normalized);

    const titleEl = findHeaderTitleEl();
    const botName = String(widgetState.settings.bot_name || "").trim();
    if (titleEl && botName) titleEl.textContent = botName;

    const greetTextEl = findGreetingTextEl();
    const greetText = String(widgetState.settings.greeting_text || "").trim();
    if (greetTextEl && greetText) greetTextEl.textContent = greetText;

    applyThemeColors(widgetState.settings);
  }

  launcherBtn?.addEventListener("click", () => {
    const isHidden = chatWindow.classList.contains("cw-hidden");
    if (isHidden) {
      chatWindow.classList.remove("cw-hidden");
      if (greetingEl) greetingEl.style.display = "none";
    } else {
      chatWindow.classList.add("cw-hidden");
    }
  });

  closeBtn?.addEventListener("click", () => {
    chatWindow.classList.add("cw-hidden");
  });

  greetingCloseBtn?.addEventListener("click", () => {
    if (greetingEl) greetingEl.style.display = "none";
  });

  setTimeout(() => {
    if (!greetingEl) return;
    if (greetingEl.style.display !== "none") greetingEl.style.display = "none";
  }, 8000);

  formEl?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userText = inputEl.value.trim();
    if (!userText) return;

    if (!WIDGET_KEY) {
      appendMessage("bot", "Widget-Key fehlt. Bitte im Snippet setzen (CHATBOT_WIDGET_KEY).");
      return;
    }

    appendMessage("user", userText);
    inputEl.value = "";
    inputEl.focus();

    showTypingIndicator();
    const replyText = await fetchBotReply(userText);
    hideTypingIndicator();
    appendMessage("bot", replyText);
  });

  (async function initWidget() {
    if (!WIDGET_KEY) {
      appendMessage("bot", "Widget-Key fehlt. Bitte im Snippet setzen (CHATBOT_WIDGET_KEY).");
      return;
    }

    const cfg = await fetchWidgetConfig();
    if (cfg) applyWidgetSettings(cfg);

    widgetState.configLoaded = true;
    const first = String(widgetState.settings.first_message || "").trim() || "Hallo! Wie kann ich helfen?";
    appendMessage("bot", first);
  })();
})();