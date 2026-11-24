/* Ukiyo Travel — Admin Panel / Command Center (static site). Run: npm run start:admin  (default http://localhost:3001) */
const path = require("path");
const { loadEnv } = require("../scripts/load-env");
const { startStaticServer } = require("../scripts/static-server");
loadEnv();

const port = parseInt(process.env.ADMIN_PORT, 10) || 3001;
startStaticServer({
  name: "Admin Panel",
  root: __dirname,
  port,
  config: {
    apiBase: process.env.API_URL || `http://localhost:${parseInt(process.env.PORT, 10) || 5000}`,
    userUrl: process.env.USER_PANEL_URL || `http://localhost:${parseInt(process.env.USER_PORT, 10) || 3000}`,
  },
});
