import { randomBytes } from "crypto";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import bcrypt from "bcryptjs";

const ENV_FILE = path.resolve(process.cwd(), ".env");
const ROUNDS = 12;

function buildPassword() {
  return randomBytes(18).toString("base64url");
}

function upsertEnvValue(contents, key, value) {
  const lines = contents.split(/\r?\n/);
  let found = false;
  const updated = lines.map((line) => {
    if (!line || line.trim().startsWith("#")) {
      return line;
    }
    const [name] = line.split("=", 1);
    if (name === key) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!found) {
    updated.push(`${key}=${value}`);
  }

  return updated.join("\n").replace(/\n{3,}/g, "\n\n");
}

async function main() {
  const password = buildPassword();
  const hash = await bcrypt.hash(password, ROUNDS);

  let contents = "";
  try {
    contents = await readFile(ENV_FILE, "utf-8");
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }

  const updated = upsertEnvValue(contents, "ADMIN_PASSWORD_HASH", hash);
  await writeFile(ENV_FILE, updated, "utf-8");

  console.log("Admin password (store securely, do NOT commit):");
  console.log(password);
  console.log("\nADMIN_PASSWORD_HASH added to .env");
}

main().catch((error) => {
  console.error("Failed to bootstrap admin password.");
  console.error(error);
  process.exitCode = 1;
});
