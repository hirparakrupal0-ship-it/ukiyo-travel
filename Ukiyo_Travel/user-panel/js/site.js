/* =========================================================
   Ukiyo Travel — homepage interaction layer
   Renders catalog cards and wires every click:
   explore modals, booking, wishlist, gallery, chat, contact.
   Depends on: bootstrap bundle, js/data.js, js/auth-api.js
========================================================= */
(function () {
  "use strict";

  const D = window.UkiyoData;
  const Auth = window.UkiyoAuth;
  const GUEST_WISHLIST_KEY = "ukiyo_guest_wishlist";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  const modal = (id) => window.bootstrap && bootstrap.Modal.getOrCreateInstance(document.getElementById(id));

  // ---------- Toast ----------
  const toastEl = $("#wishlistToast");
  let toastTimer;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2000);
  }

  // =========================================================
  //  Wishlist state (backend when logged in, else localStorage)
  // =========================================================
  let wishlist = [];
  let myTrips = [];

  function loadGuestWishlist() {
    try { return JSON.parse(localStorage.getItem(GUEST_WISHLIST_KEY)) || []; }
    catch (_) { return []; }
  }
  function saveGuestWishlist(list) {
    try { localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(list)); } catch (_) {}
  }

  async function initWishlist() {
    if (Auth.isLoggedIn()) {
      try {
        const res = await Auth.getWishlist();
        wishlist = res.wishlist || [];
      } catch (_) { wishlist = []; }
    } else {
      wishlist = loadGuestWishlist();
    }
    reflectWishlist();
  }

  async function toggleWishlist(slug) {
    const has = wishlist.includes(slug);
    if (Auth.isLoggedIn()) {
      try {
        const res = has ? await Auth.removeWishlist(slug) : await Auth.addWishlist(slug);
        wishlist = res.wishlist || [];
      } catch (err) { toast(err.message || "Could not update wishlist"); return; }
    } else {
      wishlist = has ? wishlist.filter((s) => s !== slug) : wishlist.concat(slug);
      saveGuestWishlist(wishlist);
    }
    reflectWishlist();
    const dest = D.bySlug(slug);
    toast(has ? "Removed from wishlist" : `❤️ ${dest ? dest.name : "Saved"} added to wishlist`);
  }

  function reflectWishlist() {
    const count = wishlist.length;
    const badge = $("#wishCount");
    if (badge) {
      badge.textContent = String(count);
      badge.style.display = count ? "flex" : "none";
    }
    // Update heart icons on cards + inside destination modal.
    $$(".js-wish").forEach((btn) => {
      const on = wishlist.includes(btn.dataset.slug);
      btn.classList.toggle("saved", on);
      const i = btn.querySelector("i");
      if (i) { i.classList.toggle("bi-heart-fill", on); i.classList.toggle("bi-heart", !on); }
    });
  }

  // =========================================================
  //  Render catalog cards
  // =========================================================
  function renderDestinations() {
    const grid = $("#destinationGrid");
    if (!grid) return;
    grid.innerHTML = D.destinations
      .map(
        (d) => `
      <div class="col-lg-4 col-md-6">
        <div class="destination-card" data-slug="${d.slug}">
          <button class="wish-heart js-wish" data-slug="${d.slug}" aria-label="Save ${esc(d.name)}" title="Save to wishlist">
            <i class="bi bi-heart"></i>
          </button>
          <img src="${d.image}" alt="${esc(d.name)}" loading="lazy">
          <div class="card-body">
            <h4>${esc(d.name)}</h4>
            <p>${esc(d.short)}</p>
            <button class="btn card-btn js-explore" data-slug="${d.slug}">Explore</button>
          </div>
        </div>
      </div>`
      )
      .join("");

    // Search datalist
    const dl = $("#destinationList");
    if (dl) dl.innerHTML = D.destinations.map((d) => `<option value="${esc(d.name)}">`).join("");
  }

  function renderPackages() {
    const grid = $("#packageGrid");
    if (!grid) return;
    grid.innerHTML = D.packages
      .map(
        (p) => `
      <div class="col-lg-4 col-md-6">
        <div class="package-card">
          <span class="price">${esc(p.price)}</span>
          <img src="${p.image}" alt="${esc(p.title)}" loading="lazy">
          <div class="p-4">
            <h4>${esc(p.title)}</h4>
            <p>${esc(p.duration)}</p>
            <button class="btn btn-warning w-100 js-book" data-package="${p.id}">Book Now</button>
          </div>
        </div>
      </div>`
      )
      .join("");
  }

  // =========================================================
  //  Destination detail modal
  // =========================================================
  function openDestination(slug) {
    const d = D.bySlug(slug);
    if (!d) return;
    const saved = wishlist.includes(slug);
    $("#destinationModalContent").innerHTML = `
      <button type="button" class="btn-close btn-close-white dest-close" data-bs-dismiss="modal" aria-label="Close"></button>
      <div class="dest-hero" style="background-image:url('${d.image}')">
        <div class="dest-hero-info">
          <span class="dest-badge">Best time: ${esc(d.bestTime)}</span>
          <h3>${esc(d.name)}</h3>
        </div>
      </div>
      <div class="modal-body">
        <p class="dest-desc">${esc(d.description)}</p>
        <h6 class="dest-sub">Highlights</h6>
        <div class="dest-highlights">
          ${d.highlights.map((h) => `<span><i class="bi bi-check-circle-fill"></i> ${esc(h)}</span>`).join("")}
        </div>
        <div class="dest-foot">
          <div class="dest-price">From <strong>${esc(d.priceFrom)}</strong> <small>/ person</small></div>
          <div class="dest-actions">
            <button class="btn hero-outline js-wish" data-slug="${d.slug}">
              <i class="bi ${saved ? "bi-heart-fill" : "bi-heart"}"></i> ${saved ? "Saved" : "Wishlist"}
            </button>
            <button class="btn primary-btn js-book-dest" data-slug="${d.slug}">Book this trip <i class="bi bi-arrow-right"></i></button>
          </div>
        </div>
      </div>`;
    reflectWishlist();
    modal("destinationModal").show();
  }

  // =========================================================
  //  Booking modal
  // =========================================================
  let bookingTarget = null;

  function openBooking(target) {
    if (!Auth.isLoggedIn()) {
      toast("Please log in to book a trip");
      setTimeout(() => { window.location.href = "login.html"; }, 900);
      return;
    }
    bookingTarget = target;
    $("#bookingErr").classList.remove("show");
    $("#bookingSummary").innerHTML = `
      <div class="bk-item">
        <i class="bi bi-geo-alt-fill"></i>
        <div>
          <strong>${esc(target.title)}</strong>
          ${target.price ? `<span>${esc(target.price)}${target.itemType === "destination" ? " / person" : ""}</span>` : ""}
        </div>
      </div>`;
    // If another modal (destination/hotels) is open, close it first, then show booking.
    let hadOpen = false;
    ["destinationModal", "hotelsModal"].forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.classList.contains("show")) { modal(id).hide(); hadOpen = true; }
    });
    setTimeout(() => modal("bookingModal").show(), hadOpen ? 250 : 0);
  }

  // =========================================================
  //  Hotels browser modal
  // =========================================================
  function openHotelsModal() {
    $("#hotelsBody").innerHTML = D.hotels
      .map(
        (h) => `
      <div class="hotel-row">
        <img src="${h.image}" alt="${esc(h.name)}" loading="lazy">
        <div class="hotel-row-info">
          <div class="hotel-row-top">
            <strong>${esc(h.name)}</strong>
            <span class="hotel-rating"><i class="bi bi-star-fill"></i> ${h.rating}</span>
          </div>
          <span class="hotel-city"><i class="bi bi-geo-alt"></i> ${esc(h.city)}</span>
          <div class="hotel-tags">${h.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>
        </div>
        <div class="hotel-row-book">
          <div class="hotel-price"><strong>${esc(h.price)}</strong><small>/ night</small></div>
          <button class="btn primary-btn js-book-hotel" data-hotel="${h.id}">Book stay</button>
        </div>
      </div>`
      )
      .join("");
    modal("hotelsModal").show();
  }

  async function submitBooking(e) {
    e.preventDefault();
    if (!bookingTarget) return;
    const err = $("#bookingErr");
    err.classList.remove("show");
    const btn = $("#bookingSubmit");
    const orig = btn.innerHTML;

    const date = $("#bkDate").value;
    const travellers = parseInt($("#bkTravellers").value, 10) || 1;
    if (!date) { err.textContent = "Please choose a travel date."; err.classList.add("show"); return; }
    if (Auth.isPastDate(date)) { err.textContent = Auth.PAST_DATE_MESSAGE; err.classList.add("show"); return; }

    btn.disabled = true;
    btn.innerHTML = "Booking…";
    try {
      const res = await Auth.createBooking({
        itemType: bookingTarget.itemType,
        itemId: bookingTarget.itemId,
        title: bookingTarget.title,
        price: bookingTarget.price || "",
        travelDate: date,
        travellers,
        notes: $("#bkNotes").value.trim(),
      });
      // Booking is saved as "pending". It is only confirmed after payment succeeds.
      const bkEl = document.getElementById("bookingModal");
      const afterHide = () => { bkEl.removeEventListener("hidden.bs.modal", afterHide); openPayment(res.booking); };
      bkEl.addEventListener("hidden.bs.modal", afterHide);
      modal("bookingModal").hide();
      $("#bookingForm").reset();
      $("#bkTravellers").value = 2;
    } catch (err2) {
      err.textContent = err2.message || "Booking failed.";
      err.classList.add("show");
    } finally {
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  }

  // =========================================================
  //  Payment modal: summary -> method -> Pay Now -> processing -> success / failed
  //  A booking is only "confirmed" (and given a reference) after payment succeeds.
  // =========================================================
  const PAY_STEPS = ["Form", "Processing", "Success", "Failed"];
  const DEFAULT_BANKS = ["SBI", "HDFC Bank", "ICICI Bank", "Axis Bank", "Kotak Mahindra Bank", "Bank of Baroda", "Punjab National Bank", "Yes Bank"];
  let payBooking = null;
  let payCfg = { mode: "demo", banks: DEFAULT_BANKS };
  let payBusy = false;
  let payDone = false;      // true once this booking has been paid
  let payHandoff = false;   // true while the Razorpay checkout temporarily replaces our modal

  const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
  const priceNum = (str) => parseInt(String(str || "").replace(/[^\d]/g, ""), 10) || 0;
  // "2026-10-02" -> "02 Oct 2026" (parsed as a local date, so no timezone shift)
  function fmtTripDate(v) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || "");
    if (!m) return "Date TBD";
    return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }
  const bookingAmount = (b) => (b.amount > 0 ? b.amount : priceNum(b.price) * (b.travellers || 1));
  const isHotel = (b) => b.itemType === "hotel";
  const unitLabel = (b) => (isHotel(b) ? "/ night" : "/ person");
  const paxLabel = (b) => (isHotel(b) ? "Guests" : "Travellers");

  function showPayStep(name) {
    PAY_STEPS.forEach((n) => { const el = $("#payStep" + n); if (el) el.hidden = n !== name; });
    const closeBtn = $("#payClose");
    if (closeBtn) closeBtn.style.display = name === "Processing" ? "none" : "";
  }

  function payError(msg) {
    const el = $("#payErr");
    if (!msg) { el.classList.remove("show"); return; }
    el.textContent = msg;
    el.classList.add("show");
  }

  const selectedMethod = () => ($('input[name="payMethod"]:checked') || {}).value || "upi";

  function syncPayPanels() {
    const m = selectedMethod();
    const gateway = payCfg.mode === "razorpay";
    $("#payDetails").hidden = gateway;
    $("#payGatewayNote").hidden = !gateway;
    $$("#payDetails .pay-panel").forEach((p) => { p.hidden = p.dataset.panel !== m; });
    payError("");
  }

  function showPaymentModal() {
    const el = document.getElementById("paymentModal");
    payHandoff = false;
    if (el.classList.contains("show")) return;
    // If it is still fading out, wait for it to finish before re-opening.
    if (el._hiding) el.addEventListener("hidden.bs.modal", () => modal("paymentModal").show(), { once: true });
    else modal("paymentModal").show();
  }

  async function openPayment(booking) {
    if (!booking || !booking._id) { toast("Booking saved. See My Trips."); return; }
    payBooking = booking;
    payBusy = false;
    payDone = false;

    // Summary: trip name, travel date, travellers, price per person, total.
    const amount = bookingAmount(booking);
    $("#paySummary").innerHTML = `
      <div class="pay-trip"><i class="bi bi-geo-alt-fill"></i><strong>${esc(booking.title)}</strong></div>
      <div class="pay-rows">
        <div class="pay-row"><span>Travel date</span><b>${esc(fmtTripDate(booking.travelDate))}</b></div>
        <div class="pay-row"><span>${paxLabel(booking)}</span><b>${booking.travellers}</b></div>
        <div class="pay-row"><span>Price ${isHotel(booking) ? "per night" : "per person"}</span><b>${esc(booking.price || inr(0))} ${unitLabel(booking)}</b></div>
      </div>
      <div class="pay-total"><span>Total</span><strong>${inr(amount)}</strong></div>`;
    $("#payNowAmt").textContent = "· " + inr(amount);

    // Reset form state.
    ["#payUpi", "#payCardNo", "#payCardName", "#payCardExp", "#payCardCvv"].forEach((id) => { $(id).value = ""; });
    $("#payBank").value = "";
    $('input[name="payMethod"][value="upi"]').checked = true;
    $("#payNow").disabled = false;

    // Which gateway is active?
    try { payCfg = Object.assign({ banks: DEFAULT_BANKS }, await Auth.paymentConfig()); }
    catch (_) { payCfg = { mode: "demo", banks: DEFAULT_BANKS }; }
    $("#payBank").innerHTML = `<option value="">Choose a bank…</option>` + (payCfg.banks || DEFAULT_BANKS).map((b) => `<option value="${esc(b)}">${esc(b)}</option>`).join("");
    $("#payTestNote").hidden = payCfg.mode !== "demo";

    showPayStep("Form");
    syncPayPanels();
    if (payCfg.mode === "disabled") {
      payError("Online payments are currently unavailable. Your booking is saved as pending — you can pay later from My Trips.");
      $("#payNow").disabled = true;
    }
    showPaymentModal();
  }

  function paySuccess(booking) {
    payBooking = booking;
    payDone = true;
    $("#payRef").textContent = booking.bookingRef || "—";
    const methodName = { upi: "UPI", card: "Card", netbanking: "Net Banking" }[booking.paymentMethod] || "";
    $("#payReceipt").innerHTML = `
      <div class="pay-row"><span>Trip</span><b>${esc(booking.title)}</b></div>
      <div class="pay-row"><span>Travel date</span><b>${esc(fmtTripDate(booking.travelDate))}</b></div>
      <div class="pay-row"><span>Amount paid</span><b>${inr(bookingAmount(booking))}</b></div>
      ${methodName ? `<div class="pay-row"><span>Paid via</span><b>${esc(methodName)}${booking.paymentNote && booking.paymentMethod !== "upi" ? " · " + esc(booking.paymentNote) : ""}</b></div>` : ""}`;
    showPayStep("Success");
  }

  function payFailed() { showPayStep("Failed"); }

  // Show "Processing" for at least ~2s so it never just flashes.
  const minDelay = (ms) => new Promise((r) => setTimeout(r, ms));

  async function payNow() {
    if (payBusy || !payBooking) return;
    payError("");
    const method = selectedMethod();

    if (payCfg.mode === "razorpay") return payWithRazorpay(method);

    // Built-in test gateway: collect details, validate on the server.
    const body = { bookingId: payBooking._id, method };
    if (method === "upi") {
      body.upiId = $("#payUpi").value.trim();
      if (!body.upiId) return payError("Enter your UPI ID.");
    } else if (method === "card") {
      body.card = { number: $("#payCardNo").value, name: $("#payCardName").value, expiry: $("#payCardExp").value, cvv: $("#payCardCvv").value };
      if (!body.card.number.trim() || !body.card.name.trim() || !body.card.expiry.trim() || !body.card.cvv.trim()) return payError("Please fill in all card details.");
    } else {
      body.bank = $("#payBank").value;
      if (!body.bank) return payError("Please select your bank.");
    }

    payBusy = true;
    showPayStep("Processing");
    try {
      const [res] = await Promise.all([Auth.payDemo(body), minDelay(2000)]);
      $("#payCardNo").value = ""; $("#payCardCvv").value = "";   // never keep card data around
      payBusy = false;
      paySuccess(res.booking);
    } catch (err) {
      await minDelay(800);
      payBusy = false;
      if (err.message === "Payment Failed. Please try again.") {
        $("#payCardCvv").value = "";
        payFailed();
      } else {
        // e.g. invalid card number / expired card: let the user fix it on the form.
        showPayStep("Form");
        payError(err.message || "Something went wrong. Please try again.");
      }
    }
  }

  // Real gateway (only when Razorpay keys are configured on the server).
  async function payWithRazorpay(method) {
    if (typeof window.Razorpay === "undefined") return payError("Payment gateway could not be loaded. Please check your connection.");
    payBusy = true;
    let order;
    try { order = await Auth.createOrder(payBooking._id); }
    catch (err) { payBusy = false; return payError(err.message || "Could not start the payment."); }

    const user = Auth.getUser() || {};
    const bookingId = payBooking._id;
    let settled = false;
    const reopen = (fn) => { fn(); showPaymentModal(); };

    const rzp = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: "Ukiyo Travel",
      description: payBooking.title,
      order_id: order.orderId,
      prefill: {
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        email: user.email || "",
        contact: user.phone || "",
        method,
      },
      theme: { color: "#17BEBB" },
      handler: async function (resp) {
        settled = true;
        reopen(() => showPayStep("Processing"));
        try {
          const [out] = await Promise.all([
            Auth.verifyPayment({
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
              bookingId,
              method,
            }),
            minDelay(1200),
          ]);
          payBusy = false;
          paySuccess(out.booking);
        } catch (_) { payBusy = false; payFailed(); }
      },
      modal: {
        ondismiss: function () {
          if (settled) return;
          payBusy = false;
          reopen(() => { showPayStep("Form"); payError("Payment was cancelled. You can try again."); });
        },
      },
    });
    rzp.on("payment.failed", function () {
      settled = true;
      payBusy = false;
      Auth.markPaymentFailed(bookingId).catch(() => {});
      rzp.close();
      reopen(payFailed);
    });
    // Hide our modal while Razorpay's checkout is on screen (avoids focus-trap clashes).
    const el = document.getElementById("paymentModal");
    payHandoff = true;
    el.addEventListener("hidden.bs.modal", () => rzp.open(), { once: true });
    modal("paymentModal").hide();
  }

  // Wire the payment modal once.
  (function wirePayment() {
    const el = document.getElementById("paymentModal");
    if (!el) return;
    el.addEventListener("hide.bs.modal", (e) => {
      // Don't allow closing while the test gateway is processing.
      if (payBusy && payCfg.mode !== "razorpay") { e.preventDefault(); return; }
      el._hiding = true;
    });
    el.addEventListener("hidden.bs.modal", () => {
      el._hiding = false;
      // Closed without paying: the booking stays pending, so tell the user where to finish it.
      if (!payDone && !payHandoff && payBooking) toast("Booking saved as pending — complete payment from My Trips.");
    });
    $("#payNow").addEventListener("click", payNow);
    $("#payMethods").addEventListener("change", syncPayPanels);
    $("#payRetry").addEventListener("click", () => { payError(""); showPayStep("Form"); });
    $("#payCopy").addEventListener("click", async () => {
      const ref = $("#payRef").textContent;
      try { await navigator.clipboard.writeText(ref); toast("Booking reference copied"); } catch (_) { toast(ref); }
    });
    $("#payViewTrips").addEventListener("click", () => {
      el.addEventListener("hidden.bs.modal", () => openTripsModal(), { once: true });
      modal("paymentModal").hide();
    });
    // Light input formatting.
    $("#payCardNo").addEventListener("input", (e) => {
      const d = e.target.value.replace(/\D/g, "").slice(0, 19);
      e.target.value = d.replace(/(.{4})/g, "$1 ").trim();
    });
    $("#payCardExp").addEventListener("input", (e) => {
      let d = e.target.value.replace(/\D/g, "").slice(0, 4);
      if (d.length >= 3) d = d.slice(0, 2) + "/" + d.slice(2);
      e.target.value = d;
    });
    $("#payCardCvv").addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4); });
  })();

  // =========================================================
  //  Wishlist modal
  // =========================================================
  function openWishlistModal() {
    const body = $("#wishlistBody");
    if (!wishlist.length) {
      body.innerHTML = `<div class="empty-state"><i class="bi bi-heart"></i><p>Your wishlist is empty. Tap the heart on any destination to save it.</p></div>`;
    } else {
      body.innerHTML = wishlist
        .map((slug) => {
          const d = D.bySlug(slug);
          if (!d) return "";
          return `
          <div class="list-row" data-slug="${d.slug}">
            <img src="${d.image}" alt="${esc(d.name)}">
            <div class="list-row-info">
              <strong>${esc(d.name)}</strong>
              <span>${esc(d.short)}</span>
            </div>
            <div class="list-row-actions">
              <button class="btn card-btn js-explore" data-slug="${d.slug}">View</button>
              <button class="btn-icon js-wish-remove" data-slug="${d.slug}" title="Remove"><i class="bi bi-trash"></i></button>
            </div>
          </div>`;
        })
        .join("");
    }
    if (!Auth.isLoggedIn()) {
      body.innerHTML += `<p class="list-note"><i class="bi bi-info-circle"></i> <a href="login.html">Log in</a> to save your wishlist to your account.</p>`;
    }
    modal("wishlistModal").show();
  }

  // =========================================================
  //  My Trips modal
  // =========================================================
  async function openTripsModal() {
    if (!Auth.isLoggedIn()) {
      toast("Please log in to view your trips");
      setTimeout(() => { window.location.href = "login.html"; }, 900);
      return;
    }
    const body = $("#tripsBody");
    body.innerHTML = `<div class="empty-state"><i class="bi bi-arrow-repeat"></i><p>Loading…</p></div>`;
    modal("tripsModal").show();
    try {
      const res = await Auth.getBookings();
      myTrips = res.bookings || [];
      if (!myTrips.length) {
        body.innerHTML = `<div class="empty-state"><i class="bi bi-suitcase"></i><p>No trips yet. Book a package or destination to see it here.</p></div>`;
        return;
      }
      body.innerHTML = myTrips
        .map((b) => {
          const date = fmtTripDate(b.travelDate);
          const paid = b.paymentStatus === "paid";
          const payBadge = `<span class="pay-badge ${paid ? "paid" : "unpaid"}">${paid ? "Paid" : "Unpaid"}</span>`;
          const refunded = b.paymentStatus === "refunded";
          const payBadge2 = refunded ? `<span class="pay-badge unpaid">Refunded</span>` : payBadge;
          const rs = b.reviewStatus;
          const reviewBtn = b.status === "confirmed"
            ? (rs ? `<span class="review-state">Review ${rs === "approved" ? "published" : rs === "rejected" ? "not published" : "awaiting approval"}</span>`
                   : `<button class="btn-review js-review-trip" data-id="${b._id}"><i class="bi bi-star"></i> Review</button>`)
            : "";
          const payBtn = (paid || refunded || b.status === "cancelled") ? "" : `<button class="btn-pay js-pay-trip" data-id="${b._id}">Pay now</button>`;
          return `
          <div class="list-row trip-row" data-id="${b._id}">
            <div class="trip-badge ${esc(b.status)}">${esc(b.status)}</div>
            <div class="list-row-info">
              <strong>${esc(b.title)} ${payBadge2}</strong>
              ${b.bookingRef ? `<span class="trip-ref">Ref: ${esc(b.bookingRef)}</span>` : ""}
              <span><i class="bi bi-calendar-event"></i> ${esc(date)} · ${b.travellers} traveller(s)${b.price ? " · " + esc(b.price) : ""}</span>
            </div>
            <div class="list-row-actions">
              ${payBtn}${reviewBtn}
              <button class="btn-icon js-cancel-trip" data-id="${b._id}" title="Cancel"><i class="bi bi-x-circle"></i></button>
            </div>
          </div>`;
        })
        .join("");
    } catch (err) {
      body.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><p>${esc(err.message || "Could not load trips")}</p></div>`;
    }
  }

  async function cancelTrip(id, row) {
    try {
      await Auth.cancelBooking(id);
      if (row) row.remove();
      toast("Booking cancelled");
      if (!$("#tripsBody").querySelector(".trip-row")) {
        $("#tripsBody").innerHTML = `<div class="empty-state"><i class="bi bi-suitcase"></i><p>No trips yet.</p></div>`;
      }
    } catch (err) { toast(err.message || "Could not cancel"); }
  }

  // =========================================================
  //  Chatbot
  // =========================================================
  function chatReply(text) {
    const t = text.toLowerCase();
    const found = D.destinations.find((d) => t.includes(d.slug) || t.includes(d.name.toLowerCase()));
    if (found) return `${found.name} is a great choice! ${found.short} Packages from ${found.priceFrom}. Click Explore on the ${found.name} card for details.`;
    if (/(destination|place|where|visit)/.test(t)) return "We cover Goa, Kashmir, Kerala, Rajasthan, Meghalaya and Andaman. Scroll to Destinations and hit Explore on any card. 🌍";
    if (/(package|tour|deal|price|cost|budget)/.test(t)) return "Our trending packages start at ₹9,999. Check the Packages section and tap Book Now. 🎒";
    if (/(hotel|stay|room|resort)/.test(t)) return "We have 550+ verified hotels across India. Share your city in the enquiry form and we'll suggest stays. 🏨";
    if (/(book|reserve|reservation)/.test(t)) return "To book, tap Book Now on any package (you'll need to log in). Your trips then appear under My Trips. 📅";
    if (/(hi|hello|hey)/.test(t)) return "Hello! 👋 Ask me about destinations, packages, hotels or booking.";
    return "Thanks for your message! For personalised help, drop your details in the enquiry form and our team will reach out. ✈️";
  }

  function appendChat(text, who) {
    const body = $("#chatBody");
    const div = document.createElement("div");
    div.className = who === "user" ? "user-message" : "bot-message";
    div.innerHTML = who === "user" ? esc(text) : `<p>${esc(text)}</p>`;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  function sendChat(text) {
    const msg = text.trim();
    if (!msg) return;
    appendChat(msg, "user");
    setTimeout(() => appendChat(chatReply(msg), "bot"), 450);
  }

  // =========================================================
  //  Contact form
  // =========================================================
  async function submitContact(e) {
    e.preventDefault();
    const ok = $("#contactOk"), err = $("#contactErr");
    ok.classList.remove("show"); err.classList.remove("show");
    const btn = $("#contactSubmit");
    const orig = btn.innerHTML;

    const payload = {
      name: $("#cName").value.trim(),
      email: $("#cEmail").value.trim(),
      destination: $("#cDestination").value.trim(),
      phone: $("#cPhone").value.trim(),
      message: $("#cMessage").value.trim(),
    };
    if (!payload.name || !payload.email) {
      err.textContent = "Please enter your name and a valid email.";
      err.classList.add("show");
      return;
    }

    btn.disabled = true;
    btn.innerHTML = "Sending…";
    try {
      const res = await Auth.sendEnquiry(payload);
      ok.textContent = res.message || "Enquiry sent!";
      ok.classList.add("show");
      $("#contactForm").reset();
    } catch (err2) {
      err.textContent = err2.message || "Could not send enquiry.";
      err.classList.add("show");
    } finally {
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  }

  // =========================================================
  //  Travel DNA — live result from the 5 questions
  // =========================================================
  function checkedId(sec, name) {
    const el = sec.querySelector(`input[name="${name}"]:checked`);
    return el ? el.id : null;
  }

  function computeDNA() {
    const sec = document.getElementById("travel-dna");
    if (!sec) return;
    const vibe = checkedId(sec, "vibe");
    const style = checkedId(sec, "style");
    const withWho = checkedId(sec, "with");
    const days = checkedId(sec, "days");

    const archetypes = {
      v1: { avatar: "🌿", type: "The Serene Soul", places: "Kerala, Coorg, Andaman" },
      v2: { avatar: "🏔️", type: "The Adventurer", places: "Manali, Ladakh, Rishikesh" },
      v3: { avatar: "❤️", type: "The Romantic Soul", places: "Udaipur, Kashmir, Goa" },
      v4: { avatar: "🎉", type: "The Fun Chaser", places: "Goa, Mumbai, Jaipur" },
    };
    const base = archetypes[vibe] || archetypes.v1;
    const styleWord = { s1: "budget-savvy", s2: "comfort-loving", s3: "luxury-seeking", s4: "free-spirited" }[style] || "easygoing";
    const withWord = { w1: "solo", w2: "couple", w3: "friends", w4: "family" }[withWho] || "";

    let score = 80;
    score += { v1: 6, v2: 9, v3: 5, v4: 4 }[vibe] || 0;
    score += { s1: 2, s2: 3, s3: 4, s4: 3 }[style] || 0;
    score += { d1: 1, d2: 3, d3: 4 }[days] || 0;
    score = Math.min(99, score);

    $("#dnaAvatar").textContent = base.avatar;
    $("#dnaType").textContent = base.type;
    $("#dnaDesc").textContent =
      `A ${styleWord}${withWord ? ", " + withWord + "-loving" : ""} traveller. Best matches: ${base.places}.`;
    $("#dnaScore").textContent = score + "%";
  }

  function initDNA() {
    const sec = document.getElementById("travel-dna");
    if (!sec) return;
    sec.querySelectorAll('input[type="radio"]').forEach((r) => r.addEventListener("change", computeDNA));
    computeDNA();
  }

  // =========================================================
  //  Regret-Free Trip — live risk + recommendation
  // =========================================================
  function computeRegret() {
    const sec = document.getElementById("regret-free");
    if (!sec) return;
    const boxes = Array.from(sec.querySelectorAll('.regret-option input[type="checkbox"]'));
    const checked = boxes.filter((b) => b.checked);
    const n = checked.length;

    const risk = Math.max(6, 46 - n * 6);
    let title, tone;
    if (risk <= 15) { title = "🌟 Excellent Match"; tone = "a very low regret risk"; }
    else if (risk <= 25) { title = "✅ Great Match"; tone = "a low regret risk"; }
    else if (risk <= 35) { title = "👍 Good Match"; tone = "a moderate regret risk"; }
    else { title = "⚖️ Fair Match"; tone = "some regret risk — worth prioritising"; }

    const keys = checked.map((c) => (c.parentElement.querySelector("strong") || {}).textContent || "").join(" ").toLowerCase();
    let rec = "Kerala";
    if (keys.includes("crowd")) rec = "Meghalaya";
    else if (keys.includes("accommodation")) rec = "Rajasthan";
    else if (keys.includes("food")) rec = "Rajasthan";
    else if (keys.includes("spending")) rec = "Goa";
    else if (keys.includes("weather")) rec = "Kerala";

    $("#regretRisk").textContent = risk + "%";
    $("#regretTitle").textContent = title;
    $("#regretText").innerHTML =
      n === 0
        ? "Select what you'd like to avoid and we'll tune your recommendation."
        : `Based on your ${n} preference${n > 1 ? "s" : ""}, this trip carries ${tone}. <strong>${rec}</strong> is currently a strong match.`;
  }

  function initRegret() {
    const sec = document.getElementById("regret-free");
    if (!sec) return;
    sec.querySelectorAll('.regret-option input[type="checkbox"]').forEach((c) => c.addEventListener("change", computeRegret));
    computeRegret();
  }

  // =========================================================
  //  Smart Destination + live Match Scores (combined engine)
  // =========================================================
  function renderMatches() {
    if (!window.UkiyoScore) return;
    const ranked = UkiyoScore.rank();
    const top = ranked[0];

    const sd = $("#smartDestination");
    if (sd && top) {
      sd.innerHTML = `
        <div class="smart-dest-media" style="background-image:url('${top.image}')"></div>
        <div class="smart-dest-body">
          <span class="smart-dest-tag"><i class="bi bi-magic"></i> Your Smart Destination</span>
          <h3>${esc(top.name)}</h3>
          <p>${esc(top.short)}</p>
          <div class="smart-dest-meta">
            <div class="smart-dest-score"><strong>${top.score}%</strong><small>match</small></div>
            <div class="smart-dest-actions">
              <button class="btn hero-outline js-plan-dest" data-slug="${top.slug}"><i class="bi bi-map"></i> Plan this trip</button>
              <button class="btn primary-btn js-explore" data-slug="${top.slug}">View details</button>
            </div>
          </div>
        </div>`;
    }

    const grid = $("#matchGrid");
    if (grid) {
      grid.innerHTML = ranked
        .map((r, i) => `
        <div class="col-lg-4 col-md-6">
          <div class="match-card js-explore${i === 0 ? " is-top" : ""}" data-slug="${r.slug}" role="button" tabindex="0">
            <div class="match-card-top"><h3>${esc(r.name)}</h3><span class="match-percent">${r.score}%</span></div>
            <div class="match-bar"><span style="width:${r.score}%"></span></div>
            <p>${esc(r.short)}</p>
          </div>
        </div>`)
        .join("");
    }
  }

  // =========================================================
  //  Smart Trip Planner — detailed day-wise itinerary
  // =========================================================
  function generatePlan() {
    const slug = $("#plannerDestination").value;
    const days = parseInt($("#plannerDays").value, 10) || 5;
    const budget = $("#plannerBudget").value;
    const dest = D.bySlug(slug);
    const plan = D.itineraryFor(slug, days);
    const out = $("#plannerItinerary");
    if (!out) return;

    out.innerHTML = `
      <div class="plan-head">
        <div>
          <span class="plan-eyebrow"><i class="bi bi-map"></i> Your ${days}-day plan</span>
          <h3>${esc(dest ? dest.name : slug)} Itinerary</h3>
          <p class="plan-sub">Budget ${esc(budget)} · ${days} days · from ${esc(dest ? dest.priceFrom : "")} / person</p>
        </div>
        <button class="btn primary-btn js-book-dest" data-slug="${slug}"><i class="bi bi-suitcase-lg"></i> Book this trip</button>
      </div>
      <div class="plan-days">
        ${plan.map((d, i) => `
          <div class="plan-day">
            <div class="plan-day-num"><span>Day</span><strong>${i + 1}</strong></div>
            <div class="plan-day-body">
              <h4>${esc(d.title)}</h4>
              <div class="plan-slots">
                <div class="plan-slot"><span class="slot-when"><i class="bi bi-sunrise"></i> Morning</span><span class="slot-what">${esc(d.morning)}</span></div>
                <div class="plan-slot"><span class="slot-when"><i class="bi bi-sun"></i> Afternoon</span><span class="slot-what">${esc(d.afternoon)}</span></div>
                <div class="plan-slot"><span class="slot-when"><i class="bi bi-moon-stars"></i> Evening</span><span class="slot-what">${esc(d.evening)}</span></div>
              </div>
            </div>
          </div>`).join("")}
      </div>`;
    out.classList.add("show");
    out.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function initPlanner() {
    const btn = $("#generatePlan");
    if (btn) btn.addEventListener("click", generatePlan);
  }

  function planTrip(slug) {
    const sel = $("#plannerDestination");
    if (sel) sel.value = slug;
    const planner = document.getElementById("planner");
    if (planner) planner.scrollIntoView({ behavior: "smooth" });
    generatePlan();
  }

  // =========================================================
  //  Navbar auth state
  // =========================================================
  function reflectAuth() {
    const btn = $("#navAuthBtn");
    if (btn) {
      if (Auth.isLoggedIn()) {
        const user = Auth.getUser();
        const name = user && user.firstName ? user.firstName : "My Profile";
        btn.innerHTML = '<i class="bi bi-person-circle"></i> ' + esc(name);
        btn.setAttribute("href", "profile.html");
      } else {
        // Logged out (or session expired) — show Login so the state is honest.
        btn.innerHTML = "Login";
        btn.setAttribute("href", "login.html");
      }
    }
    const tripsItem = $("#navTripsItem");
    if (tripsItem) tripsItem.classList.toggle("d-none", !Auth.isLoggedIn());
    const adminLink = $("#navAdminLink");
    if (adminLink) adminLink.href = (window.UKIYO_CONFIG && window.UKIYO_CONFIG.adminUrl) || "http://localhost:3001";
    const adminItem = $("#navAdminItem");
    if (adminItem) {
      const user = Auth.getUser();
      adminItem.classList.toggle("d-none", !(Auth.isLoggedIn() && user && user.role === "admin"));
    }
  }

  // =========================================================
  //  Wire everything
  // =========================================================
  function wire() {
    // Delegated clicks
    document.addEventListener("click", function (e) {
      const explore = e.target.closest(".js-explore");
      if (explore) { e.preventDefault(); openDestination(explore.dataset.slug); return; }

      const wish = e.target.closest(".js-wish");
      if (wish) { e.preventDefault(); toggleWishlist(wish.dataset.slug); return; }

      const wishRemove = e.target.closest(".js-wish-remove");
      if (wishRemove) {
        e.preventDefault();
        toggleWishlist(wishRemove.dataset.slug).then(openWishlistModal);
        return;
      }

      const book = e.target.closest(".js-book");
      if (book) {
        e.preventDefault();
        const p = D.packageById(book.dataset.package);
        if (p) openBooking({ itemType: "package", itemId: p.id, title: p.title, price: p.price });
        return;
      }

      const bookDest = e.target.closest(".js-book-dest");
      if (bookDest) {
        e.preventDefault();
        const d = D.bySlug(bookDest.dataset.slug);
        if (d) openBooking({ itemType: "destination", itemId: d.slug, title: d.name, price: d.priceFrom });
        return;
      }

      const bookHotel = e.target.closest(".js-book-hotel");
      if (bookHotel) {
        e.preventDefault();
        const h = D.hotelById(bookHotel.dataset.hotel);
        if (h) openBooking({ itemType: "hotel", itemId: h.id, title: `${h.name} · ${h.city}`, price: h.price });
        return;
      }

      if (e.target.closest(".js-open-hotels")) { e.preventDefault(); openHotelsModal(); return; }
      if (e.target.closest(".js-open-wishlist")) { e.preventDefault(); openWishlistModal(); return; }
      if (e.target.closest(".js-open-trips")) { e.preventDefault(); openTripsModal(); return; }
      if (e.target.closest(".js-cta-book")) { e.preventDefault(); document.getElementById("packages").scrollIntoView({ behavior: "smooth" }); return; }

      const cancel = e.target.closest(".js-cancel-trip");
      if (cancel) { e.preventDefault(); cancelTrip(cancel.dataset.id, cancel.closest(".trip-row")); return; }

      const revTrip = e.target.closest(".js-review-trip");
      if (revTrip) {
        e.preventDefault();
        const b = myTrips.find((t) => String(t._id) === revTrip.dataset.id);
        if (b) { modal("tripsModal").hide(); setTimeout(() => openReview(b), 350); }
        return;
      }

      const payTrip = e.target.closest(".js-pay-trip");
      if (payTrip) {
        e.preventDefault();
        const b = myTrips.find((t) => String(t._id) === payTrip.dataset.id);
        if (b) { modal("tripsModal").hide(); setTimeout(() => openPayment(b), 350); }
        return;
      }

      const gal = e.target.closest(".gallery-item");
      if (gal) {
        const img = gal.querySelector("img");
        if (img) { $("#galleryModalImg").src = img.src.replace(/w=\d+/, "w=1400"); modal("galleryModal").show(); }
        return;
      }

      const quick = e.target.closest("#chatQuick button");
      if (quick) { sendChat(quick.textContent); return; }

      const planDest = e.target.closest(".js-plan-dest");
      if (planDest) {
        e.preventDefault();
        planTrip(planDest.dataset.slug);
        return;
      }
    });

    // Recompute Smart Destination + Match Scores when any quiz input changes.
    document.addEventListener("change", function (e) {
      if (e.target.closest("#moodtrip, #travel-dna, #regret-free")) renderMatches();
    });

    // Booking form
    const bf = $("#bookingForm");
    if (bf) bf.addEventListener("submit", submitBooking);

    // Contact form
    const cf = $("#contactForm");
    if (cf) cf.addEventListener("submit", submitContact);

    // Chat send
    const send = $("#chatSend"), input = $("#chatInput");
    if (send && input) {
      const go = () => { sendChat(input.value); input.value = ""; };
      send.addEventListener("click", go);
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } });
    }

    // Hero search
    const sBtn = $("#heroSearchBtn"), sIn = $("#heroSearchInput");
    if (sBtn && sIn) {
      const search = () => {
        const q = sIn.value.trim().toLowerCase();
        if (!q) { document.getElementById("destinations").scrollIntoView({ behavior: "smooth" }); return; }
        const match = D.destinations.find((d) => d.name.toLowerCase().includes(q) || d.slug.includes(q));
        if (match) openDestination(match.slug);
        else { toast("No exact match — showing all destinations"); document.getElementById("destinations").scrollIntoView({ behavior: "smooth" }); }
      };
      sBtn.addEventListener("click", search);
      sIn.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); search(); } });
    }
  }

  // =========================================================
  //  Reviews: public list (approved only) + submit (pending until an admin approves)
  // =========================================================
  const stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);
  async function loadReviews() {
    const grid = $("#reviewsGrid"), sum = $("#reviewsSummary");
    if (!grid) return;
    try {
      const r = await Auth.getReviews("?limit=12");
      sum.textContent = r.count ? `${r.average} / 5 average from ${r.count} verified traveller review${r.count === 1 ? "" : "s"}` : "No reviews yet — be the first to share your trip!";
      grid.innerHTML = (r.reviews || []).map((v) => `
        <div class="col-md-6 col-lg-4"><div class="review-card">
          <div class="stars" aria-label="${v.rating} out of 5">${stars(v.rating)}</div>
          ${v.comment ? `<p>${esc(v.comment)}</p>` : ""}
          <div class="rv-meta"><strong>${esc(v.author)}</strong> · ${esc(v.itemTitle || v.destination || "")}</div>
        </div></div>`).join("");
    } catch (_) { sum.textContent = "Reviews are unavailable right now."; }
  }

  let reviewBooking = null, reviewRating = 0;
  function paintStars() {
    $$("#reviewStars button").forEach((b) => b.firstElementChild.className = "bi " + (+b.dataset.v <= reviewRating ? "bi-star-fill" : "bi-star"));
  }
  function openReview(b) {
    reviewBooking = b; reviewRating = 0; paintStars();
    $("#reviewTrip").textContent = b.title; $("#reviewText").value = "";
    $("#reviewErr").style.display = "none"; $("#reviewSubmit").disabled = false;
    modal("reviewModal").show();
  }
  function wireReviews() {
    const st = $("#reviewStars"); if (!st) return;
    st.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { reviewRating = +b.dataset.v; paintStars(); } });
    $("#reviewSubmit").addEventListener("click", async () => {
      const err = $("#reviewErr");
      if (!reviewRating) { err.textContent = "Please choose a star rating."; err.style.display = "block"; return; }
      $("#reviewSubmit").disabled = true;
      try {
        const res = await Auth.createReview({ bookingId: reviewBooking._id, rating: reviewRating, comment: $("#reviewText").value.trim() });
        modal("reviewModal").hide(); toast(res.message || "Thanks for your review!");
      } catch (e) { err.textContent = e.message || "Could not submit your review."; err.style.display = "block"; $("#reviewSubmit").disabled = false; }
    });
  }

  // ---------- Init ----------
  document.addEventListener("DOMContentLoaded", function () {
    renderDestinations();
    renderPackages();
    reflectAuth();
    initDNA();
    initRegret();
    renderMatches();
    initPlanner();
    wire();
    wireReviews();
    loadReviews();
    // The first authed call can reveal an expired session (401 clears the token);
    // re-sync the navbar afterwards so it doesn't falsely show "logged in".
    initWishlist().finally(reflectAuth);
  });
})();
