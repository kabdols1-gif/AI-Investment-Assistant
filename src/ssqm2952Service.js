const path = require("path");
const fs = require("fs");
const { KbBaaSClient } = require("./kbClient");
const { deepMerge } = require("./util");

function readJsonSafe(filePath) {
  const resolved = path.resolve(filePath);
  const raw = fs.readFileSync(resolved, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function mergeRequestBody(specPath, payload) {
  const spec = readJsonSafe(specPath);
  const template = spec.requestTemplate || {};
  return {
    requestTemplate: template,
    requestBody: deepMerge(template, payload || {}),
    servicePath: spec.path || "/baas/v2/",
    serviceCode: spec.serviceCode || "SSQM2952",
    serviceName: spec.serviceName || "",
  };
}

function describeResult(res) {
  return {
    status: res?.status,
    ok: !!res?.ok,
    headers: res?.headers || null,
    dataBody: res?.json && res.json.dataBody ? res.json.dataBody : null,
    dataHeader: res?.json && res.json.dataHeader ? res.json.dataHeader : null,
    hasEncrypt: !!(res?.json && typeof res.json.encrypt === "string"),
    decrypted: res?.decrypted || null,
    raw: res?.raw || null,
    error: res?.error || null,
  };
}

function loadCredential(inputs) {
  const missing = [];
  ["clientId", "clientSecret", "ciNo", "userInfo"].forEach((name) => {
    if (!inputs[name]) {
      missing.push(name);
    }
  });
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(", ")}`);
  }

  return {
    clientId: inputs.clientId,
    clientSecret: inputs.clientSecret,
    ciNo: inputs.ciNo,
    userInfo: inputs.userInfo,
    infoType: inputs.infoType || "1",
    baseUrl: inputs.baseUrl || "https://dbaasapi.kbsec.com:32484",
    timeoutMs: Number(inputs.timeoutMs) > 0 ? Number(inputs.timeoutMs) : undefined,
  };
}

async function runFlow({ credentials, specPath, payload }) {
  const merged = mergeRequestBody(specPath, payload);
  const cfg = loadCredential(credentials);

  const client = new KbBaaSClient({
    clientId: cfg.clientId,
    clientSecret: cfg.clientSecret,
    ciNo: cfg.ciNo,
    userInfo: cfg.userInfo,
    infoType: cfg.infoType,
    baseUrl: cfg.baseUrl,
    timeoutMs: cfg.timeoutMs,
  });

  const steps = [];
  const pushStep = (step, request, response) => {
    steps.push({ step, request, response: describeResult(response) });
  };

  const authRes = await client.baasAuthIssue();
  pushStep("baas_auth_issue", { ...merged.requestTemplate, dataBody: merged.requestTemplate.dataBody }, authRes);

  const authBody = client.extractDataBody(authRes) || {};
  if (!authBody.code || !authBody.issueNo) {
    throw new Error("baas_auth_issue response missing code/issueNo.");
  }

  const tokenRes = await client.baasTokenIssueByCode(authBody.code, authBody.issueNo);
  pushStep("baas_token_issue", {
    dataBodyType: "authorization_code",
    code: authBody.code,
    issueNo: authBody.issueNo,
  }, tokenRes);

  if (!client.accessToken) {
    throw new Error("access_token was not returned from token issue.");
  }

  const clauseRes = await client.clauseAgreeProcessWithClientCredentials();
  pushStep("clause_agree_process", { type: "client_credentials" }, clauseRes);

  if (!client.mapKey) {
    throw new Error("clause_agree_process response missing mapKey.");
  }

  const serviceRes = await client.callEncryptedByMapKey(merged.servicePath, merged.requestBody);
  pushStep("SSQM2952_encrypted", { path: merged.servicePath, requestBody: merged.requestBody }, serviceRes);

  return {
    success: serviceRes?.ok ?? false,
    serviceCode: merged.serviceCode,
    serviceName: merged.serviceName,
    credentialsMask: {
      clientId: `${cfg.clientId.slice(0, 4)}...`,
      ciNo: cfg.ciNo ? `${cfg.ciNo.slice(0, 4)}...` : "",
    },
    steps,
    final: describeResult(serviceRes),
  };
}

module.exports = { runFlow, describeResult };
