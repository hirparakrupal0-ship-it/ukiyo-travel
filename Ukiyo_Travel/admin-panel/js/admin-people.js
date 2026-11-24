/* Command Center — Users, Reviews (Customer Experience), Enquiries */
(function () {
  "use strict";
  const A = window.Admin, Auth = A.Auth, { $, $$, esc, money, num, call, toast, fmtDate, fmtDateTime, fmtDay } = A;

  /* ============ USERS ============ */
  function renderUsers(el) {
    const f = { q: "", role: "", status: "", sort: "newest" };
    el.innerHTML = `<div class="toolbar">${A.searchBox("usQ", "Search name or email…")}
      <select id="usR"><option value="">All roles</option><option value="user">Customers</option><option value="admin">Admins</option></select>
      <select id="usS"><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
      <select id="usO"><option value="newest">Newest first</option><option value="spent">Highest spend</option><option value="bookings">Most bookings</option><option value="name">Name A–Z</option></select>
      <span class="result-count" id="usC"></span></div><div id="usBody">${A.skeleton(5)}</div>`;
    let all = [];
    const self = A.state.user && String(A.state.user.id);
    const paint = () => {
      const q = f.q.toLowerCase();
      let rows = all.filter((u) => (!f.role || u.role === f.role) && (!f.status || (f.status === "active") === u.isActive) && (!q || (u.firstName + " " + u.lastName + " " + u.email).toLowerCase().includes(q)));
      const sorters = { newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt), spent: (a, b) => b.totalSpent - a.totalSpent, bookings: (a, b) => b.totalBookings - a.totalBookings, name: (a, b) => (a.firstName + a.lastName).localeCompare(b.firstName + b.lastName) };
      rows.sort(sorters[f.sort]);
      $("#usC", el).textContent = rows.length + " of " + all.length;
      $("#usBody", el).innerHTML = !all.length ? A.emptyState("bi-people", "No users yet") : !rows.length ? A.emptyState("bi-search", "No users match your filters")
        : A.table(["User", "Role", "Status", { label: "Bookings", cls: "r" }, { label: "Total spent", cls: "r" }, "Last booking", "Last login", "Favourite", "Registered", { label: "", cls: "r" }], rows.map((u) => {
          const me = String(u.id) === self;
          return [`<div class="cell-flex"><span class="avatar">${esc(A.initials(u.firstName + " " + u.lastName))}</span><div><span class="cell-strong">${esc(u.firstName)} ${esc(u.lastName)}</span><div class="cell-sub">${esc(u.email)}</div></div></div>`,
            `<select class="role-select" data-id="${u.id}" ${me ? "disabled" : ""}>${["user", "admin"].map((r) => `<option value="${r}" ${u.role === r ? "selected" : ""}>${r}</option>`).join("")}</select>`,
            A.badge(u.isActive ? "active" : "inactive", u.status), u.totalBookings, `<b>${money(u.totalSpent)}</b>`, u.lastBooking ? fmtDate(u.lastBooking) : '<span class="na">—</span>',
            u.lastLogin ? fmtDate(u.lastLogin) : '<span class="na">Not recorded</span>', u.favouriteDestination ? esc(u.favouriteDestination) : '<span class="na">—</span>', fmtDate(u.createdAt),
            `<div class="actions"><button class="icon-btn info" data-v="${u.id}" title="View profile"><i class="bi bi-eye"></i></button>
              <button class="icon-btn ${u.isActive ? "" : "on"}" data-t="${u.id}" ${me ? "disabled" : ""} title="${u.isActive ? "Deactivate" : "Activate"}"><i class="bi ${u.isActive ? "bi-person-slash" : "bi-person-check"}"></i></button>
              <button class="icon-btn js-del" data-d="${u.id}" ${me ? "disabled" : ""} title="Delete"><i class="bi bi-trash"></i></button></div>`];
        }));
      $$("[data-v]", el).forEach((b) => b.addEventListener("click", () => profile(b.dataset.v, load)));
      $$("[data-t]", el).forEach((b) => b.addEventListener("click", () => toggleActive(all.find((u) => String(u.id) === b.dataset.t), load)));
      $$("[data-d]", el).forEach((b) => b.addEventListener("click", async () => { const u = all.find((x) => String(x.id) === b.dataset.d);
        if (!(await A.confirm({ title: `Delete ${u.firstName} ${u.lastName}?`, message: "Their account, bookings, payments and reviews are removed permanently.", confirmText: "Delete user", danger: true }))) return;
        try { await call(Auth.adminDeleteUser(u.id)); toast("User deleted"); load(); } catch (e) { if (!e.handled) toast(A.msg(e), "error"); } }));
      $$(".role-select", el).forEach((s) => s.addEventListener("change", async () => { const u = all.find((x) => String(x.id) === s.dataset.id);
        if (!(await A.confirm({ title: "Change role?", message: `${u.firstName} ${u.lastName} will become ${s.value === "admin" ? "an admin with full access to this panel" : "a regular customer"}.`, confirmText: "Change role" }))) { s.value = u.role; return; }
        try { await call(Auth.adminSetRole(u.id, s.value)); toast("Role updated"); load(); } catch (e) { s.value = u.role; if (!e.handled) toast(A.msg(e), "error"); } }));
    };
    async function load() { try { all = (await call(Auth.adminUsers())).users; paint(); } catch (e) { A.errorState($("#usBody", el), e, load, "Couldn't load users."); } }
    $("#usQ", el).addEventListener("input", A.debounce((e) => { f.q = e.target.value.trim(); paint(); }, 200));
    [["usR", "role"], ["usS", "status"], ["usO", "sort"]].forEach(([id, k]) => $("#" + id, el).addEventListener("change", (e) => { f[k] = e.target.value; paint(); }));
    load();
  }
  async function toggleActive(u, reload) {
    const to = !u.isActive;
    if (!(await A.confirm({ title: to ? "Activate account?" : "Deactivate account?", message: to ? `${u.firstName} will be able to log in again.` : `${u.firstName} will be signed out of every session and won't be able to log in until reactivated.`, confirmText: to ? "Activate" : "Deactivate", danger: !to }))) return false;
    try { const r = await call(Auth.adminSetUserActive(u.id, to)); toast(r.message); reload(); return true; } catch (e) { if (!e.handled) toast(A.msg(e), "error"); return false; }
  }
  async function profile(id, reload) {
    const m = A.openModal({ title: "User profile", size: "lg", body: A.skeleton(4), footer: '<button class="btn-ghost" data-close>Close</button>' });
    try {
      const { user: u, bookings, payments } = await call(Auth.adminUser(id));
      let tab = "overview";
      const paint = () => {
        const tabs = `<div class="tabs">${[["overview", "Overview"], ["bookings", `Bookings (${bookings.length})`], ["payments", `Payments (${payments.length})`]].map(([k, l]) => `<button data-tab="${k}" class="${k === tab ? "active" : ""}">${l}</button>`).join("")}</div>`;
        const body = tab === "overview" ? `<dl class="kv"><dt>Email</dt><dd>${esc(u.email)}</dd><dt>Phone</dt><dd>${esc(u.phone || "—")}</dd><dt>Location</dt><dd>${esc([u.city, u.country].filter(Boolean).join(", ") || "—")}</dd>
            <dt>Role</dt><dd>${esc(u.role)}</dd><dt>Registered</dt><dd>${fmtDateTime(u.createdAt)}</dd><dt>Last login</dt><dd>${u.lastLogin ? fmtDateTime(u.lastLogin) : "Not recorded yet"}</dd><dt>Last booking</dt><dd>${u.lastBooking ? fmtDateTime(u.lastBooking) : "—"}</dd></dl>`
          : tab === "bookings" ? (bookings.length ? A.table(["Trip", "Travel date", "Pax", "Amount", "Status"], bookings.map((b) => [`<span class="cell-strong">${esc(b.title)}</span><div class="cell-sub">${esc(b.destination || "")}${b.reference ? " · " + esc(b.reference) : ""}</div>`, fmtDay(b.travelDate), b.travellers, money(b.amount), A.badge(b.status, A.bookingLabel(b.status))])) : A.emptyState("bi-suitcase", "No bookings yet"))
          : (payments.length ? A.table(["Payment", "Trip", "Amount", "Method", "Date", "Status"], payments.map((p) => [`<span class="mono">${esc(p.paymentId)}</span>`, esc(p.item), money(p.amount), A.payTag(p.method), fmtDateTime(p.date), A.badge(p.status)])) : A.emptyState("bi-credit-card", "No payments yet"));
        m.body.innerHTML = `<div class="profile-head"><span class="avatar lg">${esc(A.initials(u.firstName + " " + u.lastName))}</span><div><h3>${esc(u.firstName)} ${esc(u.lastName)}</h3><p>${esc(u.email)} · ${A.badge(u.isActive ? "active" : "inactive", u.status)}</p></div></div>
          <div class="stat-row"><div class="stat"><span>Bookings</span><strong>${u.totalBookings}</strong></div><div class="stat"><span>Total spent</span><strong>${money(u.totalSpent)}</strong></div><div class="stat"><span>Favourite destination</span><strong>${esc(u.favouriteDestination || "—")}</strong></div><div class="stat"><span>Status</span><strong>${esc(u.status)}</strong></div></div>${tabs}${body}`;
        $$("[data-tab]", m.body).forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; paint(); }));
      };
      paint();
      if (String(u.id) !== String(A.state.user.id)) {
        const b = document.createElement("button"); b.className = u.isActive ? "btn-danger-a" : "btn-primary-a"; b.innerHTML = u.isActive ? '<i class="bi bi-person-slash"></i> Deactivate' : '<i class="bi bi-person-check"></i> Activate'; m.foot.prepend(b);
        b.addEventListener("click", async () => { if (await toggleActive(u, reload)) m.close(); });
      }
    } catch (e) { if (!e.handled) m.body.innerHTML = `<div class="state-box error"><i class="bi bi-cloud-slash"></i><h4>${esc(A.msg(e, "Couldn't load this user."))}</h4></div>`; }
  }
  A.register("users", { title: "Users", sub: "Customer activity, spend and account control", render: renderUsers });

  /* ============ REVIEWS / CUSTOMER EXPERIENCE ============ */
  function renderReviews(el) {
    const f = { q: "", status: "", rating: "", type: "" };
    el.innerHTML = `<div id="rvTop">${A.skeleton(3)}</div>
      <div class="section-h"><h2><i class="bi bi-chat-square-text"></i> Reviews</h2><small>Moderation: only approved reviews appear on the website</small></div>
      <div class="toolbar">${A.searchBox("rvQ", "Search comment, trip, customer…")}
        <select id="rvS"><option value="">All reviews</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select>
        <select id="rvR"><option value="">Any rating</option>${[5, 4, 3, 2, 1].map((n) => `<option value="${n}">${n} star${n > 1 ? "s" : ""}</option>`).join("")}</select>
        <select id="rvT"><option value="">All types</option><option value="destination">Destinations</option><option value="hotel">Hotels</option><option value="package">Packages</option></select><span class="result-count" id="rvC"></span></div><div id="rvBody"></div>`;
    const qs = () => { const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => v && p.set(k, v)); const s = p.toString(); return s ? "?" + s : ""; };
    const rateRows = (list, empty) => list.length ? list.map((r) => `<div class="row"><strong>${esc(r.name)}</strong><span>${A.stars(r.average, "sm")} <b>${r.average}</b> <span class="cell-sub">(${r.count})</span></span></div>`).join("") : `<div class="cell-sub" style="padding:8px 0">${empty}</div>`;
    const quote = (r) => `<div class="review-text" style="margin:0 0 8px">${A.stars(r.rating, "sm")} <b>${esc(r.item)}</b><br>${esc(r.comment || "(no comment)")}<div class="cell-sub">— ${esc(r.customer)}</div></div>`;
    async function load() {
      try {
        const r = await call(Auth.adminReviews(qs())); const s = r.summary;
        $("#rvTop", el).innerHTML = !s.count && !s.pending && !s.rejected && !qs() ? `<div class="panel">${A.emptyState("bi-star", "No reviews yet", "Customers can rate a trip from My Trips once their booking is confirmed.")}</div>` : `
          <div class="chart-grid"><div class="panel"><h3 class="panel-title">Overall rating</h3><div class="rating-hero"><div><div class="rating-num">${s.average === null ? "—" : s.average}<small> / 5</small></div>${A.stars(s.average, "xl")}<div class="cell-sub">${s.count} approved review${s.count === 1 ? "" : "s"}${s.pending ? " · " + s.pending + " pending" : ""}${s.rejected ? " · " + s.rejected + " rejected" : ""}</div></div>
              <div style="flex:1;min-width:180px">${s.distribution.map((d) => `<div class="dist-row"><span>${d.stars}★</span><div class="bar"><i style="width:${s.count ? (d.count / s.count) * 100 : 0}%"></i></div><b>${d.count}</b></div>`).join("")}</div></div>
              <div class="sentiment" style="margin-top:14px"><div class="sent pos"><strong>${s.positive}</strong><span>Positive (4–5★)</span></div><div class="sent neu"><strong>${s.neutral}</strong><span>Neutral (3★)</span></div><div class="sent neg"><strong>${s.negative}</strong><span>Negative (1–2★)</span></div></div></div>
            <div class="panel"><h3 class="panel-title">Destination ratings</h3><div class="rate-list">${rateRows(s.destinations, "No destination ratings yet.")}</div></div>
            <div class="panel"><h3 class="panel-title">Hotel ratings</h3><div class="rate-list">${rateRows(s.hotels, "No hotel ratings yet.")}</div></div>
            <div class="panel"><h3 class="panel-title">Package ratings</h3><div class="rate-list">${rateRows(s.packages, "No package ratings yet.")}</div></div>
            <div class="panel"><h3 class="panel-title" style="color:#1E8E5E">Positive feedback</h3>${s.recentPositive.length ? s.recentPositive.map(quote).join("") : '<div class="cell-sub">No positive comments yet.</div>'}</div>
            <div class="panel"><h3 class="panel-title" style="color:#C0392B">Negative feedback</h3>${s.recentNegative.length ? s.recentNegative.map(quote).join("") : '<div class="cell-sub">No negative reviews — great!</div>'}</div></div>`;
        $("#rvC", el).textContent = r.count + " shown";
        $("#rvBody", el).innerHTML = !r.reviews.length ? A.emptyState("bi-chat-square", qs() ? "No reviews match your filters" : "No reviews to moderate") : r.reviews.map((v) => `<div class="review-card ${v.status === "rejected" ? "hidden-r" : ""}">
            <div class="review-head"><div>${A.stars(v.rating, "sm")} <strong style="color:var(--navy)">${esc(v.item)}</strong> ${A.badge(v.status)}<div class="review-meta">${esc(v.customer)} · ${esc(v.destination || v.itemType)} · ${fmtDate(v.createdAt)}</div></div>
              <div class="actions" style="display:flex;gap:6px">${v.status !== "approved" ? `<button class="btn-ghost btn-sm" data-hide="${v._id}" data-to="approved"><i class="bi bi-check-circle"></i> Approve</button>` : ""}${v.status !== "rejected" ? `<button class="btn-ghost btn-sm" data-hide="${v._id}" data-to="rejected"><i class="bi bi-x-circle"></i> Reject</button>` : ""}<button class="icon-btn js-del" data-del="${v._id}" title="Delete"><i class="bi bi-trash"></i></button></div></div>
            ${v.comment ? `<div class="review-text">${esc(v.comment)}</div>` : ""}</div>`).join("");
        $$("[data-hide]", el).forEach((b) => b.addEventListener("click", async () => { try { const x = await call(Auth.adminSetReviewStatus(b.dataset.hide, b.dataset.to)); toast(x.message); load(); } catch (e) { if (!e.handled) toast(A.msg(e), "error"); } }));
        $$("[data-del]", el).forEach((b) => b.addEventListener("click", async () => { if (!(await A.confirm({ title: "Delete this review?", message: "This can't be undone. Use Reject to keep it but keep it off the website.", confirmText: "Delete", danger: true }))) return;
          try { await call(Auth.adminDeleteReview(b.dataset.del)); toast("Review deleted"); load(); } catch (e) { if (!e.handled) toast(A.msg(e), "error"); } }));
      } catch (e) { A.errorState($("#rvTop", el), e, load, "Couldn't load reviews."); }
    }
    $("#rvQ", el).addEventListener("input", A.debounce((e) => { f.q = e.target.value.trim(); load(); }, 300));
    [["rvS", "status"], ["rvR", "rating"], ["rvT", "type"]].forEach(([id, k]) => $("#" + id, el).addEventListener("change", (e) => { f[k] = e.target.value; load(); }));
    load();
  }
  A.register("reviews", { title: "Customer Experience", sub: "Ratings, reviews and moderation", render: renderReviews });

  /* ============ ENQUIRIES ============ */
  function renderEnquiries(el, params) {
    const f = { q: "", status: params.filter || "" };
    el.innerHTML = `<div class="toolbar">${A.searchBox("enQ", "Search name, email, destination, message…")}<select id="enS"><option value="">All enquiries</option><option value="new">Unhandled</option><option value="handled">Handled</option></select><span class="result-count" id="enC"></span></div><div id="enBody">${A.skeleton(3)}</div>`;
    $("#enS", el).value = f.status;
    let all = [];
    const paint = () => {
      const q = f.q.toLowerCase();
      const rows = all.filter((e) => (!f.status || (e.status || "new") === f.status) && (!q || [e.name, e.email, e.destination, e.message, e.phone].some((v) => String(v || "").toLowerCase().includes(q))));
      $("#enC", el).textContent = rows.length + " of " + all.length;
      $("#enBody", el).innerHTML = !all.length ? A.emptyState("bi-envelope", "No enquiries yet", "Messages from the website contact form appear here.") : !rows.length ? A.emptyState("bi-search", "No enquiries match your filters")
        : rows.map((e) => { const handled = e.status === "handled"; return `<div class="enq-card"><div class="enq-head"><strong>${esc(e.name)} ${A.badge(handled ? "handled" : "new", handled ? "Handled" : "New")}</strong>
            <div style="display:flex;gap:6px"><a class="btn-ghost btn-sm" href="mailto:${esc(e.email)}?subject=${encodeURIComponent("Your Ukiyo Travel enquiry")}"><i class="bi bi-reply"></i> Reply</a>
              <button class="btn-ghost btn-sm" data-h="${e._id}" data-to="${handled ? "new" : "handled"}"><i class="bi ${handled ? "bi-arrow-counterclockwise" : "bi-check2-circle"}"></i> ${handled ? "Reopen" : "Mark handled"}</button>
              <button class="icon-btn js-del" data-d="${e._id}" title="Delete"><i class="bi bi-trash"></i></button></div></div>
          <div class="enq-meta"><span><i class="bi bi-envelope"></i> ${esc(e.email)}</span>${e.phone ? `<span><i class="bi bi-telephone"></i> ${esc(e.phone)}</span>` : ""}${e.destination ? `<span><i class="bi bi-geo-alt"></i> ${esc(e.destination)}</span>` : ""}<span><i class="bi bi-clock"></i> ${fmtDateTime(e.createdAt)}</span></div>
          ${e.message ? `<div class="enq-msg">${esc(e.message)}</div>` : ""}</div>`; }).join("");
      $$("[data-h]", el).forEach((b) => b.addEventListener("click", async () => { try { const r = await call(Auth.adminSetEnquiryStatus(b.dataset.h, b.dataset.to)); toast(r.message); await load(); if (A.updateEnquiryCount) A.updateEnquiryCount(); } catch (e) { if (!e.handled) toast(A.msg(e), "error"); } }));
      $$("[data-d]", el).forEach((b) => b.addEventListener("click", async () => { if (!(await A.confirm({ title: "Delete this enquiry?", message: "This can't be undone.", confirmText: "Delete", danger: true }))) return;
        try { await call(Auth.adminDeleteEnquiry(b.dataset.d)); toast("Enquiry deleted"); await load(); if (A.updateEnquiryCount) A.updateEnquiryCount(); } catch (e) { if (!e.handled) toast(A.msg(e), "error"); } }));
    };
    async function load() { try { all = (await call(Auth.adminEnquiries())).enquiries; paint(); } catch (e) { A.errorState($("#enBody", el), e, load, "Couldn't load enquiries."); } }
    $("#enQ", el).addEventListener("input", A.debounce((e) => { f.q = e.target.value.trim(); paint(); }, 200));
    $("#enS", el).addEventListener("change", (e) => { f.status = e.target.value; paint(); });
    load();
  }
  A.register("enquiries", { title: "Enquiries", sub: "Messages from the contact form", render: renderEnquiries });
})();
