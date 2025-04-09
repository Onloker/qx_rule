/******************************************
作者：Onloker
版本号：1.1.5
更新时间：2025-04-09 10:45

[mitm]
hostname = cngm.cn-np.com

[rewrite_local]
# 获取Token
^https:\/\/cngm\.cn-np\.com/ url script-request-header https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/SmartCanteen/SmartCanteen.js

[task_local]
0 9 * * * https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/SmartCanteen/SmartCanteen.js, tag=智慧食堂签到, img-url=https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/icon/cornex.png, enabled=true
******************************************/

// 获取 Token
const tokenKey = "Authorization";

if (typeof $request !== "undefined") {
  console.log("触发获取 Authorization 请求");
  console.log("请求头如下：");
  console.log(JSON.stringify($request.headers, null, 2));

  const newToken = $request.headers?.Authorization;
  const oldToken = $prefs.valueForKey(tokenKey);

  if (newToken) {
    if (newToken !== oldToken) {
      $prefs.setValueForKey(newToken, tokenKey);
      console.log("Authorization 已更新为：" + newToken);
      $notify("获取 Token 成功", "", `${newToken}`);
    } else {
      console.log("Authorization 未变化，无需更新");
    }
  } else {
    console.log("获取 Authorization 失败", "", "未在请求头中发现 Authorization");
    $notify("获取 Token 失败", "", "未发现 Token");
  }

  $done();
}

// 自动签到
if (typeof $request === "undefined") {
  console.log("触发自动签到任务");
  const authorization = $prefs.valueForKey(tokenKey);

  if (!authorization) {
    console.log("无法获取 Authorization，取消签到流程");
	$notify("签到失败", "", "未获取到 Token！");
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

    console.log("准备发送签到请求，信息如下：");
    console.log("请求 URL: " + options.url);
    console.log("请求 Headers:");
    console.log(JSON.stringify(options.headers, null, 2));

    $task.fetch(options).then(
      (response) => {
        console.log("收到签到响应，原始内容如下：");
        console.log(response.body);

        try {
          const data = JSON.parse(response.body);
          const msg = data.msg || "未知返回";
          console.log("解析后的签到提示信息：" + msg);
          $notify("智慧食堂签到", "", msg);
        } catch (e) {
          console.log("解析响应 JSON 失败: " + e);
          $notify("签到失败", "", "返回内容解析失败：" + e);
        }
        $done();
      },
      (error) => {
        console.log("签到请求失败: " + error);
        $notify("签到失败", "", "网络请求失败：" + error);
        $done();
      }
    );
  }
}