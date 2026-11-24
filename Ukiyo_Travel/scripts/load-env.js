/* Tiny zero-dependency .env loader shared by the launcher and the two panel servers. */
const fs = require("fs");
const path = require("path");

function loadEnv(file = path.join(__dirname, "..", ".env")) {
  if (!fs.existsSync(file)) return false;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith("#")) continue;
    let v = m[2];
    if (!/^["']/.test(v)) v = v.replace(/\s+#.*$/, "");
    v = v.replace(/^["']|["']$/g, "");
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
  return true;
}
module.exports = { loadEnv };
