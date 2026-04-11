import { spawn } from "node:child_process";

const children = [];
let shuttingDown = false;

function startProcess(command, args) {
  const child = spawn(command, args, {
    shell: false,
    stdio: "inherit",
    env: process.env,
  });
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }
    process.exit(code);
  }, 600);
}

const isWindows = process.platform === "win32";
const server = startProcess(process.execPath, ["server/index.js"]);
const client = isWindows
  ? startProcess("cmd.exe", ["/c", "vite"])
  : startProcess("vite", []);

server.on("exit", (code) => {
  shutdown(Number.isFinite(code) ? code : 1);
});

client.on("exit", (code) => {
  shutdown(Number.isFinite(code) ? code : 1);
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
