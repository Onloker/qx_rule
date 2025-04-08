/******************************************
作者：Onloker
版本号：1.0.24
更新时间：2025-04-08 16:50

[mitm]
hostname = cngm.cn-np.com

[rewrite_local]
# 获取Token
^https:\/\/cngm\.cn-np\.com/ url script-request-header https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/SmartCanteen/SmartCanteen.js

[task_local]
0 9 * * * https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/SmartCanteen/SmartCanteen.js, tag=智慧食堂签到, img-url=https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/icon/cornex.png, enabled=true
******************************************/

// 智慧食堂 - 抓取 Authorization + 自动签到（适用于 Quantumult X）
const tokenKey = "Authorization";

// 抓 Authorization（用于 rewrite 请求头脚本）
if (typeof $request !== "undefined") {
  const newToken = $request.headers?.Authorization;
  const oldToken = $prefs.valueForKey(tokenKey);

  if (newToken) {
    if (newToken !== oldToken) {
      $prefs.setValueForKey(newToken, tokenKey);
      $notify("抓取 Authorization 成功", "", `已更新: ${newToken}`);
    } else {
      console.log("Authorization 未变化，无需更新");
    }
  } else {
    $notify("抓取 Authorization 失败", "", "未在请求头中发现 Authorization");
  }

  $done();
}

// 定时任务 - 自动签到逻辑
if (typeof $request === "undefined") {
  const authorization = $prefs.valueForKey(tokenKey);

  if (!authorization) {
    $notify("签到失败", "", "未获取到 Authorization，请先抓包！");
    $done();
  } else {
    const signUrl = "https://smart-area-api.cn-np.com/shop/SignIn/handle";
    const options = {
      url: signUrl,
      method: "POST",
      headers: {
        "Authorization": authorization,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    };

    $task.fetch(options).then(
      (response) => {
        try {
          const data = JSON.parse(response.body);
          const msg = data.msg || "未知返回";
          $notify("智慧食堂签到", "", msg);
        } catch (e) {
          $notify("签到失败", "", "返回内容解析失败：" + e);
        }
        $done();
      },
      (error) => {
        $notify("签到失败", "", "网络请求失败：" + error);
        $done();
      }
    );
  }
}