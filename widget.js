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

  // 4) Extra Raum für Shadows (sonst werden Shadows am iframe-Rand „abgeschnitten“)
  // 80–120px ist für deine box-shadows realistisch. 96px ist ein guter Sweet Spot.
  var PAD = 96;

  // Basis-Fläche, die du bisher schon ungefähr vorgesehen hattest
  // (muss nicht 1:1 dem inneren Widget entsprechen – es ist nur die "Arbeitsfläche" des iframes)
  var BASE_W = 480;
  var BASE_H = 860;

  // 5) iframe URL bauen (pad als Debug-Param ist ok, embed.html ignoriert ihn einfach)
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

    // iframe-Kante nach außen schieben, damit Shadows nicht innerhalb des iframes „geclippt“ werden
    iframe.style.right = "-" + PAD + "px";
    iframe.style.bottom = "-" + PAD + "px";

    iframe.style.border = "0";
    iframe.style.background = "transparent";
    iframe.style.zIndex = "2147483647";

    // Responsive Größe:
    // - Desktop: BASE + PAD
    // - Kleine Screens: nicht größer als Viewport + PAD
    iframe.style.width =
      "min(calc(" + BASE_W + "px + " + PAD + "px), calc(100vw + " + PAD + "px))";
    iframe.style.height =
      "min(calc(" + BASE_H + "px + " + PAD + "px), calc(100vh + " + PAD + "px))";

    // Safety: falls min()/calc() in einem alten Browser zickt, begrenzen wir trotzdem
    iframe.style.maxWidth = "calc(100vw + " + PAD + "px)";
    iframe.style.maxHeight = "calc(100vh + " + PAD + "px)";

    document.body.appendChild(iframe);
  }

  mount();
})();