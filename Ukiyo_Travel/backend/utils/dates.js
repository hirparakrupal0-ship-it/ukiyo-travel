/* Date helpers. "Today" is always detected at call time (never hardcoded),
   in the business timezone (APP_TIMEZONE, default Asia/Kolkata) so that
   "today" matches what the customer sees on their calendar. */
const TZ = process.env.APP_TIMEZONE || "Asia/Kolkata";
const PAST_DATE_MESSAGE = "Please select today or a future date.";

const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** YYYY-MM-DD for the given instant, in the business timezone. */
function dateKey(date = new Date()) {
  return fmt.format(new Date(date));
}
const todayISO = (now = new Date()) => dateKey(now);

function isValidISODate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** ISO strings compare correctly as plain strings. */
function isPastDate(iso, now = new Date()) {
  return iso < todayISO(now);
}

function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

module.exports = { TZ, PAST_DATE_MESSAGE, dateKey, todayISO, isValidISODate, isPastDate, addDays };
