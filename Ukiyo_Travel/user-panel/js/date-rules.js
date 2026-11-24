/* =========================================================
   Ukiyo Travel — site-wide date rule
   Past dates can never be picked: today and future dates only.
   "Today" is detected at run time (never hardcoded):
     1. the server's date (business timezone) when the API is reachable
     2. otherwise the visitor's own clock
   Applies to EVERY <input type="date"> on the page, including ones added
   later. Add data-allow-past to an input only where past dates are valid
   (e.g. a date of birth field).
========================================================= */
(function () {
  "use strict";
  const MESSAGE = "Please select today or a future date.";
  const API_BASE = window.UKIYO_API_BASE || "http://localhost:5000";
  let serverToday = null;

  const pad = (n) => String(n).padStart(2, "0");
  function localToday() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  const today = () => serverToday || localToday();

  /** "" when the value is fine, otherwise the message to show. */
  function check(value) {
    if (!value) return "";
    return value < today() ? MESSAGE : "";
  }

  function errBox(input) {
    let box = input.parentElement && input.parentElement.querySelector(".date-rule-error");
    if (!box) {
      box = document.createElement("div");
      box.className = "date-rule-error";
      box.setAttribute("role", "alert");
      input.insertAdjacentElement("afterend", box);
    }
    return box;
  }

  function validateInput(input, clearIfInvalid) {
    const msg = check(input.value);
    const box = errBox(input);
    box.textContent = msg;
    box.style.display = msg ? "block" : "none";
    input.classList.toggle("is-invalid", !!msg);
    input.setCustomValidity(msg);
    if (msg && clearIfInvalid) input.value = "";
    return !msg;
  }

  function apply(root) {
    (root || document).querySelectorAll('input[type="date"]:not([data-allow-past])').forEach((el) => {
      el.min = today();
      if (!el.dataset.dateRule) {
        el.dataset.dateRule = "1";
        // Typing/pasting a past date is possible even with min= set, so check on every change.
        el.addEventListener("change", () => validateInput(el, false));
        el.addEventListener("input", () => { if (el.value) validateInput(el, false); });
        el.addEventListener("focus", () => { el.min = today(); }); // stays correct if the page is left open past midnight
      }
    });
  }

  async function sync() {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      const j = await res.json();
      if (j && /^\d{4}-\d{2}-\d{2}$/.test(j.today || "")) serverToday = j.today;
    } catch (_) { /* offline: fall back to the visitor's clock */ }
    apply();
  }

  document.addEventListener("DOMContentLoaded", () => {
    apply();
    sync();
    new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) apply(n); })))
      .observe(document.body, { childList: true, subtree: true });
  });

  window.UkiyoDates = { MESSAGE, today, check, apply, validateInput, sync };
})();
