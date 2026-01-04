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

const backdropEl = document.getElementById("cw-backdrop");

// Header Avatar
const headerAvatarImg = document.getElementById("cw-avatar-img");
const headerAvatarFallback = document.getElementById("cw-avatar-fallback");

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

// ---------------------------
// Widget State (Config)
// ---------------------------
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

// ----------------------------------------------------------
// MOBILE / KEYBOARD VAR (nur --cw-kb, minimal, ohne Fullscreen-Layout)
// ----------------------------------------------------------
const root = document.documentElement;

function setCssVar(name, value) {
  try {
    root.style.setProperty(name, value);
  } catch (_) {}
}

function isChatOpen() {
  return chatWindow && !chatWindow.classList.contains("cw-hidden");
}

// Mobile detection für Modal-Lock (Handy/Tablet Touch)
function isMobileModalTarget() {
  const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  const small =
    window.matchMedia &&
    (window.matchMedia("(max-width: 820px)").matches ||
      window.matchMedia("(max-height: 900px)").matches);
  return !!(coarse && small);
}

function updateKeyboardVar() {
  const vv = window.visualViewport;
  let kb = 0;

  if (vv) {
    kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  }

  setCssVar("--cw-kb", isChatOpen() ? `${kb}px` : "0px");
}

(function initKeyboardVar() {
  updateKeyboardVar();

  const vv = window.visualViewport;
  if (vv) {
    vv.addEventListener("resize", updateKeyboardVar, { passive: true });
  }
  window.addEventListener("resize", updateKeyboardVar, { passive: true });
  window.addEventListener("orientationchange", () => setTimeout(updateKeyboardVar, 80));
})();

// ----------------------------------------------------------
// MODAL MODE (Mobile): Backdrop + Website "tot"
// -> Website dahinter sperren wir im Parent (widget.js)
//    per postMessage, wenn open/close passiert.
// ----------------------------------------------------------
function notifyParentModal(open) {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "CW_MODAL", open: !!open }, "*");
    }
  } catch (_) {}
}

function setModalOpen(open) {
  // Parent informieren (Host sperrt dann Scroll auf Mobile)
  notifyParentModal(open);

  // Backdrop/Modal-Class nur auf Mobile innerhalb des iframes
  if (!isMobileModalTarget()) {
    updateKeyboardVar();
    return;
  }

  document.documentElement.classList.toggle("cw-modal-open", open);

  if (backdropEl) {
    if (open) backdropEl.classList.remove("cw-hidden");
    else backdropEl.classList.add("cw-hidden");
  }

  updateKeyboardVar();
  // kleine Stabilisierung gegen Jank
  requestAnimationFrame(updateKeyboardVar);
  requestAnimationFrame(updateKeyboardVar);
}

// Backdrop click = schließen
backdropEl?.addEventListener("click", () => {
  chatWindow?.classList.add("cw-hidden");
  setModalOpen(false);
});

// ----------------------------------------------------------
// READY-GATING (gegen Flash)
// ----------------------------------------------------------
const READY_FALLBACK_MS = 1200;
let readyTimer = null;

function setWidgetReady() {
  if (launcherWrap) launcherWrap.classList.add("cw-ready");
}

function forceInitialHiddenState() {
  if (launcherWrap) launcherWrap.classList.remove("cw-ready");
  if (greetingEl) greetingEl.style.display = "none";
}

forceInitialHiddenState();

// ----------------------------------------------------------
// Greeting Auto-Hide
// ----------------------------------------------------------
let greetingAutoHideTimer = null;

function scheduleGreetingAutoHide() {
  if (!greetingEl) return;
  if (greetingAutoHideTimer) clearTimeout(greetingAutoHideTimer);
  greetingAutoHideTimer = setTimeout(() => {
    if (greetingEl) greetingEl.style.display = "none";
  }, 8000);
}

