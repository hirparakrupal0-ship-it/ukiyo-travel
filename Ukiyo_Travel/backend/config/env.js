/* Loads environment variables. One shared .env at the project root is preferred
   (so the backend and both panels use one configuration); backend/.env also works. */
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const candidates = [path.join(__dirname, "..", "..", ".env"), path.join(__dirname, "..", ".env")];
const loaded = candidates.find((f) => fs.existsSync(f));
if (loaded) dotenv.config({ path: loaded });

module.exports = { envFile: loaded || null };
