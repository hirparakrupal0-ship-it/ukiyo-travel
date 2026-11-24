/* Command Center — Settings (account, security, system status) */
(function () {
  "use strict";
  const A = window.Admin, Auth = A.Auth, { $, esc, call, toast, fmtDateTime } = A;
  A.register("settings", { title: "Settings", sub: "Your admin account and system status", render(el) {
    const u = A.state.user;
    el.innerHTML = `<div class="chart-grid">
      <div class="panel"><h3 class="panel-title">Admin account</h3><div class="profile-head"><span class="avatar lg">${esc(A.initials(u.firstName + " " + u.lastName))}</span><div><h3>${esc(u.firstName)} ${esc(u.lastName)}</h3><p>${esc(u.email)}</p></div></div>
        <dl class="kv"><dt>Role</dt><dd>${esc(u.role)}</dd><dt>Member since</dt><dd>${fmtDateTime(u.createdAt)}</dd></dl>
        <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap"><a class="btn-ghost" href="profile.html"><i class="bi bi-person"></i> Edit profile</a><button class="btn-primary-a" id="chgPw"><i class="bi bi-key"></i> Change password</button></div></div>
      <div class="panel"><h3 class="panel-title">System status</h3><div id="sysBody">${A.skeleton(2)}</div></div>
      <div class="panel"><h3 class="panel-title">Business rules</h3><ul class="timeline">
        <li><i class="bi bi-calendar-check" style="color:var(--teal)"></i> Past dates can't be selected anywhere on the website; today and future dates are allowed.</li>
        <li><i class="bi bi-shield-check" style="color:var(--teal)"></i> A booking is only <b>Confirmed</b> after its payment succeeds.</li>
        <li><i class="bi bi-credit-card" style="color:var(--teal)"></i> Payments run through a <b>sandbox gateway</b> (no real money). Swap in Razorpay/Stripe in <span class="mono">server/utils/gateway.js</span> to go live.</li>
        <li><i class="bi bi-hash" style="color:var(--teal)"></i> Booking references look like <span class="mono">UKY-${new Date().getFullYear()}-XXXXX</span>.</li></ul></div></div>`;
    (async () => { try { const r = await fetch(Auth.API_BASE + "/api/health"); const j = await r.json(); $("#sysBody", el).innerHTML = `<dl class="kv"><dt>API</dt><dd>${A.badge("active", "Online")}</dd><dt>Server date</dt><dd>${esc(j.today || "—")}</dd><dt>Server time</dt><dd>${fmtDateTime(j.time)}</dd><dt>API address</dt><dd class="mono">${esc(Auth.API_BASE)}</dd></dl>`; }
      catch (_) { $("#sysBody", el).innerHTML = `<div class="state-box error" style="padding:20px"><i class="bi bi-cloud-slash"></i><h4>API unreachable</h4></div>`; } })();
    $("#chgPw", el).addEventListener("click", () => A.formModal({ title: "Change password", size: "sm", submitText: "Update password",
      fields: [{ name: "currentPassword", label: "Current password", type: "password", required: true, full: true }, { name: "newPassword", label: "New password (min 6 characters)", type: "password", required: true, full: true }, { name: "confirm", label: "Confirm new password", type: "password", required: true, full: true }],
      onSubmit: async (v) => { if (v.newPassword.length < 6) throw new Error("New password must be at least 6 characters."); if (v.newPassword !== v.confirm) throw new Error("The new passwords don't match.");
        await call(Auth.changePassword({ currentPassword: v.currentPassword, newPassword: v.newPassword })); toast("Password updated"); } }));
  } });
})();
