# 外部编排 Skill + Inspire 业务设计 Skill 设计

## 产品定义

`prd-to-editable-demo` 是可安装到 Aime、Codex 等外部 Agent 的统一编排 Skill。它负责理解 PRD、选择专业能力、调用 Inspire Prototype，并把生成结果、版本关系和验收证据交付给用户。

Inspire Prototype 是唯一最终原型容器，负责可运行原型、画布资产、人工精修和版本承载。本产品不再把自建 HTML 编辑器作为主要编辑界面。

一份独立的 Inspire 业务设计 Skill 负责注入抖音商城独立端 App 的设计系统、组件、正式素材和质量约束，使生成结果具备原生产品感。

## 部署结构

### 外部 Agent：编排 Skill

用户在 Aime、Codex 或兼容 Agent 中安装 `prd-to-editable-demo`。该 Skill 负责：

- 读取并去噪 PRD。
- 提取角色、目标、业务对象、任务、状态、事实、推断和缺口。
- 判断快速生成、复杂需求理解、视觉生成或工程交付路径。
- 查询 Inspire 当前可用业务 Skill。
- 调用官方 Inspire Prototype CLI 生成或迭代原型。
- 保存 `assetId`、预览链接、收纳箱链接、设计 Skill 版本和验收结果。
- 将后续 Agent 修改请求绑定到同一个 Inspire 原型版本链。

### Inspire：业务设计 Skill

在 Inspire 工作区安装并共享 `douyin-mall-native-design` 业务设计 Skill。它不重复 PRD 编排逻辑，只负责：

- 抖音商城独立端 App 的设计 Token。
- 正式字体、SVG Icon、Logo、图片和品牌素材。
- 顶部栏、底部导航、商品卡、按钮、弹窗、底部浮层、表单、状态页等组件。
- 页面密度、触控尺寸、圆角、阴影、留白和动效规则。
- 已接受的真实页面范例和状态范例。
- 禁止 Emoji、通用紫色渐变、Web 后台布局和伪移动端外壳。
- 生成前约束与生成后视觉验收标准。

### Inspire Prototype：最终容器

所有通过专业路径生成的最终原型必须落为 Inspire prototype asset。用户通过 Inspire Web 端完成换图、换 Icon、拖拽、缩放、位置、层级和其他精确手动编辑。

外部 Skill 可以导出备份或研发交付包，但导出物不是新的事实源；后续迭代仍以最新 Inspire `assetId` 为准。

## 主流程

1. 用户在外部 Agent 中提交 PRD、截图、参考页面或已有 Inspire 原型。
2. 编排 Skill 生成结构化需求模型，并标注事实、推断和缺口。
3. 编排 Skill 执行 `inspire-prototype whoami`、查询 `skills visible`，确认身份和可用业务设计 Skill。
4. 首次生成使用 `generate prototype`，显式传入已确认的 Inspire 业务设计 Skill、PRD 摘要和视觉素材。
5. 生成完成后记录新的 `assetId`、`previewUrl`、`inboxDeepLink`、captures 和 Skill 版本。
6. 自动执行业务覆盖、交互、视觉、素材和禁用模式验收。
7. 用户在 Inspire 中打开最终原型并进行精确手动编辑。
8. 后续 Agent 修改始终引用最新 `assetId`，通过 `generate prototype --ref <assetId>` 形成下一版本。
9. 新版本通过验收后才更新“当前版本”；失败版本保留但不覆盖已接受版本。

## 编辑模型

### 用户直接编辑

图片、Icon、位置、大小、对齐、层级、圆角、颜色、文案和组件属性优先使用 Inspire 原生编辑能力。外部 HTML 不再重复实现画布拖拽和属性面板。

### Agent 自动修改

用户可在外部 Agent 中直接描述修改。编排 Skill发送：

- 当前 `assetId` 和版本。
- 目标页面或状态。
- 目标元素的可用标识、截图裁切或选择上下文。
- 当前值、期望值和不得改变的内容。
- 相关 PRD 证据与设计规则。

Agent 基于上一版生成新版本并自动验收。用户无需导出修改任务，也无需另开 Agent。

### 精确修改边界

