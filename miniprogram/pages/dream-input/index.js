const aiHelper = require("../../utils/ai-helper.js");

Page({
  data: {
    content: "",
    isGenerating: false,
    showTip: false,
    tipTitle: "",
    tipContent: ""
  },

  onContentInput(e) {
    this.setData({
      content: e.detail.value
    });
  },

  async onSubmit() {
    const { content } = this.data;
    
    if (!content || content.trim().length === 0) {
      wx.showToast({
        title: "请输入梦境内容",
        icon: "none"
      });
      return;
    }

    if (content.length < 10) {
      wx.showToast({
        title: "梦境内容至少10个字",
        icon: "none"
      });
      return;
    }

    console.log("=== 开始提交梦境（前端LLM方案） ===");
    console.log("梦境内容:", content);
    console.log("内容长度:", content.length);

    this.setData({ isGenerating: true });
    wx.showLoading({
      title: "正在优化描述...",
      mask: true
    });

    try {
      // 第一次LLM交互：在前端直接调用（没有3秒限制）
      console.log("步骤1: 前端调用LLM优化梦境描述");
      const contentResult = await aiHelper.generateDreamContent(content);

      if (!contentResult.success) {
        throw new Error("生成内容失败");
      }

      const { title, summary, enhancedDescription } = contentResult.data;
      console.log("生成的标题:", title);
      console.log("生成的总结:", summary);
      console.log("优化后的描述:", enhancedDescription);

      wx.showLoading({
        title: "正在生成配图...",
        mask: true
      });

      // 第二次LLM交互：在前端生成图片
      console.log("步骤2: 前端调用LLM生成图片");
      const imageResult = await aiHelper.generateDreamImage(enhancedDescription);

      if (!imageResult.success) {
        throw new Error("生成图片失败");
      }

      const imageUrl = imageResult.data;
      console.log("生成的图片URL:", imageUrl);

      wx.showLoading({
        title: "正在保存...",
        mask: true
      });

      // 保存到云数据库
      console.log("步骤3: 调用云函数保存梦境");
      const saveResult = await wx.cloud.callFunction({
        name: "dreamFunctions",
        data: {
          type: "saveDream",
          data: {
            content,
            title,
            summary,
            imageUrl
          }
        }
      });

      console.log("保存结果:", JSON.stringify(saveResult));

      if (!saveResult.result.success) {
        throw new Error(saveResult.result.errMsg);
      }

      console.log("=== 梦境保存成功 ===");

      wx.hideLoading();
      wx.showToast({
        title: "保存成功",
        icon: "success",
        duration: 1500
      });

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);

    } catch (e) {
      console.error("=== 提交失败 ===");
      console.error("错误类型:", e.name);
      console.error("错误信息:", e.message);
      console.error("错误堆栈:", e.stack);
      
      wx.hideLoading();
      wx.showToast({
        title: e.message || "生成失败，请重试",
        icon: "none",
        duration: 2000
      });
    } finally {
      this.setData({ isGenerating: false });
    }
  }
});
