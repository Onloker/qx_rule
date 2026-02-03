/******************************************
作者：Onloker
版本号：1.1.7
更新时间：2026-01-20 10:00:00

[task_local]
0 10,14,20 * * * https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/SmartCanteen/smartCanteen_Evaluation.js, tag=智慧食堂评价, img-url=https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/icon/cornex.png, enabled=true
******************************************/

const AUTH_KEY = "cornex.auth";
const AUTH_EXPIRES_AT_KEY = "cornex.auth.expiresAt";
const AUTH_REFRESH_TOKEN_KEY = "cornex.auth.refreshToken";
const AUTH_TICKET_KEY = "cornex.auth.ticket";
const AUTH_TOKEN_TYPE_KEY = "cornex.auth.tokenType";
const CRYPTOJS_CACHE_KEY = "cornex.cryptojs";
let PREF_LOG_SILENT = false;

(async () => {
  try {
    console.log("⏱️ 开始执行智慧食堂评价...");
    await getAuthorization();
    console.log("✅ 登录/鉴权完成，开始读取评价 BoxJs 配置...");

    const prevSilent = PREF_LOG_SILENT;
    PREF_LOG_SILENT = true;
    let fixedFields;
    try {
      fixedFields = {
        jobCode: readStr("smartCanteen.jobCode", "").trim(),
        userInfoId: readStr("smartCanteen.userInfoId", "").trim(),
        userCodeOrigin: readStr("smartCanteen.userCodeOrigin", "").trim(),
        companyName: readStr("smartCanteen.companyName", "").trim(),
        companyCode: readStr("smartCanteen.companyCode", "").trim(),
        loginUid: readStr("smartCanteen.loginUid", "").trim(),
        userNameOrigin: readStr("smartCanteen.userNameOrigin", "").trim(),
        remark: readStr("smartCanteen.remark", "").trim(),
        score: parseInt(readStr("smartCanteen.score", "").trim(), 10)
      };
    } finally {
      PREF_LOG_SILENT = prevSilent;
    }
    console.log("📦 BoxJs 配置:\n" + JSON.stringify(fixedFields, null, 2));

    const missing = Object.entries(fixedFields).filter(([k, v]) => !v).map(([k]) => k);
    if (missing.length > 0) {
      $notify("智慧食堂评价", "❗异常", "缺失配置: " + missing.join(", "));
      return $done();
    }

    await run(fixedFields);
  } catch (err) {
    console.log("❗ 脚本异常:\n" + err);
    $notify("智慧食堂评价", "❗异常", String(err));
  }
  $done();
})();

