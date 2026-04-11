# AGENTS.md

## 项目定位

这是一个基于微信小程序 + CloudBase 的梦境记录产品 `Dream Universe / 梦境编年史`。

核心能力包括：

- 用户登录与用户资料管理
- 梦境记录、编辑、删除
- 基于 AI 的梦境图片生成
- 基于 AI 的解梦分析
- 个人中心统计与反馈提交

代码不是通用 Web 项目，而是典型的“小程序前端 + 云函数后端”结构。处理需求时必须按这个前提工作，不要把它当成 React/Vue/H5 项目。

## 强制技能规则

1. 只要是在这个仓库里工作，必须先读 `cloudbase-guidelines` skill。
2. 涉及小程序页面、交互、路由、组件时，优先使用 `miniprogram-development`。
3. 涉及云函数、部署、运行时、依赖时，使用 `cloud-functions`。
4. 涉及微信登录、OPENID、用户体系时，使用 `auth-wechat-miniprogram`。
5. 涉及 CloudBase AI 能力，区分场景：
   - 小程序前端能力：`ai-model-wechat`
   - 云函数里的 Node.js AI 调用：`ai-model-nodejs`
6. 涉及 UI 的部分，使用 `ui-ux-pro-max` skills；如果当前环境没有该技能，则退回使用 `ui-design`，但仍需保持高质量视觉标准。

## 开始工作前先读这些文件

至少先看一遍以下文件，再动手：

- `README.md`
- `docs/部署指南.md`
- `docs/prd/需求文档1.md`
- `docs/prd/需求文档2.md`
- `miniprogram/app.js`
- `miniprogram/app.json`

如果任务只影响某个页面或某个云函数，再补读对应目录下的代码。

## 项目结构

关键目录如下：

- `miniprogram/`：微信小程序前端
- `cloudfunctions/`：CloudBase 云函数
- `docs/`：需求、部署、补充说明文档
- `miniprogram/custom-tab-bar/`：自定义底部 TabBar
- `miniprogram/components/`：通用组件

主要页面：

- `pages/login/login`：登录页
- `pages/index/index`：梦境时间线首页
- `pages/dream/dream`：记录/编辑梦境页
- `pages/interpret/interpret`：解梦页
- `pages/profile/profile`：个人中心

主要云函数：

- `login`：登录并初始化用户
- `getDreams`：读取梦境列表/详情
- `createDream`：生成梦境图片
- `saveDream`：保存或更新梦境
- `deleteDream`：删除梦境
- `interpretDream`：AI 解梦
- `updateUser`：更新用户昵称
- `saveFeedback`：保存用户反馈

注意：`miniprogram/pages/example/` 更像云开发示例页面，不是当前产品主链路。除非任务明确要求，否则不要把新业务逻辑优先堆到这里。

## 当前业务事实

处理需求时要默认尊重下面这些既有事实：

1. 用户通过微信小程序登录，核心身份是 `OPENID`。
2. `login` 云函数会在用户首次进入时自动创建 `users` 记录，并生成随机昵称。
3. 新梦境默认日期是“昨天”，不是今天。
4. 梦境图片生成和梦境保存是两步流程：
   - 先生成图片
   - 用户确认后再保存梦境
5. 单次生成图片最多 3 张，解梦也支持 1 到 3 条梦境组合分析。
6. 首页支持快捷解梦、删除、继续编辑。
7. 个人中心依赖梦境统计、昵称编辑、反馈提交。

## 数据模型与 CloudBase 规则

当前至少涉及这些集合：

- `users`
- `dreams`
- `feedbacks`

处理数据库和权限时必须遵守：

1. 所有用户数据都必须按 `openid` 隔离。
2. 云函数中的查询、更新、删除都必须带上 `openid` 条件，不能只用 `_id`。
3. `users` 和 `dreams` 至少应保持“仅本人可读写”的权限模型。
4. 如果新增集合，必须同步考虑权限规则和部署文档更新。

从现有实现看，`dreams` 集合中常见字段包括：

- `openid`
- `content`
- `date`
- `images`
- `imagePrompts`
- `interpretation`
- `draftId`
- `createdAt`
- `updatedAt`

