/* Regenerates seed/catalog.seed.json from the User Panel's built-in catalog (user-panel/js/data.js). */
const fs = require("fs"), path = require("path"), vm = require("vm");
const src = path.join(__dirname, "..", "..", "user-panel", "js", "data.js");
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(src, "utf8"), sandbox, { timeout: 2000 });
const d = sandbox.window.UkiyoData;
fs.writeFileSync(path.join(__dirname, "catalog.seed.json"), JSON.stringify({ destinations: d.destinations, packages: d.packages, hotels: d.hotels }, null, 2));
console.log(`✔ Wrote seed/catalog.seed.json (${d.destinations.length} destinations, ${d.packages.length} packages, ${d.hotels.length} hotels)`);
