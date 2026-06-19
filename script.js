// ELEMENTE REFERENZIEREN -----------------------------------------
const launcherWrap = document.getElementById("cw-launcher-wrap");
const greetingEl = document.getElementById("cw-greeting");
const greetingCloseBtn = greetingEl?.querySelector(".cw-greeting-close");

const launcherBtn = document.getElementById("cw-launcher");
const chatWindow = document.getElementById("cw-window");
const closeBtn = document.getElementById("cw-close");

let bodyEl = document.getElementById("cw-body"); // kann beim Start noch null sein
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
    theme_mode: "light",
    avatar_url: null,

    // Legal (privacy only)
    privacy_url: null,
  },
  configLoaded: false,
};

// ----------------------------------------------------------
// LEGAL HINWEIS (immer anzeigen; Link nur wenn privacy_url da)
// ----------------------------------------------------------
function isHttpUrlStr(u) {
  try {
    const url = new URL(String(u || ""));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
}

// Wenn bodyEl noch nicht da ist, merken wir uns, dass wir später einfügen müssen
let legalHintPending = false;

function getBodyEl() {
  if (bodyEl) return bodyEl;
  bodyEl = document.getElementById("cw-body");
  return bodyEl;
}

function ensureLegalHint() {
  const b = getBodyEl();
  if (!b) {
    legalHintPending = true;
    return;
  }

  let el = document.getElementById("cw-legal-hint");
  if (!el) {
    el = document.createElement("div");
    el.id = "cw-legal-hint";
    el.className = "cw-legal-hint";
    b.insertBefore(el, b.firstChild);
  }

  const privacy = String(widgetState?.settings?.privacy_url || "").trim();
  const hasLink = privacy && isHttpUrlStr(privacy);

  const line1 =
    "Um deine Anfrage zu bearbeiten und unseren Service zu verbessern, verarbeiten wir Daten im Rahmen dieses Chats.";

  const line2 = hasLink
    ? `Weitere Informationen findest du in unserer <a class="cw-legal-link" href="${privacy}" target="_blank" rel="noopener noreferrer">Datenschutzerklärung</a>.`
    : "Weitere Informationen findest du in unserer Datenschutzerklärung.";

  el.innerHTML = `${line1}<br>${line2}`;
}

// Falls ensureLegalHint zu früh kam (bodyEl noch null), fügen wir es nach DOM-Ready sicher ein
function flushPendingLegalHint() {
  if (!legalHintPending) return;
  const b = getBodyEl();
  if (!b) return;
  legalHintPending = false;
  ensureLegalHint();
}

// ----------------------------------------------------------
// MOBILE / VIEWPORT / KEYBOARD VARS
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

function isMobileModalTarget() {
  try {
    const mm = window.matchMedia ? window.matchMedia.bind(window) : null;
    const coarse = mm ? mm("(pointer: coarse)").matches : false;
    const narrow = mm ? mm("(max-width: 820px)").matches : false;

    const ua = String(window.navigator.userAgent || "");
    const mobileUa =
      /Android/i.test(ua) ||
      /iPhone|iPad|iPod/i.test(ua) ||
      /Mobile/i.test(ua);

    const touchPoints = Number(window.navigator.maxTouchPoints || 0);

    return !!(narrow && (coarse || mobileUa || touchPoints > 1));
  } catch (_) {
    return false;
  }
}

function isIosSafari() {
  const ua = String(window.navigator.userAgent || "");
  const isIphoneOrIpad = /iPhone|iPad|iPod/i.test(ua);
  const isWebkit = /WebKit/i.test(ua);
  const isCriOS = /CriOS/i.test(ua);
  const isFxiOS = /FxiOS/i.test(ua);
  const isEdgiOS = /EdgiOS/i.test(ua);
  return isIphoneOrIpad && isWebkit && !isCriOS && !isFxiOS && !isEdgiOS;
}

function updateBrowserSpecificViewportVars() {
  const safariInset = isIosSafari() ? 18 : 8;
  setCssVar("--cw-mobile-safe-gap", `${safariInset}px`);

  document.documentElement.setAttribute(
    "data-cw-mobile",
    isMobileModalTarget() ? "true" : "false"
  );
}

function getVisibleViewportHeight() {
  const vv = window.visualViewport;

  if (vv && Number.isFinite(vv.height) && vv.height > 0) {
    return Math.round(vv.height);
  }

  if (Number.isFinite(window.innerHeight) && window.innerHeight > 0) {
    return Math.round(window.innerHeight);
  }

  if (document.documentElement && Number.isFinite(document.documentElement.clientHeight)) {
    return Math.round(document.documentElement.clientHeight);
  }

  return 0;
}

function updateViewportVars() {
  const visibleHeight = getVisibleViewportHeight();

  if (visibleHeight > 0) {
    setCssVar("--cw-vh", `${visibleHeight}px`);
  }

  const vv = window.visualViewport;
  let kb = 0;

  if (vv && Number.isFinite(vv.height)) {
    kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
  }

  setCssVar("--cw-kb", isChatOpen() ? `${kb}px` : "0px");
  updateBrowserSpecificViewportVars();
}

(function initViewportVars() {
  updateViewportVars();

  const vv = window.visualViewport;

  if (vv) {
    vv.addEventListener("resize", updateViewportVars, { passive: true });
    vv.addEventListener("scroll", updateViewportVars, { passive: true });
  }

  window.addEventListener("resize", updateViewportVars, { passive: true });
  window.addEventListener("orientationchange", () => {
    setTimeout(updateViewportVars, 80);
    setTimeout(updateViewportVars, 220);
    setTimeout(updateViewportVars, 420);
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) updateViewportVars();
  });
})();

