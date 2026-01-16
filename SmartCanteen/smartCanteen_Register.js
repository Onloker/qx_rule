/******************************************
作者：Onloker
版本号：1.2.3
更新时间：2026-01-16 17:15:00

[task_local]
0 10 * * * https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/SmartCanteen/smartCanteen_Register.js, tag=智慧食堂签到, img-url=https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/icon/cornex.png, enabled=true
******************************************/

const AUTH_KEY = "cornex.auth";
const AUTH_EXPIRES_AT_KEY = "cornex.auth.expiresAt";
const AUTH_REFRESH_TOKEN_KEY = "cornex.auth.refreshToken";
const AUTH_TICKET_KEY = "cornex.auth.ticket";
const AUTH_TOKEN_TYPE_KEY = "cornex.auth.tokenType";
const CRYPTOJS_CACHE_KEY = "cornex.cryptojs";

(async () => {
  try {
    console.log("⏱️ 开始执行智慧食堂签到...");
    const authorization = await getAuthorization();
    const result = await signInWithRetry(authorization);
    const msg = result?.msg || "未知返回";
    const score = result?.data?.score;
    console.log("✅ 签到完成:\n" + formatJsonString(JSON.stringify(result)));
    if (typeof score !== "undefined") {
      $notify("智慧食堂签到", "", `${msg}，本次获得积分：${score}`);
    } else {
      $notify("智慧食堂签到", "", msg);
    }
  } catch (e) {
    console.log("❗ 脚本异常:\n" + String(e));
    $notify("智慧食堂签到", "❗异常", String(e));
  } finally {
    $done();
  }
})();

async function signInWithRetry(authorization) {
  try {
    return await signIn(authorization);
  } catch (e) {
    if (!e || !e.authInvalid) throw e;
  }
  console.log("🔄 Authorization 失效，清空缓存并重新登录后重试...");
  clearAuthorization();
  const refreshed = await getAuthorization({ forceRefresh: true });
  return await signIn(refreshed);
}

async function signIn(authorization) {
  const signUrl = "https://smart-area-api.cn-np.com/shop/SignIn/handle";
  const options = {
    url: signUrl,
    method: "POST",
    headers: {
      Accept: "application/json, text/plain, */*",
      Authorization: authorization,
      "Content-Type": "application/json;charset=UTF-8",
      Origin: "https://app.dms.cn-np.com",
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 HXMall CNBusiness/3.27.0; SCO_OREO",
      Referer: "https://app.dms.cn-np.com/"
    },
    body: JSON.stringify({})
  };
  console.log("📤 请求签到 headers:\n" + JSON.stringify(sanitizeHeaders(options.headers), null, 2));
  console.log("📦 请求签到 body:\n" + JSON.stringify({}, null, 2));
  const response = await $task.fetch(options);
  const statusCode = response?.statusCode || 0;
  const bodyText = response?.body || "";
  console.log(`📥 签到返回 status:${statusCode}:\n` + formatJsonString(bodyText));
  if (looksLikeAuthInvalid(statusCode, bodyText)) {
    const err = new Error("Authorization 无效");
    err.authInvalid = true;
    throw err;
  }
  try {
    return JSON.parse(bodyText);
  } catch (_) {
    return { msg: bodyText };
  }
}

async function getAuthorization(opts) {
  const forceRefresh = !!(opts && opts.forceRefresh);
  const cached = ($prefs.valueForKey(AUTH_KEY) || "").trim();
  const expiresAt = parseInt($prefs.valueForKey(AUTH_EXPIRES_AT_KEY) || "0", 10) || 0;
  const now = Date.now();
  const skewMs = 5 * 60 * 1000;

  if (!forceRefresh && cached && expiresAt && now + skewMs < expiresAt) {
    const leftMin = Math.floor((expiresAt - now) / 60000);
    console.log(`🔑 使用缓存 Authorization（剩余约 ${leftMin} 分钟）`);
    return cached;
  }
  if (!forceRefresh && cached && !expiresAt) {
    console.log("🔑 使用缓存 Authorization（未记录 expiresAt）");
    return cached;
  }

  if (forceRefresh) {
    console.log("🔄 强制刷新 Authorization，开始重新登录...");
  } else if (cached) {
    console.log("⏳ Authorization 即将过期或已过期，开始重新登录...");
  } else {
    console.log("🔐 未发现缓存 Authorization，开始登录...");
  }
  const loginRes = await loginAndCache();
  if (loginRes && loginRes.expiresAt) {
    const leftMin = Math.floor((loginRes.expiresAt - Date.now()) / 60000);
    console.log(`✅ 获取新 Authorization 成功（有效期约 ${leftMin} 分钟）`);
  } else {
    console.log("✅ 获取新 Authorization 成功");
  }
  return loginRes.authorization;
}

