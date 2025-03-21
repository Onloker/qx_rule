/******************************************
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
const API_1 = "https://cngm.cn-np.com/";
const API_2 = "https://smart-area-api.cn-np.com/shop/SignIn/handle";

// 监听请求头，获取Authorization
if (typeof $request !== 'undefined') {
    const headers = $request.headers;
    const authHeader = headers["Authorization"] || headers["authorization"];

    if (authHeader) {
        $.setdata(authHeader, TOKEN_KEY);
        $.msg("智慧食堂签到", "Token 捕获成功", authHeader);
    } else {
        $.msg("智慧食堂签到", "未捕获到 Token", "请检查请求是否包含 Authorization");
    }
    $.done();
}

// 签到主函数
!(async () => {
    const token = $.getdata(TOKEN_KEY);

    if (!token) {
        $.msg("智慧食堂签到", "❌ 未找到有效的 Token", "请先运行 App 以捕获 Token");
        $.done();
        return;
    }

    // 请求签到接口
    const response = await signIn(token);

    if (response) {
        $.msg("智慧食堂签到", "签到成功", `🎉 签到结果: ${response}`);
    } else {
        $.msg("智慧食堂签到", "签到失败", "请检查网络或 Token 是否有效");
    }
    $.done();
})();

// 签到请求
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

    try {
        const response = await httpRequest(options);
        return response;
    } catch (error) {
        $.logErr(error);
        return null;
    }
}

// HTTP 请求封装
async function httpRequest(options) {
    return new Promise((resolve, reject) => {
        $.http.post(options, (err, resp, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

// 环境类封装
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