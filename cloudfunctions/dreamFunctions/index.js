const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

// 保存梦境（前端已经完成LLM交互,这里只负责保存）
const saveDream = async (event) => {
  try {
    const { content, title, summary, imageUrl } = event.data;
    const wxContext = cloud.getWXContext();
    
    console.log("保存梦境:", { title, summary });
    
    const result = await db.collection("dreams").add({
      data: {
        content,
        title,
        summary,
        imageUrl,
        status: "completed",
        openid: wxContext.OPENID,
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    });

    console.log("保存成功, ID:", result._id);
    
    return {
      success: true,
      data: {
        _id: result._id
      }
    };
  } catch (e) {
    console.error("保存梦境失败:", e);
    return {
      success: false,
      errMsg: e.errMsg || "保存失败"
    };
  }
};

// 获取梦境列表
const getDreamList = async (event) => {
  try {
    const wxContext = cloud.getWXContext();
    const limit = event.limit || 20;
    
    console.log("获取梦境列表, 用户:", wxContext.OPENID);
    
    const result = await db.collection("dreams")
      .where({
        openid: wxContext.OPENID
      })
      .orderBy("createTime", "desc")
      .limit(limit)
      .get();

    console.log("获取成功, 数量:", result.data.length);
    
    return {
      success: true,
      data: result.data
    };
  } catch (e) {
    console.error("获取梦境列表失败:", e);
    return {
      success: false,
      errMsg: e.errMsg || "获取失败"
    };
  }
};

// 删除梦境
const deleteDream = async (event) => {
  try {
    const { _id } = event.data;
    const wxContext = cloud.getWXContext();
    
    console.log("删除梦境, ID:", _id);
    
    await db.collection("dreams")
      .where({
        _id: _id,
        openid: wxContext.OPENID
      })
      .remove();

    console.log("删除成功");
    
    return {
      success: true
    };
  } catch (e) {
    console.error("删除梦境失败:", e);
    return {
      success: false,
      errMsg: e.errMsg || "删除失败"
    };
  }
};

exports.main = async (event, context) => {
  console.log("=== 云函数入口 ===");
  console.log("事件类型:", event.type);
  
  switch (event.type) {
    case "saveDream":
      console.log("执行: saveDream");
      return await saveDream(event);
      
    case "getDreamList":
      console.log("执行: getDreamList");
      return await getDreamList(event);
      
    case "deleteDream":
      console.log("执行: deleteDream");
      return await deleteDream(event);
      
    default:
      console.error("未知的操作类型:", event.type);
      return {
        success: false,
        errMsg: "未知的操作类型"
      };
  }
};
