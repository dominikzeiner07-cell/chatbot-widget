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

  var CACHE_BUST = "v7";
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
    try {
      allowedOrigin = new URL(scriptSrc).origin;
    } catch (_) {
      allowedOrigin = "";
    }
  }

function isMobile() {
  try {
    var mm = window.matchMedia ? window.matchMedia.bind(window) : null;
    var coarse = mm ? mm("(pointer: coarse)").matches : false;
    var narrow = mm ? mm("(max-width: 820px)").matches : false;

    var ua = String((window.navigator && window.navigator.userAgent) || "");
    var mobileUa =
      /Android/i.test(ua) ||
      /iPhone|iPad|iPod/i.test(ua) ||
      /Mobile/i.test(ua);

    var touchPoints =
      (window.navigator && Number(window.navigator.maxTouchPoints || 0)) || 0;

    return !!(narrow && (coarse || mobileUa || touchPoints > 1));
  } catch (_) {
    return false;
  }
}

  function updateIframeViewportHeight(iframe) {
  if (!iframe || !isMobile()) return;

  var h = window.innerHeight || document.documentElement.clientHeight || 0;
  if (!h) return;

  iframe.style.height = h + "px";
  iframe.style.maxHeight = h + "px";
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

  // -------------------------------
  // IFRAME GRÖSSE (Klick-Blocker vermeiden)
  // -------------------------------
  // Geschlossen: iframe schrumpft auf die Launcher-/Greeting-Fläche unten rechts,
  //   damit der Rest der Host-Seite wieder klickbar ist.
  // Geöffnet:   iframe expandiert auf die volle Chat-Größe.
  var iframeEl = null;
  var isOpen = false;
  var collapsedW = 140; // sinnvoller Default bis das iframe seine echte Größe meldet
  var collapsedH = 140;

  function applySize() {
    if (!iframeEl) return;

    if (isOpen) {
      if (isMobile()) {
        // Mobile offen: ganze sichtbare Fläche
        iframeEl.style.width = "100vw";
        iframeEl.style.height = window.innerHeight + "px";
        iframeEl.style.maxWidth = "100vw";
        iframeEl.style.maxHeight = window.innerHeight + "px";
        updateIframeViewportHeight(iframeEl);
      } else {
        // Desktop offen: Arbeitsfläche + PAD für Schatten
        iframeEl.style.width = "min(calc(" + (BASE_W + PAD) + "px), 100vw)";
        iframeEl.style.height = "min(calc(" + (BASE_H + PAD) + "px), 100vh)";
        iframeEl.style.maxWidth = "100vw";
        iframeEl.style.maxHeight = "100vh";
      }
    } else {
      // Geschlossen (Desktop & Mobile): nur die Bubble-Fläche blockieren
      var w = Math.max(60, collapsedW || 140);
      var h = Math.max(60, collapsedH || 140);
      iframeEl.style.width = "min(" + w + "px, 100vw)";
      iframeEl.style.height = "min(" + h + "px, 100vh)";
      iframeEl.style.maxWidth = "100vw";
      iframeEl.style.maxHeight = "100vh";
    }

    iframeEl.style.right = "0";
    iframeEl.style.bottom = "0";

    // Desktop ist nie gelockt – defensiv entsperren (z.B. nach Mobile->Desktop resize)
    if (!isMobile()) unlockHostScroll();
  }

  // message listener: iframe -> host
  function onMessage(ev) {
    // Origin check (wichtig) – bei unbekanntem Origin alle Nachrichten ablehnen
    if (!allowedOrigin || ev.origin !== allowedOrigin) return;

    var data = ev.data;
    if (!data || typeof data !== "object") return;
    if (data.type !== "CW_MODAL") return;

    isOpen = !!data.open;

    // Im geschlossenen Zustand meldet das iframe seine Bubble-Größe mit,
    // damit wir den iframe darauf schrumpfen und Klicks wieder durchlassen.
    if (!isOpen) {
      if (typeof data.width === "number" && isFinite(data.width)) collapsedW = data.width;
      if (typeof data.height === "number" && isFinite(data.height)) collapsedH = data.height;
    }

    applySize();

    // Scroll-Lock nur Mobile (Desktop bleibt wie früher)
    if (isMobile()) {
      if (isOpen) lockHostScroll();
      else unlockHostScroll();
    }
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

    iframeEl = iframe;
    applySize();
window.addEventListener("resize", applySize, { passive: true });
window.addEventListener("orientationchange", function () {
  setTimeout(applySize, 80);
  setTimeout(function () { updateIframeViewportHeight(iframe); }, 180);
  setTimeout(function () { updateIframeViewportHeight(iframe); }, 350);
});

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", function () {
    updateIframeViewportHeight(iframe);
  }, { passive: true });

  window.visualViewport.addEventListener("scroll", function () {
    updateIframeViewportHeight(iframe);
  }, { passive: true });
}

    document.body.appendChild(iframe);
  }

  mount();
})();