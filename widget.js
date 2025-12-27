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

  // 4) iframe URL bauen
  var src =
    base +
    "/embed.html" +
    "?widget_key=" + encodeURIComponent(WIDGET_KEY) +
    "&api_base=" + encodeURIComponent(API_BASE);

  function mount() {
    // falls body immer noch nicht da ist
    if (!document.body) {
      setTimeout(mount, 25);
      return;
    }

    // 5) iframe erstellen
    var iframe = document.createElement("iframe");
    iframe.id = IFRAME_ID;
    iframe.title = "Chat Widget";
    iframe.src = src;

    // optional/harmlos – hilft bei manchen Browsern fürs “transparent”
    iframe.setAttribute("allowtransparency", "true");

    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.border = "0";
    iframe.style.background = "transparent";
    iframe.style.zIndex = "2147483647";

    // Mehr Platz geben, damit innen (right:24 + width:400 + shadow) sicher nicht clippt
    iframe.style.width = "min(480px, calc(100vw - 16px))";
    iframe.style.height = "min(860px, calc(100vh - 16px))";

    iframe.style.maxWidth = "100vw";
    iframe.style.maxHeight = "100vh";

    document.body.appendChild(iframe);
  }

  mount();
})();