// ----------------------------------------------------------
// MODAL MODE
// ----------------------------------------------------------
// Größe (Breite/Höhe) der sichtbaren Bubble-Fläche im geschlossenen Zustand.
// Wird viewport-unabhängig über offsetWidth/offsetHeight gemessen (kein Feedback-
// Loop mit der iframe-Größe), damit der Host den iframe darauf schrumpfen kann.
function computeCollapsedSize() {
  const buffer = 90; // Platz für Inset zur Bildschirmkante + Schatten
  let w = 140;
  let h = 140;
  try {
    if (launcherWrap) {
      const ow = launcherWrap.offsetWidth || 0;
      const oh = launcherWrap.offsetHeight || 0;
      if (ow > 0) w = Math.ceil(ow + buffer);
      if (oh > 0) h = Math.ceil(oh + buffer);
    }
  } catch (_) {}
  return { width: w, height: h };
}

function notifyParentModal(open) {
  try {
    if (window.parent && window.parent !== window) {
      const msg = { type: "CW_MODAL", open: !!open };
      if (!open) {
        const s = computeCollapsedSize();
        msg.width = s.width;
        msg.height = s.height;
      }
      window.parent.postMessage(msg, "*");
    }
  } catch (_) {}
}

// Re-meldet die Collapsed-Größe an den Host (nur wenn der Chat zu ist),
// z.B. wenn das Greeting ein-/ausgeblendet wird und sich die Fläche ändert.
function syncCollapsedSize() {
  if (!isChatOpen()) notifyParentModal(false);
}

function setModalOpen(open) {
  notifyParentModal(open);

  if (!isMobileModalTarget()) {
    updateViewportVars();
    return;
  }

  document.documentElement.classList.toggle("cw-modal-open", open);

  if (backdropEl) {
    if (open) backdropEl.classList.remove("cw-hidden");
    else backdropEl.classList.add("cw-hidden");
  }

  updateViewportVars();
  requestAnimationFrame(updateViewportVars);
  requestAnimationFrame(updateViewportVars);
}

backdropEl?.addEventListener("click", () => {
  chatWindow?.classList.add("cw-hidden");
  setModalOpen(false);
});

