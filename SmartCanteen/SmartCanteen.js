/******************************************
版本号：1.0.11

[mitm]
hostname = cngm.cn-np.com, smart-area-api.cn-np.com

[rewrite_local]
# 获取Token
^https://cngm\.cn-np\.com/ script-request-header https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/SmartCanteen/SmartCanteen.js

[task_local]
0 9 * * * https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/SmartCanteen/SmartCanteen.js, tag=智慧食堂签到, enabled=true
******************************************/

// 定义存储 Authorization 的变量
let authorization = "";

// 获取 Authorization 值并存储
async function fetchAuthorization() {
    const url = "https://cngm.cn-np.com"; // 目标链接
    const options = {
        method: "POST",
        headers: {
            "User-Agent": "iosbusiness/3.27.0 (iPhone; iOS 17.1.1; Scale/3.00)",
        },
    };

    try {
        const response = await fetch(url, options);
        const headers = response.headers;
        const auth = headers.get("Authorization");

        if (auth && auth.startsWith("bearer")) {
            authorization = auth;
            console.log("成功获取 Authorization: " + authorization);
        } else {
            console.log("未找到有效的 Authorization 字段");
        }
    } catch (error) {
        console.log("获取 Authorization 失败: " + error);
    }
}

// 自动签到功能
async function autoSignIn() {
    if (!authorization) {
        console.log("未找到 Authorization，无法签到");
        return;
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
        const response = await fetch(signInUrl, options);
        const data = await response.json();

        if (data.code === 401) {
            console.log("签到失败: " + data.msg);
        } else {
            console.log("签到成功: " + JSON.stringify(data));
        }
    } catch (error) {
        console.log("签到失败: " + error);
    }
}

// 执行流程
(async function() {
    await fetchAuthorization();
    await autoSignIn();
})();
