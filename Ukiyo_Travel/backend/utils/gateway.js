/* =========================================================
   SANDBOX payment gateway (used only when no Razorpay keys are configured).
   No real money moves. Simulates a gateway so the full
   Pay -> Processing -> Success/Failed -> Retry flow works end to end.

   Test inputs
     Card   4242 4242 4242 4242 -> success   | 4000 0000 0000 0002 -> declined
     UPI    any valid id        -> success   | any id containing "fail" -> declined
     Netbanking / Wallet        -> success   (bank "Test Bank – Down" fails)
   Only masked details (last 4 digits / masked UPI id) are ever stored.
========================================================= */
const { transactionId } = require("./reference");

const METHODS = ["card", "upi", "netbanking", "wallet"];
const BANKS = ["SBI", "HDFC Bank", "ICICI Bank", "Axis Bank", "Kotak Mahindra Bank", "Bank of Baroda", "Punjab National Bank", "Yes Bank", "Test Bank – Down"];
const WALLETS = ["Paytm", "PhonePe", "Amazon Pay"];

function luhn(num) {
  let sum = 0, alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = parseInt(num[i], 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
}

/** Accept both request shapes: flat (cardNumber…) and nested (card:{number,name,expiry,cvv}). */
function normalizeInput(body = {}) {
  const c = body.card && typeof body.card === "object" ? body.card : {};
  return {
    cardNumber: body.cardNumber != null ? body.cardNumber : c.number,
    cardName: body.cardName != null ? body.cardName : c.name,
    expiry: body.expiry != null ? body.expiry : c.expiry,
    cvv: body.cvv != null ? body.cvv : c.cvv,
    upiId: body.upiId,
    bank: body.bank,
    wallet: body.wallet,
  };
}

/** Returns { error } for malformed input (HTTP 400), or { details } (masked). */
function validateInput(method, input = {}, now = new Date()) {
  if (!METHODS.includes(method)) return { error: "Please select a payment method." };

  if (method === "card") {
    const number = String(input.cardNumber || "").replace(/\s+/g, "");
    if (!/^\d{13,19}$/.test(number) || !luhn(number)) return { error: "Enter a valid card number." };
    const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(String(input.expiry || "").trim());
    if (!m || +m[1] < 1 || +m[1] > 12) return { error: "Enter the expiry as MM/YY." };
    const expEnd = new Date(2000 + +m[2], +m[1], 1); // first day of the month after expiry
    if (expEnd <= now) return { error: "This card has expired." };
    if (!/^\d{3,4}$/.test(String(input.cvv || ""))) return { error: "Enter a valid CVV." };
    if (!String(input.cardName || "").trim()) return { error: "Enter the name on the card." };
    return { details: { last4: number.slice(-4), number } };
  }
  if (method === "upi") {
    const upi = String(input.upiId || "").trim().toLowerCase();
    if (!/^[a-z0-9._-]{2,}@[a-z]{2,}$/.test(upi)) return { error: "Enter a valid UPI ID (e.g. name@bank)." };
    const [user, handle] = upi.split("@");
    return { details: { upi, masked: `${user.slice(0, 2)}***@${handle}` } };
  }
  if (method === "netbanking") {
    if (!BANKS.includes(input.bank)) return { error: "Please choose your bank." };
    return { details: { bank: input.bank } };
  }
  if (!WALLETS.includes(input.wallet)) return { error: "Please choose a wallet." };
  return { details: { wallet: input.wallet } };
}

/** Pretend to talk to a gateway. `delayMs` gives the UI a real "processing" state. */
async function charge({ method, details, delayMs = 1200 }) {
  if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
  if (method === "card" && details.number === "4000000000000002")
    return { ok: false, reason: "Your card was declined by the bank.", details: { last4: details.last4 } };
  if (method === "upi" && /fail/i.test(details.upi))
    return { ok: false, reason: "UPI payment was declined or timed out.", details: { upi: details.masked } };
  if (method === "netbanking" && details.bank === "Test Bank – Down")
    return { ok: false, reason: "The bank's server is not responding.", details: { bank: details.bank } };

  const safe = method === "card" ? { last4: details.last4 } : method === "upi" ? { upi: details.masked } : details;
  return { ok: true, transactionId: transactionId(), details: safe };
}

/** Human note shown on receipts, e.g. "Card •••• 4242". Never contains full card data. */
function noteFor(method, details = {}) {
  if (method === "card") return details.last4 ? `Card •••• ${details.last4}` : "Card";
  if (method === "upi") return "UPI";
  if (method === "netbanking") return details.bank || "Net Banking";
  if (method === "wallet") return details.wallet || "Wallet";
  return "";
}

module.exports = { METHODS, BANKS, WALLETS, validateInput, normalizeInput, charge, noteFor, luhn };
