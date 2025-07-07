/******************************************
作者：Onloker
版本号：1.1.0
更新时间：2025-07-07 09:00

[task_local]
0 10,14,20 * * * https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/SmartCanteen/smartCanteen_Evaluation.js, tag=智慧食堂评价, img-url=https://raw.githubusercontent.com/Onloker/qx_rule/refs/heads/main/icon/cornex.png, enabled=true
******************************************/

(async () => {
  try {
    const token = $prefs.valueForKey("Authorization") || "";
    console.log("✅ 读取到 token: [" + token + "]");

    if (!token) {
      $notify("智慧食堂自动评价失败", "", "❗未获取到 token");
      return $done();
    }

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
    console.log("📦 fixedFields 内容:\n" + JSON.stringify(fixedFields, null, 2));

    const missing = Object.entries(fixedFields).filter(([k, v]) => !v).map(([k]) => k);
    if (missing.length > 0) {
      $notify("智慧食堂自动评价失败", "", "❗缺失配置: " + missing.join(", "));
      return $done();
    }

    await run(token, fixedFields);
  } catch (err) {
    console.log("❗ 脚本异常:\n" + err);
    $notify("智慧食堂脚本异常", "", String(err));
  }
  $done();
})();

async function run(token, fixedFields) {
  console.log("🔍 开始获取待评价列表...");
  const tradeIds = await getPendingComments(token);
  console.log(`📋 待评价单据数量: ${tradeIds.length}`);

  if (tradeIds.length === 0) {
    return $notify("智慧食堂自动评价", "副标题", "暂无待评价单据");
  }

  let success = 0, fail = 0, totalScore = 0;
  let successList = [];
  let failList = [];

  for (const tradeId of tradeIds) {
    console.log(`\n----------------------------`);
    console.log(`➡️ 开始处理 tradeId: ${tradeId}`);

    try {
      const info = await getCommentInfo(token, tradeId);
      console.log(`✅ 获取详情成功 tradeId:${tradeId}:\n` + JSON.stringify(info, null, 2));

      const submitHeaders = {
        Authorization: token,
        "Content-Type": "application/json"
      };
      const submitBody = {
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

      console.log(`📤 提交评价 headers:\n` + JSON.stringify(submitHeaders, null, 2));
      console.log(`📦 提交评价 body:\n` + JSON.stringify(submitBody, null, 2));

      const submitRes = await httpPost({
        url: "https://smart-area-api.cn-np.com/canteen/comment/submit",
        headers: submitHeaders,
        body: JSON.stringify(submitBody)
      });
      console.log(`📥 提交评价返回:\n` + formatJsonString(submitRes));

      const submitJson = JSON.parse(submitRes);
      if (submitJson.code !== 200) throw new Error(submitJson.msg || "提交失败");

      console.log(`✅ 提交评价成功 tradeId:${tradeId}`);

      const scoreInfo = await getScoreAfterComment(token, tradeId);
      console.log(`🎉 获取得分成功 tradeId:${tradeId}:\n` + JSON.stringify(scoreInfo, null, 2));

      success++;
      totalScore += scoreInfo.total;
      successList.push({ tradeId, ...scoreInfo });
    } catch (e) {
      console.log(`❌ tradeId:${tradeId} 异常:\n` + String(e));
      fail++;
      failList.push({ tradeId, error: String(e) });
      $notify("智慧食堂自动评价单据异常", "", `ID:${tradeId}, 错误:${e}`);
    }
  }

  let msg = `总成功：${success}，总失败：${fail}，总得分：${totalScore}`;
  $notify("智慧食堂自动评价完成", "", msg);
}

async function getPendingComments(token) {
  const url = "https://smart-area-api.cn-np.com/canteen/comment/myList";
  const headers = {
    Authorization: token,
    Accept: "application/json, text/plain, */*",
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1)...",
    Origin: "https://app.dms.cn-np.com",
    Referer: "https://app.dms.cn-np.com/"
  };
  console.log("📤 请求待评价列表 headers:\n" + JSON.stringify(headers, null, 2));
  const res = await httpGet({ url, headers });
  console.log("📥 返回原始:\n" + formatJsonString(res));
  const json = JSON.parse(res);
  console.log("📋 返回 JSON:\n" + JSON.stringify(json, null, 2));
  return json?.data?.data?.map(x => x.tradeId) || [];
}

async function getCommentInfo(token, tradeId) {
  const url = `https://smart-area-api.cn-np.com/canteen/comment/getFoods?trade_id=${tradeId}`;
  const headers = {
    Authorization: token,
    Accept: "application/json, text/plain, */*",
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1)...",
    Origin: "https://app.dms.cn-np.com",
    Referer: "https://app.dms.cn-np.com/"
  };
  console.log(`📤 获取详情 tradeId:${tradeId} headers:\n` + JSON.stringify(headers, null, 2));
  const res = await httpGet({ url, headers });
  console.log(`📥 获取详情返回 tradeId:${tradeId}:\n` + formatJsonString(res));
  const data = JSON.parse(res).data || {};
  return {
    meal_time: data.meal_time || "",
    firstStallName: data.menus?.[0]?.name || "",
    firstFoodName: data.menus?.[0]?.foods?.[0]?.name || "",
    canteenName: data.canteens?.[0]?.name || "",
    canteenCode: data.canteens?.[0]?.value || ""
  };
}

async function getScoreAfterComment(token, tradeId) {
  const url = `https://smart-area-api.cn-np.com/canteen/comment/getFoods?trade_id=${tradeId}`;
  const headers = {
    Authorization: token,
    Accept: "application/json, text/plain, */*",
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1)...",
    Origin: "https://app.dms.cn-np.com",
    Referer: "https://app.dms.cn-np.com/"
  };
  console.log(`📤 再次获取得分 tradeId:${tradeId} headers:\n` + JSON.stringify(headers, null, 2));
  const res = await httpGet({ url, headers });
  console.log(`📥 得分返回 tradeId:${tradeId}:\n` + formatJsonString(res));
  const data = JSON.parse(res)?.data || {};
  const scoreing = parseInt(data.comment?.scoreing_value || "0", 10);
  const commentScoreing = parseInt(data.comment?.comment_scoreing_value || "0", 10);
  const total = scoreing + commentScoreing;
  return { scoreing_value: scoreing, comment_scoreing_value: commentScoreing, total };
}

function formatJsonString(str) {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch (e) {
    return str;
  }
}

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
