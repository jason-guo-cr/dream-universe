/**
 * AI辅助工具 - 前端直接调用硅基流动API
 * 
 * 由于云开发个人版云函数限制3秒超时，无法完成LLM交互
 * 因此改为在小程序前端直接调用，没有超时限制
 */

// 硅基流动API配置
const SILICONFLOW_API_KEY = "sk-wlsjuttffrerptoluavnyacbfqptufnpnigvfrzenpedftam"; // 你的API密钥
const SILICONFLOW_CHAT_URL = "https://api.siliconflow.cn/v1/chat/completions";
const SILICONFLOW_IMAGE_URL = "https://api.siliconflow.cn/v1/images/generations";

/**
 * 第一次LLM交互：优化梦境描述
 */
async function generateDreamContent(content) {
  console.log("=== 第一次LLM交互：生成梦境内容 ===");
  
  const prompt = `你是一位专业的梦境分析师和插画师。请根据用户输入的梦境内容，生成以下内容：

1. 一个富有诗意的标题（不超过20字）
2. 一个简短的梦境总结（不超过100字）
3. 一个详细的、优化过的梦境描述（用于AI绘画，200-300字，包含具体的场景、色彩、氛围、光线、构图等细节）

用户输入的梦境：${content}

要求：
- 标题要有诗意和文学性
- 总结要准确概括梦境的核心内容和情感
- 优化后的描述要非常具体、视觉化，包含丰富的细节
- 优化后的描述要使用中文，但要包含适合AI绘画理解的关键视觉元素
- 体现梦境的奇幻、超现实和神秘感

请严格按照以下JSON格式返回（不要添加其他说明文字）：
{
  "title": "诗意标题",
  "summary": "梦境总结",
  "enhancedDescription": "优化后的详细梦境描述"
}`;

  try {
    const response = await new Promise((resolve, reject) => {
      wx.request({
        url: SILICONFLOW_CHAT_URL,
        method: "POST",
        header: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SILICONFLOW_API_KEY}`
        },
        data: {
          model: "Qwen/Qwen2.5-7B-Instruct",
          messages: [
            {
              role: "system",
              content: "你是一位专业的梦境分析师和插画师，擅长将梦境转化为视觉化的艺术描述。"
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.8,
          top_p: 0.95,
          max_tokens: 1500
        },
        timeout: 30000, // 30秒超时
        success: resolve,
        fail: reject
      });
    });

    console.log("API响应状态:", response.statusCode);

    if (response.statusCode !== 200) {
      throw new Error(`API请求失败: ${response.statusCode}`);
    }

    if (!response.data || !response.data.choices || !response.data.choices[0]) {
      throw new Error("AI响应格式错误");
    }

    const aiResponse = response.data.choices[0].message.content;
    console.log("AI返回内容:", aiResponse);

    // 解析JSON
    let parsedData;
    try {
      parsedData = JSON.parse(aiResponse);
    } catch (e) {
      // 尝试从markdown代码块中提取
      const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/) || 
                       aiResponse.match(/```\s*([\s\S]*?)\s*```/) ||
                       aiResponse.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } else {
        throw e;
      }
    }

    return {
      success: true,
      data: parsedData
    };

  } catch (error) {
    console.error("第一次LLM交互失败:", error);
    
    // 降级方案
    return {
      success: true,
      data: {
        title: content.substring(0, Math.min(15, content.length)) + (content.length > 15 ? "..." : ""),
        summary: content.substring(0, Math.min(100, content.length)),
        enhancedDescription: content
      }
    };
  }
}

/**
 * 第二次LLM交互：生成图片
 */
async function generateDreamImage(enhancedDescription) {
  console.log("=== 第二次LLM交互：生成图片 ===");
  
  try {
    // 步骤1：将中文描述转换为英文prompt
    console.log("步骤1: 转换为英文prompt");
    
    const translatePrompt = `请将以下中文梦境描述转换为适合AI绘画的英文prompt。要求：
1. 保留所有视觉细节（场景、色彩、光线、氛围、构图等）
2. 使用AI绘画常用的英文描述风格
3. 添加画风和质量标签（如：dreamy, surreal, fantasy art, high quality, detailed等）
4. 长度控制在150-250词
5. 只返回英文prompt，不要添加其他说明

中文描述：${enhancedDescription}`;

    const translateResponse = await new Promise((resolve, reject) => {
      wx.request({
        url: SILICONFLOW_CHAT_URL,
        method: "POST",
        header: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SILICONFLOW_API_KEY}`
        },
        data: {
          model: "Qwen/Qwen2.5-7B-Instruct",
          messages: [
            {
              role: "system",
              content: "你是一位专业的AI绘画prompt工程师。"
            },
            {
              role: "user",
              content: translatePrompt
            }
          ],
          temperature: 0.7,
          max_tokens: 500
        },
        timeout: 30000,
        success: resolve,
        fail: reject
      });
    });

    const englishPrompt = translateResponse.data.choices[0].message.content.trim();
    console.log("英文prompt:", englishPrompt);

    // 步骤2：生成图片
    console.log("步骤2: 生成图片");
    
    const imageResponse = await new Promise((resolve, reject) => {
      wx.request({
        url: SILICONFLOW_IMAGE_URL,
        method: "POST",
        header: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SILICONFLOW_API_KEY}`
        },
        data: {
          model: "Qwen/Qwen-Image",
          prompt: englishPrompt,
          image_size: "1024x1024",
          num_inference_steps: 20,
          guidance_scale: 7.5
        },
        timeout: 60000, // 60秒超时
        success: resolve,
        fail: reject
      });
    });

    console.log("图片生成响应:", imageResponse.statusCode);

    if (imageResponse.statusCode !== 200) {
      throw new Error("图片生成失败");
    }

    if (!imageResponse.data || !imageResponse.data.images || !imageResponse.data.images[0]) {
      throw new Error("图片响应格式错误");
    }

    const imageUrl = imageResponse.data.images[0].url;
    console.log("图片URL:", imageUrl);

    return {
      success: true,
      data: imageUrl
    };

  } catch (error) {
    console.error("第二次LLM交互失败:", error);
    
    // 降级方案：使用Unsplash图片
    const defaultImages = [
      "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=1024",
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1024",
      "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1024"
    ];
    
    const randomIndex = Math.floor(Math.random() * defaultImages.length);
    
    return {
      success: true,
      data: defaultImages[randomIndex]
    };
  }
}

module.exports = {
  generateDreamContent,
  generateDreamImage
};

