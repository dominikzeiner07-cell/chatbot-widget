(function () {
  "use strict";

  // 1) Base-URL von widget.js ermitteln
  var currentScript = document.currentScript;
  var scriptSrc = (currentScript && currentScript.src) ? currentScript.src : "";
  var base = scriptSrc ? scriptSrc.split("/").slice(0, -1).join("/") : "";

  // origin für postMessage-validierung
  var baseOrigin = "";
  try {
    baseOrigin = new URL(base).origin;
  } catch (_) {}

  // 2) Config aus window lesen
  var WIDGET_KEY =
    window.CHATBOT_WIDGET_KEY ||
    (window.CHATBOT_CONFIG && window.CHATBOT_CONFIG.widgetKey) ||
    "";

  var API_BASE =
    window.CHATBOT_API_BASE ||
    (window.CHATBOT_CONFIG && window.CHATBOT_CONFIG.apiBase) ||
    "";

  if (!base) {
    console.error("[ChatWidget] Konnte base URL nicht bestimmen (scriptSrc leer).");
    return;
  }
  if (!WIDGET_KEY) {
    console.error("[ChatWidget] CHATBOT_WIDGET_KEY fehlt.");
    return;
  }
  if (!API_BASE) {
    console.error("[ChatWidget] CHATBOT_API_BASE fehlt.");
    return;
  }

  // 3) Nur einmal einfügen
  var IFRAME_ID = "cw-iframe";
  if (document.getElementById(IFRAME_ID)) return;

  // 4) Closed-Size (Desktop/Default)
  var PAD = 180;
  var BASE_W = 480;
  var BASE_H = 860;

  // 5) iframe URL bauen (+ cache-buster)
  var CACHE_BUST = "v4";
  var src =
    base +
    "/embed.html" +
    "?widget_key=" + encodeURIComponent(WIDGET_KEY) +
    "&api_base=" + encodeURIComponent(API_BASE) +
    "&pad=" + encodeURIComponent(String(PAD)) +
    "&cb=" + encodeURIComponent(CACHE_BUST);

  var iframe = null;

  // Host Scroll Lock (wenn Fullscreen offen)
  var scrollY = 0;
  function lockHostScroll() {
    try {
      scrollY = window.scrollY || document.documentElement.scrollTop || 0;

      // iOS + Android robust: body fixed
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = "-" + scrollY + "px";
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
      document.body.style.touchAction = "none";
    } catch (_) {}
  }

  function unlockHostScroll() {
    try {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      document.body.style.touchAction = "";

      window.scrollTo(0, scrollY || 0);
    } catch (_) {}
  }

  function isMobileNow() {
    try {
      if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return true;
      if (window.innerWidth <= 600) return true;
    } catch (_) {}
    return false;
  }

  // Closed Styles (wie bisher)
  function applyClosedStyles() {
    if (!iframe) return;

    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.left = "";
    iframe.style.top = "";

    iframe.style.border = "0";
    iframe.style.background = "transparent";
    iframe.style.zIndex = "2147483647";
    iframe.style.display = "block";

    iframe.setAttribute("scrolling", "no");

    iframe.style.width = (BASE_W + PAD) + "px";
    iframe.style.height = (BASE_H + PAD) + "px";

    iframe.style.width = "min(calc(" + (BASE_W + PAD) + "px), 100vw)";
    iframe.style.height = "min(calc(" + (BASE_H + PAD) + "px), 100vh)";
    iframe.style.maxWidth = "100vw";
    iframe.style.maxHeight = "100vh";
  }

  // Fullscreen Styles (nur Mobile)
  function applyFullscreenStyles() {
    if (!iframe) return;

    iframe.style.position = "fixed";
    iframe.style.left = "0";
    iframe.style.top = "0";
    iframe.style.right = "0";
    iframe.style.bottom = "0";

    iframe.style.border = "0";
    iframe.style.background = "transparent";
    iframe.style.zIndex = "2147483647";
    iframe.style.display = "block";

    iframe.setAttribute("scrolling", "no");

    // “dvh” falls unterstützt, plus JS fallback per resize
    iframe.style.width = "100vw";
    iframe.style.height = "100dvh";
    iframe.style.maxWidth = "100vw";
    iframe.style.maxHeight = "100vh";

    // Fallback sofort
    iframe.style.height = (window.innerHeight || 0) + "px";
  }

  function updateFullscreenSize() {
    if (!iframe) return;
    if (!isMobileNow()) return;

    // Nur wenn fullscreen aktiv ist (left/top gesetzt)
    if (iframe.style.left !== "0px" && iframe.style.left !== "0") return;

    var h = window.innerHeight || 0;
    iframe.style.height = h + "px";
  }

  function mount() {
    if (!document.body) {
      setTimeout(mount, 25);
      return;
    }

    iframe = document.createElement("iframe");
    iframe.id = IFRAME_ID;
    iframe.title = "Chat Widget";
    iframe.src = src;

    iframe.setAttribute("allowtransparency", "true");

    document.body.appendChild(iframe);

    applyClosedStyles();

    window.addEventListener("resize", updateFullscreenSize, { passive: true });
    window.addEventListener("orientationchange", function () {
      setTimeout(updateFullscreenSize, 80);
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updateFullscreenSize, { passive: true });
      window.visualViewport.addEventListener("scroll", updateFullscreenSize, { passive: true });
    }

    // Messages aus dem iframe
    window.addEventListener("message", function (ev) {
      try {
        if (baseOrigin && ev.origin !== baseOrigin) return;

        var data = ev.data || {};
        if (!data || typeof data !== "object") return;

        // optional: widgetKey match (falls mehrere Widgets)
        if (data.widgetKey && data.widgetKey !== WIDGET_KEY) return;

        if (data.type === "cw:open") {
          if (isMobileNow()) {
            applyFullscreenStyles();
            updateFullscreenSize();
            lockHostScroll();
          }
        }

        if (data.type === "cw:close") {
          applyClosedStyles();
          unlockHostScroll();
        }
      } catch (_) {}
    });
  }

  mount();
})();