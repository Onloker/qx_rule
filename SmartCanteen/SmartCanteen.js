/******************************************
版本号：1.0.17

[mitm]
hostname = cngm.cn-np.com, smart-area-api.cn-np.com

[rewrite_local]
# 获取Token
^https:\/\/cngm\.cn-np\.com/ url script-request-header https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/SmartCanteen/SmartCanteen.js

[task_local]
0 9 * * * https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/SmartCanteen/SmartCanteen.js, tag=智慧食堂签到, enabled=true
******************************************/

// 定义存储 Authorization 的变量
let authorization = "";

// 获取 Authorization 值并存储
function captureAuthorization() {
    if ($request !== undefined) {
        const authorizationArg = $request?.headers?.["Authorization"];
        if (authorizationArg && authorizationArg.startsWith("bearer")) {
            authorization = authorizationArg;
            console.log("成功捕获 Authorization: " + authorization);
            $prefs.setValueForKey(authorization, "Authorization"); // 存储 Authorization
            $notify("获取 Authorization 成功", "", authorization);
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

    const signInUrl = "https://smart-area-api.cn-np.com/shop/SignIn/handle"; // 智慧食堂签到接口
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
            return;
        }

        const data = await response.json();

        if (data.code === 401) {
            console.log("签到失败: " + data.msg);
            $notify("签到失败", "", data.msg);
        } else {
            console.log("签到成功: " + JSON.stringify(data));
            $notify("签到成功", "", "成功完成智慧食堂签到！");
        }
    } catch (error) {
        console.log("签到失败: " + error);
    }
}

// 判断是否是获取 Authorization 的请求
if ($request !== undefined) {
    captureAuthorization();
    $done({});
} else {
    // 执行签到流程
    (async function () {
        try {
            await autoSignIn();
        } catch (error) {
            console.log("脚本运行错误: " + error.message);
        }
    })();
}
