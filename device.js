// Desktop / Mobile view tabs for reviewers: one link, two views.
// ?device=mobile shows the page inside a phone-sized frame; ?frame=1 is the page running inside that frame.
(function () {
  var p = new URLSearchParams(location.search);
  if (p.get("frame") === "1") return;
  // review links only (localhost and *.vercel.app): the real site on upgrad.com never shows these tabs
  if (!/^(localhost|127\.0\.0\.1)$|\.vercel\.app$/.test(location.hostname)) return;
  var narrow = matchMedia("(max-width: 640px), (pointer: coarse)").matches;
  var mobile = p.get("device") === "mobile";
  if (mobile && narrow) { location.replace(location.pathname); return; } // already on a phone
  if (narrow) return; // real phones get the phone layout already, so no tabs

  // review options carried from the link into both views
  var keep = ["date"].map(function (k) { return p.get(k) ? "&" + k + "=" + encodeURIComponent(p.get(k)) : ""; }).join("");

  var tabs =
    '<nav class="view-tabs" aria-label="Preview size">' +
      '<a href="' + location.pathname + (keep ? "?" + keep.slice(1) : "") + '"' + (mobile ? "" : ' class="on" aria-current="page"') + ">Desktop view</a>" +
      '<a href="?device=mobile' + keep + '"' + (mobile ? ' class="on" aria-current="page"' : "") + ">Mobile view</a>" +
    "</nav>";

  if (mobile) {
    window.__DEVICE_WRAP = true;
    document.documentElement.classList.add("device-mode");
    document.body.innerHTML =
      '<div class="device-wrap">' + tabs +
        '<div class="phone"><iframe title="Mobile view of the page" src="?frame=1' + keep + '"></iframe></div>' +
        '<p class="device-note">390 × 844 phone preview</p>' +
      "</div>";
    return;
  }
  document.body.insertAdjacentHTML("beforeend", tabs);
})();
