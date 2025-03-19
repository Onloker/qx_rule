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
^https://cngm\.cn-np\.com/ script-request-header quantumultx_signin.js

[task_local]
0 9 * * * https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/SmartCanteen/SmartCanteen.js, tag=智慧食堂签到, enabled=true

const $task = typeof $task !== "undefined" ? $task : null;
const $prefs = typeof $prefs !== "undefined" ? $prefs : null;
const $notify = typeof $notify !== "undefined" ? $notify : null;

const COOKIE_KEY = "AUTHORIZATION_TOKEN";

/**
 * 获取 Token 逻辑
 */
function getAuthToken() {
    const headers = $request.headers;
    if (headers && headers.Authorization) {
        let token = headers.Authorization;
        console.log("[获取 Token]:", token);
        $prefs.setValueForKey(token, COOKIE_KEY);
    } else {
        console.log("[错误]: 未能获取 Token，请检查请求头");
    }
    $done({});
}

/**
 * 签到逻辑
 */
function signIn() {
    let authToken = $prefs.valueForKey(COOKIE_KEY);
    if (!authToken) {
        console.log("[错误]: 请先获取 Authorization Token 后再尝试签到！");
        $notify("签到失败", "未找到 Token", "请先手动获取 Token");
        return;
    }

    let options = {
        url: "https://smart-area-api.cn-np.com/shop/SignIn/handle",
        headers: {
            "Host": "smart-area-api.cn-np.com",
            "Authorization": authToken,
            "Accept": "*/*",
            "User-Agent": "iosbusiness/3.27.0 (iPhone; iOS 17.1.1; Scale/3.00)",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Connection": "keep-alive",
            "targetTenant": "HK900000"
        }
    };
	
	$task.fetch(options).then(response => {
        console.log("[签到结果]:", response.body);
        $notify("签到成功", "", "签到已完成");
        $done();
    }).catch(error => {
        console.error("[签到失败]:", error);
        $notify("签到失败", "", error.message);
        $done();
    });
}

if (typeof $request !== "undefined") {
    getAuthToken();
} else {
    signIn();
}