(function () {
  "use strict";

  // 1) Base-URL von widget.js ermitteln (damit wir embed.html im selben Repo laden können)
  var currentScript = document.currentScript;
  var scriptSrc = (currentScript && currentScript.src) ? currentScript.src : "";
  var base = scriptSrc ? scriptSrc.split("/").slice(0, -1).join("/") : "";

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

  // 4) Extra Raum für Shadows (links/oben relevant, weil dein Widget rechts/unten anchored ist)
  var PAD = 180;     // ruhig großzügig, damit definitiv kein Clipping mehr passiert
  var BASE_W = 480;  // Arbeitsfläche
  var BASE_H = 860;

  // 5) iframe URL bauen (+ cache-buster, damit du die Änderung sicher siehst)
  var CACHE_BUST = "v3";
  var src =
    base +
    "/embed.html" +
    "?widget_key=" + encodeURIComponent(WIDGET_KEY) +
    "&api_base=" + encodeURIComponent(API_BASE) +
    "&pad=" + encodeURIComponent(String(PAD)) +
    "&cb=" + encodeURIComponent(CACHE_BUST);

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

    // Fallback (falls min()/calc() aus irgendeinem Grund nicht greift)
    iframe.style.width = (BASE_W + PAD) + "px";
    iframe.style.height = (BASE_H + PAD) + "px";

    // Responsive: iframe wird NIE größer als der Viewport, wächst aber nach links/oben,
    // damit Shadows nicht am linken Rand abgeschnitten werden.
    iframe.style.width =
      "min(calc(" + (BASE_W + PAD) + "px), 100vw)";
    iframe.style.height =
      "min(calc(" + (BASE_H + PAD) + "px), 100vh)";

    iframe.style.maxWidth = "100vw";
    iframe.style.maxHeight = "100vh";

    document.body.appendChild(iframe);
  }

  mount();
})();