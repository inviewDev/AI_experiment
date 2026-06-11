import { spawn } from "node:child_process";

const processes = [
  spawn("node", ["server/index.js"], { stdio: "inherit", shell: true }),
  spawn("npx", ["vite", "--host", "0.0.0.0"], {
    stdio: "inherit",
    shell: true,
  }),
];

let exiting = false;

function shutdown(code = 0) {
  if (exiting) return;
  exiting = true;
  for (const child of processes) {
    if (!child.killed) child.kill();
  }
  process.exit(code);
}

for (const child of processes) {
  child.on("exit", (code) => {
    if (!exiting && code !== 0) {
      shutdown(code ?? 1);
    }
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
