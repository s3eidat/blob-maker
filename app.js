/* Blob Maker — seeded SVG blobs and wave dividers. Pure maths, no network. */
(function () {
  "use strict";
  var $ = S3.$, $$ = S3.$$, h = S3.h;
  var SVGNS = "http://www.w3.org/2000/svg";
  var PALETTES = [["#3dd6d0", "#3730a3"], ["#ff6f91", "#ffc75f"], ["#845ec2", "#ff6f91"], ["#00c9a7", "#c4fcef"], ["#2193b0", "#6dd5ed"], ["#f9d423", "#ff4e50"], ["#0f2027", "#2c5364"], ["#d4fc79", "#96e6a1"]];
  var DEF = { mode: "blob", seed: 1, n: 6, r: 45, layers: 3, flip: false, fill: "grad", c1: "#3dd6d0", c2: "#3730a3" };

  // ---------- core ----------
  function mulberry32(a) {
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function f1(x) { return String(Math.round(x * 10) / 10); }
  // Catmull-Rom through points -> cubic Bezier segments. closed: wraps around.
  function smooth(pts, closed) {
    var n = pts.length, d = "M" + f1(pts[0][0]) + " " + f1(pts[0][1]);
    function P(i) { return closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]; }
    for (var i = 0; i < (closed ? n : n - 1); i++) {
      var p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      d += "C" + f1(p1[0] + (p2[0] - p0[0]) / 6) + " " + f1(p1[1] + (p2[1] - p0[1]) / 6) + " " + f1(p2[0] - (p3[0] - p1[0]) / 6) + " " + f1(p2[1] - (p3[1] - p1[1]) / 6) + " " + f1(p2[0]) + " " + f1(p2[1]);
    }
    return closed ? d + "Z" : d;
  }
  function blobPath(seed, n, rand) { // 400 x 400 viewBox
    var rnd = mulberry32(seed), pts = [], R = 150, k = rand / 100;
    var start = rnd() * Math.PI * 2;
    for (var i = 0; i < n; i++) {
      var a = start + i / n * Math.PI * 2, r = R * (1 - k * 0.5 * rnd());
      pts.push([200 + Math.cos(a) * r, 200 + Math.sin(a) * r]);
    }
    return smooth(pts, true);
  }
  var WW = 1440, WH = 320;
  function wavePath(seed, waves, rand, layer, layersTotal, flip) {
    var rnd = mulberry32(seed + layer * 7919), k = rand / 100, pts = [], segs = waves * 2;
    var base = WH * (0.35 + 0.4 * (layer + 1) / (layersTotal + 1)), amp = WH * 0.22;
    for (var i = 0; i <= segs; i++) {
      var y = base + (i % 2 ? 1 : -1) * amp * (1 - k + k * rnd()) * 0.6 + (rnd() - 0.5) * amp * k * 0.6;
      pts.push([i / segs * WW, flip ? WH - y : y]);
    }
    return smooth(pts, false) + (flip ? "L" + WW + " 0L0 0Z" : "L" + WW + " " + WH + "L0 " + WH + "Z");
  }
  function svgString(s) {
    var blob = s.mode === "blob", vb = blob ? "0 0 400 400" : "0 0 " + WW + " " + WH, gid = "bm" + s.seed, fill = s.fill === "grad" ? "url(#" + gid + ")" : s.c1;
    var defs = s.fill === "grad" ? '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + s.c1 + '"/><stop offset="1" stop-color="' + s.c2 + '"/></linearGradient></defs>' : "";
    var paths = blob ? ['<path fill="' + fill + '" d="' + blobPath(s.seed, s.n, s.r) + '"/>'] : [];
    if (!blob) for (var l = 0; l < s.layers; l++) {
      var op = s.layers === 1 ? 1 : [1, 0.6, 0.4, 0.25][s.layers - 1 - l] || 1;
      paths.push('<path fill="' + fill + '"' + (op < 1 ? ' fill-opacity="' + op + '"' : "") + ' d="' + wavePath(s.seed, s.n, s.r, l, s.layers, s.flip) + '"/>');
    }
    return '<svg xmlns="' + SVGNS + '" viewBox="' + vb + '"' + (blob ? ' width="400" height="400"' : ' width="' + WW + '" height="' + WH + '" preserveAspectRatio="none"') + ">" + defs + paths.join("") + "</svg>";
  }
  // URL hash <-> state. Every value is validated, so a crafted link can only produce a valid shape.
  function toHash(s) { return "#" + ["mode", "seed", "n", "r", "layers", "flip", "fill", "c1", "c2"].map(function (k) { return k + "=" + encodeURIComponent(k[0] === "c" ? s[k].slice(1) : s[k] === true ? 1 : s[k] === false ? 0 : s[k]); }).join("&"); }
  function fromHash(hash, base) {
    var p = new URLSearchParams(String(hash || "").replace(/^#/, "")), s = Object.assign({}, base || DEF);
    function int(k, lo, hi) { var v = parseInt(p.get(k), 10); if (!isNaN(v)) s[k] = Math.min(hi, Math.max(lo, v)); }
    if (p.get("mode") === "blob" || p.get("mode") === "wave") s.mode = p.get("mode");
    int("seed", 0, 2147483647); int("r", 0, 100); int("layers", 1, 4);
    int("n", s.mode === "blob" ? 3 : 1, s.mode === "blob" ? 12 : 10);
    if (p.has("flip")) s.flip = p.get("flip") === "1";
    if (p.get("fill") === "solid" || p.get("fill") === "grad") s.fill = p.get("fill");
    ["c1", "c2"].forEach(function (k) { var v = p.get(k); if (v && /^[0-9a-f]{6}$/i.test(v)) s[k] = "#" + v.toLowerCase(); });
    return s;
  }

  // ---------- UI ----------
  var st = fromHash(location.hash, Object.assign({}, DEF, S3.store("blob.state") || {}));
  var preview = $("#preview");

  function render() {
    var svg = svgString(st), doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    preview.textContent = "";
    preview.appendChild(document.importNode(doc.documentElement, true));
    preview.classList.toggle("wave", st.mode === "wave");
    $("#code").textContent = svg;
    var isBlob = st.mode === "blob", n = $("#n");
    n.min = isBlob ? 3 : 1; n.max = isBlob ? 12 : 10; n.value = st.n;
    $("#n-label").textContent = isBlob ? "Complexity (points)" : "Waves";
    $("#n-v").textContent = st.n; $("#r").value = st.r; $("#r-v").textContent = st.r + "%";
    $("#layers").value = st.layers; $("#layers-v").textContent = st.layers; $("#flip").checked = st.flip;
    $("#wave-only").hidden = isBlob;
    $("#c1").value = st.c1; $("#c2").value = st.c2; $("#c2").hidden = st.fill !== "grad"; $("#swap").hidden = st.fill !== "grad";
    if (document.activeElement !== $("#seed")) $("#seed").value = st.seed;
    $$("#mode button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.v === st.mode)); });
    $$("#fill button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.v === st.fill)); });
    history.replaceState(null, "", toHash(st));
    S3.store("blob.state", st);
  }
  function newSeed() { return Math.floor(Math.random() * 2147483647); }

  $$("#mode button").forEach(function (b) { b.addEventListener("click", function () {
    if (st.mode === b.dataset.v) return;
    st.mode = b.dataset.v; st.n = st.mode === "blob" ? 6 : 3; render();
  }); });
  $$("#fill button").forEach(function (b) { b.addEventListener("click", function () { st.fill = b.dataset.v; render(); }); });
  $("#n").addEventListener("input", function () { st.n = +this.value; render(); });
  $("#r").addEventListener("input", function () { st.r = +this.value; render(); });
  $("#layers").addEventListener("input", function () { st.layers = +this.value; render(); });
  $("#flip").addEventListener("change", function () { st.flip = this.checked; render(); });
  $("#c1").addEventListener("input", function () { st.c1 = this.value; render(); });
  $("#c2").addEventListener("input", function () { st.c2 = this.value; render(); });
  $("#swap").addEventListener("click", function () { var t = st.c1; st.c1 = st.c2; st.c2 = t; render(); });
  $("#seed").addEventListener("input", function () { var v = parseInt(this.value, 10); if (!isNaN(v) && v >= 0) { st.seed = Math.min(v, 2147483647); render(); } });
  $("#regen").addEventListener("click", function () { st.seed = newSeed(); render(); S3.done(); });
  PALETTES.forEach(function (p, i) { $("#palettes").appendChild(h("button", { "class": "pal", "data-i": i, title: p.join(" → "), "aria-label": "Palette " + p.join(" to "), style: "background:linear-gradient(135deg," + p[0] + "," + p[1] + ")" })); });
  $("#palettes").addEventListener("click", function (e) { var b = e.target.closest(".pal"); if (!b) return; var p = PALETTES[+b.dataset.i]; st.c1 = p[0]; st.c2 = p[1]; st.fill = "grad"; render(); });
  window.addEventListener("hashchange", function () { st = fromHash(location.hash, st); render(); });

  function fileBase() { return (st.mode === "blob" ? "blob-" : "wave-") + st.seed; }
  $("#svg-dl").addEventListener("click", function () { S3.download(svgString(st), fileBase() + ".svg", "image/svg+xml"); S3.done(); });
  $("#copy-svg").addEventListener("click", function () { S3.copy(svgString(st), "SVG copied"); S3.done(); });
  $("#copy-link").addEventListener("click", function () { S3.copy(location.href, "Link copied"); });
  $("#png-dl").addEventListener("click", function () {
    var W = +$("#png-size").value, H = st.mode === "blob" ? W : Math.round(W * WH / WW);
    var url = URL.createObjectURL(new Blob([svgString(st)], { type: "image/svg+xml" })), img = new Image();
    img.onload = function () {
      var c = document.createElement("canvas"); c.width = W; c.height = H;
      c.getContext("2d").drawImage(img, 0, 0, W, H); URL.revokeObjectURL(url);
      c.toBlob(function (b) { S3.download(b, fileBase() + "-" + W + ".png", "image/png"); S3.done(); }, "image/png");
    };
    img.onerror = function () { URL.revokeObjectURL(url); S3.toast("Could not render the PNG", "error"); };
    img.src = url;
  });

  render();

  window.S3_DEMO = function () { st = Object.assign({}, DEF, { seed: 20260, n: 7, r: 55 }); render(); };

  window.S3_SELFTEST = function () {
    var r = mulberry32(42), a = [r(), r(), r()];
    var p1 = blobPath(7, 6, 50), p2 = blobPath(7, 6, 50), p3 = blobPath(8, 6, 50);
    var w = wavePath(3, 4, 40, 0, 1, false);
    var s = { mode: "wave", seed: 99, n: 4, r: 30, layers: 2, flip: true, fill: "solid", c1: "#112233", c2: "#445566" };
    var back = fromHash(toHash(s), DEF);
    var evil = fromHash("#mode=blob&n=999&c1=" + encodeURIComponent('red"/><script>') + "&seed=-5&fill=x", DEF);
    var doc = new DOMParser().parseFromString(svgString(Object.assign({}, DEF, { seed: 5 })), "image/svg+xml");
    var circle = blobPath(1, 8, 0).match(/[MC][^MCZ]*/g);
    return a[0] === 0.6011037519201636 && a[1] === 0.44829055899754167 && a[2] === 0.8524657934904099 &&
      p1 === p2 && p1 !== p3 && /^M[\d.]+ [\d.]+(C[\d. -]+){6}Z$/.test(p1) &&
      (w.match(/C/g) || []).length === 8 && /L1440 320L0 320Z$/.test(w) && /L1440 0L0 0Z$/.test(wavePath(3, 4, 40, 0, 1, true)) &&
      JSON.stringify(back) === JSON.stringify(s) &&
      evil.n === 12 && evil.c1 === DEF.c1 && evil.seed === 0 && evil.fill === DEF.fill &&
      !doc.querySelector("parsererror") && doc.documentElement.querySelectorAll("path").length === 1 &&
      circle.length === 9 && circle[0] === "M" + f1(200 + 150 * Math.cos(mulberry32(1)() * Math.PI * 2)) + " " + f1(200 + 150 * Math.sin(mulberry32(1)() * Math.PI * 2));
  };
})();
