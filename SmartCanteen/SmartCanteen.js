/******************************************
作者：Onloker
版本号：1.0.20
更新时间：2025-04-08 16:24

[mitm]
hostname = cngm.cn-np.com, smart-area-api.cn-np.com

[rewrite_local]
# 获取Token
^https:\/\/cngm\.cn-np\.com/ url script-request-header https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/SmartCanteen/SmartCanteen.js

[task_local]
0 9 * * * https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/SmartCanteen/SmartCanteen.js, tag=智慧食堂签到, img-url=https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/icon/cornex.png, enabled=true
******************************************/

// 定义存储 Authorization 的变量
let authorization = "";

// 获取 Authorization 值并存储（只在 Authorization 变化时才通知）
function captureAuthorization() {
    if ($request !== undefined) {
        const authorizationArg = $request?.headers?.["Authorization"];
        if (authorizationArg && authorizationArg.startsWith("bearer")) {
            const oldAuth = $prefs.valueForKey("Authorization") || "";
            if (authorizationArg !== oldAuth) {
                authorization = authorizationArg;
                console.log("捕获新的 Authorization: " + authorization);
                $prefs.setValueForKey(authorization, "Authorization"); // 存储新的 Authorization
                $notify("获取 Authorization 成功", "", authorization);
            } else {
                console.log("Authorization 未变化，无需通知");
            }
        } else {
            console.log("未找到有效的 Authorization, headers:");
        }
    } else {
        console.log("$request 未定义，无法捕获 Authorization");
    }
}

// 自动签到功能
async function autoSignIn() {
    if (!authorization) {
        authorization = $prefs.valueForKey("Authorization") || "";
        if (!authorization) {
            console.log("未找到 Authorization，无法签到");
            return;
        }
    }

    const signInUrl = "https://smart-area-api.cn-np.com/shop/SignIn/handle";
    const options = {
        method: "POST",
        headers: {
            "Authorization": authorization,
            "Content-Type": "application/x-www-form-urlencoded",
        },
    };

    try {
        const response = await $task.fetch(signInUrl, options);

        if (!response?.ok) {
            console.log("签到请求失败，状态码: " + response.status);
            $notify("签到失败", "HTTP错误", `状态码: ${response.status}`);
            return;
        }

        const data = await response.json();
        console.log("签到返回内容：", JSON.stringify(data));

        if (data.code === 200) {
            $notify("签到成功", "", "成功完成智慧食堂签到！");
        } else {
            const msg = JSON.stringify(data); // 格式化整个响应内容
            $notify("签到失败", "服务器返回如下信息", msg);
        }
    } catch (error) {
        console.log("签到异常: " + error);
        $notify("签到失败", "发生异常", error.message || String(error));
    }
}