async function run(fixedFields) {
  console.log("🔍 开始获取待评价列表...");
  const tradeIds = await getPendingComments();
  console.log(`📋 待评价数量: ${tradeIds.length}`);

  if (tradeIds.length === 0) {
    return $notify("智慧食堂评价", "", "暂无待评价消费");
  }

  let success = 0, fail = 0, totalScore = 0;
  let failList = [];
  let successList = [];

  for (let i = 0; i < tradeIds.length; i++) {
    const tradeId = tradeIds[i];
    console.log(`\n----------------------------`);
    console.log(`➡️ 开始处理 tradeId: ${tradeId}`);
    let done = false;
    let lastErr = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const info = await getCommentInfo(tradeId);
        console.log(`✅ 获取详情成功 tradeId:${tradeId}:\n` + JSON.stringify(info, null, 2));

        const submitBody = {
          jobCode: fixedFields.jobCode,
          userInfoId: fixedFields.userInfoId,
          userCodeOrigin: fixedFields.userCodeOrigin,
          companyName: fixedFields.companyName,
          companyCode: fixedFields.companyCode,
          loginUid: fixedFields.loginUid,
          userNameOrigin: fixedFields.userNameOrigin,
          remark: fixedFields.remark,
          trade_id: tradeId,
          meal_time: info.meal_time,
          canteen_name: info.canteenName,
          canteen_code: info.canteenCode,
          comment: [
            {
              stall_name: info.firstStallName,
              food_name: info.firstFoodName,
              score: fixedFields.score
            }
          ],
          attachment: [],
          groupCodeOrigin: []
        };

        const submitHeaders = {
          Accept: "application/json, text/plain, */*",
          "Content-Type": "application/json;charset=UTF-8",
          Origin: "https://app.dms.cn-np.com",
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 HXMall CNBusiness/3.28.0; SCO_OREO",
          Referer: "https://app.dms.cn-np.com/"
        };

        console.log(`📤 提交评价 headers:\n` + JSON.stringify(sanitizeHeaders(submitHeaders), null, 2));
        console.log(`📦 提交评价 body:\n` + JSON.stringify(submitBody, null, 2));

        const submitRes = await httpPostWithAuth({
          url: "https://smart-area-api.cn-np.com/canteen/comment/submit",
          headers: submitHeaders,
          body: JSON.stringify(submitBody)
        });
        console.log(`📥 提交评价返回:\n` + formatJsonString(submitRes));

        const submitJson = JSON.parse(submitRes);
        if (submitJson.code !== 200) throw new Error(submitJson.msg || "提交失败");

        console.log(`✅ 提交评价成功 tradeId:${tradeId}`);

        const scoreInfo = await getScoreAfterComment(tradeId);
        console.log(`🎉 获取积分成功 tradeId:${tradeId}:\n` + JSON.stringify(scoreInfo, null, 2));

        success++;
        totalScore += scoreInfo.total;
        successList.push({ tradeId, info, scoreInfo, commentScore: fixedFields.score });
        done = true;
        break;
      } catch (e) {
        lastErr = e;
        console.log(`❌ tradeId:${tradeId} 第${attempt}次异常:\n` + String(e));
        if (attempt < 2) {
          const retryDelay = randBetween(1000, 3000);
          console.log(`⏳ ${retryDelay}ms 后重试 tradeId:${tradeId}`);
          await sleep(retryDelay);
        }
      }
    }
    if (!done) {
      fail++;
      failList.push({ tradeId, error: String(lastErr) });
      $notify("智慧食堂评价", "❗异常", `ID:${tradeId}, 错误:${lastErr}`);
    }
    if (i < tradeIds.length - 1) {
      const gap = randBetween(1000, 3000);
      console.log(`⏳ 间隔 ${gap}ms 后处理下一条`);
      await sleep(gap);
    }
  }

  console.log(
    "📊 本次评价汇总：\n" +
      `评价总数：${tradeIds.length}\n` +
      `成功数量：${success}\n` +
      `失败数量：${fail}\n` +
      `积分总数：${totalScore}`
  );
  const detailText = successList.length
    ? successList
        .map(x => {
          const mealTime = (x && x.info && x.info.meal_time) || "";
          const total = (x && x.scoreInfo && typeof x.scoreInfo.total !== "undefined") ? x.scoreInfo.total : "";
          return `消费单号：${x.tradeId}\n消费时间：${mealTime}\n评价分数：${total}`;
        })
        .join("\n---\n")
    : "无";
  console.log("🧾 本次评价明细:\n" + detailText);

  const subtitle = `评价总分：${totalScore}`;
  const body = `成功:${success}   失败:${fail}`;
  $notify("智慧食堂评价", subtitle, body);
}

async function getPendingComments() {
  const url = "https://smart-area-api.cn-np.com/canteen/comment/myList";
  const headers = {
    Accept: "application/json, text/plain, */*",
    Origin: "https://app.dms.cn-np.com",
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 HXMall CNBusiness/3.28.0; SCO_OREO",
    Connection: "keep-alive",
    Referer: "https://app.dms.cn-np.com/"
  };
  console.log("📤 请求待评价列表 headers:\n" + JSON.stringify(sanitizeHeaders(headers), null, 2));
  const res = await httpGetWithAuth({ url, headers });
  console.log("📥 返回原始:\n" + formatJsonString(res));

  const json = JSON.parse(res);
  if (json.code !== 200) {
    throw new Error(`获取待评价列表失败:${json.msg || '未知错误'}`);
  }
  return json?.data?.data?.map(x => x.tradeId) || [];
}

