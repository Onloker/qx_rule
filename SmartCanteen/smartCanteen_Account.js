/******************************************
作者：Onloker
版本号：1.1.0
更新时间：2025-04-15 17:00
脚本说明：该脚本需要配合BoxJs，目前脚本还存在问题，未修复，主要原因为登录接口无法外网访问
BoxJs脚本地址：https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/BoxJs/Onloker_BoxJs.json

[task_local]
0 10 * * * https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/SmartCanteen/smartCanteen_Account.js, tag=智慧食堂签到, img-url=https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/icon/cornex.png, enabled=true
******************************************/

// 模拟登录
const tokenKey = "Authorization";
const usernameKey = "cornex.username";
const passwordKey = "cornex.password";

const username = $prefs.valueForKey(usernameKey);
const password = $prefs.valueForKey(passwordKey);

console.log(`[🔍] BoxJs 配置 - 账号: ${username}`);
console.log(`[🔍] BoxJs 配置 - 密码: ${password ? "已设置" : "未设置"}`);

if (!username || !password) {
  $notify("签到失败", "缺少账号信息", "请在 BoxJs 中配置账号和密码");
  console.log("[❌] 缺少账号或密码，终止流程");
  $done();
} else {
  const loginUrl = `https://dms.cn-np.com/apigateway/auth/oauth/token?grant_type=password&username=${username}&password=${encodeURIComponent(password)}`;

  const loginOptions = {
    url: loginUrl,
    method: "GET",
    headers: {
      "Accept": "application/json, text/plain, */*",
      "Accept-Encoding": "gzip, deflate, br, zstd",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
      "Authorization": "Basic c2NvOmRtcw==",
      "Origin": "https://bitools.cn-np.com",
      "Referer": "https://bitools.cn-np.com/",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
    }
  };

  console.log(`[📡] 准备发起登录请求：`);
  console.log(`[🔗] URL: ${loginOptions.url}`);
  console.log(`[📋] Headers: ${JSON.stringify(loginOptions.headers, null, 2)}`);

  $task.fetch(loginOptions).then(loginResp => {
    console.log("[📥] 收到登录响应，原始内容如下：");
    console.log(loginResp.body);

    try {
      const res = JSON.parse(loginResp.body);
      if (res.access_token) {
        const token = `Bearer ${res.access_token}`;
        console.log("[✅] 获取 access_token 成功：" + token);

        const oldToken = $prefs.valueForKey(tokenKey);
        if (oldToken !== token) {
          $prefs.setValueForKey(token, tokenKey);
          console.log("[📝] token 已更新为新值");
        } else {
          console.log("[ℹ️] 获取的 token 与原值一致，无需更新");
        }

        signIn(token); // 登录成功后签到
      } else {
        console.log("[❌] 登录响应未包含 access_token");
        $notify("获取 Token 失败", "", "未返回 access_token");
        $done();
      }
    } catch (e) {
      console.log("[❌] 登录响应 JSON 解析失败：" + e);
      $notify("获取 Token 失败", "", "解析响应失败：" + e);
      $done();
    }
  }, err => {
    console.log("[❌] 登录请求失败：" + err);
    $notify("获取 Token 失败", "", "请求失败：" + err);
    $done();
  });
}

function signIn(auth) {
  console.log("[🚀] 开始签到流程...");
  const signUrl = "https://smart-area-api.cn-np.com/shop/SignIn/handle";

  const options = {
    url: signUrl,
    method: "POST",
    headers: {
      "Host": "smart-area-api.cn-np.com",
      "Accept": "application/json, text/plain, */*",
      "Authorization": auth,
      "Accept-Language": "zh-CN,zh-Hans;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Content-Type": "application/json;charset=UTF-8",
      "Origin": "https://app.dms.cn-np.com",
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 HXMall CNBusiness/3.27.0; SCO_OREO",
      "Referer": "https://app.dms.cn-np.com/",
      "Connection": "keep-alive"
    },
    body: JSON.stringify({})
  };

  console.log(`[📡] 发起签到请求：`);
  console.log(`[🔗] URL: ${options.url}`);
  console.log(`[📋] Headers: ${JSON.stringify(options.headers, null, 2)}`);
  console.log(`[🧾] Body: ${options.body}`);

  $task.fetch(options).then(response => {
    console.log("[📥] 收到签到响应：");
    console.log(response.body);

    try {
      const res = JSON.parse(response.body);
      const msg = res.msg || "未知返回";
      const score = res.data?.score;

      if (typeof score !== "undefined") {
        console.log(`[🎉] 签到成功：${msg}，本次获得积分：${score}`);
        $notify("智慧食堂签到", "", `${msg}，本次获得积分：${score}`);
      } else {
        console.log(`[🎯] 签到返回消息：${msg}`);
        $notify("智慧食堂签到", "", msg);
      }
    } catch (e) {
      console.log("[❌] 签到响应 JSON 解析失败：" + e);
      $notify("签到失败", "", "解析响应失败：" + e);
    }
    $done();
  }, error => {
    console.log("[❌] 签到请求失败：" + error);
    $notify("签到失败", "", "网络请求失败：" + error);
    $done();
  });
}