不要随意改字段语义，尤其注意：

- `draftId` 用于“生成后再保存”的草稿串联
- `interpretation` 既被解梦页使用，也被首页和个人中心统计依赖

## 图片与文件存储规则

这个项目对图片的处理有明确约束：

1. 云函数 `createDream` 会先生成图片，再上传到 Cloud Storage。
2. 数据库存储应该优先保存 `cloud://` fileID，而不是临时访问链接。
3. `getDreams` 会把 fileID 转成临时 URL 给前端展示。
4. 前端保存梦境时，优先提交 `imageFileIds`，不要把临时 URL 当成最终持久化值。

如果改坏这条链路，会导致图片失效或历史数据无法展示。

## 小程序开发约束

1. 前端使用微信小程序原生写法：`App`、`Page`、`Component`、`wx.*`、`wx.cloud.*`。
2. 不要引入 React、Vue、Next.js、Vite 这一类 Web 技术栈假设。
3. 保持现有代码风格：
   - JS 为主
   - 2 空格缩进风格
   - 云函数使用 CommonJS
4. 页面跳转、登录拦截、会话恢复要兼容 `app.js` 中已有的 `requireLogin`、`setUserSession`、`restoreSession` 逻辑。
5. 修改 Tab 页时，注意同步 `custom-tab-bar` 的选中态逻辑。

## 云函数开发约束

1. 云函数保持 `wx-server-sdk` 初始化方式：`cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })`。
2. 修改 AI 相关云函数时，优先沿用现有 `@cloudbase/node-sdk` 用法，不要无故切换成别的 SDK。
3. 涉及 AI 出图/解梦时，优先做失败兜底和错误提示，避免前端直接空白。
4. 不要在云函数里写死其他环境的敏感信息。
5. 修改依赖后，要同时检查对应函数目录下的 `package.json`。

## 环境与部署注意事项

1. 当前小程序在 `miniprogram/app.js` 中写有 CloudBase 环境 ID，修改前要确认是否真的是部署需要。
2. `project.config.json` 已声明：
   - `miniprogramRoot = miniprogram/`
   - `cloudfunctionRoot = cloudfunctions/`
3. 部署说明以 `docs/部署指南.md` 为准；如果你改变了集合、权限、函数、AI 服务、页面入口或环境配置，必须更新这份文档。
4. 如果补充了新的 CloudBase 资源，也要把控制台配置步骤写回 `docs/`。

## UI / UX 约束

1. 涉及 UI 的部分，使用 `ui-ux-pro-max` skills；若不可用，则使用 `ui-design`。
2. 保持现有产品气质：深色、宇宙感、梦境感，不要做成通用后台或普通表单站。
3. 优先延续现有页面的视觉语言和信息层级，不要无故推翻整套风格。
4. 小程序页面必须兼顾手机端可读性、点击热区、滚动体验和弹窗可操作性。

## 文档与交付规则

1. 需求理解优先参考 `docs/prd/`，不是只看代码猜业务。
2. 新增说明文档、设计文档、部署说明时，默认放到 `docs/` 目录。
3. 如果任务改变了用户可见行为，除了改代码，也要补文档。

## 修改后建议验证清单

完成任务后，优先覆盖这些检查：

- 登录是否正常
- 首页时间线是否正常加载
- 新建梦境是否可保存
- 编辑已有梦境是否正常
- 图片生成后是否还能保存并重新打开
- 解梦结果是否能写回并再次展示
- 删除梦境是否生效
- 个人中心昵称修改是否生效
- 反馈提交是否成功

如果当前环境无法直接用微信开发者工具验证，要在结果里明确说明“已做静态检查/代码检查，但未完成真机或开发者工具验证”。

## 工作方式

1. 先理解现状，再改代码，不要直接重构。
2. 优先做与当前架构一致的最小可行改动。
3. 除非用户明确要求，否则不要大面积改名、迁移目录或替换技术栈。
4. 发现文档与代码不一致时，以当前代码和 PRD 为依据修正文档，并在结果中说明。
