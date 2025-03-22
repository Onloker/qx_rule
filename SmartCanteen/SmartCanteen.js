/******************************************
版本号：1.0.14

[mitm]
hostname = cngm.cn-np.com, smart-area-api.cn-np.com

[rewrite_local]
# 获取Token
^https://cngm\.cn-np\.com/ script-request-header https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/SmartCanteen/SmartCanteen.js

[task_local]
0 9 * * * https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/SmartCanteen/SmartCanteen.js, tag=智慧食堂签到, enabled=true
******************************************/

// 定义存储 Authorization 的变量
let authorization = "bearer 5f249fe1-debe-4283-854b-42c550ab1c86"; // 示例值，实际需要替换为真实值

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

        if (!response.ok) {
            console.log("签到请求失败，状态码: " + response.status);
            return;
        }

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
    try {
        await autoSignIn();
    } catch (error) {
        console.log("脚本运行错误: " + error.message);
    }
})();