如果 Inspire 提供稳定的节点选择和属性更新接口，编排 Skill 可以直接提交元素级修改，并保留撤销记录。

如果平台只支持基于 `assetId` 的原型迭代，Agent 修改属于受约束的版本生成，不能承诺像素级属性修改。此时：

- 精确微调使用 Inspire 手动编辑。
- Agent 负责跨组件、跨状态和较大范围的修改。
- 产品不得把近似重生成描述为“精确修改成功”。

## 原生设计质量

仅在 Prompt 中写“像抖音商城”或“不要 Emoji”不能形成稳定质量。原生设计质量由业务设计 Skill 的可执行资产和验收共同保证。

MVP 必须包含：

- 一套版本化设计 Token。
- 一套可复用的正式 SVG Icon；Emoji 数量必须为零。
- 至少覆盖导航、商品卡、主按钮、弹窗、底部浮层和状态反馈的组件范例。
- 至少三份经过接受的独立端页面或流程范例。
- 真实截图与业务提供素材的来源记录。
- 针对通用 AI 风格、错误 Icon、错误信息密度和 Web 化布局的负面规则。

## 数据与版本

每次交付保存：

- 原始 PRD 标识和摘要哈希。
- 结构化需求模型。
- Inspire canvas、assetId 和父版本 assetId。
- 使用的业务设计 Skill key、来源和版本。
- 输入素材清单和来源。
- 生成状态、预览链接、收纳箱链接和 captures。
- 验收结果、失败项和用户接受状态。

只有验收通过或用户明确接受的版本可以成为下一次迭代的默认 `--ref`。

## 失败与降级

- Inspire 未登录：停止并引导完成官方登录，不生成伪本地专业结果。
- 业务设计 Skill 不可见：停止高保真生成，说明缺失能力；不得静默使用通用风格。
- 素材缺失：标注缺口并请求最小必要素材，不用 Emoji 代替正式 Icon。
- 生成失败：保留当前已接受版本，允许重试。
- 视觉验收失败：不更新当前版本，返回具体失败项后基于同一父版本重试。
- Inspire 不支持节点级 Agent 编辑：明确使用“生成新版本”语义，精确修改引导用户进入 Inspire 手动编辑。

## 安装与推广

对外分发以一个统一入口为主：用户只需在现有 Agent 中安装 `prd-to-editable-demo`，再完成 Inspire CLI 登录。

业务设计 Skill 由团队管理员上传到 Inspire 工作区并共享，普通用户不需要手工安装两遍。编排 Skill 在生成前自动查询其可见性和版本。

因此用户认知是“安装一个 Skill”，系统内部则是“外部编排 Skill + Inspire 工作区业务设计 Skill”。

## 对抗性验收

- 同一 PRD 使用通用 Inspire 生成和业务设计 Skill 生成，后者在盲评中不得更差。
- Emoji 扫描为零，所有 Icon 能追溯到正式 SVG 或业务素材。
- 页面结构、状态和关键动作能追溯到 PRD 证据。
- 关键流程在真实 Inspire 预览中可点击，无死按钮。
- 原型在 Inspire 中可以手动替换图片/Icon并调整位置和大小。
- 基于最新 assetId 的 Agent 修改形成新版本，不覆盖已接受版本。
- 用户可从交付信息直接打开 Inspire 原型，无需下载再上传。
- 未验证的精确 Agent 修改不得显示为成功。

## MVP 非目标

- 不复制 Inspire 的完整画布编辑器。
- 不把静态 HTML 作为专业路径的最终事实源。
- 不承诺平台尚未提供的节点级写入能力。
- 不让普通用户管理 Inspire 业务 Skill 的上传和共享。
- 不同时生成多个相互竞争的最终原型容器。

## 已确认决策

- 采用“外部编排 Skill + Inspire 业务设计 Skill”。
- Inspire Prototype 始终是最终原型容器。
- 用户精确手动编辑使用 Inspire 原生能力。
- 外部 Agent 直接发起修改，不要求导出修改任务。
- 原生设计感通过业务设计 Skill 的组件、素材和质量门槛实现，而不是仅靠 Prompt。
