/* Ukiyo Travel — User Panel (static site). Run: npm run start:user  (default http://localhost:3000) */
const path = require("path");
const { loadEnv } = require("../scripts/load-env");
const { startStaticServer } = require("../scripts/static-server");
loadEnv();

const port = parseInt(process.env.USER_PORT, 10) || 3000;
startStaticServer({
  name: "User Panel",
  root: __dirname,
  port,
  config: {
    apiBase: process.env.API_URL || `http://localhost:${parseInt(process.env.PORT, 10) || 5000}`,
    adminUrl: process.env.ADMIN_PANEL_URL || `http://localhost:${parseInt(process.env.ADMIN_PORT, 10) || 3001}`,
  },
});
