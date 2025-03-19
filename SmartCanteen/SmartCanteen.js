/******************************************
 * @name 智慧食堂签到
 * @author Onloker
 * @update 20250319
 * @version 1.0.0
 ******************************************
 * 本脚本用于 Quantumult X 运行，自动签到。
 ******************************************/

[mitm]
hostname = cngm.cn-np.com, smart-area-api.cn-np.com

[rewrite_local]
# 获取Token
^https://cngm\.cn-np\.com/ script-request-header https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/SmartCanteen/SmartCanteen.js

[task_local]
0 9 * * * https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/SmartCanteen/SmartCanteen.js, tag=智慧食堂签到, enabled=true

const scriptName = "SmartCanteen";
const tokenKey = "SmartCanteen_Token";
const signInUrl = "https://smart-area-api.cn-np.com/shop/SignIn/handle";

const $ = new Env(scriptName);

// 获取 Authorization 并存储
if (typeof $request !== "undefined" && $request.headers && $request.headers.Authorization) {
    const token = $request.headers.Authorization;
    $.setdata(token, tokenKey);
    $.log(`[${scriptName}] 获取并存储 Token: ${token}`);
    $.msg(scriptName, "成功获取 Authorization", token);
    $.done();
    return;
}

// 定时签到任务
if (typeof $request === "undefined") {
    const token = $.getdata(tokenKey);
    if (!token) {
        $.msg(scriptName, "❌ Token 未获取，无法签到", "请先打开 App 获取 Authorization");
        $.done();
        return;
    }
    signIn(token);
}

function signIn(token) {
    const headers = {
        "Authorization": token,
        "Content-Type": "application/json"
    };
    const request = {
        url: signInUrl,
        headers: headers,
        body: "{}",
        method: "POST"
    };
    $.post(request, (error, response, data) => {
        if (error) {
            $.msg(scriptName, "❌ 签到请求失败", error);
            $.log(`签到请求失败: ${JSON.stringify(error)}`);
        } else {
            $.msg(scriptName, "✅ 签到成功", `响应: ${data}`);
            $.log(`签到成功: ${data}`);
        }
        $.done();
    });
}

function Env(t) {
    this.name = t;
    this.data = null;
    this.dataFile = "box.dat";
    this.logs = [];
    this.isMute = false;
    this.isNeedRewrite = false;
    this.logSeparator = "\n";
    this.encoding = "utf-8";
    this.startTime = (new Date).getTime();
    this.setdata = (val, key) => $prefs.setValueForKey(val, key);
    this.getdata = key => $prefs.valueForKey(key);
    this.msg = (title, subtitle, body) => $notify(title, subtitle, body);
    this.log = message => console.log(message);
    this.post = (options, callback) => {
        $httpClient.post(options, (error, response, body) => {
            callback(error, response, body);
        });
    };
    this.done = () => $done();
}