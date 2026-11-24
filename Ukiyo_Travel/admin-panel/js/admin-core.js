/* =========================================================
   Ukiyo Travel — Command Center core
   Router, toasts, dialogs, forms, tables, SVG charts, error policy.
   Requires: js/auth-api.js
========================================================= */
(function () {
  "use strict";
  const Auth = window.UkiyoAuth;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
  const num = (n) => Number(n || 0).toLocaleString("en-IN");
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
  const fmtDateTime = (d) => (d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
  const fmtDay = (iso) => (iso ? fmtDate(iso + "T00:00:00") : "—");
  const longDay = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const initials = (name) => String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
  const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const cap = (s) => String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1);

  /* ---------------- Error policy ----------------
     401 / deactivated -> back to login.  403 -> access denied screen.
     400/409/500/network -> a message; NEVER a redirect. */
  function msg(err, fallback) { return Auth.friendlyError(err, fallback || "Something went wrong. Please try again."); }
  function handleAuth(err) {
    if (!err) return false;
    if (err.status === 401 || err.code === "ACCOUNT_DEACTIVATED") {
      Auth.logout();
      window.location.href = "login.html";
      return true;
    }
    if (err.status === 403) { showGuard("You don't have admin access.", { home: true }); return true; }
    return false;
  }
  /** Run an API promise; auth failures are handled globally, everything else is rethrown. */
  async function call(promise) {
    try { return await promise; } catch (err) { if (handleAuth(err)) throw Object.assign(err, { handled: true }); throw err; }
  }

  /* ---------------- Toasts ---------------- */
  function toast(message, type = "success") {
    const root = $("#toastRoot");
    const el = document.createElement("div");
    el.className = "a-toast " + type;
    el.innerHTML = `<i class="bi ${type === "error" ? "bi-exclamation-octagon" : type === "success" ? "bi-check-circle" : "bi-info-circle"}"></i><span>${esc(message)}</span>`;
    root.appendChild(el);
    setTimeout(() => { el.style.transition = ".25s"; el.style.opacity = "0"; setTimeout(() => el.remove(), 260); }, type === "error" ? 4200 : 2600);
  }

  /* ---------------- Modals ---------------- */
  function openModal({ title, body = "", footer = "", size = "", onClose }) {
    const wrap = document.createElement("div");
    wrap.className = "a-modal-back";
    wrap.innerHTML = `
      <div class="a-modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="a-modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Close"><i class="bi bi-x-lg"></i></button></div>
        <div class="a-modal-body">${body}</div>
        ${footer ? `<div class="a-modal-foot">${footer}</div>` : ""}
      </div>`;
    $("#modalRoot").appendChild(wrap);
    const close = () => { document.removeEventListener("keydown", onKey); wrap.remove(); if (onClose) onClose(); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    wrap.addEventListener("mousedown", (e) => { if (e.target === wrap) close(); });
    wrap.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
    return { el: wrap, body: wrap.querySelector(".a-modal-body"), foot: wrap.querySelector(".a-modal-foot"), close };
  }

  function confirmDialog({ title = "Are you sure?", message = "", confirmText = "Confirm", danger = false }) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (!done) { done = true; resolve(v); } };
      const m = openModal({
        title: "", size: "sm", onClose: () => finish(false),
        body: `<div class="confirm-body"><div class="confirm-ic ${danger ? "danger" : ""}"><i class="bi ${danger ? "bi-trash3" : "bi-question-lg"}"></i></div><h4>${esc(title)}</h4><p>${esc(message)}</p></div>`,
        footer: `<button class="btn-ghost" data-close>Cancel</button><button class="${danger ? "btn-danger-a" : "btn-primary-a"}" data-ok>${esc(confirmText)}</button>`,
      });
      m.el.querySelector(".a-modal-head").style.display = "none";
      m.el.querySelector("[data-ok]").addEventListener("click", () => { finish(true); m.close(); });
      m.el.querySelector("[data-ok]").focus();
    });
  }

  /* ---------------- Form modal with validation ----------------
     fields: { name, label, type: text|number|textarea|select|checkbox|url|email, required, options:[[value,label]], hint, full, min, max, step, placeholder, maxlength }
     onSubmit(values) -> Promise; throw to show the error inside the form. */
  function formModal({ title, fields, values = {}, submitText = "Save", onSubmit, size = "" }) {
    const html = fields.map((f) => {
      const v = values[f.name] == null ? "" : values[f.name];
      let input;
      if (f.type === "textarea") input = `<textarea name="${f.name}" ${f.maxlength ? `maxlength="${f.maxlength}"` : ""} placeholder="${esc(f.placeholder || "")}">${esc(v)}</textarea>`;
      else if (f.type === "select") input = `<select name="${f.name}">${(f.options || []).map(([val, lab]) => `<option value="${esc(val)}" ${String(val) === String(v) ? "selected" : ""}>${esc(lab)}</option>`).join("")}</select>`;
      else if (f.type === "checkbox") input = `<label class="f-check"><input type="checkbox" name="${f.name}" ${v === true || v === "true" ? "checked" : ""}> ${esc(f.label)}</label>`;
      else input = `<input name="${f.name}" type="${f.type || "text"}" value="${esc(v)}" ${f.min != null ? `min="${f.min}"` : ""} ${f.max != null ? `max="${f.max}"` : ""} ${f.step ? `step="${f.step}"` : ""} ${f.maxlength ? `maxlength="${f.maxlength}"` : ""} placeholder="${esc(f.placeholder || "")}" ${f.readonly ? "readonly" : ""} autocomplete="off">`;
      return `<div class="f-field ${f.full || f.type === "textarea" || f.type === "checkbox" ? "full" : ""}" data-f="${f.name}">
        ${f.type === "checkbox" ? "" : `<label>${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ""}</label>`}${input}
        ${f.hint ? `<div class="f-hint">${esc(f.hint)}</div>` : ""}<div class="f-err"></div></div>`;
    }).join("");
    const m = openModal({
      title, size,
      body: `<div class="form-banner" id="fBanner"></div><form novalidate><div class="f-grid">${html}</div></form>`,
      footer: `<button type="button" class="btn-ghost" data-close>Cancel</button><button type="button" class="btn-primary-a" data-save>${esc(submitText)}</button>`,
    });
    const form = m.body.querySelector("form");
    const banner = m.body.querySelector("#fBanner");
    const saveBtn = m.foot.querySelector("[data-save]");

    function collect() {
      const out = {};
      fields.forEach((f) => {
        const el = form.elements[f.name];
        if (!el) return;
        out[f.name] = f.type === "checkbox" ? el.checked : el.value.trim();
      });
      return out;
    }
    function validate(vals) {
      let ok = true;
      fields.forEach((f) => {
        const box = form.querySelector(`[data-f="${f.name}"]`);
        let err = "";
        const v = vals[f.name];
        if (f.required && (v === "" || v == null)) err = `${f.label} is required.`;
        else if (v !== "" && f.type === "number") {
          const n = Number(v);
          if (!Number.isFinite(n)) err = "Enter a valid number.";
          else if (f.min != null && n < f.min) err = `Must be at least ${f.min}.`;
          else if (f.max != null && n > f.max) err = `Must be at most ${f.max}.`;
        } else if (v !== "" && f.type === "email" && !/^\S+@\S+\.\S+$/.test(v)) err = "Enter a valid email address.";
        else if (v !== "" && f.type === "url" && !/^(https?:\/\/|assets\/|\/)/i.test(v)) err = "Enter a link starting with https://";
        box.classList.toggle("invalid", !!err);
        box.querySelector(".f-err").textContent = err;
        if (err) ok = false;
      });
      return ok;
    }
    async function submit() {
      banner.classList.remove("show");
      const vals = collect();
      if (!validate(vals)) { const first = form.querySelector(".invalid input,.invalid select,.invalid textarea"); if (first) first.focus(); return; }
      saveBtn.disabled = true;
      const orig = saveBtn.innerHTML;
      saveBtn.innerHTML = "Saving…";
      try {
        await onSubmit(vals);
        m.close();
      } catch (err) {
        if (err && err.handled) return;
        banner.textContent = msg(err, "Unable to save. Please try again.");
        banner.classList.add("show");
        saveBtn.disabled = false;
        saveBtn.innerHTML = orig;
      }
    }
    saveBtn.addEventListener("click", submit);
    form.addEventListener("submit", (e) => { e.preventDefault(); submit(); });
    const first = form.querySelector("input:not([readonly]),select,textarea"); if (first) first.focus();
    return m;
  }

  /* ---------------- UI helpers ---------------- */
  const badge = (status, label) => `<span class="badge-status ${esc(status)}">${esc(label || status)}</span>`;
  const bookingLabel = (s) => (s === "pending" ? "Pending Payment" : cap(s));
  const payTag = (m) => (m ? `<span class="pay-tag">${esc(m === "netbanking" ? "Net banking" : m)}</span>` : '<span class="na">—</span>');

  function table(headers, rows, { foot = "" } = {}) {
    return `<div class="table-wrap"><table class="admin-table">
      <thead><tr>${headers.map((h) => (typeof h === "string" ? `<th>${h}</th>` : `<th class="${h.cls || ""}">${h.label}</th>`)).join("")}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td class="${typeof headers[i] === "object" ? headers[i].cls || "" : ""}">${c}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>${foot ? `<div class="table-foot">${foot}</div>` : ""}</div>`;
  }
  const skeleton = (n = 4) => Array.from({ length: n }, () => '<div class="skeleton sk-row"></div>').join("");
  const emptyState = (icon, title, sub = "", action = "") => `<div class="state-box"><i class="bi ${icon}"></i><h4>${esc(title)}</h4><p>${esc(sub)}</p>${action}</div>`;
  function errorState(el, err, retry, fallback) {
    if (err && err.handled) return;
    el.innerHTML = `<div class="state-box error"><i class="bi bi-cloud-slash"></i><h4>${esc(msg(err, fallback || "Couldn't load this section."))}</h4><p>Nothing has been changed.</p><button class="btn-ghost" data-retry><i class="bi bi-arrow-clockwise"></i> Try again</button></div>`;
    const b = el.querySelector("[data-retry]"); if (b) b.addEventListener("click", retry);
  }
  const stars = (avg, cls = "") => `<span class="stars ${cls}" style="--p:${Math.max(0, Math.min(100, ((avg || 0) / 5) * 100))}%" aria-label="${avg || 0} out of 5">★★★★★</span>`;
  const searchBox = (id, ph, val = "") => `<div class="search-box"><i class="bi bi-search"></i><input id="${id}" type="search" placeholder="${esc(ph)}" value="${esc(val)}" autocomplete="off"></div>`;

  function downloadCSV(filename, headers, rows) {
    const q = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((r) => r.map(q).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------------- SVG charts (no external library) ---------------- */
  const niceMax = (v) => { if (v <= 5) return Math.max(1, Math.ceil(v)); const p = Math.pow(10, Math.floor(Math.log10(v))); return Math.ceil(v / p) * p; };
  const shortDay = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

  function lineChart(data, { color = "#17BEBB", fmt = (v) => num(v), id = "lc" } = {}) {
    const W = 600, H = 190, L = 44, R = 12, T = 12, B = 26;
    const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
    const x = (i) => L + (data.length === 1 ? 0 : (i * (W - L - R)) / (data.length - 1));
    const y = (v) => T + (1 - v / max) * (H - T - B);
    const pts = data.map((d, i) => [x(i), y(d.value)]);
    const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    const area = line + ` L${x(data.length - 1).toFixed(1)} ${H - B} L${x(0).toFixed(1)} ${H - B} Z`;
    const grid = [0, 0.5, 1].map((f) => `<line x1="${L}" x2="${W - R}" y1="${y(max * f)}" y2="${y(max * f)}" stroke="#EEF3F3"/><text x="${L - 8}" y="${y(max * f) + 3}" text-anchor="end">${fmt(Math.round(max * f))}</text>`).join("");
    const step = Math.ceil(data.length / 6);
    const xl = data.map((d, i) => (i % step === 0 || i === data.length - 1 ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${shortDay(d.date)}</text>` : "")).join("");
    const dots = data.map((d, i) => `<circle cx="${x(i)}" cy="${y(d.value)}" r="${d.value ? 3.4 : 0}" fill="#fff" stroke="${color}" stroke-width="2"><title>${shortDay(d.date)}: ${fmt(d.value)}</title></circle>`).join("");
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${area}" fill="url(#${id})"/><path d="${line}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>${dots}${xl}</svg>`;
  }

  function barChart(data, { color = "#17BEBB", fmt = (v) => num(v) } = {}) {
    const W = 600, H = 190, L = 36, R = 8, T = 14, B = 28;
    const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
    const bw = (W - L - R) / data.length;
    const bars = data.map((d, i) => {
      const h = (d.value / max) * (H - T - B), bx = L + i * bw + bw * 0.2;
      return `<rect x="${bx}" y="${H - B - h}" width="${bw * 0.6}" height="${Math.max(h, d.value ? 2 : 0)}" rx="6" fill="${color}"><title>${esc(d.label)}: ${fmt(d.value)}</title></rect>
        ${d.value ? `<text x="${bx + bw * 0.3}" y="${H - B - h - 5}" text-anchor="middle" style="fill:#4A5A6A;font-weight:700">${fmt(d.value)}</text>` : ""}
        <text x="${bx + bw * 0.3}" y="${H - 9}" text-anchor="middle">${esc(d.label)}</text>`;
    }).join("");
    const grid = [0, 0.5, 1].map((f) => `<line x1="${L}" x2="${W - R}" y1="${H - B - f * (H - T - B)}" y2="${H - B - f * (H - T - B)}" stroke="#EEF3F3"/><text x="${L - 6}" y="${H - B - f * (H - T - B) + 3}" text-anchor="end">${fmt(Math.round(max * f))}</text>`).join("");
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${grid}${bars}</svg>`;
  }

  const PALETTE = { paid: "#2FA36B", confirmed: "#2FA36B", pending: "#E0952B", failed: "#E5484D", cancelled: "#E5484D", refunded: "#7A8CA3" };
  function donut(data, { totalLabel = "total" } = {}) {
    const total = data.reduce((s, d) => s + d.value, 0);
    if (!total) return `<div class="state-box" style="padding:30px 10px"><i class="bi bi-pie-chart"></i><p>No data yet.</p></div>`;
    const R = 52, C = 2 * Math.PI * R;
    let off = 0;
    const arcs = data.filter((d) => d.value).map((d) => {
      const len = (d.value / total) * C;
      const el = `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${PALETTE[d.name] || "#17BEBB"}" stroke-width="18" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"><title>${cap(d.name)}: ${d.value}</title></circle>`;
      off += len; return el;
    }).join("");
    const legend = data.map((d) => `<div class="legend-row"><i class="sw ${d.name}"></i>${cap(d.name)}<b>${d.value}</b><em>${Math.round((d.value / total) * 100)}%</em></div>`).join("");
    return `<div class="donut-wrap"><svg viewBox="0 0 140 140" role="img"><circle cx="70" cy="70" r="${R}" fill="none" stroke="#F0F4F4" stroke-width="18"/>${arcs}<text class="big" x="70" y="70" text-anchor="middle">${total}</text><text class="sm" x="70" y="86" text-anchor="middle">${totalLabel}</text></svg><div class="legend">${legend}</div></div>`;
  }
  function rankBars(items, fmt = num) {
    if (!items.length) return `<div class="state-box" style="padding:30px 10px"><i class="bi bi-bar-chart"></i><p>No data yet.</p></div>`;
    const max = Math.max(1, ...items.map((i) => i.value));
    return items.map((i) => `<div class="top-item"><div class="top-item-top"><strong>${esc(i.name)}</strong><span>${fmt(i.value)}</span></div><div class="top-track"><div class="top-fill" style="width:${(i.value / max) * 100}%"></div></div></div>`).join("");
  }

  /* ---------------- Guard + router ---------------- */
  function showGuard(message, { login = false, home = false, retry = null } = {}) {
    $("#shell").style.display = "none";
    $("#guard").style.display = "flex";
    $("#guardMsg").textContent = message;
    $("#guardLogin").style.display = login ? "inline-flex" : "none";
    $("#guardLink").style.display = home ? "inline-flex" : "none";
    const r = $("#guardRetry"); r.style.display = retry ? "inline-flex" : "none"; r.onclick = retry;
  }

  const views = {};
  const state = { view: null, params: {}, user: null };
  const A = {
    Auth, $, $$, esc, money, num, fmtDate, fmtDateTime, fmtDay, longDay, initials, debounce, cap,
    msg, call, handleAuth, toast, openModal, confirm: confirmDialog, formModal,
    badge, bookingLabel, payTag, table, skeleton, emptyState, errorState, stars, searchBox, downloadCSV,
    lineChart, barChart, donut, rankBars, views, state,
    register(name, def) { views[name] = def; },
    go(view, params = {}) {
      state.params = params;
      const hash = "#/" + view;
      if (location.hash === hash) render(); else location.hash = hash;
    },
  };
  window.Admin = A;

  function render() {
    const name = (location.hash.replace(/^#\/?/, "") || "dashboard").split("?")[0];
    const view = views[name] ? name : "dashboard";
    const def = views[view];
    const params = state.params || {}; state.params = {};
    state.view = view;
    $$(".admin-nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    $$(".view").forEach((s) => (s.hidden = s.id !== "view-" + view));
    $("#viewTitle").textContent = def.title; $("#viewSub").textContent = def.sub;
    document.title = def.title + " · Ukiyo Command Center";
    closeSidebar();
    window.scrollTo({ top: 0 });
    def.render($("#view-" + view), params);
  }
  A.refresh = () => render();

  const closeSidebar = () => { $("#sidebar").classList.remove("open"); $("#sideBackdrop").classList.remove("show"); };

  async function guard() {
    if (!Auth.getToken()) { showGuard("Please log in as an admin.", { login: true, home: true }); return false; }
    try {
      const res = await Auth.getProfile();
      if (!res.user || res.user.role !== "admin") { showGuard("You don't have admin access.", { home: true }); return false; }
      state.user = res.user;
      return true;
    } catch (err) {
      if (err.status === 401 || err.code === "ACCOUNT_DEACTIVATED") { showGuard("Your session has expired. Please log in again.", { login: true, home: true }); return false; }
      if (err.status === 403) { showGuard("You don't have admin access.", { home: true }); return false; }
      // 500 / network: not an auth problem — don't send anyone to the login page.
      showGuard(msg(err, "The server isn't responding right now."), { retry: init });
      return false;
    }
  }

  function wire() {
    $$(".admin-nav-item").forEach((b) => b.addEventListener("click", () => A.go(b.dataset.view)));
    window.addEventListener("hashchange", render);
    $("#logoutBtn").addEventListener("click", () => { Auth.logout(); window.location.href = "login.html"; });
    $("#menuBtn").addEventListener("click", () => { $("#sidebar").classList.add("open"); $("#sideBackdrop").classList.add("show"); });
    $("#sideBackdrop").addEventListener("click", closeSidebar);
  }

  let wired = false;
  async function init() {
    $("#guard").style.display = "flex"; $("#guardMsg").textContent = "Checking access…";
    ["guardLogin", "guardLink", "guardRetry"].forEach((id) => ($("#" + id).style.display = "none"));
    if (!(await guard())) return;
    $("#guard").style.display = "none"; $("#shell").style.display = "flex";
    const name = `${state.user.firstName} ${state.user.lastName}`;
    $("#adminName").textContent = name; $("#adminAvatar").textContent = initials(name);
    if (!wired) { wired = true; wire(); }
    if (A.afterLogin) A.afterLogin();
    render();
  }
  A.init = init;
  document.addEventListener("DOMContentLoaded", () => setTimeout(init, 0)); // runs after all view modules have registered
})();
