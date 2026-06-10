const crypto = require("crypto");

const DEFAULT_BASE_URL = "https://dbaasapi.kbsec.com:32484";

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

function trimAndCompactJsonString(json) {
  return json.replace(/\s+/g, "");
}

function toBufferKey(secret) {
  const key = Buffer.from(String(secret ?? ""), "utf8");
  if ([16, 24, 32].includes(key.length)) {
    return key;
  }
  return crypto.createHash("sha256").update(key).digest();
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

class KbBaaSClient {
  constructor(options) {
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.ciNo = options.ciNo;
    this.userInfo = options.userInfo;
    this.infoType = options.infoType || "1";
    this.baseUrl = options.baseUrl || DEFAULT_BASE_URL;
    this.timeoutMs = options.timeoutMs || 20000;
    this.accessToken = null;
    this.refreshToken = null;
    this.mapKey = null;
  }

  async postJson(path, body, headers = {}) {
    const url = `${this.baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
    const payload = JSON.stringify(body);
    const t = timeoutSignal(this.timeoutMs);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: payload,
        signal: t.signal,
      });

      const text = await res.text();
      return {
        status: res.status,
        ok: res.ok,
        headers: Object.fromEntries(res.headers.entries()),
        raw: text,
        json: safeJsonParse(text),
      };
    } finally {
      t.clear();
    }
  }

  async baasAuthIssue() {
    return this.postJson("/baas/v2/baas_auth_issue", {
      dataHeader: this._buildDataHeader(),
      dataBody: {
        clientId: this.clientId,
        ciNo: this.ciNo,
        userInfo: this.userInfo,
        infoType: this.infoType,
      },
    }, {
      "Content-Type": "application/json",
    });
  }

  async baasTokenIssueByCode(code, issueNo) {
    const res = await this.postJson("/baas/v2/baas_token_issue", {
      dataHeader: this._buildDataHeader(),
      dataBody: {
        code,
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        grantType: "authorization_code",
        scope: "public security",
        issueNo,
      },
    }, {
      "Content-Type": "application/json",
    });

    this._extractTokens(res);
    return res;
  }

  async baasTokenIssueByClientCredentials() {
    const res = await this.postJson("/baas/v2/baas_token_issue", {
      dataHeader: this._buildDataHeader(),
      dataBody: {
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        grantType: "client_credentials",
        scope: "public security",
      },
    }, {
      "Content-Type": "application/json",
    });

    this._extractTokens(res);
    return res;
  }

  async clauseAgreeProcessWithClientCredentials() {
    return this._postClauseAgree({
      clientId: this.clientId,
      ciNo: this.ciNo,
      collAgreeYn: "Y",
      offerAgreeYn: "Y",
      agrType: "1",
      grantType: "client_credentials",
    });
  }

  async _postClauseAgree(dataBody) {
    const res = await this.postJson("/baas/v2/clause_agree_process", {
      dataHeader: {
        ...this._buildDataHeader(),
        hsKey: "body",
      },
      dataBody,
    }, {
      "Content-Type": "application/json",
    });

    const body = this.extractDataBody(res);
    if (body && body.mapKey) {
      this.mapKey = body.mapKey;
    }
    return res;
  }

  async callEncryptedByMapKey(path, requestBody) {
    return this._callEncryptedEndpoint(path, requestBody, {
      type: "mapKey",
      requiresAccessToken: true,
      requiresMapKey: true,
      addHsKey: true,
    });
  }

  async callEncryptedByToken(path, requestBody) {
    return this._callEncryptedEndpoint(path, requestBody, {
      type: "token",
      requiresAccessToken: true,
      addHsKey: true,
    });
  }

  async callEncryptedByAppKey(path, requestBody) {
    return this._callEncryptedEndpoint(path, requestBody, {
      type: "appKey",
    });
  }

  async _callEncryptedEndpoint(path, requestBody, options = {}) {
    const reqString = JSON.stringify(requestBody);
    const compact = trimAndCompactJsonString(reqString);
    const encrypt = this._aesEncrypt(compact, this.clientSecret);
    const headers = {
      "Content-Type": "application/json",
    };

    if (options.addHsKey && this.accessToken) {
      headers.hsKey = this._calcHsKey(compact, this.accessToken);
    }

    if (options.requiresAccessToken) {
      if (!this.accessToken) {
        throw new Error("access_token is missing. Please issue token first.");
      }
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    if (options.type === "mapKey") {
      if (!this.mapKey) {
        throw new Error("mapKey is missing. Run clause_agree_process(client_credentials) first.");
      }
      headers.mapKey = this.mapKey;
    }

    if (options.type === "appKey") {
      headers.appKey = this.clientId;
    }

    const res = await this.postJson(path, { encrypt }, headers);
    this._attachDecryptedBody(res);
    return res;
  }

  _buildDataHeader() {
    return {
      udId: "UDID",
      subChannel: "subChannel",
      deviceModel: "Node.js",
      deviceOs: "Node.js",
      carrier: "KB",
      connectionType: "..",
      appName: "OpenAPITester",
      appVersion: "1.0.0",
      scrNo: "0000",
    };
  }

  _extractTokens(res) {
    const body = this.extractDataBody(res);
    if (!body) {
      return;
    }
    if (body.access_token) {
      this.accessToken = body.access_token;
    }
    if (body.refresh_token) {
      this.refreshToken = body.refresh_token;
    }
  }

  _attachDecryptedBody(res) {
    const raw = res?.json;
    if (!raw || typeof raw.encrypt !== "string") {
      return;
    }
    try {
      const dec = this._aesDecrypt(raw.encrypt, this.clientSecret);
      const decoded = safeJsonParse(dec);
      res.decrypted = decoded ?? { raw: dec };
      res.decryptedText = dec;
    } catch (error) {
      res.decrypted = { error: error.message };
    }
  }

  _aesEncrypt(raw, secret) {
    const key = toBufferKey(secret);
    const cipher = crypto.createCipheriv("aes-256-ecb", key, null);
    const encrypted = Buffer.concat([cipher.update(raw, "utf8"), cipher.final()]);
    return encrypted.toString("base64");
  }

  _aesDecrypt(base64Text, secret) {
    const key = toBufferKey(secret);
    const decipher = crypto.createDecipheriv("aes-256-ecb", key, null);
    const decrypted = Buffer.concat([decipher.update(base64Text, "base64"), decipher.final()]);
    return decrypted.toString("utf8");
  }

  _calcHsKey(requestBodyText, accessToken) {
    // Match Postman sample style: compacted request body + accessToken HMAC SHA-256, base64.
    const hmacHex = crypto.createHmac("sha256", accessToken).update(requestBodyText).digest("hex");
    return Buffer.from(hmacHex, "utf8").toString("base64");
  }

  extractDataBody(res) {
    return res && res.json && res.json.dataBody ? res.json.dataBody : null;
  }

  extractResultCode(res) {
    const body = this.extractDataBody(res);
    return {
      code: body ? body.rspCd || body.code || null : null,
      message: body ? body.rspMsg || body.msg || null : null,
      raw: body,
    };
  }
}

module.exports = { KbBaaSClient };