// HILFSFUNKTIONEN -------------------------------------------------
function normalizeHexColor(c) {
  const s = String(c || "").trim();
  if (!s) return null;
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    return "#" + s
      .slice(1)
      .split("")
      .map((ch) => ch + ch)
      .join("");
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

// Header / Greeting Finder
function findHeaderEl() {
  return (
    document.getElementById("cw-header") ||
    document.querySelector(".cw-header") ||
    document.querySelector("[data-cw-header]") ||
    null
  );
}

function findHeaderTitleEl() {
  const direct =
    document.getElementById("cw-title") ||
    document.querySelector(".cw-title") ||
    document.querySelector("[data-cw-title]") ||
    document.querySelector(".cw-header-title") ||
    null;
  if (direct) return direct;

  const header = findHeaderEl();
  if (!header) return null;

  return (
    header.querySelector("#cw-title") ||
    header.querySelector(".cw-title") ||
    header.querySelector(".cw-header-title") ||
    header.querySelector("[data-cw-title]") ||
    header.querySelector("h1,h2,h3,h4") ||
    null
  );
}

function findGreetingTextEl() {
  if (!greetingEl) return null;

  const candidate =
    greetingEl.querySelector(".cw-greeting-text") ||
    greetingEl.querySelector(".cw-greeting-content") ||
    greetingEl.querySelector("[data-cw-greeting-text]") ||
    null;

  if (candidate) return candidate;

  const existingSpan = greetingEl.querySelector("[data-cw-greeting-text-generated]");
  if (existingSpan) return existingSpan;

  const span = document.createElement("span");
  span.setAttribute("data-cw-greeting-text-generated", "1");

  if (greetingCloseBtn && greetingCloseBtn.parentElement === greetingEl) {
    greetingEl.insertBefore(span, greetingCloseBtn);
  } else {
    greetingEl.appendChild(span);
  }

  return span;
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
}

// Header-Avatar anwenden
function applyHeaderAvatar(url) {
  const u = String(url || "").trim();

  if (headerAvatarImg && u) {
    headerAvatarImg.src = u;
    headerAvatarImg.style.display = "block";
    if (headerAvatarFallback) headerAvatarFallback.style.display = "none";
    return;
  }

  if (headerAvatarImg) {
    headerAvatarImg.removeAttribute("src");
    headerAvatarImg.style.display = "none";
  }
  if (headerAvatarFallback) headerAvatarFallback.style.display = "flex";
}

// Mappt alte/alternative Keys
function normalizeIncomingSettings(incoming) {
  if (!incoming || typeof incoming !== "object") return null;
  const obj = incoming;

  const pick = (keys) => {
    for (const k of keys) {
      if (typeof obj[k] !== "undefined" && obj[k] !== null) return obj[k];
    }
    return undefined;
  };

  return {
    bot_name: pick(["bot_name", "botName", "name", "bot_name_display"]),
    user_label: pick(["user_label", "userLabel"]),
    greeting_text: pick(["greeting_text", "launcherText", "launcher_text", "greetingText"]),
    first_message: pick(["first_message", "botGreeting", "bot_greeting", "firstMessage"]),
    header_color: pick(["header_color", "headerBg", "header_bg", "widget_header_bg", "widget_header_color"]),
    accent_color: pick(["accent_color", "accent", "widget_accent", "widget_accent_color"]),
    text_color_mode: pick(["text_color_mode", "textColorMode"]),
    avatar_url: pick(["avatar_url", "botAvatarUrl", "bot_avatar_url"]),
  };
}

function mergeSettings(base, incoming) {
  const out = { ...base };
  if (!incoming || typeof incoming !== "object") return out;

  const keys = [
    "bot_name",
    "user_label",
    "greeting_text",
    "first_message",
    "header_color",
    "accent_color",
    "text_color_mode",
    "avatar_url",
  ];
  for (const k of keys) {
    if (typeof incoming[k] !== "undefined" && incoming[k] !== null) out[k] = incoming[k];
  }
  return out;
}

// Baut eine Chat-Zeile (User oder Bot)
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
      avatar.textContent = "◉";
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

// ----------------------------------------------------------
// TYPING INDICATOR
// ----------------------------------------------------------
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
    avatar.textContent = "◉";
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

// ----------------------------------------------------------
// BACKEND CALL – /ask mit widget_key
// ----------------------------------------------------------
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
      } catch (_) {}
      return fallback;
    }

    const data = await res.json();
    if (data.reply) return data.reply;
    if (data.error) return "Fehler: " + data.error;
    return "Keine Antwort erhalten.";
  } catch (err) {
    console.error("Fetch-/Netzwerkfehler:", err);
    return "Netzwerkfehler – bitte später erneut versuchen.";
  }
}

