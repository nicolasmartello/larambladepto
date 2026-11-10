(function () {
  var I18N = {
    es: { eyebrow: "Mar del Plata · Guía para huéspedes", title: "Comer, tomar algo y salir, a pasos del Aldrey",
          lead: "Los lugares que recomendamos nosotros. Elegí qué tenés ganas de hacer.",
          back: "Volver", close: "Cerrar", go: "Cómo llegar", rec: "Recomendado", rom: "Romántico", home: "Paseo Aldrey (referencia)",
          photo: "Foto próximamente", one: "1 lugar", many: "lugares" },
    en: { eyebrow: "Mar del Plata · Guest guide", title: "Eat, drink and go out, steps from Aldrey",
          lead: "The places we recommend ourselves. Pick what you feel like doing.",
          back: "Back", close: "Close", go: "Get directions", rec: "Recommended", rom: "Romantic", home: "Paseo Aldrey (reference)",
          photo: "Photo coming soon", one: "1 place", many: "places" }
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
  var NEAR_M = 3500;     // radio (m) del encuadre inicial del mapa
  var MAX_ROWS = 4;      // hasta 4 lugares entran sin scroll en el panel
  var lang = "es", cat = null, selected = null, map, layer, markers = {}, homeMarker;
  var IMG = {};          // id -> true (cargada) | false (no existe) | null (cargando)
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var svg = function (c, color) { return '<svg viewBox="0 0 24 24" fill="none" stroke="' + (color || "#fff") + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + c + "</svg>"; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  // Eventos de Google Analytics (ver js/analytics.js); cada uno lleva el idioma y si era de día o de noche
  function track(name, params) {
    if (!window.track) return;
    window.track(name, Object.assign({ language: lang, time_of_day: document.body.dataset.tod || "day" }, params));
  }
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var byId = function (id) { return PLACES.filter(function (x) { return x.id === id; })[0]; };

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
    if (typeof menuSnap !== "undefined") menuSnap.set(menuSnap.idx());
    if (homeMarker) homeMarker.setTooltipContent(t.home);
  }

  function text(p) { return (p.by && p.by[cat] && p.by[cat][lang]) || p[lang]; }
  function placesOf(k) { return PLACES.filter(function (p) { return p.cats.indexOf(k) > -1; }); }

  // Las fotos se precargan para que aparezcan de una al abrir la ficha
  function preload(id) {
    if (id in IMG) return;
    IMG[id] = null;
    var im = new Image();
    im.onload = function () { IMG[id] = true; };
    im.onerror = function () { IMG[id] = false; };
    im.src = "img/places/" + id + ".webp";
  }
  function preloadAll() { PLACES.forEach(function (p) { preload(p.id); }); }

  function pinIcon(p, on) {
    return L.divIcon({ className: "", iconSize: [34, 34], iconAnchor: [17, 34],
      html: '<div class="pin' + (on ? " on" : "") + '" style="--c:' + CATS[cat].color + '"><div class="dot"></div>' + (p.rec ? '<span class="st">★</span>' : "") + "</div>" });
  }

  function initMap() {
    if (map) return;
    map = L.map("map", { zoomControl: false, attributionControl: false });
    // el crédito va arriba a la izquierda, bajo el encabezado: abajo tapaba el botón "Cómo llegar" de la ficha
    L.control.attribution({ position: "topleft", prefix: false }).addTo(map);
    L.control.zoom({ position: "topright" }).addTo(map);
    // Mapa base de OpenFreeMap (gratis, sin clave, pensado para sitios en producción). Si el celular no soporta WebGL,
    // se usa el mapa de OpenStreetMap como respaldo.
    var webgl = false;
    try { var cv = document.createElement("canvas"); webgl = !!(window.maplibregl && L.maplibreGL && (cv.getContext("webgl2") || cv.getContext("webgl"))); } catch (e) {}
    if (webgl) {
      L.maplibreGL({ style: "https://tiles.openfreemap.org/styles/liberty",
        attribution: '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }).addTo(map);
    } else {
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
    }
    layer = L.layerGroup().addTo(map);
    homeMarker = L.marker(HOME.ll, { zIndexOffset: 500, icon: L.divIcon({ className: "", iconSize: [38, 38], iconAnchor: [19, 19],
      html: '<div class="home-pin">' + svg('<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>') + "</div>" }) })
      .bindTooltip(I18N[lang].home, { direction: "top", offset: [0, -16] }).addTo(map);
    map.on("click", closeSheet);
  }

  function openCategory(k) {
    cat = k; selected = null;
    track("category_open", { category: k });
    show("mapview");
    initMap();
    $("#map-title").textContent = CATS[k][lang];
    layer.clearLayers(); markers = {};
    var pts = [HOME.ll];
    placesOf(k).forEach(function (p) {
      preload(p.id);
      if (!p.ll) return;
      markers[p.id] = L.marker(p.ll, { icon: pinIcon(p, false), keyboard: true, title: p.name }).on("click", function () { select(p.id); }).addTo(layer);
      pts.push(p.ll);
    });
    drawerSnap.reset();
    renderStrip();
    closeSheet();
    setTimeout(function () {
      map.invalidateSize();
      // el encuadre inicial solo abarca los lugares cercanos al depto: uno lejano no debe achicar todo el mapa
      var near = pts.filter(function (q) { return L.latLng(q).distanceTo(L.latLng(HOME.ll)) <= NEAR_M; });
      map.fitBounds(L.latLngBounds(near.length > 1 ? near : pts), { paddingTopLeft: [50, 80], paddingBottomRight: [50, drawerHeight() + 30], maxZoom: 16 });
    }, 60);
  }

  /* ---------- Paneles que se arrastran: lista del mapa y menú de inicio ---------- */
  // Panel anclado abajo que se acomoda en alturas fijas (snaps) al soltar. El gesto mueve el panel; la lista interna
  // solo se desplaza cuando el panel está abierto del todo y hay contenido de más.
  function makeSnapper(el, o) {
    var st = { i: 0, snaps: [] }, g = null;
    var last = function () { return st.snaps.length - 1; };
    var height = function () { return el.getBoundingClientRect().height; };
    function set(i) {
      st.snaps = o.snaps();
      st.i = clamp(i, 0, last());
      el.classList.remove("dragging");
      el.style.height = st.snaps[st.i] + "px";
      o.scroller.style.overflowY = (o.scrolls() && st.i === last()) ? "auto" : "hidden";
    }
    function start(y, onScroller) {
      g = { y0: y, h0: height(), lock: null, moved: false, onScroller: onScroller, pts: [{ t: Date.now(), h: height() }] };
    }
    function move(y, ev) {
      if (!g) return;
      var dy = y - g.y0;
      if (g.lock === null) {
        if (Math.abs(dy) < 6) return;
        var canScroll = o.scrolls() && st.i === last();
        g.lock = (!g.onScroller || !canScroll || (o.scroller.scrollTop <= 0 && dy > 0)) ? "drag" : "scroll";
      }
      if (g.lock !== "drag") return;
      if (ev && ev.cancelable) ev.preventDefault();
      g.moved = true;
      el.classList.add("dragging");
      var h = clamp(g.h0 - dy, st.snaps[0], st.snaps[last()]);
      el.style.height = h + "px";
      g.pts.push({ t: Date.now(), h: h });
      if (g.pts.length > 5) g.pts.shift();
    }
    function end() {
      if (!g) return;
      if (g.lock === "drag") {
        var p0 = g.pts[0], p1 = g.pts[g.pts.length - 1], v = p1.t > p0.t ? (p1.h - p0.h) / (p1.t - p0.t) : 0; // px/ms, + = sube
        var target = p1.h + v * 160, best = 0;
        st.snaps.forEach(function (s, i) { if (Math.abs(s - target) < Math.abs(st.snaps[best] - target)) best = i; });
        set(best);
      }
      if (g.moved) { ignoreClick = true; setTimeout(function () { ignoreClick = false; }, 300); }
      g = null;
    }
    el.addEventListener("touchstart", function (e) { start(e.touches[0].clientY, !!e.target.closest(o.scrollSel || "#none")); }, { passive: true });
    el.addEventListener("touchmove", function (e) { move(e.touches[0].clientY, e); }, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    el.addEventListener("mousedown", function (e) { if (e.button === 0) start(e.clientY, !!e.target.closest(o.scrollSel || "#none")); });
    window.addEventListener("mousemove", function (e) { if (g) move(e.clientY, e); });
    window.addEventListener("mouseup", end);
    return {
      set: set,
      idx: function () { return st.i; },
      count: function () { return st.snaps.length; },
      reset: function () { st.i = 1; st.snaps = []; },
      cycle: function () { set(st.i + 1 >= st.snaps.length ? 0 : st.i + 1); }
    };
  }

  // Lista de lugares (mapa)
  function computeSnaps() {
    var H = $("#mapview").clientHeight, head = $("#grab").offsetHeight + $(".dh").offsetHeight, peek = head + 4;
    var rows = $("#rows"), lastRow = rows.lastElementChild;
    if (placesOf(cat).length <= MAX_ROWS) {
      var nat = lastRow ? lastRow.offsetTop + lastRow.offsetHeight + parseFloat(getComputedStyle(rows).paddingBottom) : peek + 40;
      return [peek, Math.min(nat, Math.round(H * 0.6))];
    }
    return [peek, Math.round(H * 0.4), Math.round(H * 0.82)];
  }
  var drawerSnap = makeSnapper($("#strip"), { scroller: $("#rows"), scrollSel: "#rows", snaps: computeSnaps,
    scrolls: function () { return placesOf(cat).length > MAX_ROWS; } });
  function drawerHeight() { return $("#strip").getBoundingClientRect().height; }

  // Menú de inicio: abajo junto con el título; cerrado muestra 2 botones y un pedacito del siguiente
  function menuLayout() {
    var wrap = $("#menu-wrap"), menu = $("#menu"), kids = menu.children;
    var natural = menu.offsetTop + menu.offsetHeight + parseFloat(getComputedStyle(wrap).paddingBottom);
    var peek = kids[Math.min(2, kids.length - 1)].offsetTop + 30;
    var maxH = $("#home").clientHeight - $(".home-inner").getBoundingClientRect().bottom - 8;
    var full = Math.max(peek + 40, Math.min(natural, maxH));
    return { peek: Math.min(peek, full), full: full, scrolls: natural > maxH + 1 };
  }
  var menuSnap = makeSnapper($("#menu-sheet"), { scroller: $("#menu-wrap"), scrollSel: "#menu-wrap",
    snaps: function () { var l = menuLayout(); return [l.peek, l.full]; },
    scrolls: function () { return menuLayout().scrolls; } });

  window.addEventListener("resize", function () { menuSnap.set(menuSnap.idx()); if (cat) drawerSnap.set(drawerSnap.idx()); });

  /* ---------- Paneles que se arrastran: lista del mapa y menú de inicio ---------- */
  var ignoreClick = false;
  // Panel anclado abajo que se acomoda en alturas fijas (snaps) al soltar. El gesto mueve el panel; la lista interna
  // solo se desplaza cuando el panel está abierto del todo y hay contenido de más.
  function makeSnapper(el, o) {
    var st = { i: 0, snaps: [] }, g = null;
    var last = function () { return st.snaps.length - 1; };
    var height = function () { return el.getBoundingClientRect().height; };
    function set(i) {
      st.snaps = o.snaps();
      st.i = clamp(i, 0, last());
      el.classList.remove("dragging");
      el.style.height = st.snaps[st.i] + "px";
      o.scroller.style.overflowY = (o.scrolls() && st.i === last()) ? "auto" : "hidden";
    }
    function start(y, onScroller) {
      g = { y0: y, h0: height(), lock: null, moved: false, onScroller: onScroller, pts: [{ t: Date.now(), h: height() }] };
    }
    function move(y, ev) {
      if (!g) return;
      var dy = y - g.y0;
      if (g.lock === null) {
        if (Math.abs(dy) < 6) return;
        var canScroll = o.scrolls() && st.i === last();
        g.lock = (!g.onScroller || !canScroll || (o.scroller.scrollTop <= 0 && dy > 0)) ? "drag" : "scroll";
      }
      if (g.lock !== "drag") return;
      if (ev && ev.cancelable) ev.preventDefault();
      g.moved = true;
      el.classList.add("dragging");
      var h = clamp(g.h0 - dy, st.snaps[0], st.snaps[last()]);
      el.style.height = h + "px";
      g.pts.push({ t: Date.now(), h: h });
      if (g.pts.length > 5) g.pts.shift();
    }
    function end() {
      if (!g) return;
      if (g.lock === "drag") {
        var p0 = g.pts[0], p1 = g.pts[g.pts.length - 1], v = p1.t > p0.t ? (p1.h - p0.h) / (p1.t - p0.t) : 0; // px/ms, + = sube
        var target = p1.h + v * 160, best = 0;
        st.snaps.forEach(function (s, i) { if (Math.abs(s - target) < Math.abs(st.snaps[best] - target)) best = i; });
        set(best);
      }
      if (g.moved) { ignoreClick = true; setTimeout(function () { ignoreClick = false; }, 300); }
      g = null;
    }
    el.addEventListener("touchstart", function (e) { start(e.touches[0].clientY, !!e.target.closest(o.scrollSel || "#none")); }, { passive: true });
    el.addEventListener("touchmove", function (e) { move(e.touches[0].clientY, e); }, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    el.addEventListener("mousedown", function (e) { if (e.button === 0) start(e.clientY, !!e.target.closest(o.scrollSel || "#none")); });
    window.addEventListener("mousemove", function (e) { if (g) move(e.clientY, e); });
    window.addEventListener("mouseup", end);
    return {
      set: set,
      idx: function () { return st.i; },
      count: function () { return st.snaps.length; },
      reset: function () { st.i = 1; st.snaps = []; },
      cycle: function () { set(st.i + 1 >= st.snaps.length ? 0 : st.i + 1); }
    };
  }

  // Lista de lugares (mapa)
  function computeSnaps() {
    var H = $("#mapview").clientHeight, head = $("#grab").offsetHeight + $(".dh").offsetHeight, peek = head + 4;
    var rows = $("#rows"), lastRow = rows.lastElementChild;
    if (placesOf(cat).length <= MAX_ROWS) {
      var nat = lastRow ? lastRow.offsetTop + lastRow.offsetHeight + parseFloat(getComputedStyle(rows).paddingBottom) : peek + 40;
      return [peek, Math.min(nat, Math.round(H * 0.6))];
    }
    return [peek, Math.round(H * 0.4), Math.round(H * 0.82)];
  }
  var drawerSnap = makeSnapper($("#strip"), { scroller: $("#rows"), scrollSel: "#rows", snaps: computeSnaps,
    scrolls: function () { return placesOf(cat).length > MAX_ROWS; } });
  function drawerHeight() { return $("#strip").getBoundingClientRect().height; }

  // Menú de inicio: abajo junto con el título; cerrado muestra 2 botones y un pedacito del siguiente
  function menuLayout() {
    var wrap = $("#menu-wrap"), menu = $("#menu"), kids = menu.children;
    var natural = menu.offsetTop + menu.offsetHeight + parseFloat(getComputedStyle(wrap).paddingBottom);
    var peek = kids[Math.min(2, kids.length - 1)].offsetTop + 30;
    var maxH = $("#home").clientHeight - $(".home-inner").getBoundingClientRect().bottom - 8;
    var full = Math.max(peek + 40, Math.min(natural, maxH));
    return { peek: Math.min(peek, full), full: full, scrolls: natural > maxH + 1 };
  }
  var menuSnap = makeSnapper($("#menu-sheet"), { scroller: $("#menu-wrap"), scrollSel: "#menu-wrap",
    snaps: function () { var l = menuLayout(); return [l.peek, l.full]; },
    scrolls: function () { return menuLayout().scrolls; } });

  window.addEventListener("resize", function () { menuSnap.set(menuSnap.idx()); if (cat) drawerSnap.set(drawerSnap.idx()); });

  function renderStrip() {
    var t = I18N[lang], list = placesOf(cat);
    $("#count").textContent = list.length === 1 ? t.one : list.length + " " + t.many;
    $("#rows").innerHTML = list.map(function (p) {
      return '<button class="row" data-id="' + p.id + '" style="--c:' + CATS[cat].color + '"><i></i><span class="tx"><b>' + esc(p.name) +
        (p.rec ? ' <span class="s">★</span>' : "") + (p.rom ? ' <span class="h">♥</span>' : "") + "</b><small>" + esc(text(p)) + "</small></span>" +
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg></button>';
    }).join("");
    drawerSnap.set(list.length <= MAX_ROWS ? 1 : (drawerSnap.count() === 3 ? drawerSnap.idx() : 1));
  }

  /* ---------- Ficha de detalle: gesto horizontal para ir al anterior / siguiente ---------- */
  function neighbor(dir) {
    var list = placesOf(cat), i = list.map(function (p) { return p.id; }).indexOf(selected);
    return list[i + dir] || null;
  }

  function focusPlace(id) {
    selected = id;
    track("place_view", { place_id: id, place_name: byId(id).name, category: cat });
    Object.keys(markers).forEach(function (k) { markers[k].setIcon(pinIcon(byId(k), k === id)); });
    var p = byId(id);
    if (p.ll) {
      // deja el pin en la mitad superior, libre de la ficha
      var z = Math.max(map.getZoom(), 16), off = map.getSize().y * 0.22;
      map.flyTo(map.unproject(map.project(p.ll, z).add([0, off]), z), z, { duration: .6 });
    }
  }

  function select(id) {
    focusPlace(id);
    var sheet = $("#sheet");
    // fade out el contenido actual, cambia y fade in
    if (sheet.classList.contains("open")) {
      sheet.classList.remove("open");
      setTimeout(function () { renderSheet(id); sheet.classList.add("open"); }, 260);
    } else { renderSheet(id); setTimeout(function () { sheet.classList.add("open"); }, 20); }
    $("#strip").classList.add("hide");
  }

  function slideTo(id, dir) {
    var sc = $(".sheet-scroll");
    sc.style.transition = "transform .16s ease, opacity .16s ease";
    sc.style.transform = "translateX(" + (-dir * 70) + "px)";
    sc.style.opacity = 0;
    focusPlace(id);
    setTimeout(function () {
      renderSheet(id);
      var n = $(".sheet-scroll");
      n.style.transition = "none"; n.style.transform = "translateX(" + (dir * 70) + "px)"; n.style.opacity = 0;
      void n.offsetWidth;
      n.style.transition = "transform .22s ease, opacity .22s ease"; n.style.transform = "none"; n.style.opacity = 1;
    }, 160);
  }

  var s = null;
  function sStart(x, y, e) {
    if (!$("#sheet").classList.contains("open") || e.target.closest(".close")) return;
    s = { x0: x, y0: y, dx: 0, lock: null, t0: Date.now() };
  }
  function sMove(x, y, ev) {
    if (!s) return;
    var dx = x - s.x0, dy = y - s.y0;
    if (s.lock === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      s.lock = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
    }
    if (s.lock !== "h") return;
    if (ev.cancelable) ev.preventDefault();
    s.dx = dx;
    var sc = $(".sheet-scroll"), edge = !neighbor(dx < 0 ? 1 : -1), r = edge ? 0.25 : 0.7;
    sc.style.transition = "none";
    sc.style.transform = "translateX(" + dx * r + "px)";
    sc.style.opacity = String(1 - Math.min(Math.abs(dx * r) / 320, 0.5));
  }
  function sEnd() {
    if (!s) return;
    var st = s; s = null;
    if (st.lock !== "h") return;
    var dt = Math.max(1, Date.now() - st.t0), dir = st.dx < 0 ? 1 : -1, next = neighbor(dir);
    if (next && (Math.abs(st.dx) > 70 || Math.abs(st.dx) / dt > 0.5)) { slideTo(next.id, dir); return; }
    var sc = $(".sheet-scroll");
    sc.style.transition = "transform .2s ease, opacity .2s ease"; sc.style.transform = "none"; sc.style.opacity = 1;
    ignoreClick = true; setTimeout(function () { ignoreClick = false; }, 300);
  }

  (function wireSheet() {
    var sh = $("#sheet");
    sh.addEventListener("touchstart", function (e) { sStart(e.touches[0].clientX, e.touches[0].clientY, e); }, { passive: true });
    sh.addEventListener("touchmove", function (e) { sMove(e.touches[0].clientX, e.touches[0].clientY, e); }, { passive: false });
    sh.addEventListener("touchend", sEnd);
    sh.addEventListener("touchcancel", sEnd);
    sh.addEventListener("mousedown", function (e) { if (e.button === 0) sStart(e.clientX, e.clientY, e); });
    window.addEventListener("mousemove", function (e) { if (s) sMove(e.clientX, e.clientY, e); });
    window.addEventListener("mouseup", sEnd);
    document.addEventListener("keydown", function (e) {
      if (!selected || !$("#sheet").classList.contains("open")) return;
      var n = e.key === "ArrowRight" ? neighbor(1) : e.key === "ArrowLeft" ? neighbor(-1) : null;
      if (n) slideTo(n.id, e.key === "ArrowRight" ? 1 : -1);
    });
  })();

  function renderSheet(id) {
    var t = I18N[lang], p = byId(id), list = placesOf(cat), idx = list.indexOf(p);
    var dest = p.ll ? "destination=" + p.ll[0] + "," + p.ll[1] : "destination=" + encodeURIComponent(p.name + " Mar del Plata");
    var tags = '<span class="tag cat" style="--c:' + CATS[cat].color + '">' + CATS[cat][lang] + "</span>" +
      (p.rec ? '<span class="tag">★ ' + t.rec + "</span>" : "") + (p.rom ? '<span class="tag rom">♥ ' + t.rom + "</span>" : "") +
      (list.length > 1 ? '<span class="pager">' + (idx + 1) + " / " + list.length + "</span>" : "");
    var photo = IMG[p.id] === false ? "<span>" + t.photo + "</span>" :
      '<img src="img/places/' + p.id + '.webp" alt="' + esc(p.name) + '" decoding="sync" draggable="false" style="object-position:' + (p.pos || "center") + '">';
    $("#sheet").style.setProperty("--c", CATS[cat].color);
    $("#sheet").innerHTML = '<div class="sheet-scroll"><div class="photo">' + photo +
      '<button class="close" id="close" aria-label="' + t.close + '"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="body"><div class="tags">' + tags + "</div><h3>" + esc(p.name) + "</h3><p>" + esc(text(p)) + "</p>" +
      '<a class="go" target="_blank" rel="noopener" draggable="false" href="https://www.google.com/maps/dir/?api=1&' + dest + '&travelmode=walking">' + t.go +
      ' <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a></div></div>';
    var im = $("#sheet img");
    if (im) im.onerror = function () {
      IMG[p.id] = false;
      var sp = document.createElement("span"); sp.textContent = t.photo;
      im.parentNode.insertBefore(sp, im); im.remove();
    };
    $("#close").onclick = closeSheet;
  }

  function closeSheet() {
    selected = null;
    $("#sheet").classList.remove("open");
    $("#strip").classList.remove("hide");
    Object.keys(markers).forEach(function (k) { markers[k].setIcon(pinIcon(byId(k), false)); });
  }

  function show(id) {
    document.querySelectorAll(".screen").forEach(function (sc) {
      var on = sc.id === id;
      sc.classList.toggle("is-active", on);
      sc.setAttribute("aria-hidden", !on);
    });
  }

  document.addEventListener("click", function (e) {
    var b;
    if (ignoreClick) { e.preventDefault(); e.stopPropagation(); return; }
    if ((b = e.target.closest("[data-lang]"))) { if (b.dataset.lang !== lang) { lang = b.dataset.lang; track("language_change", { selected_language: lang }); } renderStatic(); return; }
    if ((b = e.target.closest("#menu [data-cat]"))) { openCategory(b.dataset.cat); return; }
    if ((b = e.target.closest(".row[data-id]"))) { select(b.dataset.id); return; }
    if (e.target.closest("#sheet .go") && selected) { track("directions_click", { place_id: selected, place_name: byId(selected).name, category: cat }); return; }
    if (e.target.closest("#grab")) { drawerSnap.cycle(); return; }
    if (e.target.closest("#menu-grab")) { menuSnap.cycle(); return; }
    if (e.target.closest("#back")) { closeSheet(); show("home"); }
  }, true);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheet(); });

  // Foto de día o de noche según la hora del sol en Mar del Plata (no depende de la zona horaria del celular).
  // Para probar: ?fondo=noche o ?fondo=dia
  function isNight(now) {
    var lat = -38.0 * Math.PI / 180, lon = -57.55;
    var n = Math.floor((now - Date.UTC(now.getUTCFullYear(), 0, 0)) / 864e5);
    var b = 2 * Math.PI * (n - 81) / 365;
    var decl = 23.44 * Math.PI / 180 * Math.sin(b);
    var eot = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
    var cosH = (Math.sin(-0.833 * Math.PI / 180) - Math.sin(lat) * Math.sin(decl)) / (Math.cos(lat) * Math.cos(decl));
    var half = Math.acos(Math.max(-1, Math.min(1, cosH))) * 180 / Math.PI * 4; // minutos
    var noon = 720 - 4 * lon - eot;                                           // minutos UTC
    var m = now.getUTCHours() * 60 + now.getUTCMinutes();
    return Math.abs(((m - noon + 1440 + 720) % 1440) - 720) > half;
  }
  function applyBackground() {
    var q = /[?&]fondo=(noche|dia)/.exec(location.search), night = q ? q[1] === "noche" : isNight(new Date());
    document.body.dataset.tod = night ? "night" : "day";
  }

  applyBackground();
  setInterval(applyBackground, 600000);
  renderStatic();
  menuSnap.set(0);
  // las fuentes y el idioma cambian el alto del texto: recalcular las alturas del menú cuando cambia su contenido
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(function () { menuSnap.set(menuSnap.idx()); });
    ro.observe($(".hero")); ro.observe($("#menu"));
  }
  window.addEventListener("load", function () { setTimeout(preloadAll, 150); });
})();
