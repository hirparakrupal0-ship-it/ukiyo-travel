/* =========================================================
   Ukiyo Travel — frontend API helper
   Change API_BASE if your backend runs on a different host/port.
========================================================= */
(function () {
  // The API address comes from config.js, which each panel's server generates from .env
  // (API_URL). The fallback only applies if the page is opened without its server.
  const API_BASE = (window.UKIYO_CONFIG && window.UKIYO_CONFIG.apiBase) || window.UKIYO_API_BASE || "http://localhost:5000";

  const TOKEN_KEY = "ukiyo_token";
  const USER_KEY = "ukiyo_user";

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  // Generic request helper. `auth: true` attaches the Bearer token.
  async function apiRequest(fullPath, { method = "GET", body, auth = false } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (auth) {
      const token = getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    let res;
    try {
      res = await fetch(`${API_BASE}${fullPath}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (_) {
      // Network failure / server down — NOT an auth problem, so never a reason to log out.
      const e = new Error("Unable to reach the server. Please check your connection and try again.");
      e.status = 0;
      e.network = true;
      throw e;
    }
    let data = {};
    try {
      data = await res.json();
    } catch (_) {
      /* non-JSON response */
    }
    // Only a real authentication failure invalidates the stored session.
    if (auth && (res.status === 401 || (res.status === 403 && data.code === "ACCOUNT_DEACTIVATED"))) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    if (!res.ok || data.success === false) {
      const e = new Error(data.message || `Request failed (${res.status})`);
      e.status = res.status;
      e.code = data.code;
      throw e;
    }
    return data;
  }

  const apiPost = (path, body) => apiRequest(`/api/auth${path}`, { method: "POST", body });

  function saveSession(data) {
    if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
    if (data.user) localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  }

  function setUser(user) {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  window.UkiyoAuth = {
    API_BASE,

    // ----- Auth -----
    register: (payload) => apiPost("/register", payload),
    login: (payload) => apiPost("/login", payload),

    // ----- Profile (protected) -----
    getProfile: () => apiRequest("/api/user/profile", { auth: true }),
    updateProfile: (payload) => apiRequest("/api/user/profile", { method: "PUT", body: payload, auth: true }),
    changePassword: (payload) => apiRequest("/api/user/password", { method: "PUT", body: payload, auth: true }),

    // ----- Wishlist (protected) -----
    getWishlist: () => apiRequest("/api/user/wishlist", { auth: true }),
    addWishlist: (slug) => apiRequest("/api/user/wishlist", { method: "POST", body: { slug }, auth: true }),
    removeWishlist: (slug) => apiRequest(`/api/user/wishlist/${encodeURIComponent(slug)}`, { method: "DELETE", auth: true }),

    // ----- Bookings (protected) -----
    createBooking: (payload) => apiRequest("/api/bookings", { method: "POST", body: payload, auth: true }),
    getBookings: () => apiRequest("/api/bookings", { auth: true }),
    cancelBooking: (id) => apiRequest(`/api/bookings/${encodeURIComponent(id)}`, { method: "DELETE", auth: true }),

    getBooking: (id) => apiRequest(`/api/bookings/${encodeURIComponent(id)}`, { auth: true }),
    paymentOptions: () => apiRequest("/api/bookings/payment-options", { auth: true }),
    payBooking: (id, payload) => apiRequest(`/api/bookings/${encodeURIComponent(id)}/pay`, { method: "POST", body: payload, auth: true }),

    // ----- Reviews -----
    createReview: (payload) => apiRequest("/api/reviews", { method: "POST", body: payload, auth: true }),
    getReviews: (q = "") => apiRequest(`/api/reviews${q}`),

    // ----- Payments (Razorpay when configured, otherwise the built-in sandbox) -----
    paymentConfig: () => apiRequest("/api/payments/config", { auth: true }),
    createOrder: (bookingId) => apiRequest("/api/payments/order", { method: "POST", body: { bookingId }, auth: true }),
    payDemo: (payload) => apiRequest("/api/payments/demo", { method: "POST", body: payload, auth: true }),
    markPaymentFailed: (bookingId) => apiRequest("/api/payments/failed", { method: "POST", body: { bookingId }, auth: true }),
    verifyPayment: (payload) => apiRequest("/api/payments/verify", { method: "POST", body: payload, auth: true }),

    // ----- Contact enquiry (public; sends token if logged in) -----
    sendEnquiry: (payload) => apiRequest("/api/contact", { method: "POST", body: payload, auth: true }),

    // ----- Admin (protected + admin role) -----
    adminStats: () => apiRequest("/api/admin/stats", { auth: true }),
    adminUsers: () => apiRequest("/api/admin/users", { auth: true }),
    adminSetRole: (id, role) => apiRequest(`/api/admin/users/${id}/role`, { method: "PATCH", body: { role }, auth: true }),
    adminDeleteUser: (id) => apiRequest(`/api/admin/users/${id}`, { method: "DELETE", auth: true }),
    adminBookings: () => apiRequest("/api/admin/bookings", { auth: true }),
    adminSetBookingStatus: (id, status) => apiRequest(`/api/admin/bookings/${id}`, { method: "PATCH", body: { status }, auth: true }),
    adminDeleteBooking: (id) => apiRequest(`/api/admin/bookings/${id}`, { method: "DELETE", auth: true }),
    adminEnquiries: () => apiRequest("/api/admin/enquiries", { auth: true }),
    adminDeleteEnquiry: (id) => apiRequest(`/api/admin/enquiries/${id}`, { method: "DELETE", auth: true }),

    // Admin: Command Center
    adminDashboard: () => apiRequest("/api/admin/dashboard", { auth: true }),
    adminTrending: (w = 30) => apiRequest(`/api/admin/trending?window=${w}`, { auth: true }),
    adminInsights: () => apiRequest("/api/admin/insights", { auth: true }),
    adminCalendar: (month, basis) => apiRequest(`/api/admin/calendar?month=${month}&basis=${basis}`, { auth: true }),
    adminCalendarDay: (date, basis) => apiRequest(`/api/admin/calendar/day?date=${date}&basis=${basis}`, { auth: true }),
    adminAlerts: () => apiRequest("/api/admin/alerts", { auth: true }),
    adminAlertState: (key, state) => apiRequest("/api/admin/alerts/state", { method: "POST", body: { key, state }, auth: true }),
    adminAlertStateAll: (state) => apiRequest("/api/admin/alerts/state-all", { method: "POST", body: { state }, auth: true }),
    adminUser: (id) => apiRequest(`/api/admin/users/${id}`, { auth: true }),
    adminSetUserActive: (id, isActive) => apiRequest(`/api/admin/users/${id}/active`, { method: "PATCH", body: { isActive }, auth: true }),
    adminPayments: (qs = "") => apiRequest(`/api/admin/payments${qs}`, { auth: true }),
    adminPayment: (id) => apiRequest(`/api/admin/payments/${id}`, { auth: true }),
    adminRefund: (id) => apiRequest(`/api/admin/payments/${id}/refund`, { method: "POST", auth: true }),
    adminReviews: (qs = "") => apiRequest(`/api/admin/reviews${qs}`, { auth: true }),
    adminSetReviewStatus: (id, status) => apiRequest(`/api/admin/reviews/${id}`, { method: "PATCH", body: { status }, auth: true }),
    adminDeleteReview: (id) => apiRequest(`/api/admin/reviews/${id}`, { method: "DELETE", auth: true }),
    adminSetEnquiryStatus: (id, status) => apiRequest(`/api/admin/enquiries/${id}`, { method: "PATCH", body: { status }, auth: true }),
    adminCatalog: (type) => apiRequest(`/api/admin/catalog/${type}`, { auth: true }),
    adminCatalogCreate: (type, body) => apiRequest(`/api/admin/catalog/${type}`, { method: "POST", body, auth: true }),
    adminCatalogUpdate: (type, id, body) => apiRequest(`/api/admin/catalog/${type}/${id}`, { method: "PUT", body, auth: true }),
    adminCatalogFlags: (type, id, body) => apiRequest(`/api/admin/catalog/${type}/${id}/flags`, { method: "PATCH", body, auth: true }),
    adminCatalogReorder: (type, ids) => apiRequest(`/api/admin/catalog/${type}/reorder`, { method: "POST", body: { ids }, auth: true }),
    adminCatalogDelete: (type, id) => apiRequest(`/api/admin/catalog/${type}/${id}`, { method: "DELETE", auth: true }),

    // ----- Error helpers -----
    // true ONLY for 401/403 — the only cases where sending the user to login makes sense.
    isAuthError: (err) => !!err && (err.status === 401 || err.status === 403),
    // Friendly text for 500s / network failures; the server's own message for 400/409 validation errors.
    friendlyError: (err, fallback) => {
      if (!err) return fallback;
      if (err.network) return err.message;
      if (err.status >= 500 || err.status === undefined) return fallback;
      return err.message || fallback;
    },

    // ----- Session helpers -----
    saveSession,
    setUser,
    getToken,
    isLoggedIn: () => !!getToken(),
    getUser: () => {
      try {
        return JSON.parse(localStorage.getItem(USER_KEY));
      } catch (_) {
        return null;
      }
    },
    logout: () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    },
    // ----- Date helpers (local device date; the server re-checks every booking) -----
    todayStr: () => {
      const d = new Date();
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    },
    isPastDate: (value) => !!value && value < window.UkiyoAuth.todayStr(),
    PAST_DATE_MESSAGE: "Please select today or a future date.",

    // Redirect to login if there is no token. Returns true when authenticated.
    requireAuth: (redirect = "login.html") => {
      if (!getToken()) {
        window.location.href = redirect;
        return false;
      }
      return true;
    },
  };
})();
