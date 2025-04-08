/******************************************
作者：Onloker
版本号：1.1.2
更新时间：2025-04-08 17:18

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
  const newToken = $request.headers?.Authorization;
  const oldToken = $prefs.valueForKey(tokenKey);

  if (newToken) {
    if (newToken !== oldToken) {
      $prefs.setValueForKey(newToken, tokenKey);
	  console.log("获取 Authorization 成功，Authorization： " + newToken);
      $notify("获取 Token 成功");
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
  const authorization = $prefs.valueForKey(tokenKey);

  if (!authorization) {
	console.log("签到失败", "", "未获取到 Authorization，请先获取Authorization！");
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

    $task.fetch(options).then(
      (response) => {
        try {
          const data = JSON.parse(response.body);
          const msg = data.msg || "未知返回";
		  console.log("智慧食堂签到："\n + msg);
          $notify("智慧食堂签到", "", msg);
        } catch (e) {
          console.log("签到失败", "", "返回内容解析失败：" + e);
		  $notify("签到失败", "", "返回内容解析失败：" + e);
        }
        $done();
      },
      (error) => {
		console.log("签到失败", "", "网络请求失败：" + error);
        $notify("签到失败", "", "网络请求失败：" + error);
        $done();
      }
    );
  }
}