const fs = require("fs");
const path = require("path");
const { parseArgs, printJson } = require("../src/util");
const { runFlow } = require("../src/ssqm2952Service");

function stripBom(text) {
  return text.replace(/^\uFEFF/, "");
}

function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }
    const idx = trimmed.indexOf("=");
    if (idx < 0) return;

    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^"|"$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

function loadPayloadFromInput(filePath, payloadText) {
  if (filePath) {
    return JSON.parse(stripBom(fs.readFileSync(filePath, "utf8")));
  }
  if (payloadText) {
    return JSON.parse(payloadText);
  }
  return {};
}

function main() {
  loadDotEnv();
  const args = parseArgs(process.argv);

  if (args.help || args.h) {
    console.log("Usage:");
    console.log("  node scripts/run-ssqm2952.js [--spec path] [--payload-file path] [--payload-json '{...}']");
    return;
  }

  const specPath = path.resolve(args.spec || path.join(process.cwd(), "broker-specs/kbsec/SSQM2952.json"));
  const payload = loadPayloadFromInput(
    args["payload-file"] ? path.resolve(args["payload-file"]) : null,
    args["payload-json"]
  );

  return runFlow({
    credentials: {
      clientId: process.env.KB_CLIENT_ID,
      clientSecret: process.env.KB_CLIENT_SECRET,
      ciNo: process.env.KB_CI_NO,
      userInfo: process.env.KB_USER_INFO,
      infoType: process.env.KB_INFO_TYPE || "1",
      baseUrl: process.env.KB_BASE_URL || "https://dbaasapi.kbsec.com:32484",
      timeoutMs: Number(process.env.KB_TIMEOUT_MS || 20000),
    },
    specPath,
    payload,
  })
    .then((result) => {
      printJson("SSQM2952 run result", result);
      return result;
    })
    .catch((err) => {
      console.error("Run failed:", err.message);
      if (err.cause) {
        console.error("Cause:", err.cause.message || String(err.cause));
      }
      if (err.stack) {
        console.error(err.stack);
      }
      process.exit(1);
    });
}

main();
