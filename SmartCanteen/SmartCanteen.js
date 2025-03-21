/******************************************
版本号：1.0.7

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

// 主函数入口
!(async () => {
    try {
        const token = $.getdata(TOKEN_KEY);

        if (!token && typeof $request !== 'undefined') {
            // 捕获 Authorization
            $.log("开始捕获 Authorization...");
            const headers = $request.headers;
            const authHeader = headers["Authorization"] || headers["authorization"];

            if (authHeader && authHeader.startsWith("bearer ")) {
                $.setdata(authHeader, TOKEN_KEY);
                $.msg("智慧食堂签到", "Token 捕获成功", authHeader);
                $.log("已捕获并存储最新的 Token。");
            } else {
                $.msg("智慧食堂签到", "未捕获到有效的 Authorization");
                $.log("捕获失败，没有有效的 Authorization 值。");
            }
            $.done();
            return;
        }

        if (token) {
            // 调用签到逻辑
            $.log(`读取到存储的 Token: ${token}`);
            const response = await signIn(token);

            if (response && response.success) {
                $.msg("智慧食堂签到", "签到成功", `🎉 签到结果: ${JSON.stringify(response)}`);
            } else {
                $.msg("智慧食堂签到", "签到失败", response ? response.message : "未知错误");
            }
        } else {
            $.msg("智慧食堂签到", "未找到有效的 Token", "请先打开 App 捕获 Token");
        }
    } catch (error) {
        $.logErr("脚本运行失败: " + error);
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

    $.log("准备发起签到请求...");

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