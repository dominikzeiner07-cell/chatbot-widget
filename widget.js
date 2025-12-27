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

  // 4) WICHTIG: Extra Raum für Shadows (sonst wird der Shadow am iframe-Rand „abgeschnitten“)
  // 120px ist safe für deine box-shadows.
  var PAD = 120;

  // 5) iframe URL bauen (+ pad übergeben)
  var src =
    base +
    "/embed.html" +
    "?widget_key=" + encodeURIComponent(WIDGET_KEY) +
    "&api_base=" + encodeURIComponent(API_BASE) +
    "&pad=" + encodeURIComponent(String(PAD));

  function mount() {
    // falls body immer noch nicht da ist
    if (!document.body) {
      setTimeout(mount, 25);
      return;
    }

    var iframe = document.createElement("iframe");
    iframe.id = IFRAME_ID;
    iframe.title = "Chat Widget";
    iframe.src = src;

    // hilft in manchen Browsern
    iframe.setAttribute("allowtransparency", "true");

    iframe.style.position = "fixed";

    // iframe-Kante nach außen schieben, damit Shadows nicht innerhalb der sichtbaren Seite „geclippt“ werden
    iframe.style.right = "-" + PAD + "px";
    iframe.style.bottom = "-" + PAD + "px";

    iframe.style.border = "0";
    iframe.style.background = "transparent";
    iframe.style.zIndex = "2147483647";

    // Größe + PAD (damit trotz Verschiebung genug Fläche im sichtbaren Bereich bleibt)
    iframe.style.width = (480 + PAD) + "px";
    iframe.style.height = (860 + PAD) + "px";

    // responsive limit (kleine Screens)
    iframe.style.maxWidth = "calc(100vw + " + PAD + "px)";
    iframe.style.maxHeight = "calc(100vh + " + PAD + "px)";

    document.body.appendChild(iframe);
  }

  mount();
})();