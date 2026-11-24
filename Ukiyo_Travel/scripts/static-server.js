/* =========================================================
   Minimal zero-dependency static file server for a panel.
   Serves a folder, plus a generated /config.js that tells the browser
   where the shared API and the other panel live (from .env).
========================================================= */
const http = require("http");
const fs = require("fs");
const path = require("path");

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml",
  ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".woff2": "font/woff2", ".md": "text/plain; charset=utf-8",
};

function startStaticServer({ name, root, port, config }) {
  const server = http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch (_) { res.writeHead(400); return res.end("Bad request"); }
    const headers = { "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin", "Cache-Control": "no-cache" };

    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405, headers); return res.end("Method not allowed"); }
    if (pathname === "/config.js") {
      res.writeHead(200, { ...headers, "Content-Type": TYPES[".js"] });
      return res.end(req.method === "HEAD" ? undefined : "window.UKIYO_CONFIG = " + JSON.stringify(config) + ";\nwindow.UKIYO_API_BASE = window.UKIYO_CONFIG.apiBase;\n");
    }
    if (pathname.endsWith("/")) pathname += "index.html";
    const file = path.join(root, path.normalize(pathname));
    if (!file.startsWith(root + path.sep) || /(^|[\\/])\.(?!well-known)/.test(path.relative(root, file)) || /package(-lock)?\.json$|server\.js$/.test(file)) {
      res.writeHead(404, headers); return res.end("Not found");
    }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404, { ...headers, "Content-Type": "text/plain; charset=utf-8" }); return res.end("404 Not found"); }
      res.writeHead(200, { ...headers, "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "Content-Length": st.size });
      if (req.method === "HEAD") return res.end();
      fs.createReadStream(file).pipe(res);
    });
  });

  server.on("error", (e) => {
    console.error(e.code === "EADDRINUSE"
      ? `✖ ${name}: port ${port} is already in use. Stop the other program or set a different port in .env.`
      : `✖ ${name}: ${e.message}`);
    process.exit(1);
  });
  server.listen(port, () => console.log(`✔ ${name} running on http://localhost:${port}  (API: ${config.apiBase})`));
  const stop = () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 1500).unref(); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  return server;
}

module.exports = { startStaticServer };