async function getCommentInfo(tradeId) {
  const url = `https://smart-area-api.cn-np.com/canteen/comment/getFoods?trade_id=${tradeId}`;
  const headers = {
    Accept: "application/json, text/plain, */*",
    Origin: "https://app.dms.cn-np.com",
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 HXMall CNBusiness/3.28.0; SCO_OREO",
    Connection: "keep-alive",
    Referer: "https://app.dms.cn-np.com/"
  };
  console.log(`📤 获取详情 tradeId:${tradeId} headers:\n` + JSON.stringify(sanitizeHeaders(headers), null, 2));
  const res = await httpGetWithAuth({ url, headers });
  console.log(`📥 获取详情返回 tradeId:${tradeId}:\n` + formatJsonString(res));
  const data = JSON.parse(res).data || {};
  return {
    meal_time: data.meal_time || "",
    firstStallName: data.menus?.[0]?.name || "",
    firstFoodName: data.menus?.[0]?.foods?.[0]?.name || "",
    canteenName: data.canteens?.[0]?.name || "",
    canteenCode: data.canteens?.[0]?.value || ""
  };
}

async function getScoreAfterComment(tradeId) {
  const url = `https://smart-area-api.cn-np.com/canteen/comment/getFoods?trade_id=${tradeId}`;
  const headers = {
    Accept: "application/json, text/plain, */*",
    Origin: "https://app.dms.cn-np.com",
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 HXMall CNBusiness/3.28.0; SCO_OREO",
    Connection: "keep-alive",
    Referer: "https://app.dms.cn-np.com/"
  };
  console.log(`📤 再次获取积分 tradeId:${tradeId} headers:\n` + JSON.stringify(sanitizeHeaders(headers), null, 2));
  const res = await httpGetWithAuth({ url, headers });
  console.log(`📥 积分返回 tradeId:${tradeId}:\n` + formatJsonString(res));
  const data = JSON.parse(res)?.data || {};
  const scoreing = parseInt(data.comment?.scoreing_value || "0", 10);
  const commentScoreing = parseInt(data.comment?.comment_scoreing_value || "0", 10);
  const total = scoreing + commentScoreing;
  return { scoreing_value: scoreing, comment_scoreing_value: commentScoreing, total };
}

function formatJsonString(str) {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch (e) {
    return str;
  }
}

function sanitizeHeaders(headers) {
  const out = { ...(headers || {}) };
  if (out.Authorization) out.Authorization = "***";
  return out;
}

function maskMiddle(v, keepStart, keepEnd) {
  const s = typeof v === "undefined" || v === null ? "" : String(v);
  const a = Math.max(0, parseInt(keepStart || "0", 10) || 0);
  const b = Math.max(0, parseInt(keepEnd || "0", 10) || 0);
  if (!s) return s;
  if (a + b >= s.length) return s;
  return s.slice(0, a) + "***" + s.slice(s.length - b);
}

function maskPassword(v) {
  const s = typeof v === "undefined" || v === null ? "" : String(v);
  if (!s) return "";
  return `***(${s.length})`;
}

