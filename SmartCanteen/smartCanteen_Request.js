/******************************************
作者：Onloker
版本号：1.1.8
更新时间：2025-04-11 10:00

[mitm]
hostname = cngm.cn-np.com

[rewrite_local]
# 获取Token
^https:\/\/cngm\.cn-np\.com/ url script-request-header https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/SmartCanteen/SmartCanteen.js

[task_local]
0 10 * * * https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/SmartCanteen/SmartCanteen.js, tag=智慧食堂签到, img-url=https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/icon/cornex.png, enabled=true
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
      console.log("获取 Authorization 成功，更新为：" + newToken);
      $notify("获取 Token 成功", "", `${newToken}`);
    } else {
      console.log("Authorization 未变化，无需更新");
    }
  } else {
    console.log("获取 Authorization 失败：未在请求头中发现 Authorization");
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
        "Host": "smart-area-api.cn-np.com",
        "Accept": "application/json, text/plain, */*",
        "Authorization": authorization,
        "Sec-Fetch-Site": "same-site",
        "Accept-Language": "zh-CN,zh-Hans;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Sec-Fetch-Mode": "cors",
        "Content-Type": "application/json;charset=UTF-8",
        "Origin": "https://app.dms.cn-np.com",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 HXMall CNBusiness/3.27.0; SCO_OREO",
        "Referer": "https://app.dms.cn-np.com/",
        "Connection": "keep-alive",
        "Sec-Fetch-Dest": "empty"
      },
      body: JSON.stringify({}) // 根据实际需要填写内容
    };

    console.log("准备发送签到请求，信息如下：");
    console.log("请求 URL: " + options.url);
    console.log("请求 Headers:");
    console.log(JSON.stringify(options.headers, null, 2));
    console.log("请求 Body:");
    console.log(options.body);

    $task.fetch(options).then(
      (response) => {
        console.log("收到签到响应，原始内容如下：");
        console.log(response.body);

        try {
          const data = JSON.parse(response.body);
          const msg = data.msg || "未知返回";

          // 如果存在 data 字段，说明有积分信息
          if (data.data && typeof data.data.score !== "undefined") {
            const score = data.data.score;
            console.log(`智慧食堂签到返回消息: ${msg}，本次获得积分：${score}`);
            $notify("智慧食堂签到", "", `${msg}，本次获得积分：${score}`);
          } else {
            // 没有 data 字段，仅显示 msg
            console.log("智慧食堂签到返回消息：" + msg);
            $notify("智慧食堂签到", "", msg);
          }

        } catch (e) {
          console.log("签到失败：解析响应 JSON 失败: " + e);
          $notify("智慧食堂签到失败", "", "返回内容解析失败：" + e);
        }
        $done();
      },
      (error) => {
        console.log("智慧食堂签到失败：网络请求失败，错误：" + error);
        $notify("智慧食堂签到失败", "", "网络请求失败：" + error);
        $done();
      }
    );
  }
}