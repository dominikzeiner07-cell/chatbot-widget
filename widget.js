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

  var CACHE_BUST = "v5";
  var src =
    base +
    "/embed.html" +
    "?widget_key=" + encodeURIComponent(WIDGET_KEY) +
    "&api_base=" + encodeURIComponent(API_BASE) +
    "&pad=" + encodeURIComponent(String(PAD)) +
    "&cb=" + encodeURIComponent(CACHE_BUST);

  // Origin vom Widget (für postMessage-Validation)
  var allowedOrigin = "";
  try {
    allowedOrigin = new URL(base).origin;
  } catch (_) {
    allowedOrigin = "";
  }

  function isMobile() {
    try {
      var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
      var small =
        window.matchMedia &&
        (window.matchMedia("(max-width: 820px)").matches ||
          window.matchMedia("(max-height: 900px)").matches);
      return !!(coarse && small);
    } catch (_) {
      return false;
    }
  }

  // -------------------------------
  // SCROLL LOCK (Host Page)
  // -------------------------------
  var scrollLocked = false;
  var savedScrollY = 0;
  var prev = null;

  function preventScroll(e) {
    // verhindert iOS/Android "scroll through"
    e.preventDefault();
  }

  function lockHostScroll() {
    if (scrollLocked) return;
    if (!document.documentElement || !document.body) return;

    scrollLocked = true;
    savedScrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;

    prev = {
      htmlOverflow: document.documentElement.style.overflow,
      bodyOverflow: document.body.style.overflow,
      bodyPosition: document.body.style.position,
      bodyTop: document.body.style.top,
      bodyLeft: document.body.style.left,
      bodyRight: document.body.style.right,
      bodyWidth: document.body.style.width,
      bodyTouchAction: document.body.style.touchAction,
    };

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    // iOS-safe Lock: body fixed + offset
    document.body.style.position = "fixed";
    document.body.style.top = (-savedScrollY) + "px";
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.touchAction = "none";

    // Extra Schutz gegen "scroll bleed"
    window.addEventListener("touchmove", preventScroll, { passive: false });
    window.addEventListener("wheel", preventScroll, { passive: false });
  }

  function unlockHostScroll() {
    if (!scrollLocked) return;
    if (!document.documentElement || !document.body) return;

    scrollLocked = false;

    window.removeEventListener("touchmove", preventScroll);
    window.removeEventListener("wheel", preventScroll);

    // restore styles
    document.documentElement.style.overflow = prev ? prev.htmlOverflow : "";
    document.body.style.overflow = prev ? prev.bodyOverflow : "";
    document.body.style.position = prev ? prev.bodyPosition : "";
    document.body.style.top = prev ? prev.bodyTop : "";
    document.body.style.left = prev ? prev.bodyLeft : "";
    document.body.style.right = prev ? prev.bodyRight : "";
    document.body.style.width = prev ? prev.bodyWidth : "";
    document.body.style.touchAction = prev ? prev.bodyTouchAction : "";

    // restore scroll position
    window.scrollTo(0, savedScrollY);
    prev = null;
  }

  // message listener: iframe -> host
  function onMessage(ev) {
    // Origin check (wichtig)
    if (allowedOrigin && ev.origin !== allowedOrigin) return;

    var data = ev.data;
    if (!data || typeof data !== "object") return;
    if (data.type !== "CW_MODAL") return;

    // Nur Mobile sperren (Desktop bleibt wie früher)
    if (!isMobile()) return;

    if (data.open) lockHostScroll();
    else unlockHostScroll();
  }

  window.addEventListener("message", onMessage);

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
        // Mobile: iframe fullscreen (Modal-Overlay)
        iframe.style.width = "100vw";
        iframe.style.height = "100vh";
        iframe.style.maxWidth = "100vw";
        iframe.style.maxHeight = "100vh";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
      } else {
        // Desktop: wie vorher (Arbeitsfläche + PAD für Schatten)
        iframe.style.width = (BASE_W + PAD) + "px";
        iframe.style.height = (BASE_H + PAD) + "px";

        iframe.style.width = "min(calc(" + (BASE_W + PAD) + "px), 100vw)";
        iframe.style.height = "min(calc(" + (BASE_H + PAD) + "px), 100vh)";

        iframe.style.maxWidth = "100vw";
        iframe.style.maxHeight = "100vh";

        // Falls man von Mobile->Desktop resized: sicherheitshalber unlock
        unlockHostScroll();
      }
    }

    applySize();
    window.addEventListener("resize", applySize, { passive: true });
    window.addEventListener("orientationchange", function () {
      setTimeout(applySize, 80);
    });

    document.body.appendChild(iframe);
  }

  mount();
})();