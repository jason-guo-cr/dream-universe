const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;

const testGenerateImage = async () => {
  console.log("=== 测试图片生成 ===");
  
  try {
    const imagePrompt = "A cute cat sitting on a cloud, dreamy atmosphere, soft lighting, fantasy art style";
    console.log("图片描述:", imagePrompt);
    
    const result = await cloud.openapi.ai.textToImage({
      model: "hunyuan-image",
      prompt: imagePrompt,
      size: "1024x1024"
    });

    console.log("AI图片生成响应:", JSON.stringify(result));
    
    if (!result || !result.data) {
      console.error("AI图片响应格式错误");
      throw new Error("AI图片响应格式错误");
    }

    const imageUrl = result.data.url;
    console.log("=== 图片生成成功 ===");
    console.log("图片URL:", imageUrl);
    
    return {
      success: true,
      imageUrl: imageUrl
    };
  } catch (e) {
    console.error("=== 图片生成失败 ===");
    console.error("错误类型:", e.name);
    console.error("错误信息:", e.message);
    console.error("错误码:", e.errCode);
    console.error("错误堆栈:", e.stack);
    
    return {
      success: false,
      error: e.message
    };
  }
};

exports.main = async (event, context) => {
  console.log("=== 测试云函数入口 ===");
  console.log("事件类型:", event.type);
  
  switch (event.type) {
    case "testGenerateImage":
      console.log("执行: testGenerateImage");
      return await testGenerateImage();
    default:
      console.error("未知的操作类型:", event.type);
      return {
        success: false,
        errMsg: "未知的操作类型"
      };
  }
};
