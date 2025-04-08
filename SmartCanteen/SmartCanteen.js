/******************************************
作者：Onloker
版本号：1.0.23
更新时间：2025-04-08 16:40

[mitm]
hostname = cngm.cn-np.com, smart-area-api.cn-np.com

[rewrite_local]
# 获取Token
^https:\/\/cngm\.cn-np\.com/ url script-request-header https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/SmartCanteen/SmartCanteen.js

[task_local]
0 9 * * * https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/SmartCanteen/SmartCanteen.js, tag=智慧食堂签到, img-url=https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/icon/cornex.png, enabled=true
******************************************/

// 抓 Authorization + 签到
let url = $request.url;
let method = $request.method;
let headers = $request.headers;

const tokenKey = "Authorization";

if (url.includes("/user/info") && method === "GET" && headers?.Authorization) {
    // 抓取 Authorization
    const newAuth = headers.Authorization;
    const oldAuth = $prefs.valueForKey(tokenKey);

    if (newAuth && newAuth !== oldAuth) {
        $prefs.setValueForKey(newAuth, tokenKey);
        $notify("抓取 Authorization 成功", "", `已更新: ${newAuth}`);
    } else {
        console.log("Authorization 未变化，无需更新");
    }

    $done();
} else {
    // 签到逻辑
    const authorization = $prefs.valueForKey(tokenKey);
    if (!authorization) {
        $notify("签到失败", "", "未获取到有效的 Authorization，请先抓取");
        $done();
    } else {
        const signInUrl = "https://smart-area-api.cn-np.com/shop/SignIn/handle";
        const options = {
            url: signInUrl,
            method: "POST",
            headers: {
                "Authorization": authorization,
                "Content-Type": "application/x-www-form-urlencoded",
            },
        };

        $task.fetch(options).then(response => {
            try {
                const data = JSON.parse(response.body);
                const msg = data.msg || "未知返回";
                $notify("智慧食堂签到", "", msg);
            } catch (e) {
                $notify("签到失败", "", "响应解析失败：" + e);
            }
            $done();
        }, error => {
            $notify("签到失败", "", "网络请求失败：" + error);
            $done();
        });
    }
}
