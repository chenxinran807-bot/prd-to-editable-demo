---
name: prd-to-editable-demo
description: 将 PRD、产品需求文字或需求文档快速转成零依赖、可点击、可直接编辑的 HTML 交互原型，并支持点选元素生成 Agent 修改任务。用于“PRD 转原型”“生成评审 Demo”“做可点击页面”“直接在原型上修改”“圈选后让 Agent 改”等需求；默认优先快速生成评审初版，把推断和缺口单独列出。
---

# PRD To Editable Demo

把用户的 PRD 转为一个可预览、可直接编辑、可继续交给 Agent 修改的原型。它是统一入口，不替代已经更适合特定输入的专业 Skill。

## 执行原则

1. 先生成可评审初版，不因局部信息缺失阻塞；但不得把 PRD 章节直接当作页面。
2. 只有用户身份、核心任务或流程入口无法判断时才提问。
3. 把推断写入 `assumptions.md`，不要冒充 PRD 事实。
4. 默认生成零外部依赖的 `index.html`，不得依赖 CDN。
5. 每个可编辑元素使用稳定、唯一的 `data-proto-key`。
6. 同一任务只选择一个执行路径，不串行套用多个完整原型 Skill。

## 先理解，再画页面

生成前先形成需求模型，至少包含：用户角色、目标、业务对象、用户动作、状态/分支、事实证据、推断和缺口。页面与交互必须能追溯到其中一项；“市场调研”“竞品分析”“方向判断”等文档章节不是页面证据。

如果核心角色、目标和入口只有一项缺失，可作最小推断并记录；如果业务对象与用户动作都无法提取，停止生成并向用户补问。先用用户自己的关键名词命名页面、对象和按钮，禁止用“功能首页”“操作结果”“继续”等空洞占位词冒充理解结果。

## 快速执行

在本 Skill 目录运行：

```bash
node bin/prd-to-editable-demo.mjs --prd <prd-path> --out <output-directory>
```

可选参数：

- `--intent <用户目标>`：用于识别专业路径。
- `--asset <素材路径>`：可重复传入。
- `--url <参考页面>`：保留给后续专业适配器。

执行后必须运行：

```bash
npm test
```

## 交付

向用户提供 `index.html` 的绝对路径，并说明：

- “预览”模式用于走通业务流程。
- “编辑”模式可点选元素修改文案、颜色、显隐、禁用和跳转。
- “让 Agent 修改”会保存元素级修改任务，可导出 `agent-comments.json`。
- 用户修改保存在浏览器本地，刷新后仍存在，也可导出补丁。

同时交付：

- `prototype.manifest.json`
- `prototype.patches.json`
- `agent-comments.json`
- `demo-summary.md`
- `assumptions.md`

## 路由边界

统一入口先输出路由判断。命中专业场景时，CLI 生成 `specialist-handoff.json` 后以状态码 3 停止；Agent 必须读取交接包并调用指定 Skill，完成后再用本 Skill 的统一交付结构补齐可编辑能力和验收记录。不得静默降级为本地模板，不得把临时草稿宣称为专业结果。

- 复杂旅程、多角色、多状态或偏产品方案的 PRD：`prd-generator` 先完成产品级需求理解。
- 截图、设计稿、组件库或高保真要求：`pm-kakaxi-skills` 接管视觉与交互还原。
- 明确要求工程化 React、内部组件库或研发交付：`vne-prototype` 接管。
- 明确要求 Inspire 云端资产：`inspire-prototype` 接管。
- 完整流程图和切图且要求像素还原：`figma-flow-to-html-demo` 接管。
- 其他情况始终使用本地快速路径。

专业 Skill 不可用时，明确报告缺失能力和交接包位置；只有用户明确接受低保真草稿后才允许本地降级。

## 回收专业结果

专业 Skill 完成后，先保留其完整输出目录，不重写页面结构、视觉样式、素材或工程实现。若结果是本地 HTML bundle，执行：

```bash
node bin/finalize-specialist.mjs \
  --source <专业结果目录> \
  --handoff <specialist-handoff.json> \
  --out <统一交付目录>
```

统一目录中的 `index.html` 是注入直接编辑、撤销重做、补丁和 Agent 修改任务后的版本；`index.original.html` 是未注入的专业原版，其余 CSS、JS 和素材原样复制。预览质量以原版为基线，统一层不得用本地模板覆盖专业页面。

若专业结果只提供远程 asset（如 Inspire），先使用该专业能力的官方导出命令取得代码包，再执行回收；无法取得本地 bundle 时保留原专业预览链接，并明确标记“远程编辑”，不得伪造本地可编辑交付。
