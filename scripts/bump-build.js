import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = path.join(rootDir, "webapp", "index.html");

const commitSha = process.env.CF_PAGES_COMMIT_SHA;
const buildId = commitSha ? commitSha.slice(0, 8) : createTimestampId();

function createTimestampId() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return [
    now.getUTCFullYear(),
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
    "-",
    pad(now.getUTCHours()),
    pad(now.getUTCMinutes()),
  ].join("");
}

const html = await readFile(indexPath, "utf8");
const scriptPattern = /(<script\s+type="module"\s+src="app\.js)(\?v=[^"]*)?("><\/script>)/i;
const match = html.match(scriptPattern);
if (!match) {
  throw new Error("Could not find app.js module script tag in webapp/index.html");
}

const updated = html.replace(scriptPattern, `$1?v=${buildId}$3`);
await writeFile(indexPath, updated, "utf8");

console.log(`[build] app.js cache bust set to v=${buildId}`);
