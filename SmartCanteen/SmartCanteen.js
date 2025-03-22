/******************************************
版本号：1.0.10

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
function fetchAuthorization() {
    const url = "https://cngm.cn-np.com"; // 目标链接
    const options = {
        method: "POST",
        headers: {
            "User-Agent": "iosbusiness/3.27.0 (iPhone; iOS 17.1.1; Scale/3.00)",
        },
    };

    $httpClient.post(url, options, (error, response, data) => {
        if (error) {
            console.log("获取 Authorization 失败: " + error);
        } else {
            // 提取 Authorization 值
            const headers = response.headers;
            if (headers["Authorization"] && headers["Authorization"].startsWith("bearer")) {
                authorization = headers["Authorization"];
                console.log("成功获取 Authorization: " + authorization);

                // 可选择存储到本地，方便后续使用
                $persistentStore.write(authorization, "Authorization");
            } else {
                console.log("未找到有效的 Authorization 字段");
            }
        }
    });
}

// 自动签到功能
function autoSignIn() {
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

    $httpClient.post(signInUrl, options, (error, response, data) => {
        if (error) {
            console.log("签到失败: " + error);
        } else {
            try {
                const result = JSON.parse(data);
                if (result.code === 401) {
                    console.log("签到失败: " + result.msg);
                    $notification.post("签到通知", "签到失败", result.msg);
                } else {
                    console.log("签到成功: " + data);
                    $notification.post("签到通知", "签到成功", "成功完成智慧食堂签到！");
                }
            } catch (e) {
                console.log("解析返回结果失败: " + e);
            }
        }
    });
}

// 执行流程
fetchAuthorization();
// 延迟执行签到，确保获取到 Authorization 后运行
setTimeout(autoSignIn, 3000);