// ----------------------------------------------------------
// READY-GATING
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
    syncCollapsedSize();
  }, 8000);
}

// ----------------------------------------------------------
// THEME HELPERS
// ----------------------------------------------------------
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

function applyWidgetThemeMode(themeMode) {
  const mode = String(themeMode || "light").trim().toLowerCase() === "dark"
    ? "dark"
    : "light";

  if (chatWindow) {
    chatWindow.setAttribute("data-cw-theme", mode);
  }

  if (launcherWrap) {
    launcherWrap.setAttribute("data-cw-theme", mode);
  }
}

// ----------------------------------------------------------
// SETTINGS NORMALIZATION + MERGE
// ----------------------------------------------------------
function normalizeIncomingSettings(incoming) {
  if (!incoming || typeof incoming !== "object") return null;

  const pickFrom = (source, keys) => {
    if (!source || typeof source !== "object") return undefined;
    for (const k of keys) {
      if (typeof source[k] !== "undefined" && source[k] !== null) return source[k];
    }
    return undefined;
  };

  const ws = incoming;
  const legal = (ws && typeof ws.legal === "object") ? ws.legal : null;

  const privacy =
    pickFrom(ws, ["privacy_url", "privacyUrl", "privacy_policy_url", "privacyPolicyUrl"]) ??
    pickFrom(legal, ["privacy_url", "privacyUrl", "privacy_policy_url", "privacyPolicyUrl"]) ??
    undefined;

  return {
    bot_name: pickFrom(ws, ["bot_name", "botName", "name", "bot_name_display"]),
    user_label: pickFrom(ws, ["user_label", "userLabel"]),
    greeting_text: pickFrom(ws, ["greeting_text", "launcherText", "launcher_text", "greetingText"]),
    first_message: pickFrom(ws, ["first_message", "botGreeting", "bot_greeting", "firstMessage"]),
    header_color: pickFrom(ws, ["header_color", "headerBg", "header_bg", "widget_header_bg", "widget_header_color"]),
    accent_color: pickFrom(ws, ["accent_color", "accent", "widget_accent", "widget_accent_color"]),
    text_color_mode: pickFrom(ws, ["text_color_mode", "textColorMode"]),
    theme_mode: pickFrom(ws, ["theme_mode", "themeMode"]),
    avatar_url: pickFrom(ws, ["avatar_url", "botAvatarUrl", "bot_avatar_url"]),
    privacy_url: privacy,
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
    "theme_mode",
    "avatar_url",
    "privacy_url",
  ];

  for (const k of keys) {
    if (typeof incoming[k] !== "undefined" && incoming[k] !== null) out[k] = incoming[k];
  }
  return out;
}

// ----------------------------------------------------------
// CHAT UI HELPERS
// ----------------------------------------------------------
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
  const b = getBodyEl();
  if (!b) return;
  const row = createMessageRow({ sender, text });
  b.appendChild(row);
  b.scrollTop = b.scrollHeight;
}

// ----------------------------------------------------------
// TYPING INDICATOR
// ----------------------------------------------------------
let typingEl = null;

