/******************************************
版本号：1.0.5

[mitm]
hostname = cngm.cn-np.com, smart-area-api.cn-np.com

[rewrite_local]
# 获取Token
^https://cngm\.cn-np\.com/ script-request-header https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/SmartCanteen/SmartCanteen.js

[task_local]
0 9 * * * https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/SmartCanteen/SmartCanteen.js, tag=智慧食堂签到, enabled=true
******************************************/

const $ = new Env("智慧食堂签到");
const TOKEN_KEY = "smartcanteen_auth_token";
const API_2 = "https://smart-area-api.cn-np.com/shop/SignIn/handle";

// 捕获 Authorization
if (typeof $request !== 'undefined') {
    $.log("开始捕获 Authorization...");
    try {
        const headers = $request.headers;
        const authHeader = headers["Authorization"] || headers["authorization"];

        if (authHeader && authHeader.startsWith("bearer ")) {
            $.setdata(authHeader, TOKEN_KEY);
            $.msg("智慧食堂签到", "Token 捕获成功", authHeader);
        } else {
            $.msg("智慧食堂签到", "未捕获到有效的 Authorization");
        }
    } catch (error) {
        $.logErr("捕获 Authorization 失败: " + error);
    }
    $.done();
    return; // 捕获逻辑结束，退出脚本
}

// 定时任务逻辑
!(async () => {
    $.log("定时任务执行中...");
    try {
        // 读取存储的 Token
        const token = $.getdata(TOKEN_KEY);
        if (!token) {
            $.msg("智慧食堂签到", "未找到有效的 Token", "请先打开 App 捕获 Token");
            return;
        }

        $.log(`读取到 Token: ${token}`);

        // 调用签到接口
        const response = await signIn(token);
        if (response && response.success) {
            $.msg("智慧食堂签到", "签到成功", `🎉 签到结果: ${JSON.stringify(response)}`);
        } else {
            $.msg("智慧食堂签到", "签到失败", response ? response.message : "未知错误");
        }
    } catch (error) {
        $.logErr("定时任务执行失败: " + error);
    } finally {
        $.done();
    }
})();

// 签到请求逻辑
async function signIn(token) {
    const headers = {
        "Authorization": token,
        "Content-Type": "application/json"
    };

    const options = {
        url: API_2,
        headers: headers,
        method: "POST"
    };

    return new Promise((resolve, reject) => {
        $.http.post(options, (err, resp, data) => {
            if (err) {
                $.logErr("签到请求失败: " + err);
                reject(err);
            } else {
                try {
                    $.log("签到响应数据: " + data);
                    resolve(JSON.parse(data));
                } catch (parseErr) {
                    $.logErr("解析响应失败: " + parseErr);
                    reject(parseErr);
                }
            }
        });
    });
}

// 环境封装类
function Env(name) {
    this.name = name;
    this.log = (msg) => console.log(`[${this.name}] ${msg}`);
    this.logErr = (err) => console.error(`[${this.name}]`, err);
    this.msg = (title, subtitle, content) => console.log(`\n${title}\n${subtitle || ''}\n${content || ''}`);
    this.getdata = (key) => $prefs.valueForKey(key);
    this.setdata = (val, key) => $prefs.setValueForKey(val, key);
    this.done = () => $done();
    this.http = {
        post: (options, callback) => {
            const request = require("request");
            request.post(options, callback);
        }
    };
}