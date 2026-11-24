/* Fallback configuration (used only if this folder is opened without its server).
   When started with `npm run start:user` the server generates this file from .env instead. */
window.UKIYO_CONFIG = { apiBase: "http://localhost:5000", adminUrl: "http://localhost:3001" };
window.UKIYO_API_BASE = window.UKIYO_CONFIG.apiBase;
