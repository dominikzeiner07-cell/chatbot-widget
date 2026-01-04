(function () {
  "use strict";

  var currentScript = document.currentScript;
  var scriptSrc = (currentScript && currentScript.src) ? currentScript.src : "";
  var base = scriptSrc ? scriptSrc.split("/").slice(0, -1).join("/") : "";

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

  var IFRAME_ID = "cw-iframe";
  if (document.getElementById(IFRAME_ID)) return;

  var PAD = 180;
  var BASE_W = 480;
  var BASE_H = 860;

  var CACHE_BUST = "v4";
  var src =
    base +
    "/embed.html" +
    "?widget_key=" + encodeURIComponent(WIDGET_KEY) +
    "&api_base=" + encodeURIComponent(API_BASE) +
    "&pad=" + encodeURIComponent(String(PAD)) +
    "&cb=" + encodeURIComponent(CACHE_BUST);

  function isMobile() {
    try {
      var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
      var small = window.matchMedia && (window.matchMedia("(max-width: 820px)").matches || window.matchMedia("(max-height: 900px)").matches);
      return !!(coarse && small);
    } catch (_) {
      return false;
    }
  }

  function mount() {
    if (!document.body) {
      setTimeout(mount, 25);
      return;
    }

    var iframe = document.createElement("iframe");
    iframe.id = IFRAME_ID;
    iframe.title = "Chat Widget";
    iframe.src = src;

    iframe.setAttribute("allowtransparency", "true");
    iframe.setAttribute("scrolling", "no");

    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.border = "0";
    iframe.style.background = "transparent";
    iframe.style.zIndex = "2147483647";
    iframe.style.display = "block";

    function applySize() {
      if (isMobile()) {
        // Mobile: iframe fullscreen -> blockt die komplette Website
        iframe.style.width = "100vw";
        iframe.style.height = "100vh";
        iframe.style.maxWidth = "100vw";
        iframe.style.maxHeight = "100vh";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
      } else {
        // Desktop: wie vorher (nur "Arbeitsfläche" + PAD für Schatten)
        iframe.style.width = (BASE_W + PAD) + "px";
        iframe.style.height = (BASE_H + PAD) + "px";

        iframe.style.width = "min(calc(" + (BASE_W + PAD) + "px), 100vw)";
        iframe.style.height = "min(calc(" + (BASE_H + PAD) + "px), 100vh)";

        iframe.style.maxWidth = "100vw";
        iframe.style.maxHeight = "100vh";
      }
    }

    applySize();
    window.addEventListener("resize", applySize, { passive: true });
    window.addEventListener("orientationchange", function () { setTimeout(applySize, 80); });

    document.body.appendChild(iframe);
  }

  mount();
})();