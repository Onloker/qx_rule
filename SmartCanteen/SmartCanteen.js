/******************************************
[mitm]
hostname = cngm.cn-np.com, smart-area-api.cn-np.com

[rewrite_local]
# 获取Token
^https://cngm\.cn-np\.com/ script-request-header https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/SmartCanteen/SmartCanteen.js

[task_local]
0 9 * * * https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/SmartCanteen/SmartCanteen.js, tag=智慧食堂签到, enabled=true
******************************************/

const scriptName = "SmartCanteen";
const tokenKey = "SmartCanteen_Token";
const signInUrl = "https://smart-area-api.cn-np.com/shop/SignIn/handle";

const $ = new Env(scriptName);

// 获取 Authorization 并存储
if ($request && $request.headers && $request.headers.Authorization) {
    const token = $request.headers.Authorization;
    if (token) {
        $.setdata(token, tokenKey);
        $.log(`[${scriptName}] 成功存储 Token: ${token}`);
        $.msg(scriptName, "✅ 获取 Authorization 成功", token);
    }
    $.done();
    return;
}

// 签到任务
if (typeof $request === "undefined") {
    const token = $.getdata(tokenKey);
    if (!token) {
        $.msg(scriptName, "❌ Token 获取失败", "请先打开 App 以存储 Authorization");
        $.done();
        return;
    }
    doSignIn(token);
}

function doSignIn(token) {
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
            $.msg(scriptName, "❌ 签到请求失败", JSON.stringify(error));
            $.log(`❌ 签到请求失败: ${JSON.stringify(error)}`);
        } else {
            $.msg(scriptName, "✅ 签到成功", `服务器响应: ${data}`);
            $.log(`✅ 签到成功: ${data}`);
        }
        $.done();
    });
}

function Env(t) {
    this.name = t;
    this.data = {};
    this.logs = [];
    this.logSeparator = "\n";
    this.startTime = new Date().getTime();
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