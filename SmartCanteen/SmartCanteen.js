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

const COOKIE_KEY = "AUTHORIZATION_TOKEN";

/**
 * 获取 Token 逻辑
 */
function getAuthToken() {
    if (typeof $request === "undefined" || !$request.headers) {
        $notify("获取 Token 失败", "", "未能捕获请求，请检查 Quantumult X 配置");
        return $done({});
    }
	
	let token = $request.headers.Authorization || "";
    if (token) {
        $prefs.setValueForKey(token, COOKIE_KEY);
        $notify("Token 获取成功", "", token);
    } else {
        $notify("获取 Token 失败", "", "未能找到 Authorization 头");
    }
    return $done({});
}

/**
 * 签到逻辑
 */
function signIn() {
    let authToken = $prefs.valueForKey(COOKIE_KEY);
    if (!authToken) {
        $notify("签到失败", "未找到 Token", "请先手动获取 Token");
        return;
    }
	
	let options = {
        url: "https://smart-area-api.cn-np.com/shop/SignIn/handle",
        method: "POST",
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
        let result = response.body || "";
        try {
            let json = JSON.parse(result);
            if (json.success) {
                $notify("签到成功", "", "签到已完成");
            } else {
                $notify("签到失败", "", json.message || "未知错误");
            }
        } catch (e) {
            $notify("签到异常", "", "无法解析服务器返回的数据");
        }
        return $done();
    }).catch(error => {
        $notify("签到失败", "", error.message);
        return $done();
    });
}

// 判断执行逻辑
if (typeof $request !== "undefined") {
    getAuthToken();
} else {
    signIn();
}