# 梦境宇宙 Dream Universe 🌙

一个基于微信小程序云开发的AI梦境记录与可视化应用。用户可以输入梦境内容，AI会自动生成诗意的标题、梦境总结以及配图。

---

## ✨ 功能特性

- 📝 **梦境记录**：输入梦境内容，支持长文本
- 🤖 **AI优化**：使用LLM优化梦境描述，生成标题和摘要
- 🎨 **AI配图**：根据梦境内容自动生成配图
- 📱 **时间轴展示**：瀑布流展示所有梦境记录
- 💾 **云端存储**：基于微信云开发，数据安全可靠
- 🚀 **前端调用**：LLM在小程序前端调用，无超时限制

---

## 🎯 技术方案

### V2.0 架构（当前方案）

```
用户输入
   ↓
小程序前端 → LLM API (第一次交互) → 优化描述
   ↓
小程序前端 → LLM API (第二次交互) → 生成图片
   ↓
云函数 → 云数据库 → 保存完成
```

**为什么采用前端调用？**

云开发个人版**所有云函数操作限制3秒超时**，而LLM交互通常需要20-30秒，因此无法在云函数中完成。改为前端直接调用LLM API，没有超时限制。

---

## 🚀 快速开始

### 1. 环境准备

- 微信开发者工具（最新版）
- 注册微信小程序账号
- 开通云开发服务
- 注册[硅基流动](https://cloud.siliconflow.cn/)账号并获取API密钥

### 2. 克隆项目

```bash
git clone https://github.com/yourusername/dream-universe.git
cd dream-universe
```

### 3. 配置云开发环境

打开 `miniprogram/app.js`，修改云开发环境ID：

```javascript
wx.cloud.init({
  env: "你的云开发环境ID",
  traceUser: true
});
```

### 4. 配置API密钥

打开 `miniprogram/utils/ai-helper.js`，修改API密钥：

```javascript
const SILICONFLOW_API_KEY = "你的硅基流动API密钥";
```

### 5. 配置request域名白名单

**开发测试：** 在微信开发者工具中勾选"不校验合法域名"

**正式发布：** 在小程序后台配置request合法域名：
```
https://api.siliconflow.cn
```

详细步骤见：[前端调用方案部署指南.md](./前端调用方案部署指南.md)

### 6. 上传云函数

1. 打开微信开发者工具
2. 右键点击 `cloudfunctions/dreamFunctions`
3. 选择 **上传并部署：云端安装依赖**

### 7. 运行测试

点击微信开发者工具的 **编译** 按钮，开始体验！

---

## 📖 详细文档

- [前端调用方案部署指南](./前端调用方案部署指南.md) - 完整的部署步骤和配置说明
- [需求文档](./docs/需求1.md) - 项目需求和功能说明

---

## 🏗️ 项目结构

```
dream-universe/
├── miniprogram/                 # 小程序前端
│   ├── pages/
│   │   ├── index/              # 首页（梦境列表）
│   │   └── dream-input/        # 梦境输入页
│   ├── utils/
│   │   └── ai-helper.js        # AI调用工具（前端）
│   ├── app.js
│   ├── app.json
│   └── app.wxss
├── cloudfunctions/             # 云函数
│   └── dreamFunctions/         # 梦境数据库操作
│       ├── index.js            # 保存/查询/删除梦境
│       ├── package.json
│       └── config.json
├── docs/                       # 文档
│   └── 需求1.md
├── 前端调用方案部署指南.md      # 部署指南
├── project.config.json         # 项目配置
└── README.md                   # 本文件
```

---

## 💡 核心实现

### 前端AI调用 (`miniprogram/utils/ai-helper.js`)

```javascript
// 第一次LLM交互：优化梦境描述
await aiHelper.generateDreamContent(content)
  → { title, summary, enhancedDescription }

// 第二次LLM交互：生成图片
await aiHelper.generateDreamImage(enhancedDescription)
  → imageUrl
```

### 云函数 (`cloudfunctions/dreamFunctions/index.js`)

```javascript
// 只负责数据库操作
case "saveDream":    // 保存梦境
case "getDreamList": // 获取列表
case "deleteDream":  // 删除梦境
```

### 数据库结构 (`dreams` 集合)

```javascript
{
  content: "原始梦境内容",
  title: "AI生成的标题",
  summary: "AI生成的摘要",
  imageUrl: "AI生成的图片URL",
  status: "completed",
  openid: "用户openid",
  createTime: "创建时间",
  updateTime: "更新时间"
}
```

---

## 🎨 使用的AI服务

### 硅基流动（SiliconFlow）

- **Chat API**：文本生成（标题、摘要、优化描述）
  - 模型：`Qwen/Qwen2.5-7B-Instruct`
  - 成本：约 ¥0.001/次
  
- **Image API**：图片生成
  - 模型：`Qwen/Qwen-Image`
  - 成本：约 ¥0.05/张

**总成本：** 约 ¥0.051/次完整梦境记录

**注册地址：** https://cloud.siliconflow.cn/

---

## 🔧 自定义配置

### 更换LLM模型

编辑 `miniprogram/utils/ai-helper.js`：

```javascript
// 文本生成
model: "Qwen/Qwen2.5-7B-Instruct"

// 图片生成
model: "Qwen/Qwen-Image"
```

支持的模型列表：https://docs.siliconflow.cn/docs/model-list

### 调整生成参数

```javascript
// 文本生成参数
temperature: 0.8,    // 创造性（0.1-1.0）
max_tokens: 1500,    // 最大输出长度

// 图片生成参数
image_size: "1024x1024",     // 图片尺寸
num_inference_steps: 20,     // 推理步数
guidance_scale: 7.5          // 引导强度
```

---

## 🐛 常见问题

### 1. request:fail url not in domain list

**解决：** 配置request域名白名单 `https://api.siliconflow.cn`

### 2. API调用失败

**检查：**
- API密钥是否正确
- 账户余额是否充足
- 网络连接是否正常

### 3. 生成效果不理想

**优化：**
- 调整prompt（`ai-helper.js` 中的提示词）
- 更换模型
- 调整temperature参数

### 4. 云函数上传失败

**解决：**
- 检查云开发环境是否开通
- 检查网络连接
- 重新上传并部署

详细问题解决见：[前端调用方案部署指南.md](./前端调用方案部署指南.md)

---

## 📊 成本分析

### 云开发费用（微信）

- **个人版免费额度：**
  - 数据库：2GB 存储
  - 云函数：4万次/天调用
  - 云存储：5GB
  
- **实际成本：** 个人使用基本免费

### AI服务费用（硅基流动）

- **免费额度：** 注册即送
- **付费标准：**
  - 文本生成：¥0.001/次
  - 图片生成：¥0.05/次
  
- **月度预估：**
  - 10次/月：¥0.51
  - 50次/月：¥2.55
  - 100次/月：¥5.10

---

## 🛣️ Roadmap

- [ ] 添加梦境分享功能
- [ ] 支持多种AI模型选择
- [ ] 添加梦境分析统计
- [ ] 支持语音输入梦境
- [ ] 添加梦境搜索功能
- [ ] 优化加载动画
- [ ] 添加"重新生成"功能
- [ ] 实现本地缓存减少API调用

---

## 📄 License

MIT License

---

## 🙏 致谢

- 微信小程序云开发
- 硅基流动（SiliconFlow）
- Unsplash（降级方案图片来源）

---

## 📮 联系方式

如有问题或建议，欢迎提Issue或PR！

**更新日期：** 2026年1月2日  
**当前版本：** v2.0（前端直接调用方案）