function clearAuthorization() {
  $prefs.setValueForKey("", AUTH_KEY);
  $prefs.setValueForKey("", AUTH_EXPIRES_AT_KEY);
  $prefs.setValueForKey("", AUTH_REFRESH_TOKEN_KEY);
  $prefs.setValueForKey("", AUTH_TICKET_KEY);
  $prefs.setValueForKey("", AUTH_TOKEN_TYPE_KEY);
  $prefs.setValueForKey("", "Authorization");
}

function saveAuthorization(authorization, extra) {
  $prefs.setValueForKey(String(authorization || ""), AUTH_KEY);
  $prefs.setValueForKey(String(authorization || ""), "Authorization");
  if (extra && typeof extra.expiresAt === "number") $prefs.setValueForKey(String(extra.expiresAt), AUTH_EXPIRES_AT_KEY);
  if (extra && extra.refreshToken) $prefs.setValueForKey(String(extra.refreshToken), AUTH_REFRESH_TOKEN_KEY);
  if (extra && extra.ticket) $prefs.setValueForKey(String(extra.ticket), AUTH_TICKET_KEY);
  if (extra && extra.tokenType) $prefs.setValueForKey(String(extra.tokenType), AUTH_TOKEN_TYPE_KEY);
}

async function loginAndCache() {
  const cfg = readLoginConfig();
  await ensureCryptoJS();

  const payload = {
    username: cfg.username,
    pswd: cfg.password,
    grant_type: "password",
    loginType: 1,
    deviceBrand: "-"
  };

  const appKeyCandidates = buildAppKeyCandidates(cfg.appKey, [
    "7adbe5e0-eb1b-11ee-a417-e55e300151f5",
    "856ded10-5f11-11ed-869d-9345d017b816",
    "d6571b30-5f3d-11ed-a277-1505f577475e",
    "b8c80da0-5f0f-11ed-b6ae-5b1a0c84d405"
  ]);

  let lastBodyText = "";
  for (const appKey of appKeyCandidates) {
    const { requestBody } = buildSignedRequest(payload, cfg, appKey);
    const res = await sendLogin(cfg, requestBody);
    const bodyText = res.bodyText || "";
    lastBodyText = bodyText;
    const parsed = safeJsonParse(bodyText);
    const msg = (parsed && (parsed.message || parsed.resultMessage)) || "";
    if (typeof msg === "string" && msg.includes("设备记录设置失败")) {
      continue;
    }
    if (!parsed || !(parsed.resultCode === 200 || parsed.code === 200 || parsed.resultData)) {
      throw new Error(msg || "登录失败");
    }
    const rd = parsed.resultData || parsed.data || {};
    const ticket = (rd.ticket || "").trim();
    const tokenType = (rd.tokenType || "").trim();
    const expiresIn = parseInt(rd.expiresIn || "0", 10) || 0;
    const refreshToken = (rd.refreshToken || "").trim();
    if (!ticket || !tokenType) {
      throw new Error("登录成功但未返回 tokenType/ticket");
    }
    const authorization = `${tokenType} ${ticket}`.trim();
    const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : 0;
    saveAuthorization(authorization, { expiresAt, refreshToken, ticket, tokenType });
    return { authorization, expiresAt, refreshToken, ticket, tokenType };
  }

  const lastParsed = safeJsonParse(lastBodyText);
  const lastMsg = (lastParsed && (lastParsed.message || lastParsed.resultMessage)) || lastBodyText || "登录失败";
  throw new Error(lastMsg);
}

