(function () {
  "use strict";

  // --- 1) Script-Base (damit wir style.css von derselben GitHub-Pages URL laden können)
  var currentScript = document.currentScript;
  var scriptSrc = currentScript && currentScript.src ? currentScript.src : "";
  var base = scriptSrc ? scriptSrc.split("/").slice(0, -1).join("/") : "";

  // --- 2) CSS einhängen (nur einmal)
  if (base && !document.querySelector('link[data-cw-style="1"]')) {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = base + "/style.css";
    link.setAttribute("data-cw-style", "1");
    document.head.appendChild(link);
  }

  // --- 3) HTML einfügen (nur einmal)
  // WICHTIG: IDs + Klassen, damit style.css auf jeden Fall matcht
  if (!document.getElementById("cw-launcher-wrap")) {
    var root = document.createElement("div");
    root.id = "cw-launcher-wrap";
    root.className = "cw-launcher-wrap";

    root.innerHTML = [
      '<div id="cw-greeting" class="cw-greeting">',
      '  <span class="cw-greeting-text"></span>',
      '  <button class="cw-greeting-close" type="button" aria-label="Greeting schließen">×</button>',
      "</div>",

      '<button id="cw-launcher" class="cw-launcher" type="button" aria-label="Chat öffnen"></button>',

      '<div id="cw-window" class="cw-window cw-hidden">',
      '  <div id="cw-header" class="cw-header">',
      '    <div id="cw-title" class="cw-title">Support</div>',
      '    <button id="cw-close" class="cw-close" type="button" aria-label="Chat schließen">×</button>',
      "  </div>",

      '  <div id="cw-body" class="cw-body"></div>',

      '  <form id="cw-form" class="cw-form">',
      '    <input id="cw-input" class="cw-input" type="text" placeholder="Schreib eine Nachricht…" autocomplete="off" />',
      '    <button id="cw-send" class="cw-send" type="submit">Senden</button>',
      "  </form>",
      "</div>"
    ].join("\n");

    document.body.appendChild(root);
  }

  // --- 4) ELEMENTE REFERENZIEREN -----------------------------------------
  var greetingEl = document.getElementById("cw-greeting");
  var greetingCloseBtn = greetingEl ? greetingEl.querySelector(".cw-greeting-close") : null;

  var launcherBtn = document.getElementById("cw-launcher");
  var chatWindow = document.getElementById("cw-window");
  var closeBtn = document.getElementById("cw-close");

  var bodyEl = document.getElementById("cw-body");
  var formEl = document.getElementById("cw-form");
  var inputEl = document.getElementById("cw-input");
  var sendBtn = document.getElementById("cw-send");

  // --- 5) KONFIG ----------------------------------------------------------
  var API_BASE =
    window.CHATBOT_API_BASE ||
    (window.CHATBOT_CONFIG && window.CHATBOT_CONFIG.apiBase) ||
    "http://localhost:5051";

  var API_BASE_CLEAN = String(API_BASE || "").replace(/\/+$/, "");
  var ASK_URL = API_BASE_CLEAN.endsWith("/ask") ? API_BASE_CLEAN : API_BASE_CLEAN + "/ask";
  var CONFIG_URL = API_BASE_CLEAN + "/widget/config";

  var WIDGET_KEY =
    window.CHATBOT_WIDGET_KEY ||
    (window.CHATBOT_CONFIG && window.CHATBOT_CONFIG.widgetKey) ||
    "";

  var widgetState = {
    settings: {
      bot_name: null,
      user_label: "DU",
      greeting_text: null,
      first_message: "Hallo! Wie kann ich helfen?",
      header_color: null,
      accent_color: null,
      text_color_mode: "auto",
      avatar_url: null
    },
    configLoaded: false
  };

  function normalizeHexColor(c) {
    var s = String(c || "").trim();
    if (!s) return null;
    if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
    if (/^#[0-9a-fA-F]{3}$/.test(s)) {
      return "#" + s.slice(1).split("").map(function (ch) { return ch + ch; }).join("");
    }
    return null;
  }

  function hexToRgb(hex) {
    var h = normalizeHexColor(hex);
    if (!h) return null;
    var v = h.slice(1);
    return {
      r: parseInt(v.slice(0, 2), 16),
      g: parseInt(v.slice(2, 4), 16),
      b: parseInt(v.slice(4, 6), 16)
    };
  }

  function luminance(rgb) {
    var srgb = [rgb.r, rgb.g, rgb.b]
      .map(function (v) { return v / 255; })
      .map(function (v) {
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  }

  function pickTextColorMode(headerHex, mode) {
    var m = String(mode || "auto").toLowerCase();
    if (m === "light" || m === "dark") return m;
    var rgb = hexToRgb(headerHex);
    if (!rgb) return "dark";
    return luminance(rgb) < 0.42 ? "light" : "dark";
  }

  function applyThemeColors(settings) {
    var headerHex = normalizeHexColor(settings.header_color);
    var accentHex = normalizeHexColor(settings.accent_color);

    var headerEl = document.getElementById("cw-header");
    var titleEl = document.getElementById("cw-title");

    var resolvedTextMode = pickTextColorMode(headerHex, settings.text_color_mode);
    var headerTextColor = resolvedTextMode === "light" ? "#ffffff" : "#111827";

    if (headerEl && headerHex) headerEl.style.backgroundColor = headerHex;
    if (titleEl) titleEl.style.color = headerTextColor;
    if (closeBtn) closeBtn.style.color = headerTextColor;

    if (accentHex) {
      if (launcherBtn) launcherBtn.style.backgroundColor = accentHex;
      if (sendBtn) sendBtn.style.backgroundColor = accentHex;
    }
  }

  function normalizeIncomingSettings(obj) {
    if (!obj || typeof obj !== "object") return null;

    function pick(keys) {
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (typeof obj[k] !== "undefined" && obj[k] !== null) return obj[k];
      }
      return undefined;
    }

    return {
      bot_name: pick(["bot_name", "botName", "name"]),
      user_label: pick(["user_label", "userLabel"]),
      greeting_text: pick(["greeting_text", "launcherText", "launcher_text"]),
      first_message: pick(["first_message", "botGreeting", "bot_greeting"]),
      header_color: pick(["header_color", "headerBg", "header_bg"]),
      accent_color: pick(["accent_color", "accent"]),
      text_color_mode: pick(["text_color_mode", "textColorMode"]),
      avatar_url: pick(["avatar_url", "botAvatarUrl", "bot_avatar_url"])
    };
  }

  function mergeSettings(baseObj, incoming) {
    var out = {};
    Object.keys(baseObj).forEach(function (k) { out[k] = baseObj[k]; });

    if (!incoming || typeof incoming !== "object") return out;

    var keys = ["bot_name","user_label","greeting_text","first_message","header_color","accent_color","text_color_mode","avatar_url"];
    for (var i = 0; i < keys.length; i++) {
      var k2 = keys[i];
      if (typeof incoming[k2] !== "undefined" && incoming[k2] !== null) out[k2] = incoming[k2];
    }
    return out;
  }

  function createMessageRow(sender, text) {
    var row = document.createElement("div");
    row.className = "cw-row";
    if (sender === "user") row.classList.add("cw-row-user");

    var avatar = document.createElement("div");
    avatar.className = "cw-avatar";

    if (sender === "user") {
      avatar.classList.add("cw-avatar-user");
      avatar.textContent = widgetState.settings.user_label || "DU";
    } else {
      var url = String(widgetState.settings.avatar_url || "").trim();
      if (url) {
        avatar.textContent = "";
        avatar.style.backgroundImage = 'url("' + url + '")';
        avatar.style.backgroundSize = "cover";
        avatar.style.backgroundPosition = "center";
        avatar.style.backgroundRepeat = "no-repeat";
      } else {
        avatar.textContent = "AI";
      }
    }

    var bubble = document.createElement("div");
    bubble.className = "cw-msg";
    bubble.textContent = text;

    row.appendChild(avatar);
    row.appendChild(bubble);
    return row;
  }

  function appendMessage(sender, text) {
    var row = createMessageRow(sender, text);
    bodyEl.appendChild(row);
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  var typingEl = null;

  function showTypingIndicator() {
    if (typingEl) return;

    var row = document.createElement("div");
    row.className = "cw-typing-row";

    var avatar = document.createElement("div");
    avatar.className = "cw-avatar";

    var url = String(widgetState.settings.avatar_url || "").trim();
    if (url) {
      avatar.textContent = "";
      avatar.style.backgroundImage = 'url("' + url + '")';
      avatar.style.backgroundSize = "cover";
      avatar.style.backgroundPosition = "center";
      avatar.style.backgroundRepeat = "no-repeat";
    } else {
      avatar.textContent = "AI";
    }

    var bubble = document.createElement("div");
    bubble.className = "cw-typing-bubble";

    var dotsWrapper = document.createElement("div");
    dotsWrapper.className = "cw-dots";

    for (var i = 0; i < 3; i++) {
      var dot = document.createElement("div");
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

  function fetchBotReply(userText) {
    var headers = { "Content-Type": "application/json" };
    if (WIDGET_KEY) headers["X-Widget-Key"] = WIDGET_KEY;

    return fetch(ASK_URL, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ message: userText, widget_key: WIDGET_KEY || undefined })
    })
      .then(function (res) {
        if (!res.ok) {
          if (res.status === 401) return "Auth-Fehler – Widget-Key prüfen.";
          if (res.status === 429) return "Zu viele Anfragen / Rate-Limit.";

          return res.json().then(function (errData) {
            if (errData && (errData.error || errData.message)) return errData.message || errData.error;
            return "Serverfehler (" + res.status + ").";
          }).catch(function () {
            return "Serverfehler (" + res.status + ").";
          });
        }

        return res.json().then(function (data) {
          if (data.reply) return data.reply;
          if (data.error) return "Fehler: " + data.error;
          return "Keine Antwort erhalten.";
        });
      })
      .catch(function () {
        return "Netzwerkfehler – bitte später erneut versuchen.";
      });
  }

  function fetchWidgetConfig() {
    if (!WIDGET_KEY) return Promise.resolve(null);

    var headers = { "X-Widget-Key": WIDGET_KEY };

    return fetch(CONFIG_URL + "?widget_key=" + encodeURIComponent(WIDGET_KEY), { method: "GET", headers: headers })
      .then(function (res) {
        if (!res.ok) return null;
        return res.json().then(function (data) {
          if (!data || data.ok !== true) return null;
          return data.widget_settings || data.settings || null;
        }).catch(function () { return null; });
      })
      .catch(function () { return null; });
  }

  function applyWidgetSettings(settings) {
    var normalized = normalizeIncomingSettings(settings) || settings;
    widgetState.settings = mergeSettings(widgetState.settings, normalized);

    var titleEl = document.getElementById("cw-title");
    var botName = String(widgetState.settings.bot_name || "").trim();
    if (titleEl && botName) titleEl.textContent = botName;

    var greetTextEl = greetingEl ? greetingEl.querySelector(".cw-greeting-text") : null;
    var greetText = String(widgetState.settings.greeting_text || "").trim();
    if (greetTextEl && greetText) greetTextEl.textContent = greetText;

    applyThemeColors(widgetState.settings);
  }

  // --- UI Events
  if (launcherBtn) {
    launcherBtn.addEventListener("click", function () {
      var isHidden = chatWindow.classList.contains("cw-hidden");
      if (isHidden) {
        chatWindow.classList.remove("cw-hidden");
        if (greetingEl) greetingEl.style.display = "none";
      } else {
        chatWindow.classList.add("cw-hidden");
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", function () {
      chatWindow.classList.add("cw-hidden");
    });
  }

  if (greetingCloseBtn) {
    greetingCloseBtn.addEventListener("click", function () {
      if (greetingEl) greetingEl.style.display = "none";
    });
  }

  setTimeout(function () {
    if (!greetingEl) return;
    if (greetingEl.style.display !== "none") greetingEl.style.display = "none";
  }, 8000);

  if (formEl) {
    formEl.addEventListener("submit", function (e) {
      e.preventDefault();

      var userText = inputEl.value.trim();
      if (!userText) return;

      if (!WIDGET_KEY) {
        appendMessage("bot", "Widget-Key fehlt. Bitte im Snippet setzen (CHATBOT_WIDGET_KEY).");
        return;
      }

      appendMessage("user", userText);
      inputEl.value = "";
      inputEl.focus();

      showTypingIndicator();

      fetchBotReply(userText).then(function (replyText) {
        hideTypingIndicator();
        appendMessage("bot", replyText);
      });
    });
  }

  // --- Init
  (function initWidget() {
    if (!WIDGET_KEY) {
      appendMessage("bot", "Widget-Key fehlt. Bitte im Snippet setzen (CHATBOT_WIDGET_KEY).");
      return;
    }

    fetchWidgetConfig().then(function (cfg) {
      if (cfg) applyWidgetSettings(cfg);

      widgetState.configLoaded = true;
      var first = String(widgetState.settings.first_message || "").trim() || "Hallo! Wie kann ich helfen?";
      appendMessage("bot", first);
    });
  })();
})();