---
name: prd-to-editable-demo
description: 将完整 PRD、需求文字、截图或 Figma 流程直接生成可评审、可交互、可修改的高保真 HTML Demo。适用于产品经理希望在 Agent 对话中立即看到原型、继续自然语言修改、撤销或按需发送到 Inspire 深度编辑的场景。
---

# PRD To Editable Demo

这是 PRD 到可编辑交互原型的单 Skill、单一安装入口。默认由宿主 Agent 直接生成一个最佳 Demo 并内嵌预览；Inspire 是可选的深度编辑、托管与团队协作工具，不是必经生成步骤。

## 核心合同

1. 始终读取用户提供的完整 PRD，不用摘要替代原文。
2. 生成前建立平台无关的 `demo-context`：业务对象、页面、页面内容、信息架构、交互、状态、视觉证据、推断、缺口与禁止推断项。
3. 事实必须带原文证据；默认推断不得伪装成 PRD 事实。不得把章节标题机械生成为页面，也不得针对某个评测案例硬编码页面或状态。
4. 默认只呈现自动评选出的单一最佳方案。只有页面结构、交互策略和视觉层级形成显著、可感知且可解释的差异时，才展示备选方案。
5. 默认直接交付 `index.html`、`prototype.manifest.json`、`demo-context.json`、`design-profile.json`、补丁与修改记录。结果应直接嵌入 Agent 的结果区，不要求用户先打开外部平台。
6. 核心能力不依赖用户另行安装 `prd-generator`、`pm-kakaxi-skills`、Open Design、花叔 Design、`vne-prototype` 或其他同类 Skill。

执行前读取 [capability-policy.md](references/capability-policy.md)。按任务需要读取 [requirements-ir.md](references/requirements-ir.md)、[interaction-design.md](references/interaction-design.md)、[visual-quality.md](references/visual-quality.md) 和 [quality-gates.md](references/quality-gates.md)。电商需求使用 [ecommerce-design-core.json](references/ecommerce-design-core.json) 做最小组件与 Token 路由；不要把完整重资产仓库加载进上下文。

## 生成流程

### 1. 建立语义需求

根据完整 PRD 生成 `model-semantic` 结构，并为业务对象、动作和流转提供可逐字核对的原文证据。信息密度和分类层级还要写入 `pageContent` 与 `informationArchitecture`。

```bash
node bin/prd-to-editable-demo.mjs \
  --prd <prd-path> \
  --requirements <semantic-requirements.json> \
  --out <output-directory>
```

没有 `--requirements` 时允许低置信启发式兜底，但必须标记缺口。专业模式若无法得到明确页面和流转，写出 `requirements-blocker.json` 后停止，不生成空壳；不得静默降级为章节标题加按钮的模板。

### 2. 建立统一 demo-context

`demo-context` 必须包含：

- `completeness`：semantic、interaction、state、visual。
- `pageUnits`、`visualInventory`、`interactionInventory`、`stateMatrix`。
- `assumptions`、`openQuestions`、`doNotInfer`、`evidenceSources`。
- 完整 PRD 原文，保证结构化处理不会压缩掉页面内容和信息架构。

增量修改时先更新 `demo-context`，再修改代码，避免多轮漂移。

### 3. 直接生成最佳 Demo

默认路由为 `direct`：语义理解 → 轻量设计语言匹配 → 代码生成 → 浏览器验收。专业结果仍必须支持图片、Icon、位置、大小、文字、颜色、显隐、状态和跳转编辑，并保留撤销与重做。

电商视觉使用轻量核心中的页面—模块—组件路由、Token 白名单和质量规则。正式素材优先从经过批准的版本化远程 Manifest 按需获取；安装包只携带少量基础 SVG。远程素材不可用时允许 CSS 骨架预览，但必须标记视觉不完整，不能宣称高保真验收通过。

## 质量门禁

- Emoji 数量必须为 0；不得用文字字符冒充 Icon。
- 禁止通用紫色渐变、桌面侧栏、假手机外壳、无来源品牌标识和未批准素材。
- 禁止显示“商品图占位”“价格待提供”“销量待确认”等未完成内容作为正式候选。
- 主任务必须从当前入口实际可达；URL 变化不能单独证明交互成功。
- 控件必须有正确语义和可观察反馈；覆盖适用的加载、空、错误、禁用、权限、成功与恢复路径。
- 自动规则通过不等于视觉优秀；品牌原生感、信息密度、素材相关性和视觉层级仍需同视口截图或多模态审查。

交付前运行：

```bash
npm test
npm run benchmark
npm run smoke
```

## 修改与版本

用户在 Agent 中描述修改时直接更新当前 Demo，不要求导出任务再发送给另一个 Agent。元素使用稳定 key；补丁保存在本地，支持撤销、重做和版本迁移。对图片、Icon、位置、大小等精细修改也必须遵循同一补丁协议。

## 可选 Inspire 路径

只有用户明确要求“在 Inspire 编辑、发布到 Inspire、团队画布协作”时才调用 Inspire。此时：

- `prd-to-editable-demo` 是宿主 Agent Skill，不能作为 Inspire Builder 的 `--skill`。
- 从 `inspire-prototype skills visible --json` 选择真正可见的业务设计 Skill。
- 校验 `activatedSkills` 和 `openedSkills` 的来源、key、版本与 package hash。
- 基于已接受 `assetId` 继续迭代，失败不得覆盖上一版本。

```bash
node bin/run-inspire-pipeline.mjs \
  --handoff <specialist-handoff.json> \
  --design-skill <source:key@version> \
  --ref <assetId> \
  --out <delivery-directory>
```

Inspire 不可用不得阻塞默认直出；但用户明确要求 Inspire 时不得静默伪装成已发布成功。
