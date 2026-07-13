---
name: prd-to-editable-demo
description: 将 PRD、产品需求文字或需求文档快速转成零依赖、可点击、可直接编辑的 HTML 交互原型，并支持点选元素生成 Agent 修改任务。用于“PRD 转原型”“生成评审 Demo”“做可点击页面”“直接在原型上修改”“圈选后让 Agent 改”等需求；默认优先快速生成评审初版，把推断和缺口单独列出。
---

# PRD To Editable Demo

把用户的 PRD 转为一个可预览、可直接编辑、可继续交给 Agent 修改的单文件网页。

## 执行原则

1. 先生成可评审初版，不因局部信息缺失阻塞。
2. 只有用户身份、核心任务或流程入口无法判断时才提问。
3. 把推断写入 `assumptions.md`，不要冒充 PRD 事实。
4. 默认生成零外部依赖的 `index.html`，不得依赖 CDN。
5. 每个可编辑元素使用稳定、唯一的 `data-proto-key`。
6. 同一任务只选择一个执行路径，不串行套用多个完整原型 Skill。

## 快速执行

在本 Skill 目录运行：

```bash
node bin/prd-to-editable-demo.mjs --prd <prd-path> --out <output-directory>
```

可选参数：

- `--intent <用户目标>`：用于识别专业路径；MVP 对专业路径自动降级为本地生成并记录原因。
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

统一入口先输出路由判断。命中专业场景时，必须把同一份需求理解摘要、素材清单和缺口清单交给推荐的接管 Skill；交付物中的 `prototype.manifest.json.routing` 记录接管 Skill、判断原因和当前状态。本地 Demo 只能作为临时评审草稿，不能宣称等价于专业路径。

- 明确要求工程化 React、内部组件库或研发交付：后续由 `vne-prototype` 适配器接管。
- 明确要求 Inspire 云端资产：后续由 `inspire-prototype` 适配器接管。
- 完整流程图和切图且要求像素还原：后续由 `figma-flow-to-html-demo` 适配器接管。
- 其他情况始终使用本地快速路径。

当前 MVP 未接入上述适配器；命中时必须明确提示降级，不得假装已调用专业能力。
