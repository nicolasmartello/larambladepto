(function () {
  var I18N = {
    es: { eyebrow: "Mar del Plata · Guía para huéspedes", title: "Comer, tomar algo y salir, a pasos del Aldrey",
          lead: "Los lugares que recomendamos nosotros. Elegí qué tenés ganas de hacer.",
          back: "Volver", close: "Cerrar", go: "Cómo llegar", rec: "Recomendado", rom: "Romántico", home: "Paseo Aldrey (referencia)",
          photo: "Foto próximamente" },
    en: { eyebrow: "Mar del Plata · Guest guide", title: "Eat, drink and go out, steps from Aldrey",
          lead: "The places we recommend ourselves. Pick what you feel like doing.",
          back: "Back", close: "Close", go: "Get directions", rec: "Recommended", rom: "Romantic", home: "Paseo Aldrey (reference)",
          photo: "Photo coming soon" }
  };
  var ORDER = ["desayuno", "almuerzo", "cena", "cerveza", "tragos", "dulce", "actividad"];
  var ICONS = {
    desayuno: '<path d="M4 9h12v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9zm12 1h2a2 2 0 0 1 0 4h-2M7 3v3m3-3v3" />',
    almuerzo: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 3c-2 2-2.5 5-2 8h4V3zM16 11v10" />',
    cena: '<path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z" />',
    cerveza: '<path d="M6 7h9v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7zm9 2h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2M6 7a3 3 0 0 1 3-3 3 3 0 0 1 6 0" />',
    tragos: '<path d="M4 4h16l-8 9-8-9zM12 13v7m-4 0h8" />',
    dulce: '<path d="M7 11a5 5 0 0 1 10 0M7 11l5 10 5-10z" />',
    actividad: '<path d="M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4V6zM10 6v12" />'
  };
  var lang = "es", cat = null, selected = null, map, layer, markers = {}, homeMarker;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var svg = function (c, color) { return '<svg viewBox="0 0 24 24" fill="none" stroke="' + (color || "#fff") + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + c + "</svg>"; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };

  function renderStatic() {
    var t = I18N[lang];
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-t]").forEach(function (e) { e.textContent = t[e.dataset.t]; });
    document.querySelectorAll("[data-t-aria]").forEach(function (e) { e.setAttribute("aria-label", t[e.dataset.tAria]); });
    document.querySelectorAll("[data-lang]").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.lang === lang); });
    $("#menu").innerHTML = ORDER.map(function (k) {
      return '<button data-cat="' + k + '" style="--c:' + CATS[k].color + '"><span class="ico">' + svg(ICONS[k]) + '</span><span class="lbl">' + CATS[k][lang] +
        '</span><svg class="chev" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg></button>';
    }).join("");
    if (cat) { $("#map-title").textContent = CATS[cat][lang]; renderStrip(); if (selected) renderSheet(selected); }
    if (homeMarker) homeMarker.setTooltipContent(t.home);
  }

  function placesOf(k) { return PLACES.filter(function (p) { return p.cats.indexOf(k) > -1; }); }

  function pinIcon(p, on) {
    return L.divIcon({ className: "", iconSize: [34, 34], iconAnchor: [17, 34],
      html: '<div class="pin' + (on ? " on" : "") + '" style="--c:' + CATS[cat].color + '"><div class="dot"></div>' + (p.rec ? '<span class="st">★</span>' : "") + "</div>" });
  }

  function initMap() {
    if (map) return;
    map = L.map("map", { zoomControl: false, attributionControl: true });
    L.control.zoom({ position: "topright" }).addTo(map);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
    layer = L.layerGroup().addTo(map);
    homeMarker = L.marker(HOME.ll, { zIndexOffset: 500, icon: L.divIcon({ className: "", iconSize: [38, 38], iconAnchor: [19, 19],
      html: '<div class="home-pin">' + svg('<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>') + "</div>" }) })
      .bindTooltip(I18N[lang].home, { direction: "top", offset: [0, -16] }).addTo(map);
    map.on("click", closeSheet);
  }

  function openCategory(k) {
    cat = k; selected = null;
    show("mapview");
    initMap();
    $("#map-title").textContent = CATS[k][lang];
    layer.clearLayers(); markers = {};
    var pts = [HOME.ll];
    placesOf(k).forEach(function (p) {
      if (!p.ll) return;
      markers[p.id] = L.marker(p.ll, { icon: pinIcon(p, false), keyboard: true, title: p.name }).on("click", function () { select(p.id); }).addTo(layer);
      pts.push(p.ll);
    });
    renderStrip();
    closeSheet();
    setTimeout(function () {
      map.invalidateSize();
      map.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 16 });
    }, 60);
  }

  function renderStrip() {
    $("#strip").innerHTML = placesOf(cat).map(function (p) {
      return '<button class="chip" data-id="' + p.id + '" style="--c:' + CATS[cat].color + '"><i></i>' + esc(p.name) + (p.rec ? ' <span class="s">★</span>' : "") + (p.rom ? ' <span class="s" style="color:#d6336c">♥</span>' : "") + "</button>";
    }).join("");
  }

  function select(id) {
    selected = id;
    Object.keys(markers).forEach(function (k) {
      var p = PLACES.filter(function (x) { return x.id === k; })[0];
      markers[k].setIcon(pinIcon(p, k === id));
    });
    var p = PLACES.filter(function (x) { return x.id === id; })[0];
    if (p.ll) {
      // deja el pin en la mitad superior, libre de la ficha
      var z = Math.max(map.getZoom(), 16), off = map.getSize().y * 0.22;
      var c = map.project(p.ll, z).add([0, off]);
      map.flyTo(map.unproject(c, z), z, { duration: .6 });
    }
    var sheet = $("#sheet");
    // fade out el contenido actual, cambia y fade in
    if (sheet.classList.contains("open")) {
      sheet.classList.remove("open");
      setTimeout(function () { renderSheet(id); sheet.classList.add("open"); }, 260);
    } else { renderSheet(id); requestAnimationFrame(function () { sheet.classList.add("open"); }); }
    $("#strip").classList.add("hide");
  }

  function renderSheet(id) {
    var t = I18N[lang], p = PLACES.filter(function (x) { return x.id === id; })[0];
    var dest = p.ll ? "destination=" + p.ll[0] + "," + p.ll[1] : "destination=" + encodeURIComponent(p.name + " Mar del Plata");
    var tags = '<span class="tag cat" style="--c:' + CATS[cat].color + '">' + CATS[cat][lang] + "</span>" +
      (p.rec ? '<span class="tag">★ ' + t.rec + "</span>" : "") + (p.rom ? '<span class="tag rom">♥ ' + t.rom + "</span>" : "");
    $("#sheet").style.setProperty("--c", CATS[cat].color);
    $("#sheet").innerHTML = '<div class="sheet-scroll"><div class="photo"><span>' + t.photo + '</span><img src="img/places/' + p.id + '.jpg" alt="' + esc(p.name) + '" onerror="this.remove()">' +
      '<button class="close" id="close" aria-label="' + t.close + '"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="body"><div class="tags">' + tags + "</div><h3>" + esc(p.name) + "</h3><p>" + esc(p[lang]) + "</p>" +
      '<a class="go" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&' + dest + '&travelmode=walking">' + t.go +
      ' <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a></div></div>';
    $("#close").onclick = closeSheet;
  }

  function closeSheet() {
    selected = null;
    $("#sheet").classList.remove("open");
    $("#strip").classList.remove("hide");
    Object.keys(markers).forEach(function (k) {
      var p = PLACES.filter(function (x) { return x.id === k; })[0];
      markers[k].setIcon(pinIcon(p, false));
    });
  }

  function show(id) {
    document.querySelectorAll(".screen").forEach(function (s) {
      var on = s.id === id;
      s.classList.toggle("is-active", on);
      s.setAttribute("aria-hidden", !on);
    });
  }

  document.addEventListener("click", function (e) {
    var b;
    if ((b = e.target.closest("[data-lang]"))) { lang = b.dataset.lang; renderStatic(); return; }
    if ((b = e.target.closest("#menu [data-cat]"))) { openCategory(b.dataset.cat); return; }
    if ((b = e.target.closest(".chip[data-id]"))) { select(b.dataset.id); return; }
    if (e.target.closest("#back")) { closeSheet(); show("home"); }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheet(); });

  renderStatic();
})();
