// Google Analytics 4. Mientras GA_MEASUREMENT_ID esté vacío no se carga nada y track() no hace nada.
// Para activarlo: pegá el ID de la propiedad (formato G-XXXXXXXXXX), en Admin > Flujos de datos > tu sitio web.
(function () {
  var GA_MEASUREMENT_ID = "G-RRVYC2QJKW";

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.track = function (name, params) { if (GA_MEASUREMENT_ID) gtag("event", name, params || {}); };
  if (!GA_MEASUREMENT_ID) return;

  // Consentimiento (Consent Mode v2): en el Espacio Económico Europeo, Reino Unido y Suiza arranca denegado;
  // en el resto del mundo, concedido para analítica. La publicidad siempre denegada.
  var EU = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT",
            "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "GB", "CH"];
  var off = { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" };
  gtag("consent", "default", Object.assign({ analytics_storage: "denied", region: EU }, off));
  gtag("consent", "default", Object.assign({ analytics_storage: "granted" }, off));

  var KEY = "ga-consent", saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (saved) gtag("consent", "update", { analytics_storage: saved });

  gtag("js", new Date());
  gtag("config", GA_MEASUREMENT_ID, { allow_google_signals: false, allow_ad_personalization_signals: false });
  var s = document.createElement("script");
  s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA_MEASUREMENT_ID);
  document.head.appendChild(s);

  // Aviso de cookies: solo para quien está en zona horaria europea y todavía no eligió. Si no elige, queda denegado.
  var tz = "";
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
  if (saved || tz.indexOf("Europe/") !== 0) return;
  document.addEventListener("DOMContentLoaded", function () {
    var es = /^es/i.test(navigator.language || "");
    var bar = document.createElement("div");
    bar.className = "consent"; bar.setAttribute("role", "dialog");
    bar.innerHTML = "<p>" + (es ? "Usamos Google Analytics para saber qué lugares interesan. ¿Lo permitís?" : "We use Google Analytics to learn which places people like. Is that OK?") +
      '</p><div><button data-v="denied">' + (es ? "No" : "No") + '</button><button data-v="granted" class="yes">' + (es ? "Permitir" : "Allow") + "</button></div>";
    bar.addEventListener("click", function (e) {
      var v = e.target.getAttribute && e.target.getAttribute("data-v"); if (!v) return;
      try { localStorage.setItem(KEY, v); } catch (err) {}
      gtag("consent", "update", { analytics_storage: v });
      bar.remove();
    });
    document.body.appendChild(bar);
  });
})();
