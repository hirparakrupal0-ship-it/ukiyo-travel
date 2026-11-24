/* Command Center — Bookings, Payments, Booking Calendar */
(function () {
  "use strict";
  const A = window.Admin, Auth = A.Auth, { $, $$, esc, money, call, toast, fmtDate, fmtDateTime, fmtDay, longDay } = A;
  const today = () => (window.__serverToday) || new Date().toLocaleDateString("en-CA");

  /* ============ BOOKINGS ============ */
  function renderBookings(el, params) {
    const f = { q: "", status: params.filter || "", type: "" };
    el.innerHTML = `<div class="toolbar">${A.searchBox("bkQ", "Search customer, trip, reference…")}
      <select id="bkS"><option value="">All statuses</option><option value="pending">Pending Payment</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option></select>
      <select id="bkT"><option value="">All types</option><option value="package">Packages</option><option value="destination">Destinations</option><option value="hotel">Hotels</option></select>
      <span class="result-count" id="bkC"></span></div><div id="bkBody">${A.skeleton(5)}</div>`;
    $("#bkS", el).value = f.status;
    let all = [];
    const paint = () => {
      const q = f.q.toLowerCase();
      const rows = all.filter((b) => (!f.status || b.status === f.status) && (!f.type || b.itemType === f.type) &&
        (!q || [b.title, b.reference, b.destination, b.user && b.user.firstName, b.user && b.user.lastName, b.user && b.user.email].some((v) => String(v || "").toLowerCase().includes(q))));
      $("#bkC", el).textContent = rows.length + " of " + all.length;
      $("#bkBody", el).innerHTML = !all.length ? A.emptyState("bi-suitcase", "No bookings yet", "Bookings appear here as soon as customers book a trip.")
        : !rows.length ? A.emptyState("bi-search", "No bookings match your filters", "Try clearing the search or filters.")
        : A.table(["Customer", "Trip", "Travel date", "Pax", "Amount", "Payment", "Status", { label: "", cls: "r" }], rows.map((b) => {
          const u = b.user || {};
          const paid = b.paymentStatus === "paid";
          const opts = [["pending", "Pending Payment"], ["confirmed", "Confirmed"], ["cancelled", "Cancelled"]]
            .map(([v, l]) => `<option value="${v}" ${b.status === v ? "selected" : ""} ${v === "confirmed" && !paid ? "disabled" : ""} ${v === "pending" && (paid || b.status === "cancelled") && b.status !== "pending" ? "disabled" : ""}>${l}${v === "confirmed" && !paid ? " (needs payment)" : ""}</option>`).join("");
          return [`<span class="cell-strong">${esc(u.firstName ? u.firstName + " " + u.lastName : "Deleted user")}</span><div class="cell-sub">${esc(u.email || "")}</div>`,
            `<span class="cell-strong">${esc(b.title)}</span><div class="cell-sub">${esc(b.itemType)} · ${esc(b.destination || "")}${b.reference ? ` · <span class="mono">${esc(b.reference)}</span>` : ""}</div>`,
            fmtDay(b.travelDate), b.travellers, `<b>${money(b.amount)}</b>`,
            b.payment ? A.badge(b.payment.status) : A.badge("unpaid"),
            `<select class="status-select" data-id="${b._id}" ${b.status === "cancelled" ? "disabled" : ""}>${opts}</select>`,
            `<div class="actions"><button class="icon-btn info" data-view-b="${b._id}" title="View details"><i class="bi bi-eye"></i></button><button class="icon-btn js-del" data-id="${b._id}" title="Delete"><i class="bi bi-trash"></i></button></div>`];
        }));
      $$(".status-select", el).forEach((s) => s.addEventListener("change", async () => {
        const b = all.find((x) => x._id === s.dataset.id);
        if (s.value === "cancelled" && !(await A.confirm({ title: "Cancel this booking?", message: b.paymentStatus === "paid" ? "The customer's payment will be marked as refunded." : "The customer will see it as cancelled.", confirmText: "Cancel booking", danger: true }))) { s.value = b.status; return; }
        try { const r = await call(Auth.adminSetBookingStatus(s.dataset.id, s.value)); toast(r.message); load(); } catch (e) { s.value = b.status; if (!e.handled) toast(A.msg(e), "error"); }
      }));
      $$(".js-del", el).forEach((x) => x.addEventListener("click", async () => {
        if (!(await A.confirm({ title: "Delete this booking?", message: "The booking and its payment records are removed permanently. Use Cancel to keep history.", confirmText: "Delete", danger: true }))) return;
        try { await call(Auth.adminDeleteBooking(x.dataset.id)); toast("Booking deleted"); load(); } catch (e) { if (!e.handled) toast(A.msg(e), "error"); }
      }));
      $$("[data-view-b]", el).forEach((x) => x.addEventListener("click", () => bookingModal(all.find((b) => b._id === x.dataset.viewB))));
    };
    async function load() { try { all = (await call(Auth.adminBookings())).bookings; paint(); } catch (e) { A.errorState($("#bkBody", el), e, load, "Couldn't load bookings."); } }
    $("#bkQ", el).addEventListener("input", A.debounce((e) => { f.q = e.target.value.trim(); paint(); }, 200));
    $("#bkS", el).addEventListener("change", (e) => { f.status = e.target.value; paint(); });
    $("#bkT", el).addEventListener("change", (e) => { f.type = e.target.value; paint(); });
    load();
  }
  function bookingModal(b) {
    const u = b.user || {};
    A.openModal({ title: "Booking details", body: `<dl class="kv">
      <dt>Reference</dt><dd class="mono">${esc(b.reference || "Not issued (awaiting payment)")}</dd>
      <dt>Customer</dt><dd>${esc(u.firstName ? u.firstName + " " + u.lastName : "Deleted user")} <span class="cell-sub">${esc(u.email || "")}</span></dd>
      <dt>Trip</dt><dd>${esc(b.title)} <span class="cell-sub">(${esc(b.itemType)})</span></dd>
      <dt>Destination</dt><dd>${esc(b.destination || "—")}</dd><dt>Travel date</dt><dd>${fmtDay(b.travelDate)}</dd>
      <dt>Travellers</dt><dd>${b.travellers}</dd><dt>Amount</dt><dd>${money(b.amount)}</dd>
      <dt>Booking status</dt><dd>${A.badge(b.status, A.bookingLabel(b.status))}</dd><dt>Payment</dt><dd>${b.payment ? A.badge(b.payment.status) + " " + A.payTag(b.payment.method) : A.badge("unpaid")}</dd>
      <dt>Notes</dt><dd>${esc(b.notes || "—")}</dd><dt>Created</dt><dd>${fmtDateTime(b.createdAt)}</dd>${b.paidAt ? `<dt>Paid</dt><dd>${fmtDateTime(b.paidAt)}</dd>` : ""}</dl>`,
      footer: '<button class="btn-ghost" data-close>Close</button>' });
  }
  A.register("bookings", { title: "Bookings", sub: "Manage and update customer bookings", render: renderBookings });

  /* ============ PAYMENTS ============ */
  function renderPayments(el, params) {
    const f = { q: "", status: params.filter || "", method: "", from: "", to: "" };
    el.innerHTML = `<div id="paySum" class="kpi-grid" style="grid-template-columns:repeat(5,1fr)">${Array.from({ length: 5 }, () => '<div class="skeleton sk-kpi"></div>').join("")}</div>
      <div class="toolbar">${A.searchBox("pyQ", "Search payment ID, booking, customer…")}
        <select id="pyS"><option value="">All statuses</option><option value="paid">Paid</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="refunded">Refunded</option></select>
        <select id="pyM"><option value="">All methods</option><option value="card">Card</option><option value="upi">UPI</option><option value="netbanking">Net banking</option><option value="wallet">Wallet</option></select>
        <input type="date" id="pyF" data-allow-past title="From date"><input type="date" id="pyT" data-allow-past title="To date">
        <button class="btn-ghost" id="pyClear"><i class="bi bi-x-circle"></i> Clear</button>
        <button class="btn-ghost" id="pyCsv"><i class="bi bi-download"></i> Export CSV</button><span class="result-count" id="pyC"></span></div>
      <div id="pyBody">${A.skeleton(5)}</div>`;
    $("#pyS", el).value = f.status;
    let rows = [];
    const qs = () => { const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => v && p.set(k, v)); const s = p.toString(); return s ? "?" + s : ""; };
    async function load() {
      try {
        const r = await call(Auth.adminPayments(qs())); rows = r.payments; const s = r.summary;
        $("#paySum", el).innerHTML = [["i-rev", "bi-cash-coin", money(s.collected), "Collected", s.paid + " paid"], ["i-ok", "bi-check2-circle", s.paid, "Paid", ""], ["i-pend", "bi-hourglass-split", s.pending, "Pending", s.pending ? money(s.pendingAmount) : ""], ["i-bad", "bi-x-octagon", s.failed, "Failed", ""], ["i-enq", "bi-arrow-counterclockwise", s.refunded, "Refunded", s.refunded ? money(s.refundedAmount) : ""]]
          .map(([c, ic, v, l, sub]) => `<div class="kpi ${c}"><div class="kpi-icon"><i class="bi ${ic}"></i></div><div class="kpi-value">${esc(v)}</div><div class="kpi-label">${l}</div>${sub ? `<div class="kpi-sub">${esc(sub)}</div>` : ""}</div>`).join("");
        $("#pyC", el).textContent = r.count + " record" + (r.count === 1 ? "" : "s");
        $("#pyBody", el).innerHTML = !rows.length ? (qs() ? A.emptyState("bi-search", "No payments match your filters", "Try clearing the filters.") : A.emptyState("bi-credit-card-2-front", "No payments yet", "Payment records appear when customers book a trip."))
          : A.table(["Payment ID", "Booking", "Customer", "Trip / Hotel / Package", { label: "Amount", cls: "r" }, "Method", "Date", "Status", ""], rows.map((p) => [
            `<span class="mono cell-strong">${esc(p.paymentId)}</span>`, `<span class="mono">${esc(p.bookingReference || "—")}</span>`,
            `<span class="cell-strong">${esc(p.customer)}</span><div class="cell-sub">${esc(p.email)}</div>`, `${esc(p.item)}<div class="cell-sub">${esc(p.itemType)}</div>`,
            `<b>${money(p.amount)}</b>`, A.payTag(p.method), fmtDateTime(p.date), A.badge(p.status),
            `<div class="actions"><button class="icon-btn info" data-pay="${p._id}" title="View details"><i class="bi bi-eye"></i></button></div>`]));
        $$("[data-pay]", el).forEach((b) => b.addEventListener("click", () => paymentModal(b.dataset.pay, load)));
      } catch (e) { A.errorState($("#pyBody", el), e, load, "Couldn't load payments."); }
    }
    const set = (k) => (e) => { f[k] = e.target.value.trim(); load(); };
    $("#pyQ", el).addEventListener("input", A.debounce(set("q"), 300));
    $("#pyS", el).addEventListener("change", set("status")); $("#pyM", el).addEventListener("change", set("method"));
    $("#pyF", el).addEventListener("change", set("from")); $("#pyT", el).addEventListener("change", set("to"));
    $("#pyClear", el).addEventListener("click", () => { Object.keys(f).forEach((k) => (f[k] = "")); renderPayments(el, {}); });
    $("#pyCsv", el).addEventListener("click", () => { if (!rows.length) return toast("Nothing to export.", "error"); A.downloadCSV("ukiyo-payments.csv", ["Payment ID", "Booking ref", "Customer", "Email", "Item", "Amount", "Method", "Date", "Status"], rows.map((p) => [p.paymentId, p.bookingReference, p.customer, p.email, p.item, p.amount, p.method || "", new Date(p.date).toISOString(), p.status])); });
    load();
  }
  async function paymentModal(id, reload) {
    const m = A.openModal({ title: "Payment details", size: "lg", body: A.skeleton(3), footer: '<button class="btn-ghost" data-close>Close</button>' });
    try {
      const { payment: p, attempts } = await call(Auth.adminPayment(id));
      const d = p.details || {};
      const detail = d.last4 ? "Card ending " + d.last4 : d.upi ? "UPI " + d.upi : d.bank ? d.bank : d.wallet ? d.wallet : "—";
      m.body.innerHTML = `<dl class="kv"><dt>Payment ID</dt><dd class="mono">${esc(p.paymentId)}</dd><dt>Booking</dt><dd><span class="mono">${esc(p.bookingReference || "Not issued")}</span> · ${A.badge(p.bookingStatus || "pending", A.bookingLabel(p.bookingStatus || "pending"))}</dd>
        <dt>Customer</dt><dd>${esc(p.customer)} <span class="cell-sub">${esc(p.email)}</span></dd><dt>Item</dt><dd>${esc(p.item)} <span class="cell-sub">${esc(p.itemType)} · ${p.travellers} traveller(s) · ${fmtDay(p.travelDate)}</span></dd>
        <dt>Amount</dt><dd>${money(p.amount)}</dd><dt>Method</dt><dd>${A.payTag(p.method)} <span class="cell-sub">${esc(detail)}</span></dd><dt>Status</dt><dd>${A.badge(p.status)}</dd>
        <dt>Transaction</dt><dd class="mono">${esc(p.transactionId || "—")}</dd>${p.failureReason ? `<dt>Failure reason</dt><dd style="color:#C0392B">${esc(p.failureReason)}</dd>` : ""}<dt>Date</dt><dd>${fmtDateTime(p.date)}</dd></dl>
        ${attempts.length > 1 ? `<h4 class="panel-title" style="margin-top:18px">All attempts for this booking</h4><ul class="timeline">${attempts.map((a) => `<li>${A.badge(a.status)} <span class="mono">${esc(a.paymentId)}</span> ${a.method ? A.payTag(a.method) : ""} <span class="cell-sub">${fmtDateTime(a.createdAt)}${a.failureReason ? " — " + esc(a.failureReason) : ""}</span></li>`).join("")}</ul>` : ""}`;
      if (p.status === "paid") {
        const b = document.createElement("button"); b.className = "btn-danger-a"; b.innerHTML = '<i class="bi bi-arrow-counterclockwise"></i> Refund & cancel booking'; m.foot.prepend(b);
        b.addEventListener("click", async () => { if (!(await A.confirm({ title: "Refund this payment?", message: "The payment is marked refunded and the booking is cancelled. This can't be undone.", confirmText: "Refund", danger: true }))) return;
          try { const r = await call(Auth.adminRefund(p._id)); toast(r.message); m.close(); reload(); } catch (e) { if (!e.handled) toast(A.msg(e), "error"); } });
      }
    } catch (e) { if (!e.handled) m.body.innerHTML = `<div class="state-box error"><i class="bi bi-cloud-slash"></i><h4>${esc(A.msg(e, "Couldn't load this payment."))}</h4></div>`; }
  }
  A.register("payments", { title: "Payments", sub: "Every payment attempt, linked to its booking", render: renderPayments });

  /* ============ BOOKING CALENDAR ============ */
  function renderCalendar(el, params) {
    const t0 = today();
    let ym = (params.date || t0).slice(0, 7), basis = "travel", sel = params.date || null;
    el.innerHTML = `<div class="cal-head"><button class="btn-ghost btn-sm" id="cPrev"><i class="bi bi-chevron-left"></i></button><h2 id="cTitle"></h2><button class="btn-ghost btn-sm" id="cNext"><i class="bi bi-chevron-right"></i></button>
        <button class="btn-ghost btn-sm" id="cToday">Today</button>
        <div class="seg" id="cBasis"><button data-b="travel" class="active">By travel date</button><button data-b="created">By booking date</button></div></div>
      <div class="cal-layout"><div><div class="cal" id="calBox">${A.skeleton(4)}</div>
        <div class="cal-legend"><span><i style="background:var(--ok)"></i> Confirmed</span><span><i style="background:var(--warn)"></i> Pending payment</span><span><i style="background:var(--bad)"></i> Cancelled</span></div></div>
        <div class="panel day-panel" id="dayPanel">${A.emptyState("bi-calendar-event", "Select a date", "Click any day to see its bookings.")}</div></div>`;
    const shift = (n) => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); ym = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); load(); };
    $("#cPrev", el).onclick = () => shift(-1); $("#cNext", el).onclick = () => shift(1);
    $("#cToday", el).onclick = () => { ym = t0.slice(0, 7); sel = t0; load(); openDay(t0); };
    $$("#cBasis button", el).forEach((b) => (b.onclick = () => { basis = b.dataset.b; $$("#cBasis button", el).forEach((x) => x.classList.toggle("active", x === b)); load(); if (sel) openDay(sel); }));
    async function load() {
      const [y, m] = ym.split("-").map(Number);
      $("#cTitle", el).textContent = new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
      try {
        const r = await call(Auth.adminCalendar(ym, basis)); window.__serverToday = r.today;
        const map = new Map(r.days.map((d) => [d.date, d]));
        const first = (new Date(y, m - 1, 1).getDay() + 6) % 7, dim = new Date(y, m, 0).getDate();
        let cells = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `<div>${d}</div>`).join("");
        let grid = "";
        for (let i = 0; i < first; i++) grid += '<div class="cal-cell blank"></div>';
        for (let d = 1; d <= dim; d++) {
          const iso = `${ym}-${String(d).padStart(2, "0")}`, info = map.get(iso);
          grid += `<button class="cal-cell ${info ? "has" : ""} ${iso === r.today ? "today" : ""} ${iso < r.today ? "past" : ""} ${iso === sel ? "selected" : ""}" data-d="${iso}" aria-label="${longDay(iso)}${info ? ", " + info.total + " bookings" : ""}">
            <span class="d-num">${d}</span>${info ? `<span class="d-total">${info.total} booking${info.total > 1 ? "s" : ""}</span><span class="dots">${info.confirmed ? `<i class="c">${info.confirmed}</i>` : ""}${info.pending ? `<i class="p">${info.pending}</i>` : ""}${info.cancelled ? `<i class="x">${info.cancelled}</i>` : ""}</span>` : ""}</button>`;
        }
        $("#calBox", el).innerHTML = `<div class="cal-dow">${cells}</div><div class="cal-grid">${grid}</div>`;
        $$(".cal-cell[data-d]", el).forEach((c) => c.addEventListener("click", () => { sel = c.dataset.d; $$(".cal-cell", el).forEach((x) => x.classList.toggle("selected", x === c)); openDay(sel); }));
        if (!r.days.length) $("#calBox", el).insertAdjacentHTML("beforeend", `<div class="cell-sub" style="text-align:center;margin-top:10px">No bookings in this month (${basis === "travel" ? "by travel date" : "by booking date"}).</div>`);
      } catch (e) { A.errorState($("#calBox", el), e, load, "Couldn't load the calendar."); }
    }
    async function openDay(iso) {
      const p = $("#dayPanel", el); p.innerHTML = A.skeleton(3);
      try {
        const r = await call(Auth.adminCalendarDay(iso, basis));
        p.innerHTML = `<div class="day-title">${basis === "travel" ? "Trips starting on" : "Bookings made on"}</div><div class="day-big">${longDay(iso)}</div>
          <div class="day-stats"><div class="metric"><span>Bookings</span><strong>${r.count}</strong></div><div class="metric"><span>Travellers</span><strong>${r.totals.travellers}</strong></div><div class="metric"><span>Total amount</span><strong>${money(r.totals.amount)}</strong></div></div>
          ${r.bookings.length ? r.bookings.map((b) => `<div class="day-book ${b.status}"><div class="day-book-top"><div><strong>${esc(b.customer)}</strong><div class="cell-sub">${esc(b.email)}</div></div>${A.badge(b.status, A.bookingLabel(b.status))}</div>
              <div class="meta"><span>Destination: <b>${esc(b.destination)}</b></span><span>Travellers: <b>${b.travellers}</b></span><span>Hotel: <b>${esc(b.hotel || "—")}</b></span><span>Package: <b>${esc(b.package || "—")}</b></span><span>Amount: <b>${money(b.amount)}</b></span><span>Ref: <b class="mono">${esc(b.reference || "—")}</b></span></div></div>`).join("")
            : A.emptyState("bi-calendar-x", "No bookings on this date")}`;
      } catch (e) { A.errorState(p, e, () => openDay(iso), "Couldn't load this date."); }
    }
    load(); if (sel) openDay(sel);
  }
  A.register("calendar", { title: "Booking Calendar", sub: "Booking activity by date", render: renderCalendar });
})();