function randBetween(min, max) {
  const a = Math.max(0, parseInt(min || "0", 10) || 0);
  const b = Math.max(0, parseInt(max || "0", 10) || 0);
  if (a >= b) return a;
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

function sleep(ms) {
  const n = Math.max(0, parseInt(ms || "0", 10) || 0);
  return new Promise(resolve => setTimeout(resolve, n));
}

function sanitizeLoginConfig(cfg) {
  const c = { ...(cfg || {}) };
  if (c.password) c.password = maskPassword(c.password);
  if (c.secretKey) c.secretKey = maskMiddle(c.secretKey, 4, 4);
  if (c.md5Key) c.md5Key = maskMiddle(c.md5Key, 4, 4);
  if (c.iv) c.iv = maskMiddle(c.iv, 2, 2);
  if (c.appKey) c.appKey = maskMiddle(c.appKey, 8, 4);
  if (c.mac) c.mac = maskMiddle(c.mac, 3, 2);
  if (c.deviceNo) c.deviceNo = maskMiddle(c.deviceNo, 6, 4);
  return c;
}

function sanitizeLoginPayload(payload) {
  const p = { ...(payload || {}) };
  if (p.pswd) p.pswd = maskPassword(p.pswd);
  return p;
}

function sanitizeLoginPlainPayload(plainPayload) {
  const p = { ...(plainPayload || {}) };
  if (p.pswd) p.pswd = maskPassword(p.pswd);
  return p;
}

function truncateWithLen(v, headLen) {
  const s = typeof v === "undefined" || v === null ? "" : String(v);
  const n = Math.max(0, parseInt(headLen || "0", 10) || 0);
  if (!s) return s;
  if (s.length <= n) return `${s}(${s.length})`;
  return `${s.slice(0, n)}...(${s.length})`;
}

function sanitizeLoginRequestParams(params) {
  const p = { ...(params || {}) };
  if (p.data) p.data = truncateWithLen(p.data, 48);
  if (p.identity_code) p.identity_code = truncateWithLen(p.identity_code, 24);
  if (p.identityCode) p.identityCode = truncateWithLen(p.identityCode, 24);
  return p;
}

function sanitizeLoginResponseText(text) {
  const obj = safeJsonParse(text);
  if (!obj) return formatJsonString(String(text || ""));
  const root = JSON.parse(JSON.stringify(obj));
  const sensitiveKeys = {
    ticket: true,
    refreshToken: true,
    access_token: true,
    accessToken: true,
    Authorization: true,
    authorization: true
  };
  const walk = v => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) {
      for (const it of v) walk(it);
      return;
    }
    for (const k of Object.keys(v)) {
      const val = v[k];
      if (sensitiveKeys[k]) {
        v[k] = maskMiddle(val, 6, 4);
      } else {
        walk(val);
      }
    }
  };
  walk(root);
  return JSON.stringify(root, null, 2);
}

async function httpGetWithAuth(options) {
  const res = await fetchWithAuth({ ...options, method: "GET" });
  return res.bodyText;
}

async function httpPostWithAuth(options) {
  const res = await fetchWithAuth({ ...options, method: "POST" });
  return res.bodyText;
}

