/******************************************
作者：Onloker
版本号：1.0.5
更新时间：2025-07-01 16:10

[task_local]
0 10 * * * https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/SmartCanteen/smartCanteen_Evaluation.js, tag=智慧食堂评价, img-url=https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/icon/cornex.png, enabled=true
******************************************/

(async () => {
  try {
    const token = $prefs.valueForKey("Authorization");
    console.log("✅ 动态读到 token: [" + token + "]");
    $notify("评价脚本读到 token", "", token ? token : "空");

    const fixedFields = {
      jobCode: $prefs.valueForKey("smartCanteen.jobCode") || "",
      userInfoId: $prefs.valueForKey("smartCanteen.userInfoId") || "",
      userCodeOrigin: $prefs.valueForKey("smartCanteen.userCodeOrigin") || "",
      companyName: $prefs.valueForKey("smartCanteen.companyName") || "",
      companyCode: $prefs.valueForKey("smartCanteen.companyCode") || "",
      loginUid: $prefs.valueForKey("smartCanteen.loginUid") || "",
      userNameOrigin: $prefs.valueForKey("smartCanteen.userNameOrigin") || "",
      remark: $prefs.valueForKey("smartCanteen.remark") || "",
      score: parseInt($prefs.valueForKey("smartCanteen.score") || "5", 10)
    };
    console.log("📦 fixedFields: " + JSON.stringify(fixedFields));

    const missing = Object.entries(fixedFields).filter(([k, v]) => !v).map(([k]) => k);
    if (!token || missing.length > 0) {
      let msg = !token ? "未获取到 token" : "缺失配置: " + missing.join(", ");
      console.log("❗ " + msg);
      $notify("智慧食堂自动评价失败", "", msg);
      return $done();
    }

    await run(token, fixedFields);
  } catch (err) {
    console.log("❗ 脚本异常:", err);
    $notify("智慧食堂脚本异常", "", String(err));
  }
  $done();
})();

async function run(token, fixedFields) {
  console.log("🔍 开始获取待评价列表...");
  const tradeIds = await getPendingComments(token);
  console.log(`📋 待评价单据数量: ${tradeIds.length}`);

  if (tradeIds.length === 0) {
    return $notify("智慧食堂自动评价", "", "暂无待评价单据");
  }

  let success = 0, fail = 0;
  for (const tradeId of tradeIds) {
    console.log(`➡️ 处理 tradeId: ${tradeId}`);
    try {
      const info = await getCommentInfo(token, tradeId);
      console.log("✅ 获取详情成功:", JSON.stringify(info));
      await submitComment(token, tradeId, info, fixedFields);
      console.log("✅ 提交评价成功");
      success++;
    } catch (e) {
      console.log("❌ 提交评价失败:", e);
      fail++;
    }
  }

  $notify("智慧食堂自动评价完成", "", `总数:${tradeIds.length}, ✅成功:${success}, ❌失败:${fail}`);
}

async function getPendingComments(token) {
  const url = "https://smart-area-api.cn-np.com/canteen/comment/myList";
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json, text/plain, */*",
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1)...",
    Origin: "https://app.dms.cn-np.com",
    Referer: "https://app.dms.cn-np.com/"
  };
  console.log("📤 请求待评价列表 headers:", JSON.stringify(headers));
  const res = await httpGet({ url, headers });
  console.log("📥 返回原始:", res);
  const json = JSON.parse(res);
  console.log("📋 返回 JSON:", JSON.stringify(json));
  return json?.data?.data?.map(x => x.tradeId) || [];
}

async function getCommentInfo(token, tradeId) {
  const url = `https://smart-area-api.cn-np.com/canteen/comment/getFoods?trade_id=${tradeId}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json, text/plain, */*",
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1)...",
    Origin: "https://app.dms.cn-np.com",
    Referer: "https://app.dms.cn-np.com/"
  };
  console.log("📤 请求详情 tradeId:", tradeId);
  const res = await httpGet({ url, headers });
  console.log("📥 返回原始:", res);
  const data = JSON.parse(res).data || {};
  return {
    meal_time: data.meal_time || "",
    firstStallName: data.menus?.[0]?.name || "",
    firstFoodName: data.menus?.[0]?.foods?.[0]?.name || "",
    canteenName: data.canteens?.[0]?.name || "",
    canteenCode: data.canteens?.[0]?.value || ""
  };
}

async function submitComment(token, tradeId, info, fixedFields) {
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
  console.log("📤 提交评价 body:", JSON.stringify(body));
  const res = await httpPost({ url, headers, body: JSON.stringify(body) });
  console.log("📥 提交返回原始:", res);
  const json = JSON.parse(res);
  if (json.code !== 200) throw new Error(json.msg || "提交失败");
}

// HTTP 封装
function httpGet(options) {
  return new Promise((resolve, reject) => {
    $task.fetch(options).then(r => resolve(r.body)).catch(e => reject(e));
  });
}
function httpPost(options) {
  return new Promise((resolve, reject) => {
    $task.fetch({ ...options, method: "POST" }).then(r => resolve(r.body)).catch(e => reject(e));
  });
}