function readLoginConfig() {
  const username = readStr("cornex.username", "").trim();
  const password = readStr("cornex.password", "").trim();
  if (!username || !password) {
    throw new Error("请先在 BoxJs 的 DMS 中配置账号和密码");
  }

  return {
    username,
    password,
    url: readRequired("cornex.url").trim(),
    urlControl: readStr("cornex.urlControl", "/sso/sso/getTicket.do").trim(),
    systemId: parseInt(readStr("cornex.systemId", "100080"), 10) || 100080,
    businessEnvironment: readStr("cornex.businessEnvironment", "release").trim() || "release",
    requestTokenType: readStr("cornex.requestTokenType", "ST1").trim() || "ST1",
    acceptLanguage: readStr("cornex.acceptLanguage", "zh").trim() || "zh",
    confSystem: readStr("cornex.confSystem", "S1").trim() || "S1",
    secretKey: readRequired("cornex.secretKey").trim(),
    md5Key: readRequired("cornex.md5Key").trim(),
    iv: readRequired("cornex.iv").trim(),
    appKey: readRequired("cornex.appKey").trim(),
    appVersion: readStr("cornex.appVersion", "1.3.83").trim() || "1.3.83",
    deviceType: readStr("cornex.deviceType", "Windows").trim() || "Windows",
    imDeviceType: readStr("cornex.imDeviceType", "pc").trim() || "pc",
    deviceName: readStr("cornex.deviceName", "").trim(),
    deviceModel: readStr("cornex.deviceModel", "Windows10").trim() || "Windows10",
    deviceNo: readStr("cornex.deviceNo", "").trim(),
    mac: readStr("cornex.mac", "00:00:00:00:00:00").trim() || "00:00:00:00:00:00",
    ips: readStr("cornex.ips", "127.0.0.1").trim() || "127.0.0.1"
  };
}

function buildSignedRequest(payload, cfg, appKey) {
  const deviceInfo = buildDeviceInfo(cfg, appKey);
  const meta = {
    system_id: String(cfg.systemId),
    systemId: cfg.systemId,
    businessEnvironment: cfg.businessEnvironment || "release",
    adapterNo: "",
    confSystem: cfg.confSystem || "",
    eureka_application: "",
    urlControl: cfg.urlControl
  };

  const plainPayload = Object.assign(
    {
      system_id: meta.system_id,
      systemId: meta.systemId,
      businessEnvironment: meta.businessEnvironment
    },
    deviceInfo,
    payload || {}
  );

  const timeStr = buildTime();
  const plainText = JSON.stringify(plainPayload);
  const data = tripleDesCbcEncryptBase64(plainText, cfg.secretKey, cfg.iv);
  const identity = md5Hex(String(cfg.md5Key || "") + String(data || "") + String(timeStr || ""));

  const sign = {
    data,
    time: timeStr,
    identity_code: identity,
    identityCode: identity
  };
  const requestBody = normalizeParams(Object.assign({}, meta, sign));
  return { requestBody, plainPayload };
}

function normalizeParams(params) {
  const out = Object.assign({}, params || {});
  if (!out.identityCode && out.identity_code) out.identityCode = out.identity_code;
  if (!out.identity_code && out.identityCode) out.identity_code = out.identityCode;
  if (!out.systemId && typeof out.system_id !== "undefined") out.systemId = parseInt(out.system_id, 10) || out.system_id;
  if (!out.system_id && typeof out.systemId !== "undefined") out.system_id = String(out.systemId);
  return out;
}

function buildDeviceInfo(cfg, appKey) {
  const mac = cfg.mac || "00:00:00:00:00:00";
  const ips = parseCsv(cfg.ips).filter(Boolean);
  const ipInfo = (ips.length ? ips : ["127.0.0.1"]).map(ip => ({ IP: ip, MAC: mac }));

  const st = cfg.deviceType || "Windows";
  const deviceName = cfg.deviceName || `ele-${st}-user`;
  const deviceNo = cfg.deviceNo || md5Hex(`${deviceName}|${mac}|cngm`);

  return {
    deviceType: st,
    deviceNo,
    deviceName,
    deviceModel: cfg.deviceModel || "Windows10",
    appVersion: cfg.appVersion || "1.3.83",
    appKey: appKey || "",
    imDeviceType: cfg.imDeviceType || "pc",
    div_source_tag: "楚能办公",
    IpInfo: ipInfo
  };
}