async function fetchWithAuth(options) {
  const opts = { ...(options || {}) };
  opts.headers = { ...(opts.headers || {}) };
  const auth = await getAuthorization();
  opts.headers.Authorization = auth;
  const res1 = await $task.fetch(opts);
  const statusCode1 = res1?.statusCode || 0;
  const bodyText1 = res1?.body || "";
  if (!looksLikeAuthInvalid(statusCode1, bodyText1)) {
    return { statusCode: statusCode1, bodyText: bodyText1 };
  }

  clearAuthorization();
  const auth2 = await getAuthorization({ forceRefresh: true });
  opts.headers.Authorization = auth2;
  const res2 = await $task.fetch(opts);
  return { statusCode: res2?.statusCode || 0, bodyText: res2?.body || "" };
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
    console.log("Authorization：" + String(cached || ""));
    return cached;
  }
  if (!forceRefresh && cached && !expiresAt) {
    console.log("🔑 使用缓存 Authorization（未记录 expiresAt）");
    console.log("Authorization：" + String(cached || ""));
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
    console.log("Authorization：" + String(loginRes.authorization || ""));
  } else {
    console.log("✅ 获取新 Authorization 成功");
    console.log("Authorization：" + String(loginRes.authorization || ""));
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
  console.log("🔐 开始登录流程...");
  const cfg = readLoginConfig();
  console.log("📦 登录配置(BoxJs,已脱敏):\n" + JSON.stringify(sanitizeLoginConfig(cfg), null, 2));
  await ensureCryptoJS();

  const loginParams = {
    username: cfg.username,
    pswd: cfg.password,
    grant_type: "password",
    loginType: 1,
    deviceBrand: "-"
  };
  console.log("📦 登录参数(已脱敏):\n" + JSON.stringify(sanitizeLoginPayload(loginParams), null, 2));

  const appKeyCandidates = buildAppKeyCandidates(cfg.appKey, [
    "7adbe5e0-eb1b-11ee-a417-e55e300151f5",
    "856ded10-5f11-11ed-869d-9345d017b816",
    "d6571b30-5f3d-11ed-a277-1505f577475e",
    "b8c80da0-5f0f-11ed-b6ae-5b1a0c84d405"
  ]);
  console.log("🧩 appKeyCandidates:\n" + JSON.stringify(appKeyCandidates, null, 2));

  let lastBodyText = "";
  for (let i = 0; i < appKeyCandidates.length; i++) {
    const appKey = appKeyCandidates[i];
    console.log(`🚪 尝试登录 appKey[${i + 1}/${appKeyCandidates.length}]: ${maskMiddle(appKey, 8, 4)}`);
    const { requestBody, plainPayload: signPlainParams } = buildSignedRequest(loginParams, cfg, appKey);
    console.log("🧾 签名明文参数(已脱敏):\n" + JSON.stringify(sanitizeLoginPlainPayload(signPlainParams), null, 2));
    console.log("🧾 签名参数(已脱敏):\n" + JSON.stringify(sanitizeLoginRequestParams(requestBody), null, 2));
    const res = await sendLogin(cfg, requestBody);
    const bodyText = res.bodyText || "";
    lastBodyText = bodyText;
    console.log(`📥 登录响应 响应状态:${res.statusCode || 0} method:${res.method || ""}:\n` + sanitizeLoginResponseText(bodyText));
    const parsed = safeJsonParse(bodyText);
    const msg = (parsed && (parsed.message || parsed.resultMessage)) || "";
    if (typeof msg === "string" && msg.includes("设备记录设置失败")) {
      console.log("⚠️ 登录提示: 设备记录设置失败，尝试下一个 appKey...");
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
  console.log("📤 登录请求 POST url:\n" + String(cfg.url || ""));
  console.log("📤 登录请求 POST headers:\n" + JSON.stringify(headers, null, 2));
  console.log("📦 登录请求 POST form(已脱敏):\n" + JSON.stringify(sanitizeLoginRequestParams(requestParams), null, 2));
  console.log("📦 登录请求 POST formEncoded 长度: " + String(formBody.length));
  const res = await $task.fetch({ url: cfg.url, method: "POST", headers, body: formBody });
  const statusCode = res?.statusCode || 0;
  const bodyText = res?.body || "";
  console.log(`📥 登录响应 POST 响应状态:${statusCode}:\n` + sanitizeLoginResponseText(bodyText));
  if (looksLikeCannotPost(bodyText)) {
    const joiner = cfg.url.includes("?") ? "&" : "?";
    const getUrl = cfg.url + joiner + formBody;
    console.log("↪️ 登录接口不支持 POST，尝试 GET...");
    console.log("📤 登录请求 GET url(前200字符):\n" + String(getUrl).slice(0, 200));
    const res2 = await $task.fetch({ url: getUrl, method: "GET", headers: { ...headers, "Content-Type": "" } });
    const statusCode2 = res2?.statusCode || 0;
    const bodyText2 = res2?.body || "";
    console.log(`📥 登录响应 GET 响应状态:${statusCode2}:\n` + sanitizeLoginResponseText(bodyText2));
    return { statusCode: statusCode2, bodyText: bodyText2, method: "GET" };
  }
  return { statusCode, bodyText, method: "POST" };
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

function isNil(v) {
  return typeof v === "undefined" || v === null;
}

function safeLen(v) {
  if (isNil(v)) return 0;
  return String(v).length;
}

function isSensitivePrefKey(key) {
  const k = String(key || "");
  return (
    k === "cornex.password" ||
    k === "cornex.secretKey" ||
    k === "cornex.md5Key" ||
    k === "cornex.iv" ||
    k === "cornex.appKey" ||
    k === "cornex.auth" ||
    k === "cornex.auth.expiresAt" ||
    k === "cornex.auth.refreshToken" ||
    k === "cornex.auth.ticket" ||
    k === "cornex.auth.tokenType" ||
    k === "Authorization" ||
    k === "cornex.cryptojs" ||
    /token|ticket|secret|password|pswd|authorization/i.test(k)
  );
}

function previewPrefValue(key, value) {
  const s = isNil(value) ? "" : String(value);
  if (!s) return "";
  if (String(key || "") === "cornex.password") return maskPassword(s);
  if (isSensitivePrefKey(key)) return maskMiddle(s, 6, 4);
  if (s.length > 160) return s.slice(0, 160) + `...(${s.length})`;
  return s;
}

function readStr(key, defVal) {
  const k = String(key);
  const raw = $prefs.valueForKey(k);
  const hasRaw = !isNil(raw);
  const rawStr = hasRaw ? String(raw) : "";
  const defProvided = typeof defVal !== "undefined";
  const defStr = defProvided ? String(defVal) : "";
  const finalStr = hasRaw ? rawStr : defProvided ? defStr : "";
  const from = hasRaw ? "BoxJs" : defProvided ? "默认值" : "空字符串";
  const info = {
    key: k,
    raw: {
      exists: hasRaw,
      type: hasRaw ? typeof raw : "undefined",
      length: safeLen(rawStr),
      trimmedLength: safeLen(rawStr.trim()),
      blankAfterTrim: !rawStr.trim(),
      preview: previewPrefValue(k, rawStr)
    },
    def: {
      provided: defProvided,
      type: defProvided ? typeof defVal : "undefined",
      length: safeLen(defStr),
      trimmedLength: safeLen(defStr.trim()),
      blankAfterTrim: !defStr.trim(),
      preview: previewPrefValue(k, defStr)
    },
    final: {
      from,
      length: safeLen(finalStr),
      trimmedLength: safeLen(finalStr.trim()),
      blankAfterTrim: !finalStr.trim(),
      preview: previewPrefValue(k, finalStr)
    }
  };
  return finalStr;
}

function readRequired(key) {
  const k = String(key);
  const raw = $prefs.valueForKey(k);
  const hasRaw = !isNil(raw);
  const rawStr = hasRaw ? String(raw) : "";
  const info = {
    key: k,
    raw: {
      exists: hasRaw,
      type: hasRaw ? typeof raw : "undefined",
      length: safeLen(rawStr),
      trimmedLength: safeLen(rawStr.trim()),
      blankAfterTrim: !rawStr.trim(),
      preview: previewPrefValue(k, rawStr)
    },
    required: true
  };
  if (!rawStr.trim()) throw new Error("缺失配置: " + k);
  return rawStr;
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
    console.log("📦 CryptoJS 缓存命中，长度: " + String(cached.length));
    try {
      eval(cached);
    } catch (_) {}
    if (typeof CryptoJS !== "undefined") return;
  }
  const url = "https://cdn.jsdelivr.net/npm/crypto-js@4.2.0/crypto-js.min.js";
  console.log("🌐 下载 CryptoJS:\n" + url);
  const res = await $task.fetch({ url });
  const body = res?.body || "";
  if (body) {
    console.log("📥 CryptoJS 下载完成，长度: " + String(body.length));
    $prefs.setValueForKey(body, CRYPTOJS_CACHE_KEY);
    eval(body);
  }
  if (typeof CryptoJS === "undefined") {
    throw new Error("CryptoJS 加载失败");
  }
}
