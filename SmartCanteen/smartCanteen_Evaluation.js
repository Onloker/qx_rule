/******************************************
作者：Onloker
版本号：1.0.1
更新时间：2025-6-28 10:40

[task_local]
0 10 * * * https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/SmartCanteen/smartCanteen_Evaluation.js, tag=智慧食堂评价, img-url=https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/icon/cornex.png, enabled=true
******************************************/

// 读取 token
const token = $prefs.valueForKey("smartCanteen_token");

// BoxJs 中读取固定参数
const fixedFields = {
  jobCode: $prefs.valueForKey("smartCanteen.jobCode") || "",
  userInfoId: $prefs.valueForKey("smartCanteen.userInfoId") || "",
  userCodeOrigin: $prefs.valueForKey("smartCanteen.userCodeOrigin") || "",
  companyName: $prefs.valueForKey("smartCanteen.companyName") || "",
  companyCode: $prefs.valueForKey("smartCanteen.companyCode") || "",
  loginUid: $prefs.valueForKey("smartCanteen.loginUid") || "",
  userNameOrigin: $prefs.valueForKey("smartCanteen.userNameOrigin") || "",
  remark: $prefs.valueForKey("smartCanteen.remark") || "",
  score: parseInt($prefs.valueForKey("smartCanteen.score") || "", 10)
};

// 校验必填项
const requiredFields = [
  "jobCode", "userInfoId", "userCodeOrigin",
  "companyName", "companyCode", "loginUid",
  "userNameOrigin", "remark", "score"
];

const missing = requiredFields.filter(key => !fixedFields[key]);
if (!token || missing.length > 0) {
  let msg = !token ? "未获取到 token" : "BoxJs 配置缺失: " + missing.join(", ");
  console.log("❗" + msg);
  $notify("智慧食堂自动评价", "", "❗" + msg);
  $done();
} else {
  run();
}

async function run() {
  try {
    console.log("🔍 开始获取待评价列表...");
    const tradeIds = await getPendingComments(token);
    console.log(`📋 共检测到待评价单据: ${tradeIds.length} 条`);

    if (tradeIds.length === 0) {
      $notify("智慧食堂自动评价", "", "暂无待评价单据");
    } else {
      let successCount = 0, failCount = 0;

      for (const tradeId of tradeIds) {
        console.log(`➡️ 正在处理 tradeId: ${tradeId}`);
        try {
          const info = await getCommentInfo(token, tradeId);
          console.log(`✅ 获取详情成功:`, JSON.stringify(info));
          await submitComment(token, tradeId, info);
          console.log(`✅ 提交评价成功 tradeId=${tradeId}`);
          successCount++;
        } catch (err) {
          console.log(`❌ 单据 ${tradeId} 评价失败: ${err}`);
          failCount++;
        }
      }

      console.log(`🎉 评价完成，总数: ${tradeIds.length}, 成功: ${successCount}, 失败: ${failCount}`);
      $notify(
        "智慧食堂自动评价完成",
        "",
        `总数: ${tradeIds.length}, ✅ 成功: ${successCount}, ❌ 失败: ${failCount}`
      );
    }
  } catch (error) {
    console.log("❗脚本执行出错:", error);
    $notify("智慧食堂自动评价出错", "", String(error));
  }

  $done();
}

// 获取待评价列表
async function getPendingComments(token) {
  const url = "https://smart-area-api.cn-np.com/canteen/comment/myList";
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json, text/plain, */*",
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X)...",
    Origin: "https://app.dms.cn-np.com",
    Referer: "https://app.dms.cn-np.com/"
  };

  const response = await httpGet({ url, headers });
  const json = JSON.parse(response);
  const list = json?.data?.data || [];
  console.log(`📋 待评价列表返回：${JSON.stringify(list)}`);
  return list.map(item => item.tradeId);
}

// 获取评价详情
async function getCommentInfo(token, tradeId) {
  const url = `https://smart-area-api.cn-np.com/canteen/comment/getFoods?trade_id=${tradeId}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json, text/plain, */*",
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X)...",
    Origin: "https://app.dms.cn-np.com",
    Referer: "https://app.dms.cn-np.com/"
  };

  const response = await httpGet({ url, headers });
  const json = JSON.parse(response);
  const data = json.data || {};

  return {
    meal_time: data.meal_time || "",
    firstStallName: data.menus?.[0]?.name || "",
    firstFoodName: data.menus?.[0]?.foods?.[0]?.name || "",
    canteenName: data.canteens?.[0]?.name || "",
    canteenCode: data.canteens?.[0]?.value || ""
  };
}

// 提交评价
async function submitComment(token, tradeId, info) {
  const url = "https://smart-area-api.cn-np.com/canteen/comment/submit";
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };

  const body = {
    jobCode: fixedFields.jobCode,
    userInfoId: fixedFields.userInfoId,
    userCodeOrigin: fixedFields.userCodeOrigin,
    companyName: fixedFields.companyName,
    companyCode: fixedFields.companyCode,
    loginUid: fixedFields.loginUid,
    userNameOrigin: fixedFields.userNameOrigin,
    remark: fixedFields.remark,
    trade_id: tradeId,
    meal_time: info.meal_time,
    canteen_name: info.canteenName,
    canteen_code: info.canteenCode,
    comment: [
      {
        stall_name: info.firstStallName,
        food_name: info.firstFoodName,
        score: fixedFields.score
      }
    ],
    attachment: [],
    groupCodeOrigin: []
  };

  console.log("📦 提交评价数据：", JSON.stringify(body));
  const res = await httpPost({ url, headers, body: JSON.stringify(body) });
  const json = JSON.parse(res);
  console.log(`📨 提交评价接口返回: ${JSON.stringify(json)}`);
  if (json.code !== 200) throw new Error(json.msg || "提交评价失败");
}

// HTTP 封装
function httpGet(options) {
  return new Promise((resolve, reject) => {
    $task.fetch(options).then(response => resolve(response.body)).catch(error => reject(error));
  });
}

function httpPost(options) {
  return new Promise((resolve, reject) => {
    $task.fetch({ ...options, method: "POST" }).then(response => resolve(response.body)).catch(error => reject(error));
  });
}