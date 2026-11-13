(function () {
  "use strict";
  if (window.__DEVICE_WRAP) return; // the phone-frame wrapper page has no hero to run

  var hero = document.getElementById("hero");
  var heroIn = document.getElementById("heroIn");
  var walls = [document.getElementById("wall"), document.getElementById("wallLit")];
  var rig = document.getElementById("rig");
  var tilt = document.getElementById("tilt");
  var pass = document.getElementById("pass");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- word wall ---------- */
  var PHRASE = "<span>Close the <b>Gap</b></span>";
  var rows = [[], []];
  var phraseW = 1;

  function buildWall() {
    var probe = document.createElement("div");
    probe.className = "row";
    probe.style.cssText = "position:absolute;visibility:hidden";
    probe.innerHTML = PHRASE;
    walls[0].appendChild(probe);
    phraseW = probe.firstChild.getBoundingClientRect().width || 1;
    var rowH = probe.getBoundingClientRect().height || 60;
    walls[0].removeChild(probe);

    var n = Math.ceil(hero.clientHeight / rowH) + 1;
    var reps = Math.ceil(window.innerWidth / phraseW) + 1; // one spare phrase is enough: rows only ever shift by up to one phrase
    var html = new Array(reps + 1).join(PHRASE);
    walls.forEach(function (w, wi) {
      w.innerHTML = "";
      rows[wi] = [];
      for (var i = 0; i < n; i++) {
        var r = document.createElement("div");
        r.className = "row" + (i % 2 ? " o" : "");
        r.innerHTML = html;
        w.appendChild(r);
        rows[wi].push(r);
      }
    });
  }

  var wallAt = null;
  function drawWall(s) {
    if (wallAt !== null && Math.abs(s - wallAt) < 0.25) return; // nothing moved: leave the rows alone
    wallAt = s;
    for (var i = 0; i < rows[0].length; i++) {
      var dir = i % 2 ? 1 : -1;
      var off = dir * s * 0.45 + i * phraseW * 0.37;
      off = ((off % phraseW) + phraseW) % phraseW;
      var t = "translate3d(" + (off - phraseW).toFixed(1) + "px,0,0)";
      rows[0][i].style.transform = t;
      rows[1][i].style.transform = t;
    }
  }

  /* ---------- pass physics ---------- */
  var th = 0, om = 0;          // swing angle (deg) and speed (deg/s)
  var gyro = 0;                // lean from the phone's tilt
  var rx = 0, ry = 0, trx = 0, try_ = 0; // 3D tilt and its targets
  var sScroll = 0, lastY = window.scrollY;
  var pointerOn = false, lastPX = null, torchTimer = 0;
  var mx = 0.5, my = 0.42, tmx = 0.5, tmy = 0.42;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  window.addEventListener("scroll", function () {
    var y = window.scrollY, dy = y - lastY;
    lastY = y;
    if (!reduce) om += clamp(dy * 0.16, -22, 22);
    kick();
  }, { passive: true });

  function passPoint(e) {
    var r = pass.getBoundingClientRect();
    return { x: (e.clientX - (r.left + r.width / 2)) / r.width, y: (e.clientY - (r.top + r.height / 2)) / r.height };
  }
  function torchTo(e) {
    var r = hero.getBoundingClientRect();
    tmx = (e.clientX - r.left) / r.width;
    tmy = (e.clientY - r.top) / r.height;
  }

  hero.addEventListener("pointerdown", function (e) {
    pointerOn = true; lastPX = e.clientX; kick();
    clearTimeout(torchTimer);
    torchTo(e);
    if (reduce) return;
    var p = passPoint(e);
    if (Math.abs(p.x) < 0.9 && Math.abs(p.y) < 0.8) {
      om += clamp(-p.x * 55, -40, 40) || 14;
      try_ = clamp(p.x * 10, -7, 7);
      trx = clamp(-p.y * 8, -5, 5);
    }
  });
  hero.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "mouse" && !pointerOn) return;
    torchTo(e); kick();
    if (reduce) return;
    var p = passPoint(e);
    try_ = clamp(p.x * 9, -7, 7);
    trx = clamp(-p.y * 7, -5, 5);
    if (lastPX !== null) om += clamp((e.clientX - lastPX) * 0.22, -10, 10);
    lastPX = e.clientX;
  });
  function torchHome() {
    var r = hero.getBoundingClientRect(), c = tilt.getBoundingClientRect();
    tmx = (c.left + c.width / 2 - r.left) / r.width;
    tmy = (c.top + c.height * 0.45 - r.top) / r.height;
  }
  function release() {
    pointerOn = false; lastPX = null; trx = 0; try_ = 0;
    clearTimeout(torchTimer);
    torchTimer = setTimeout(function () { torchHome(); kick(); }, 900);
    kick();
  }
  hero.addEventListener("pointerup", release);
  hero.addEventListener("pointercancel", release);
  hero.addEventListener("pointerleave", release);

  // Android gives tilt without asking. iOS needs a permission prompt, so it is skipped there.
  if (!reduce && window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission !== "function") {
    window.addEventListener("deviceorientation", function (e) {
      if (e.gamma === null) return;
      var g = clamp(e.gamma * 0.22, -8, 8);
      if (Math.abs(g - gyro) < 0.25) return; // ignore hand tremor: about one degree of real tilt wakes the pass
      gyro = g; kick();
    });
  }

  var last = performance.now();
  var heroHidden = false, bornAt = performance.now();
  var fade = document.getElementById("heroFade");
  var sheen = pass.querySelector(".sheen"), shAt = 99, mxAt = -1, myAt = -1, pAt = -1;
  // The loop only runs while something is actually moving. Scroll, touch, tilt and resize wake it (kick).
  var running = false;
  var canSway = window.matchMedia("(hover: hover) and (pointer: fine)").matches; // the idle sway is for desktops; phones rest
  function kick() { if (running) return; running = true; last = performance.now(); requestAnimationFrame(frame); }
  function frame(now) {
    var busy = false;
    var dt = Math.min(0.032, (now - last) / 1000);
    last = now;
    var H = hero.clientHeight;
    var y = window.scrollY;
    sScroll += (y - sScroll) * 0.14;

    // Once the sheet fully covers the hero, stop drawing it: nothing can show through and the phone saves work.
    var covered = y >= H;
    if (covered !== heroHidden) { heroHidden = covered; heroIn.style.visibility = covered ? "hidden" : ""; }

    if (!covered) {
      drawWall(reduce ? 0 : sScroll);

      if (!reduce) {
        var target = gyro + (canSway ? Math.sin(now / 1700) * 0.5 : 0);
        // On landing the pass is let go from one side and swings like something hanging; the swing then dies down
        // (light damping for the first seconds, easing into the normal, calmer damping).
        var age = (now - bornAt) / 1000;
        var damp = age < 6 ? 0.7 + (3.6 - 0.7) * Math.pow(age / 6, 3) : 3.6;
        var acc = -42 * (th - target) - damp * om;
        om += acc * dt;
        th = clamp(th + om * dt, -12, 12);
        rx += (trx - rx) * 0.08;
        ry += (try_ + gyro * 0.6 - ry) * 0.08;
        rig.style.transform = "rotate(" + th.toFixed(2) + "deg)";
        tilt.style.transform = "rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg)";
        if (canSway || age < 7 || Math.abs(om) > 0.05 || Math.abs(th - target) > 0.05 || Math.abs(trx - rx) + Math.abs(try_ + gyro * 0.6 - ry) > 0.05) busy = true;
        var sh = ry * 2.6 + th * 2.2;
        if (Math.abs(sh - shAt) > 0.4) { shAt = sh; sheen.style.transform = "translateX(" + sh.toFixed(1) + "%)"; }
      }

      mx += (tmx - mx) * 0.14; my += (tmy - my) * 0.14;
      if (Math.abs(tmx - mx) + Math.abs(tmy - my) > 0.002) busy = true;
      if (Math.abs(mx - mxAt) + Math.abs(my - myAt) > 0.002) { // the torch repaints the lit wall, so only move it when it really moved
        mxAt = mx; myAt = my;
        walls[1].style.setProperty("--mx", (mx * 100).toFixed(1) + "%");
        walls[1].style.setProperty("--my", (my * 100).toFixed(1) + "%");
      }

      // The hero sinks back a little while the next section slides over it.
      var p = clamp(y / H, 0, 1);
      if (p !== pAt) {
        pAt = p;
        heroIn.style.transform = "scale(" + (1 - p * 0.07).toFixed(4) + ")";
        // The hero dims under ONE flat black layer. Fading the whole hero (dozens of moving layers) made the
        // phone blend all of them again on every scrolled frame.
        fade.style.opacity = (p * 0.65).toFixed(3);
      }
      if (Math.abs(y - sScroll) > 0.3) busy = true;
    }
    if (busy) requestAnimationFrame(frame); else running = false;
  }

  /* ---------- countdown ---------- */
  // Copy doc: a regular timer till the 27th, then one line each for the 28th, 29th and 30th.
  // The sale is taken to end at midnight on 30 Nov 2026, India time.
  var SALE_END = new Date("2026-11-30T23:59:59+05:30").getTime();
  var DAY_MSG = {
    28: "The deals are still here. The clock is ticking",
    29: "1 day left. Find your skill today.",
    30: "Last chance at Black Friday prices. Act now."
  };
  // Reviewers: add ?date=2026-11-29 to the link to see that day's line.
  var fakeDate = new URLSearchParams(location.search).get("date");
  var clockShift = fakeDate ? new Date(fakeDate + "T10:00:00+05:30").getTime() - Date.now() : 0;
  if (isNaN(clockShift)) clockShift = 0;

  var cLabel = document.getElementById("cLabel");
  var cMsg = document.getElementById("cMsg");
  var cEls = ["cD", "cH", "cM", "cS"].map(function (id) { return document.getElementById(id); });
  function two(n) { return (n < 10 ? "0" : "") + n; }
  function tick() {
    var now = Date.now() + clockShift;
    var ist = new Date(now + 5.5 * 3600 * 1000);
    var inNov = ist.getUTCFullYear() === 2026 && ist.getUTCMonth() === 10;
    var ended = now > SALE_END;
    var msg = !ended && inNov ? DAY_MSG[ist.getUTCDate()] || "" : "";
    cMsg.textContent = msg;
    cMsg.hidden = !msg;
    cLabel.textContent = ended ? "Sale ended" : "Ends in";
    var s = Math.max(0, Math.floor((SALE_END - now) / 1000));
    var v = [Math.floor(s / 86400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60];
    for (var i = 0; i < 4; i++) cEls[i].textContent = two(v[i]);
  }

  /* ---------- start ---------- */
  function start() {
    buildWall();
    drawWall(0);
    torchHome(); mx = tmx; my = tmy;
    tick();
    setInterval(tick, 1000);
    if (!reduce) { th = -11; om = 0; bornAt = performance.now(); } // the landing swing
    kick();
  }
  var resizeT;
  window.addEventListener("resize", function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () { buildWall(); wallAt = null; pAt = -1; if (!pointerOn) torchHome(); kick(); }, 150);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else start();
})();
