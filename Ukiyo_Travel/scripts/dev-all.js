#!/usr/bin/env node
/* =========================================================
   Starts the shared backend + User Panel + Admin Panel together.
     npm run dev:all      (alias: npm start)
   - checks every port is free first (clear message instead of EADDRINUSE crashes)
   - prefixes each service's output
   - Ctrl+C (or one service dying) stops everything gracefully
   Zero dependencies; works on macOS, Linux and Windows.
========================================================= */
const net = require("net");
const path = require("path");
const { spawn } = require("child_process");
const { loadEnv } = require("./load-env");
loadEnv();

const root = path.join(__dirname, "..");
const ports = {
  backend: parseInt(process.env.PORT, 10) || 5000,
  user: parseInt(process.env.USER_PORT, 10) || 3000,
  admin: parseInt(process.env.ADMIN_PORT, 10) || 3001,
};
const services = [
  { name: "backend", color: "\x1b[36m", file: path.join(root, "backend", "server.js"), cwd: path.join(root, "backend"), port: ports.backend },
  { name: "user   ", color: "\x1b[32m", file: path.join(root, "user-panel", "server.js"), cwd: path.join(root, "user-panel"), port: ports.user },
  { name: "admin  ", color: "\x1b[35m", file: path.join(root, "admin-panel", "server.js"), cwd: path.join(root, "admin-panel"), port: ports.admin },
];

const isFree = (port) => new Promise((resolve) => {
  const s = net.createServer();
  s.once("error", () => resolve(false));
  s.once("listening", () => s.close(() => resolve(true)));
  s.listen(port);
});

const children = [];
let stopping = false;
function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  console.log("\nStopping Ukiyo Travel services…");
  children.forEach((c) => { try { c.kill("SIGTERM"); } catch (_) {} });
  setTimeout(() => process.exit(code), 2500).unref();
  const check = setInterval(() => { if (children.every((c) => c.exitCode !== null || c.killed && c.signalCode)) { clearInterval(check); process.exit(code); } }, 100);
}

(async () => {
  const dup = new Set(Object.values(ports));
  if (dup.size !== 3) { console.error("✖ PORT, USER_PORT and ADMIN_PORT must all be different."); process.exit(1); }
  for (const s of services) {
    if (!(await isFree(s.port))) {
      console.error(`✖ Port ${s.port} (${s.name.trim()}) is already in use. Stop whatever is using it, or change it in .env.`);
      process.exit(1);
    }
  }
  for (const s of services) {
    const child = spawn(process.execPath, [s.file], { cwd: s.cwd, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    children.push(child);
    const pipe = (stream, out) => {
      let buf = "";
      stream.on("data", (d) => { buf += d; const lines = buf.split(/\r?\n/); buf = lines.pop(); lines.forEach((l) => out.write(`${s.color}[${s.name}]\x1b[0m ${l}\n`)); });
    };
    pipe(child.stdout, process.stdout);
    pipe(child.stderr, process.stderr);
    child.on("exit", (code, sig) => { if (!stopping) { console.error(`✖ ${s.name.trim()} stopped unexpectedly (${sig || "exit " + code}).`); stopAll(code || 1); } });
  }
  setTimeout(() => {
    if (!stopping) console.log(`\n  User Panel   → http://localhost:${ports.user}\n  Admin Panel  → http://localhost:${ports.admin}\n  API (shared) → http://localhost:${ports.backend}/api/health\n  Press Ctrl+C to stop everything.\n`);
  }, 1800);
})();
process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
