import { spawnSync } from "child_process";
import path from "path";
import fs from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pkgDir = path.join(process.cwd(), "node_modules", "@embedded-postgres", "linux-x64");
const bin = path.join(pkgDir, "native", "bin");
const dataDir = path.join(process.cwd(), "embedded-postgres-data");
const PORT = 54329;
const USER = "skillvault";
const DB = "skillvault";
const LOG = path.join(dataDir, "postgres.log");

function run(cmd, args, opts = {}) {
  const res = spawnSync(path.join(bin, cmd), args, { stdio: "pipe", encoding: "utf8", ...opts });
  if (res.status !== 0) {
    console.error(res.stdout, res.stderr);
    process.exit(1);
  }
  return res;
}

function isRunning() {
  const res = spawnSync(path.join(bin, "pg_ctl"), ["-D", dataDir, "status"], { encoding: "utf8" });
  return res.status === 0;
}

if (process.argv[2] === "stop") {
  if (isRunning()) {
    run("pg_ctl", ["-D", dataDir, "stop", "-m", "fast"]);
    console.log("postgres stopped");
  } else {
    console.log("postgres not running");
  }
  process.exit(0);
}

if (isRunning()) {
  console.log("postgres already running on port", PORT);
  process.exit(0);
}

if (!fs.existsSync(path.join(dataDir, "PG_VERSION"))) {
  fs.rmSync(dataDir, { recursive: true, force: true });
  run("initdb", ["-D", dataDir, "-U", USER, "--auth=trust", "--encoding=UTF8"]);
  console.log("database cluster initialised");
}

run("pg_ctl", ["-D", dataDir, "-l", LOG, "-o", `-p ${PORT} -h 127.0.0.1 -k /tmp`, "start"]);
const url = `postgresql://${USER}@127.0.0.1:${PORT}/postgres`;
const check = spawnSync("npx", ["prisma", "db", "execute", "--url", url, "--stdin"], {
  input: `SELECT 1 FROM pg_database WHERE datname='${DB}';`,
  encoding: "utf8",
});
if (check.status !== 0) {
  spawnSync("npx", ["prisma", "db", "execute", "--url", url, "--stdin"], {
    input: `CREATE DATABASE ${DB};`,
    encoding: "utf8",
    stdio: "inherit",
  });
  console.log("database created");
}
console.log(`postgres ready: postgresql://${USER}@127.0.0.1:${PORT}/${DB}`);
