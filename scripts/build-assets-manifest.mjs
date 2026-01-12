import { readdir, writeFile } from "fs/promises";
import path from "path";

const assetsDir = path.resolve("webapp/assets");
const manifestPath = path.join(assetsDir, "assets-manifest.json");
const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (imageExtensions.has(ext)) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = await walk(assetsDir);
const manifest = {
  generatedAt: new Date().toISOString(),
  files: files
    .map((file) => path.posix.join("/assets", path.relative(assetsDir, file).split(path.sep).join("/")))
    .sort(),
};

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`Wrote ${manifest.files.length} asset entries to ${manifestPath}`);
