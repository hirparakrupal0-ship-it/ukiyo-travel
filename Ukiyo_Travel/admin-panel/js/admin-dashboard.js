/* Command Center — Dashboard, Trending, Insights, Smart Alerts */
(function () {
  "use strict";
  const A = window.Admin, Auth = A.Auth, { $, $$, esc, money, num, call, toast } = A;

  const ALERT_ICON = { "pending-payments": "bi-hourglass-split", "unhandled-enquiries": "bi-envelope-exclamation", "trips-tomorrow": "bi-airplane", "trips-today": "bi-airplane-engines",
    "failed-payments": "bi-x-octagon", "high-cancellations": "bi-graph-down-arrow", "new-users": "bi-person-plus", "booking-surge": "bi-graph-up-arrow" };

  /* ---------------- Smart Alerts ---------------- */
  let alertCache = [];
  function alertHtml(a) {
    return `<div class="alert-item ${a.read ? "" : "unread"}" data-key="${esc(a.key)}">
      <span class="alert-ic ${esc(a.severity)}"><i class="bi ${ALERT_ICON[a.type] || "bi-bell"}"></i></span>
      <div class="alert-body"><strong>${esc(a.title)}</strong><p>${esc(a.message)}</p>
        <div class="alert-actions">
          <button class="link-btn" data-a="view"><i class="bi bi-box-arrow-up-right"></i> View related</button>
          ${a.read ? "" : '<button class="link-btn" data-a="read"><i class="bi bi-check2"></i> Mark as read</button>'}
          <button class="link-btn danger" data-a="clear"><i class="bi bi-x-lg"></i> Clear</button>
        </div></div>${a.read ? "" : '<span class="alert-dot"></span>'}</div>`;
  }
  function bindAlerts(root, after) {
    root.querySelectorAll(".alert-item").forEach((row) => {
      const a = alertCache.find((x) => x.key === row.dataset.key);
      row.querySelectorAll("[data-a]").forEach((btn) => btn.addEventListener("click", async () => {
        const act = btn.dataset.a;
        if (act === "view") { closeBell(); const l = a.link || {}; A.go(l.view || "dashboard", l); return; }
        try { await call(Auth.adminAlertState(a.key, act === "read" ? "read" : "cleared")); toast(act === "read" ? "Marked as read" : "Alert cleared"); await loadAlerts(); if (after) after(); }
        catch (e) { if (!e.handled) toast(A.msg(e), "error"); }
      }));
    });
  }
  async function loadAlerts() {
    try {
      const res = await call(Auth.adminAlerts());
      alertCache = res.alerts;
      const b = $("#bellBadge"); b.textContent = res.unread > 9 ? "9+" : res.unread; b.hidden = !res.unread;
      return res;
    } catch (e) { return null; }
  }
  function closeBell() { $("#bellPanel").hidden = true; }
  function renderBell() {
    const p = $("#bellPanel");
    p.innerHTML = `<div class="bell-head"><span>Smart Alerts</span><span class="link-row"><button class="link-btn" id="bAllRead">Mark all read</button><button class="link-btn danger" id="bClear">Clear all</button></span></div>
      <div class="bell-list">${alertCache.length ? alertCache.map(alertHtml).join("") : A.emptyState("bi-bell-slash", "You're all caught up", "No active alerts right now.")}</div>`;
    bindAlerts(p, renderBell);
    const bulk = (state) => async () => { try { await call(Auth.adminAlertStateAll(state)); await loadAlerts(); renderBell(); if (A.state.view === "dashboard") A.refresh(); } catch (e) { if (!e.handled) toast(A.msg(e), "error"); } };
    $("#bAllRead").onclick = bulk("read"); $("#bClear").onclick = bulk("cleared");
  }
  A.afterLogin = function () {
    if (A.afterLogin.done) return; A.afterLogin.done = true;
    $("#bellBtn").addEventListener("click", async (e) => { e.stopPropagation(); const p = $("#bellPanel"); if (!p.hidden) return closeBell(); await loadAlerts(); renderBell(); p.hidden = false; });
    document.addEventListener("click", (e) => { if (!e.target.closest(".bell-wrap")) closeBell(); });
    loadAlerts(); setInterval(loadAlerts, 60000);
    A.updateEnquiryCount = async () => { try { const r = await Auth.adminEnquiries(); const n = r.enquiries.filter((x) => (x.status || "new") !== "handled").length; const c = $("#navEnqCount"); c.textContent = n; c.hidden = !n; } catch (_) {} };
    A.updateEnquiryCount();
  };

  /* ---------------- Dashboard ---------------- */
  const VIEW_FOR_KPI = { pendingPayments: ["bookings", { filter: "pending" }], confirmed: ["bookings", { filter: "confirmed" }], cancelled: ["bookings", { filter: "cancelled" }], users: ["users"], bookings: ["bookings"], revenue: ["payments", { filter: "paid" }], enquiries: ["enquiries"], hotels: ["hotels"], destinations: ["destinations"], packages: ["packages"] };

  function kpiTiles(k) {
    const t = [
      ["users", "i-users", "bi-people-fill", num(k.users), "Total users"],
      ["bookings", "i-book", "bi-suitcase-lg-fill", num(k.bookings), "Total bookings"],
      ["revenue", "i-rev", "bi-cash-coin", money(k.revenue), "Total revenue", "Paid payments only"],
      ["hotels", "i-hotel", "bi-building-fill", num(k.hotels), "Total hotels"],
      ["destinations", "i-dest", "bi-geo-alt-fill", num(k.destinations), "Destinations"],
      ["packages", "i-pkg", "bi-box-seam-fill", num(k.packages), "Packages"],
      ["enquiries", "i-enq", "bi-envelope-fill", num(k.enquiries), "Enquiries"],
      ["pendingPayments", "i-pend", "bi-hourglass-split", num(k.pendingPayments), "Pending payments", k.pendingPayments ? money(k.pendingPaymentsAmount) + " awaiting" : ""],
      ["confirmed", "i-ok", "bi-patch-check-fill", num(k.confirmed), "Confirmed bookings"],
      ["cancelled", "i-bad", "bi-x-octagon-fill", num(k.cancelled), "Cancelled bookings"],
    ];
    return t.map(([key, cls, icon, val, label, sub]) => `<div class="kpi link ${cls}" data-kpi="${key}" tabindex="0"><div class="kpi-icon"><i class="bi ${icon}"></i></div><div class="kpi-value ${String(val).length > 9 ? "sm" : ""}">${esc(val)}</div><div class="kpi-label">${label}</div>${sub ? `<div class="kpi-sub">${esc(sub)}</div>` : ""}</div>`).join("");
  }

  function pulseCards(p) {
    const na = '<span class="na">Not enough data</span>';
    const g = p.bookingGrowth;
    const growth = g.percent === null ? na : `<span class="${g.percent >= 0 ? "trend-up" : "trend-down"}">${g.percent >= 0 ? "▲ +" : "▼ "}${g.percent}%</span>`;
    const items = [
      ["bi-geo-alt", "Most popular destination", p.popularDestination ? esc(p.popularDestination.name) : na, p.popularDestination ? p.popularDestination.count + " bookings" : ""],
      ["bi-building", "Most booked hotel", p.mostBookedHotel ? esc(p.mostBookedHotel.name) : na, p.mostBookedHotel ? p.mostBookedHotel.count + " bookings" : ""],
      ["bi-box-seam", "Most popular package", p.popularPackage ? esc(p.popularPackage.name) : na, p.popularPackage ? p.popularPackage.count + " bookings" : ""],
      ["bi-calendar-heart", "Most popular travel month", p.popularTravelMonth ? esc(p.popularTravelMonth.name) : na, p.popularTravelMonth ? p.popularTravelMonth.count + " trips planned" : ""],
      ["bi-receipt", "Average booking value", p.averageBookingValue === null ? na : money(p.averageBookingValue), "Confirmed bookings"],
      ["bi-graph-up-arrow", "Booking growth", growth, `${g.thisWeek} this week · ${g.lastWeek} last week`],
      ["bi-slash-circle", "Cancellation rate", p.cancellationRate === null ? na : p.cancellationRate + "%", "Of all bookings"],
      ["bi-airplane", "Upcoming trips", String(p.upcomingTrips), "Confirmed, travel date ahead"],
      ["bi-sun", "Today's bookings", String(p.todaysBookings), "Created today"],
    ];
    return items.map(([ic, l, v, s]) => `<div class="pulse"><i class="bi ${ic}"></i><div><div class="p-label">${l}</div><div class="p-value">${v}</div><div class="p-sub">${esc(s)}</div></div></div>`).join("");
  }

  function renderDashboard(el) {
    el.innerHTML = `<div class="kpi-grid">${Array.from({ length: 10 }, () => '<div class="skeleton sk-kpi"></div>').join("")}</div>${A.skeleton(3)}`;
    load();
    async function load() {
      try {
        const [d, tr, ins, al] = await Promise.all([call(Auth.adminDashboard()), call(Auth.adminTrending(30)), call(Auth.adminInsights()), call(Auth.adminAlerts())]);
        alertCache = al.alerts;
        const c = d.charts;
        const empty = d.kpis.bookings === 0;
        el.innerHTML = `
          ${empty ? '<div class="inline-note"><i class="bi bi-info-circle"></i> No bookings yet — figures below fill in automatically as customers book and pay.</div>' : ""}
          <div class="kpi-grid">${kpiTiles(d.kpis)}</div>

          <div class="section-h"><h2><i class="bi bi-activity"></i> Travel Pulse</h2><small>Live from your bookings</small></div>
          <div class="pulse-grid">${pulseCards(d.pulse)}</div>

          <div class="section-h"><h2><i class="bi bi-bar-chart-line"></i> Analytics</h2><small>Last 30 days unless noted</small></div>
          <div class="chart-grid">
            <div class="panel"><h3 class="panel-title">Bookings over time <small>${num(c.bookingsOverTime.reduce((s, x) => s + x.value, 0))} total</small></h3>${A.lineChart(c.bookingsOverTime, { id: "g1" })}</div>
            <div class="panel"><h3 class="panel-title">Revenue over time <small>${money(c.revenueOverTime.reduce((s, x) => s + x.value, 0))}</small></h3>${A.lineChart(c.revenueOverTime, { color: "#E0952B", fmt: (v) => (v >= 1000 ? "₹" + Math.round(v / 1000) + "k" : "₹" + v), id: "g2" })}</div>
            <div class="panel"><h3 class="panel-title">Bookings by destination</h3>${A.rankBars(c.bookingsByDestination.slice(0, 7).map((x) => ({ name: x.name, value: x.value })))}</div>
            <div class="panel"><h3 class="panel-title">Payment status</h3>${A.donut(c.paymentStatus, { totalLabel: "payments" })}</div>
            <div class="panel"><h3 class="panel-title">Booking status</h3>${A.donut(c.bookingStatus, { totalLabel: "bookings" })}</div>
            <div class="panel"><h3 class="panel-title">User growth <small>New users / month</small></h3>${A.barChart(c.userGrowth.map((m) => ({ label: new Date(m.month + "-01T00:00:00").toLocaleDateString("en-GB", { month: "short" }), value: m.added })))}<div class="cell-sub" style="margin-top:6px">Total users: <b>${num(d.kpis.users)}</b></div></div>
          </div>

          <div class="section-h"><h2><i class="bi bi-fire"></i> What's Trending Right Now?</h2><small>Last ${tr.windowDays} days · cancelled bookings excluded</small></div>
          <div class="panel" id="trendPanel"></div>

          <div class="section-h"><h2><i class="bi bi-lightbulb"></i> Ukiyo Insights</h2><small>Rule-based analysis of your data</small></div>
          <div class="insight-grid" id="insightGrid"></div>

          <div class="section-h"><h2><i class="bi bi-bell"></i> Smart Alerts</h2><small id="alertCount"></small></div>
          <div class="panel" style="padding:0" id="alertPanel"></div>`;
        $$(".kpi.link", el).forEach((k) => { const go = () => { const [v, p] = VIEW_FOR_KPI[k.dataset.kpi] || ["dashboard"]; A.go(v, p || {}); }; k.addEventListener("click", go); k.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); }); });
        renderTrending(tr);
        renderInsights(ins.insights);
        const paintAlerts = () => { $("#alertCount").textContent = alertCache.length ? alertCache.length + " active" : ""; $("#alertPanel").innerHTML = alertCache.length ? alertCache.map(alertHtml).join("") : A.emptyState("bi-bell-slash", "You're all caught up", "No active alerts right now."); bindAlerts($("#alertPanel"), paintAlerts); };
        paintAlerts();
      } catch (e) { A.errorState(el, e, load, "Couldn't load the dashboard."); }
    }
  }

  /* ---------------- Trending ---------------- */
  function renderTrending(tr) {
    const panel = $("#trendPanel");
    const tabs = [["destinations", "Destinations", "destinations", "destination"], ["packages", "Packages", "packages", "package"], ["hotels", "Hotels", "hotels", "hotel"]];
    let active = "destinations";
    function paint() {
      const rows = tr[active];
      const meta = tabs.find((t) => t[0] === active);
      panel.innerHTML = `<div class="trend-tabs">${tabs.map((t) => `<button class="${t[0] === active ? "active" : ""}" data-t="${t[0]}">${t[1]}</button>`).join("")}</div>` +
        (rows.length ? rows.map((r) => `<div class="trend-row"><span class="rank">${r.rank}</span>
            <div class="trend-info"><strong>${esc(r.name)}</strong>${r.isFeatured ? '<span class="feat-tag">Featured</span>' : ""}<small>${r.change === null ? "New this period" : (r.change >= 0 ? "▲ +" : "▼ ") + r.change + "% vs previous " + tr.windowDays + " days"}</small></div>
            <span class="trend-count">${r.bookings} booking${r.bookings === 1 ? "" : "s"}</span>
            <button class="btn-ghost btn-sm" data-feat="${esc(r.id)}" data-type="${meta[2]}" data-on="${r.isFeatured}"><i class="bi ${r.isFeatured ? "bi-star-fill" : "bi-star"}"></i> ${r.isFeatured ? "Unfeature" : "Feature"}</button></div>`).join("")
          : A.emptyState("bi-graph-up", "No trending " + active + " yet", "Rankings appear once customers start booking in the last " + tr.windowDays + " days."));
      panel.querySelectorAll("[data-t]").forEach((b) => b.addEventListener("click", () => { active = b.dataset.t; paint(); }));
      panel.querySelectorAll("[data-feat]").forEach((b) => b.addEventListener("click", async () => {
        try {
          const list = await call(Auth.adminCatalog(b.dataset.type));
          const key = b.dataset.type === "destinations" ? "slug" : "id";
          const item = list.items.find((i) => i[key] === b.dataset.feat);
          if (!item) return toast("That item no longer exists in the catalog.", "error");
          await call(Auth.adminCatalogFlags(b.dataset.type, item._id, { isFeatured: b.dataset.on !== "true" }));
          toast(b.dataset.on === "true" ? "Removed from featured" : "Marked as featured — now highlighted on the website");
          A.refresh();
        } catch (e) { if (!e.handled) toast(A.msg(e), "error"); }
      }));
    }
    paint();
  }

  /* ---------------- Insights ---------------- */
  function renderInsights(list) {
    $("#insightGrid").innerHTML = list.map((i) => `<div class="insight ${i.insufficient ? "none" : i.severity}">
      <h4><i class="bi ${i.insufficient ? "bi-hourglass" : "bi-stars"}"></i> ${esc(i.title)}</h4><p>${esc(i.text)}</p>
      ${i.metrics.length ? `<div class="metrics">${i.metrics.map((m) => `<div class="metric"><span>${esc(m.label)}</span><strong>${esc(m.value)}</strong></div>`).join("")}</div>` : ""}
      ${i.action ? `<div class="insight-action"><i class="bi bi-lightbulb-fill"></i><span>${esc(i.action.text)}</span>${i.action.type === "feature-destination" && i.action.slug ? `<button class="btn-primary-a btn-sm" data-feature-slug="${esc(i.action.slug)}">Feature it</button>` : i.action.type === "view" ? `<button class="btn-ghost btn-sm" data-go="${esc(i.action.view)}" data-filter="${esc(i.action.filter || "")}">Open</button>` : ""}</div>` : ""}</div>`).join("");
    $$("[data-feature-slug]", $("#insightGrid")).forEach((b) => b.addEventListener("click", async () => {
      try { const l = await call(Auth.adminCatalog("destinations")); const it = l.items.find((x) => x.slug === b.dataset.featureSlug); if (!it) return toast("Destination not found.", "error");
        await call(Auth.adminCatalogFlags("destinations", it._id, { isFeatured: true })); toast(it.name + " is now featured on the homepage"); b.disabled = true; b.textContent = "Featured ✓"; }
      catch (e) { if (!e.handled) toast(A.msg(e), "error"); } }));
    $$("[data-go]", $("#insightGrid")).forEach((b) => b.addEventListener("click", () => A.go(b.dataset.go, { filter: b.dataset.filter })));
  }

  A.register("dashboard", { title: "Travel Intelligence Dashboard", sub: "Live overview of bookings, revenue and demand", render: renderDashboard });
})();
