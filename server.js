const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { runFlow } = require("./src/ssqm2952Service");

function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const idx = trimmed.indexOf("=");
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^"|"$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function parseJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body is too large."));
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error("Request body is not valid JSON."));
      }
    });
    req.on("error", reject);
  });
}

function setJson(res, statusCode, payload) {
  const json = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  res.end(json);
}

function sendFile(res, filePath, contentType = "text/html; charset=utf-8") {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

function normalizePayloadPayload(rawPayload) {
  if (rawPayload === "" || rawPayload === null || rawPayload === undefined) {
    return {};
  }
  if (typeof rawPayload === "object" && rawPayload !== null) {
    return rawPayload;
  }
  if (typeof rawPayload === "string") {
    return JSON.parse(rawPayload);
  }
  return {};
}

async function handleApiRun(req, res) {
  const body = await parseJson(req);
  const payload = normalizePayloadPayload(body.payload);

  const credentials = {
    clientId: body.clientId || "",
    clientSecret: body.clientSecret || "",
    ciNo: body.ciNo || "",
    userInfo: body.userInfo || "",
    infoType: body.infoType || "1",
    baseUrl: body.baseUrl || "https://dbaasapi.kbsec.com:32484",
    timeoutMs: Number(body.timeoutMs || 20000),
  };

  const specPath = path.resolve(process.cwd(), body.specPath || "broker-specs/kbsec/SSQM2952.json");
  const result = await runFlow({
    credentials,
    specPath,
    payload,
  });

  setJson(res, 200, { ok: true, result });
}

async function requestHandler(req, res) {
  const parsed = new URL(req.url, "http://localhost");
  const { pathname } = parsed;

  if (req.method === "OPTIONS") {
    setJson(res, 200, {});
    return;
  }

  if (pathname === "/api/run-ssqm2952" && req.method === "POST") {
    try {
      await handleApiRun(req, res);
    } catch (err) {
      setJson(res, 500, { ok: false, error: err.message });
    }
    return;
  }

  if (pathname === "/api/spec/default") {
    try {
      const defaultPath = parsed.searchParams.get("path") || "broker-specs/kbsec/SSQM2952.json";
      const specPath = path.resolve(process.cwd(), defaultPath);
      const spec = JSON.parse(fs.readFileSync(specPath, "utf8").replace(/^\uFEFF/, ""));
      const template = spec.requestTemplate || {};
      setJson(res, 200, { ok: true, template });
    } catch (err) {
      setJson(res, 500, { ok: false, error: err.message });
    }
    return;
  }

  if (pathname === "/" || pathname === "/index.html") {
    sendFile(res, path.resolve(process.cwd(), "public/index.html"));
    return;
  }

  setJson(res, 404, { ok: false, error: "not found" });
}

function main() {
  loadDotEnv();
  const port = Number(process.env.APP_PORT || 3000);
  const server = http.createServer((req, res) => {
    requestHandler(req, res);
  });

  server.listen(port, () => {
    console.log(`Server started: http://localhost:${port}`);
  });
}

main();