// ----------------------------------------------------------
// Widget Config laden + anwenden
// ----------------------------------------------------------
async function fetchWidgetConfig() {
  if (!WIDGET_KEY) return null;

  const headers = { "X-Widget-Key": WIDGET_KEY };

  try {
    const res = await fetch(`${CONFIG_URL}?widget_key=${encodeURIComponent(WIDGET_KEY)}`, {
      method: "GET",
      headers,
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!data || data.ok !== true) return null;

    return data.widget_settings || data.settings || null;
  } catch (_) {
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
  if (greetTextEl) greetTextEl.textContent = greetText;

  if (greetingEl) {
    if (greetText) {
      greetingEl.style.display = "flex";
      scheduleGreetingAutoHide();
    } else {
      greetingEl.style.display = "none";
    }
  }

  applyHeaderAvatar(widgetState.settings.avatar_url);
  applyThemeColors(widgetState.settings);
}

// ----------------------------------------------------------
// Input hardening
// ----------------------------------------------------------
(function hardenInput() {
  if (!inputEl) return;
  inputEl.setAttribute("autocomplete", "off");
  inputEl.setAttribute("autocorrect", "off");
  inputEl.setAttribute("autocapitalize", "none");
  inputEl.setAttribute("spellcheck", "false");
  inputEl.setAttribute("inputmode", "text");
  inputEl.setAttribute("enterkeyhint", "send");
})();

// UI-AKTIONEN -----------------------------------------------------
launcherBtn?.addEventListener("click", () => {
  const isHidden = chatWindow.classList.contains("cw-hidden");
  if (isHidden) {
    chatWindow.classList.remove("cw-hidden");
    if (greetingEl) greetingEl.style.display = "none";
    setModalOpen(true);
  } else {
    chatWindow.classList.add("cw-hidden");
    setModalOpen(false);
  }
});

closeBtn?.addEventListener("click", () => {
  chatWindow.classList.add("cw-hidden");
  setModalOpen(false);
});

greetingCloseBtn?.addEventListener("click", () => {
  if (greetingEl) greetingEl.style.display = "none";
});

// Nachricht absenden ----------------------------------------------
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

  // Keyboard schließen beim Senden (wichtiges Upgrade)
  const isCoarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  if (isCoarse) inputEl.blur();
  else inputEl.focus();

  showTypingIndicator();
  updateKeyboardVar();

  let replyText;
  try {
    replyText = await fetchBotReply(userText);
  } catch (_) {
    replyText = "Es gab ein Problem bei der Antwort.";
  }

  hideTypingIndicator();
  appendMessage("bot", replyText);

  setTimeout(() => {
    if (bodyEl) bodyEl.scrollTop = bodyEl.scrollHeight;
    updateKeyboardVar();
  }, 0);
});

// ----------------------------------------------------------
// INIT
// ----------------------------------------------------------
(async function initWidget() {
  if (!WIDGET_KEY) {
    setWidgetReady();
    appendMessage("bot", "Widget-Key fehlt. Bitte im Snippet setzen (CHATBOT_WIDGET_KEY).");
    return;
  }

  readyTimer = setTimeout(() => setWidgetReady(), READY_FALLBACK_MS);

  const cfg = await fetchWidgetConfig();
  if (cfg) {
    applyWidgetSettings(cfg);
  } else {
    applyHeaderAvatar(null);
    if (greetingEl) greetingEl.style.display = "none";
  }

  widgetState.configLoaded = true;

  if (readyTimer) clearTimeout(readyTimer);
  setWidgetReady();

  const first = String(widgetState.settings.first_message || "").trim() || "Hallo! Wie kann ich helfen?";
  appendMessage("bot", first);

  updateKeyboardVar();
})();