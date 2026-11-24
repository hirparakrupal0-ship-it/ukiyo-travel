/* Ukiyo Insights — rule-based, no external AI. Every number comes from records.
   If a rule lacks data it says so instead of guessing. */
const { dateKey, addDays } = require("./dates");
const { bookingAmount } = require("./money");
const { countBy, top, pct, createdBetween, MONTHS, live } = require("./analytics");

const NOT_ENOUGH = "Not enough data to generate this insight.";
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
const sign = (n) => (n > 0 ? `+${n}%` : `${n}%`);

function buildInsights({ bookings, payments, users, destOf, now = new Date() }) {
  const today = dateKey(now);
  const w0 = addDays(today, -6), p0 = addDays(today, -13), p1 = addDays(today, -7);
  const out = [];
  const add = (i) => out.push({ severity: "info", insufficient: false, metrics: [], action: null, ...i });
  const none = (id, title) => add({ id, title, text: NOT_ENOUGH, insufficient: true });

  const cur = createdBetween(bookings, w0, today);
  const prev = createdBetween(bookings, p0, p1);
  const curLive = cur.filter(live);
  const prevLive = prev.filter(live);

  // 1. Booking growth (overall)
  if (cur.length + prev.length >= 3 && prev.length > 0) {
    const g = pct(cur.length, prev.length);
    add({
      id: "booking-growth", title: "Booking activity",
      severity: g >= 0 ? "good" : "warn",
      text: g === 0 ? "Bookings are flat compared with last week."
        : `Bookings ${g > 0 ? "increased" : "decreased"} ${Math.abs(g)}% compared with the previous 7 days.`,
      metrics: [
        { label: "Booking Growth", value: sign(g) },
        { label: "Bookings this week", value: String(cur.length) },
        { label: "Bookings last week", value: String(prev.length) },
      ],
    });
  } else none("booking-growth", "Booking activity");

  // 2. Destination surge
  const destThis = countBy(curLive, (b) => destOf(b).name);
  const destPrev = countBy(prevLive, (b) => destOf(b).name);
  const lead = top(destThis);
  if (lead && lead.count >= 2) {
    const slug = (curLive.find((b) => destOf(b).name === lead.name) && destOf(curLive.find((b) => destOf(b).name === lead.name)).slug) || "";
    const before = destPrev.get(lead.name) || 0;
    const g = pct(lead.count, before);
    const rows = curLive.filter((b) => destOf(b).name === lead.name);
    add({
      id: "destination-surge", title: `${lead.name} is in demand`, severity: "good",
      text: before === 0 ? `${lead.name} received ${lead.count} bookings this week and none the week before.`
        : `${lead.name} bookings ${g >= 0 ? "increased" : "decreased"} ${Math.abs(g)}% this week.`,
      metrics: [
        { label: "Booking Growth", value: g === null ? "New demand" : sign(g) },
        { label: "Travellers", value: String(rows.reduce((s, b) => s + (b.travellers || 1), 0)) },
        { label: "Estimated Revenue", value: inr(rows.reduce((s, b) => s + bookingAmount(b), 0)) },
      ],
      action: { text: `Consider featuring ${lead.name} packages on the homepage.`, type: "feature-destination", slug },
    });
  } else none("destination-surge", "Destination demand");

  // 3. Revenue growth (paid payments)
  const paid = payments.filter((p) => p.status === "paid");
  const revIn = (from, to) => paid.filter((p) => { const k = dateKey(p.paidAt || p.createdAt); return k >= from && k <= to; }).reduce((s, p) => s + p.amount, 0);
  const rc = revIn(w0, today), rp = revIn(p0, p1);
  if (rp > 0) {
    const g = pct(rc, rp);
    add({ id: "revenue-growth", title: "Revenue", severity: g >= 0 ? "good" : "warn",
      text: `Collected revenue ${g >= 0 ? "grew" : "fell"} ${Math.abs(g)}% versus the previous 7 days.`,
      metrics: [{ label: "This week", value: inr(rc) }, { label: "Last week", value: inr(rp) }, { label: "Change", value: sign(g) }] });
  } else none("revenue-growth", "Revenue");

  // 4. Popular travel period
  const month = top(countBy(bookings.filter((b) => live(b) && b.travelDate), (b) => MONTHS[parseInt(b.travelDate.slice(5, 7), 10) - 1]));
  const dated = bookings.filter((b) => live(b) && b.travelDate).length;
  if (dated >= 3 && month) {
    add({ id: "travel-period", title: "Popular travel period",
      text: `${month.name} is the most requested travel month (${month.count} of ${dated} bookings).`,
      metrics: [{ label: "Top month", value: month.name }, { label: "Share", value: `${Math.round((month.count / dated) * 100)}%` }] });
  } else none("travel-period", "Popular travel period");

  // 5. High-demand destination (share of all active bookings)
  const liveAll = bookings.filter(live);
  const dAll = top(countBy(liveAll, (b) => destOf(b).name));
  if (liveAll.length >= 5 && dAll) {
    const share = Math.round((dAll.count / liveAll.length) * 100);
    add({ id: "high-demand", title: "High-demand destination",
      text: share >= 40 ? `${dAll.name} accounts for ${share}% of all bookings — demand is concentrated.`
        : `${dAll.name} leads with ${share}% of bookings; demand is well spread across destinations.`,
      metrics: [{ label: "Destination", value: dAll.name }, { label: "Bookings", value: String(dAll.count) }, { label: "Share", value: `${share}%` }] });
  } else none("high-demand", "High-demand destination");

  // 6. Pending payment trend
  const pend = bookings.filter((b) => b.status === "pending");
  if (bookings.length >= 3) {
    const share = Math.round((pend.length / bookings.length) * 100);
    const amt = pend.reduce((s, b) => s + bookingAmount(b), 0);
    add({ id: "pending-payments", title: "Pending payments", severity: share >= 30 ? "warn" : "info",
      text: pend.length ? `${pend.length} booking${pend.length > 1 ? "s are" : " is"} awaiting payment (${share}% of all bookings).` : "No bookings are waiting for payment.",
      metrics: [{ label: "Awaiting payment", value: String(pend.length) }, { label: "Value at stake", value: inr(amt) }],
      action: pend.length ? { text: "Follow up with customers who haven't paid yet.", type: "view", view: "bookings", filter: "pending" } : null });
  } else none("pending-payments", "Pending payments");

  // 7. Cancellation trend
  const cc = cur.filter((b) => b.status === "cancelled").length;
  const cp = prev.filter((b) => b.status === "cancelled").length;
  if (cur.length + prev.length >= 4) {
    const rate = cur.length ? Math.round((cc / cur.length) * 100) : 0;
    add({ id: "cancellations", title: "Cancellations", severity: rate >= 30 && cc >= 2 ? "warn" : "info",
      text: cc === 0 ? "No cancellations in the last 7 days." : `${cc} cancellation${cc > 1 ? "s" : ""} this week (${rate}% of new bookings)${cp ? `, versus ${cp} the week before` : ""}.`,
      metrics: [{ label: "This week", value: String(cc) }, { label: "Last week", value: String(cp) }, { label: "Rate", value: `${rate}%` }] });
  } else none("cancellations", "Cancellations");

  // 8. Customer activity
  const newCur = users.filter((u) => { const k = dateKey(u.createdAt); return k >= w0 && k <= today; }).length;
  const newPrev = users.filter((u) => { const k = dateKey(u.createdAt); return k >= p0 && k <= p1; }).length;
  if (users.length >= 3) {
    const active = new Set(cur.map((b) => String(b.user))).size;
    add({ id: "customer-activity", title: "Customer activity",
      text: `${newCur} new account${newCur === 1 ? "" : "s"} this week (${newPrev} last week); ${active} customer${active === 1 ? "" : "s"} made a booking.`,
      metrics: [{ label: "New users", value: String(newCur) }, { label: "Active bookers", value: String(active) }, { label: "Total users", value: String(users.length) }] });
  } else none("customer-activity", "Customer activity");

  return out;
}

module.exports = { buildInsights, NOT_ENOUGH };
