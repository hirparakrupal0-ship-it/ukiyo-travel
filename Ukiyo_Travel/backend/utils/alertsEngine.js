/* Smart Alerts — computed from live data on every request. */
const { dateKey, addDays } = require("./dates");
const { countBy } = require("./analytics");

/** Each alert's key embeds a signature of its data, so a cleared alert returns when the numbers change. */
function buildAlerts({ bookings, payments, enquiries, users, now = new Date() }) {
  const today = dateKey(now), tomorrow = addDays(today, 1);
  const alerts = [];
  const add = (type, sig, severity, title, message, link) =>
    alerts.push({ key: `${type}:${sig}`, type, severity, title, message, link });

  const pending = bookings.filter((b) => b.status === "pending");
  if (pending.length) add("pending-payments", pending.length, "warning", "Bookings awaiting payment",
    `${pending.length} booking${pending.length > 1 ? "s are" : " is"} awaiting payment.`, { view: "bookings", filter: "pending" });

  const open = enquiries.filter((e) => (e.status || "new") !== "handled");
  if (open.length) add("unhandled-enquiries", open.length, "warning", "Unhandled enquiries",
    `${open.length} enquir${open.length > 1 ? "ies have" : "y has"} not been handled.`, { view: "enquiries", filter: "new" });

  const confirmed = bookings.filter((b) => b.status === "confirmed");
  const tm = confirmed.filter((b) => b.travelDate === tomorrow).length;
  if (tm) add("trips-tomorrow", `${tomorrow}:${tm}`, "info", "Trips tomorrow",
    `${tm} trip${tm > 1 ? "s are" : " is"} scheduled for tomorrow.`, { view: "calendar", date: tomorrow });
  const td = confirmed.filter((b) => b.travelDate === today).length;
  if (td) add("trips-today", `${today}:${td}`, "info", "Trips starting today",
    `${td} trip${td > 1 ? "s start" : " starts"} today.`, { view: "calendar", date: today });

  const failedNow = bookings.filter((b) => b.status === "pending" && b.paymentStatus === "failed").length;
  if (failedNow) add("failed-payments", failedNow, "danger", "Failed payments",
    `${failedNow} booking${failedNow > 1 ? "s have" : " has"} a failed payment waiting for retry.`, { view: "payments", filter: "failed" });

  const w0 = addDays(today, -6);
  const recent = bookings.filter((b) => { const k = dateKey(b.createdAt); return k >= w0 && k <= today; });
  const cancelled = recent.filter((b) => b.status === "cancelled").length;
  if (cancelled >= 3 && cancelled / recent.length >= 0.3) add("high-cancellations", cancelled, "danger", "High cancellation activity",
    `${cancelled} of ${recent.length} bookings from the last 7 days were cancelled.`, { view: "bookings", filter: "cancelled" });

  const newUsers = users.filter((u) => dateKey(u.createdAt) === today).length;
  if (newUsers) add("new-users", `${today}:${newUsers}`, "info", "New users",
    `${newUsers} new user${newUsers > 1 ? "s" : ""} registered today.`, { view: "users" });

  const perDay = countBy(bookings, (b) => dateKey(b.createdAt));
  const todayN = perDay.get(today) || 0;
  let prevTotal = 0;
  for (let i = 1; i <= 7; i++) prevTotal += perDay.get(addDays(today, -i)) || 0;
  const avg = prevTotal / 7;
  if (todayN >= 3 && todayN >= avg * 2) add("booking-surge", `${today}:${todayN}`, "success", "Sudden increase in bookings",
    `${todayN} bookings today, versus an average of ${avg.toFixed(1)} per day last week.`, { view: "bookings" });

  return alerts;
}

module.exports = { buildAlerts };
