import { spawn } from "child_process";
import fs from "fs";
import net from "net";
import path from "path";
import process from "process";

const root = process.cwd();
const ports = (process.env.PORTS || "3000,3001,3002")
  .split(",")
  .map((p) => Number(p.trim()))
  .filter(Boolean);
const host = process.env.HOST || "127.0.0.1";
const nextBin = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");
const shopSlugs = ["cay-canh", "decor-vang", "in-tranh"];

if (ports.length !== 3) {
  console.error("PORTS must contain exactly 3 comma-separated ports. Example: PORTS=3000,3001,3002 npm run demo:3");
  process.exit(1);
}

if (!fs.existsSync(nextBin)) {
  console.error("Missing node_modules/.bin/next. Run npm install first.");
  process.exit(1);
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

function runOnce(args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(nextBin, args, { cwd: root, stdio: "inherit", env: process.env });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} exited with code ${code}`));
    });
  });
}

const free = await Promise.all(ports.map(isPortFree));
const busy = ports.filter((_, index) => !free[index]);
if (busy.length) {
  console.error(`Port(s) already in use: ${busy.join(", ")}`);
  process.exit(1);
}

if (process.env.SKIP_BUILD !== "1") {
  console.log("Building production demo...");
  await runOnce(["build"], "next build");
}

const children = ports.map((port, index) => {
  const shopSlug = shopSlugs[index];
  const child = spawn(nextBin, ["start", "--port", String(port), "--hostname", host], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: String(port), SHOP_SLUG: shopSlug },
  });

  const prefix = `[${port}] `;
  child.stdout.on("data", (chunk) => process.stdout.write(prefix + chunk.toString().replace(/\n/g, `\n${prefix}`)));
  child.stderr.on("data", (chunk) => process.stderr.write(prefix + chunk.toString().replace(/\n/g, `\n${prefix}`)));
  child.on("exit", (code) => {
    if (code !== 0 && !shuttingDown) console.error(`${prefix}next start exited with code ${code}`);
  });
  child.shopSlug = shopSlug;
  child.demoUrl = `http://${host}:${port}/`;
  return child;
});

let shuttingDown = false;
function shutdown() {
  shuttingDown = true;
  for (const child of children) child.kill("SIGTERM");
}
process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});
process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});

console.log("\n3 local demo hosts:");
children.forEach((child) => console.log(`- ${child.demoUrl} (${child.shopSlug})`));
console.log(`Admin chung: http://${host}:${ports[0]}/admin`);
console.log("Press Ctrl+C to stop all demo servers.\n");

await new Promise(() => {});