function showTypingIndicator() {
  const b = getBodyEl();
  if (!b) return;
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
  b.appendChild(row);
  b.scrollTop = b.scrollHeight;
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
      if (res.status === 429) {
        let errData = null;
        try { errData = await res.json(); } catch (_) {}
        return errData?.message || "Zu viele Anfragen. Bitte kurz warten und dann erneut versuchen.";
      }

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

    // widget settings
    const ws = data.widget_settings || data.settings || {};
    const wsLegal = (ws && typeof ws.legal === "object") ? ws.legal : null;
    const legalTop = (data && typeof data.legal === "object") ? data.legal : null; // <--- NEU
    const customer = (data && typeof data.customer === "object") ? data.customer : null;

    const privacyCandidate =
      // 1) direkt in settings
      (ws && (ws.privacy_url || ws.privacyUrl || ws.privacy_policy_url || ws.privacyPolicyUrl)) ||
      // 2) settings.legal
      (wsLegal && (wsLegal.privacy_url || wsLegal.privacyUrl || wsLegal.privacy_policy_url || wsLegal.privacyPolicyUrl)) ||
      // 3) top-level legal (so liefert es dein Backend gerade)
      (legalTop && (legalTop.privacy_url || legalTop.privacyUrl || legalTop.privacy_policy_url || legalTop.privacyPolicyUrl)) ||
      // 4) alternative Shapes
      data.privacy_url ||
      data.privacyUrl ||
      (customer && (customer.privacy_url || customer.privacyUrl)) ||
      null;

    return {
      ...(ws && typeof ws === "object" ? ws : {}),
      ...(privacyCandidate ? { privacy_url: privacyCandidate } : {}),
    };
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

  // Greeting nur zeigen, wenn der Loader es erlaubt (Startseite, 1x/Session).
  // fail-open: nur bei explizitem false unterdrücken.
  const allowGreeting = window.CW_ALLOW_GREETING !== false;

  if (greetingEl) {
    if (greetText && allowGreeting) {
      greetingEl.style.display = "flex";
      scheduleGreetingAutoHide();
    } else {
      greetingEl.style.display = "none";
    }
  }

  // Bubble-Fläche kann sich durch das Greeting geändert haben → Host informieren
  syncCollapsedSize();

  applyHeaderAvatar(widgetState.settings.avatar_url);
  applyThemeColors(widgetState.settings);
  applyWidgetThemeMode(widgetState.settings.theme_mode);

  ensureLegalHint();
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

// AUTO-RESIZE TEXTAREA -------------------------------------------
function autoResizeInput() {
  if (!inputEl) return;
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 144) + "px";
}

inputEl?.addEventListener("input", autoResizeInput);

inputEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    formEl?.requestSubmit();
  }
});

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
  syncCollapsedSize();
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
  autoResizeInput();

  const isCoarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  if (isCoarse) inputEl.blur();
  else inputEl.focus();

  showTypingIndicator();
  updateViewportVars();

  let replyText;
  try {
    replyText = await fetchBotReply(userText);
  } catch (_) {
    replyText = "Es gab ein Problem bei der Antwort.";
  }

  hideTypingIndicator();
  appendMessage("bot", replyText);

  setTimeout(() => {
    const b = getBodyEl();
    if (b) b.scrollTop = b.scrollHeight;
    updateViewportVars();
  }, 0);
});

// ----------------------------------------------------------
// INIT
// ----------------------------------------------------------
(async function initWidget() {
  // Falls cw-body noch nicht ready ist: nach DOMContentLoaded nochmal versuchen
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", flushPendingLegalHint, { once: true });
  } else {
    flushPendingLegalHint();
  }

  // Versuch: sofort (wenn body existiert)
  ensureLegalHint();

  if (!WIDGET_KEY) {
    setWidgetReady();
    appendMessage("bot", "Widget-Key fehlt. Bitte im Snippet setzen (CHATBOT_WIDGET_KEY).");
    syncCollapsedSize();
    return;
  }

  readyTimer = setTimeout(() => setWidgetReady(), READY_FALLBACK_MS);

  const cfg = await fetchWidgetConfig();
  if (cfg) {
    applyWidgetSettings(cfg);
  } else {
    applyHeaderAvatar(null);
    applyWidgetThemeMode(widgetState.settings.theme_mode);
    if (greetingEl) greetingEl.style.display = "none";
    ensureLegalHint(); // bleibt ohne Link
  }

  widgetState.configLoaded = true;

  if (readyTimer) clearTimeout(readyTimer);
  setWidgetReady();

  const first = String(widgetState.settings.first_message || "").trim() || "Hallo! Wie kann ich helfen?";
  appendMessage("bot", first);

  updateViewportVars();

  // Host die initiale Bubble-Fläche melden, damit der iframe sofort schrumpft
  syncCollapsedSize();
})();