async function sendLogin(cfg, requestParams) {
  const headers = {
    "X-CnGm-Token-Type": cfg.requestTokenType || "ST1",
    "Accept-Language": cfg.acceptLanguage || "zh",
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/x-www-form-urlencoded;charset=utf-8"
  };
  const formBody = formEncode(requestParams);
  const res = await $task.fetch({ url: cfg.url, method: "POST", headers, body: formBody });
  const statusCode = res?.statusCode || 0;
  const bodyText = res?.body || "";
  if (looksLikeCannotPost(bodyText)) {
    const joiner = cfg.url.includes("?") ? "&" : "?";
    const getUrl = cfg.url + joiner + formBody;
    const res2 = await $task.fetch({ url: getUrl, method: "GET", headers: { ...headers, "Content-Type": "" } });
    return { statusCode: res2?.statusCode || 0, bodyText: res2?.body || "" };
  }
  return { statusCode, bodyText };
}

function looksLikeCannotPost(text) {
  return typeof text === "string" && text.includes("Cannot POST");
}

function looksLikeAuthInvalid(statusCode, bodyText) {
  if (statusCode === 401 || statusCode === 403) return true;
  const obj = safeJsonParse(bodyText);
  const msg =
    (obj && (obj.message || obj.msg || obj.resultMessage)) ||
    (obj && obj.body && obj.body.message) ||
    "";
  const code = obj && (obj.code || obj.resultCode);
  if (code === 401 || code === 403) return true;
  if (typeof msg === "string" && (msg.includes("未登录") || msg.includes("token") || msg.includes("Token"))) {
    if (msg.includes("失效") || msg.includes("过期") || msg.includes("无效") || msg.includes("未登录")) return true;
  }
  return false;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

function formatJsonString(str) {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch (_) {
    return str;
  }
}

function sanitizeHeaders(headers) {
  const out = { ...(headers || {}) };
  if (out.Authorization) out.Authorization = "***";
  return out;
}

function formEncode(params) {
  const parts = [];
  for (const k in params) {
    if (!Object.prototype.hasOwnProperty.call(params, k)) continue;
    const v = params[k];
    if (typeof v === "undefined" || v === null) continue;
    parts.push(encodeURIComponent(String(k)) + "=" + encodeURIComponent(String(v)));
  }
  return parts.join("&");
}

function parseCsv(s) {
  if (!s) return [];
  return String(s)
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);
}

function readStr(key, defVal) {
  const v = $prefs.valueForKey(String(key));
  if (typeof v === "undefined" || v === null) return String(defVal || "");
  return String(v);
}

function readRequired(key) {
  const v = $prefs.valueForKey(String(key));
  const s = typeof v === "undefined" || v === null ? "" : String(v);
  if (!s.trim()) throw new Error("缺失配置: " + String(key));
  return s;
}

function buildTime() {
  const ts = Math.floor(Date.now() / 1000);
  return String(ts) + randomStr(8);
}

function randomStr(length) {
  const chars = "ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678";
  const n = Math.max(0, parseInt(length || "0", 10) || 0);
  let out = "";
  for (let i = 0; i < n; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

function buildAppKeyCandidates(primary, fallbacks) {
  const p = (primary || "").trim();
  const out = [];
  if (p) out.push(p);
  for (const k of fallbacks || []) {
    if (k && out.indexOf(k) === -1) out.push(k);
  }
  return out;
}

function md5Hex(s) {
  return CryptoJS.MD5(String(s || "")).toString();
}

function tripleDesCbcEncryptBase64(plainText, secretKey, iv) {
  const keyWA = CryptoJS.enc.Utf8.parse(String(secretKey || ""));
  const ivWA = CryptoJS.enc.Utf8.parse(String(iv || ""));
  const encrypted = CryptoJS.TripleDES.encrypt(String(plainText || ""), keyWA, {
    iv: ivWA,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  return CryptoJS.enc.Base64.stringify(encrypted.ciphertext);
}

async function ensureCryptoJS() {
  if (typeof CryptoJS !== "undefined") return;
  const cached = $prefs.valueForKey(CRYPTOJS_CACHE_KEY) || "";
  if (cached) {
    try {
      eval(cached);
    } catch (_) {}
    if (typeof CryptoJS !== "undefined") return;
  }
  const url = "https://cdn.jsdelivr.net/npm/crypto-js@4.2.0/crypto-js.min.js";
  const res = await $task.fetch({ url });
  const body = res?.body || "";
  if (body) {
    $prefs.setValueForKey(body, CRYPTOJS_CACHE_KEY);
    eval(body);
  }
  if (typeof CryptoJS === "undefined") {
    throw new Error("CryptoJS 加载失败");
  }
}
