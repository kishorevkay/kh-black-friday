// Everything below the hero: the lead form, the "Explore Offer" buttons and the scroll-linked word strips.
(function () {
  "use strict";
  if (window.__DEVICE_WRAP) return;

  // Where leads are sent.
  // - On the Vercel site: this site's own /api/lead.
  // - On any other host (for example the copy the tech team puts on upgrad.com): the same API by its full address,
  //   so leads from every copy land in one list and show in /admin on Vercel.
  // - On the plain local preview (port 5260) there is no API: the form only validates and shows a "preview" note.
  var LOCAL_PREVIEW = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.port === "5260";
  var LEAD_HOME = "https://blackfridaykh.vercel.app";
  var LEAD_API = LOCAL_PREVIEW ? "" : (/^(localhost|127\.0\.0\.1)$|\.vercel\.app$/.test(location.hostname) ? "/api/lead" : LEAD_HOME + "/api/lead");
  // one id per page load, so a double press or a retry updates the same row instead of adding a second lead
  var LEAD_ID = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
    : "l-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8);

  /* ---------- lead form ---------- */
  var form = document.getElementById("lead");
  var f = {
    name: document.getElementById("fName"),
    phone: document.getElementById("fPhone"),
    email: document.getElementById("fEmail"),
    course: document.getElementById("fCourse")
  };
  if (document.getElementById("fCountry")) f.country = document.getElementById("fCountry"); // added 18 Nov
  var e = {
    name: document.getElementById("eName"),
    phone: document.getElementById("ePhone"),
    email: document.getElementById("eEmail"),
    course: document.getElementById("eCourse"),
    country: document.getElementById("eCountry"),
    form: document.getElementById("eForm")
  };
  var submitBtn = document.getElementById("fSubmit");
  var consentBox = document.getElementById("fConsent"), consentErr = document.getElementById("eConsent"), consentAt = "";
  function checkConsent() {
    if (!consentBox) return true; // an older page without the tick box: still send the lead (stored as consent: false)
    var ok = consentBox.checked;
    consentErr.textContent = ok ? "" : "Tick the box to continue";
    consentBox.closest(".field").classList.toggle("bad", !ok);
    consentBox.setAttribute("aria-invalid", ok ? "false" : "true");
    return ok;
  }
  if (consentBox) consentBox.addEventListener("change", function () {
    consentAt = consentBox.checked ? new Date().toISOString() : "";
    if (consentErr && consentErr.textContent) checkConsent();
  });

  function check(key) {
    var v = f[key].value.trim(), msg = "";
    if (key === "name" && (v.length < 2 || /[<>]/.test(v))) msg = "Enter your full name";
    if (key === "phone" && !/^\+?\d{7,15}$/.test(v.replace(/[\s\-()]/g, ""))) msg = "Enter a valid mobile number";
    if (key === "email" && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(v)) msg = "Enter a valid email address";
    if (key === "course" && !v) msg = "Pick a course";
    if (key === "country" && !/^[A-Z]{2}$/.test(v)) msg = "Pick your country";
    e[key].textContent = msg;
    f[key].parentNode.classList.toggle("bad", !!msg);
    f[key].setAttribute("aria-invalid", msg ? "true" : "false");
    return !msg;
  }
  Object.keys(f).forEach(function (key) {
    f[key].addEventListener("input", function () { if (e[key].textContent) check(key); });
    f[key].addEventListener("change", function () { if (e[key].textContent) check(key); });
  });

  function done(sent) {
    document.getElementById("offer").classList.add("sent"); // hides the pop-up's heading: only the thank-you shows
    form.innerHTML =
      '<div class="lead-done" role="status">' +
        "<h3>Got it.</h3>" +
        "<p>Our advisor will get in touch with your offer and enrolment details.</p>" +
        (sent ? "" : '<p class="preview-note">Preview only: this local copy does not save leads, so nothing was sent.</p>') +
      "</div>";
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var ok = true, first = null;
    Object.keys(f).forEach(function (key) {
      if (!check(key)) { ok = false; if (!first) first = f[key]; }
    });
    if (!checkConsent()) { ok = false; if (!first) first = consentBox; }
    e.form.textContent = "";
    if (!ok) {
      first.focus({ preventScroll: true });
      // on short phones the pop-up scrolls: bring the whole field and its message into view, not just the input
      first.closest(".field").scrollIntoView({ block: "nearest", behavior: "smooth" });
      return;
    }
    if (!LEAD_API) { done(false); return; }

    var lead = {
      id: LEAD_ID,
      name: f.name.value.trim(),
      phone: f.phone.value.trim(),
      email: f.email.value.trim(),
      course: f.course.value,
      countryChosen: f.country ? f.country.value : "",
      consent: !!(consentBox && consentBox.checked),
      consentAt: consentBox && consentBox.checked ? consentAt || new Date().toISOString() : "",
      source: location.search.slice(0, 400),
      ref: document.referrer.slice(0, 200)
    };
    submitBtn.disabled = true;
    fetch(LEAD_API, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(lead) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); done(true); })
      .catch(function () {
        submitBtn.disabled = false;
        e.form.textContent = "Couldn't send your details. Try again.";
      });
  });

  /* ---------- the form pop-up ---------- */
  // Opens from every offer button, and once by itself 3 seconds after landing.
  var dock = document.getElementById("offer");
  var shade = document.getElementById("dockShade");
  var opener = null, everOpened = false;
  function firstField() { return document.getElementById("fName") || dock; }
  function openDock(from, quiet) {
    if (dock.classList.contains("open")) return;
    everOpened = true;
    opener = from || null;
    dock.classList.add("open");
    dock.setAttribute("role", "dialog"); dock.setAttribute("aria-modal", "true");
    shade.hidden = false;
    document.documentElement.style.overflow = "hidden";
    // A tap asked for the form, so the cursor goes straight in. When it opens by itself the keyboard stays down.
    setTimeout(function () { var el = quiet ? dock : firstField(); if (el.focus) el.focus({ preventScroll: true }); }, 360);
  }
  function closeDock() {
    if (!dock.classList.contains("open")) return;
    dock.classList.remove("open");
    dock.removeAttribute("role"); dock.removeAttribute("aria-modal");
    shade.hidden = true;
    document.documentElement.style.overflow = "";
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }
  // once per visit (per browser tab), so a reload or coming back from a course page does not nag
  var POP_KEY = "khbf_pop_shown", POP_DELAY = 3000;
  function popSeen() { try { return sessionStorage.getItem(POP_KEY) === "1"; } catch (x) { return false; } }
  if (!popSeen()) setTimeout(function () {
    if (everOpened || document.hidden) return;
    try { sessionStorage.setItem(POP_KEY, "1"); } catch (x) {}
    openDock(null, true);
  }, POP_DELAY);
  document.getElementById("dockX").addEventListener("click", closeDock);
  shade.addEventListener("click", closeDock);
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") closeDock(); });
  if (!dock.hasAttribute("tabindex")) dock.setAttribute("tabindex", "-1");

  // Every "Get My Offer", "Explore Offer" and "Help Me Choose" button opens the form; the last two also pick the course.
  Array.prototype.forEach.call(document.querySelectorAll('a[href="#offer"]'), function (a) {
    a.addEventListener("click", function (ev) {
      ev.preventDefault();
      var c = a.getAttribute("data-course");
      if (c && document.getElementById("fCourse")) {
        f.course.value = c;
        if (e.course.textContent) check("course");
      }
      openDock(a);
    });
  });

  // The tapped course lights up as its page opens, then goes back to normal: on its own after a moment,
  // and for certain when the visitor comes back to this tab.
  var courseLinks = document.querySelectorAll(".c-list a"), pickT = 0;
  function unpick() { clearTimeout(pickT); Array.prototype.forEach.call(courseLinks, function (o) { o.classList.remove("picked"); o.blur(); }); }
  Array.prototype.forEach.call(courseLinks, function (a) {
    a.addEventListener("click", function () {
      unpick(); a.classList.add("picked");
      pickT = setTimeout(unpick, 900);
    });
  });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) unpick(); });
  window.addEventListener("pageshow", unpick);

  /* ---------- word strips that slide with the scroll ---------- */
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var strips = [];
  function buildStrips() {
    strips = Array.prototype.map.call(document.querySelectorAll(".strip"), function (el) {
      var words = el.getAttribute("data-words").split("|");
      var unit = el.hasAttribute("data-unit")
        ? '<span><b class="unit"></b></span>'
        : "<span>" + words.map(function (w) { return w + "<i>/</i>"; }).join("") + "</span>";
      el.innerHTML = '<div class="strip-row">' + unit + "</div>";
      var row = el.firstChild;
      var w = row.firstChild.getBoundingClientRect().width || 1;
      row.innerHTML = new Array(Math.ceil(window.innerWidth / w) + 3).join(unit);
      return { el: el, row: row, w: w, dir: +el.getAttribute("data-dir") || 1 };
    });
  }
  function drawStrips() {
    var vh = window.innerHeight;
    for (var i = 0; i < strips.length; i++) {
      var s = strips[i], r = s.el.getBoundingClientRect();
      if (r.bottom < -50 || r.top > vh + 50) continue;
      var off = reduce ? 0 : s.dir * (vh - r.top) * 0.45;
      off = ((off % s.w) + s.w) % s.w;
      s.row.style.transform = "translate3d(" + (off - s.w).toFixed(1) + "px,0,0)";
    }
  }
  var queued = false;
  function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; drawStrips(); });
  }
  function startStrips() { buildStrips(); drawStrips(); }
  window.addEventListener("scroll", onScroll, { passive: true });
  var rt;
  window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(startStrips, 150); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(startStrips); else startStrips();
})();
