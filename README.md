# PRD to Editable Demo

一个可安装到兼容 Agent 的统一入口 Skill：先理解 PRD，再选择本地快速原型或适用的专业原型能力，最终交付可演示、可编辑、可继续让 Agent 修改的结果。

## 快速开始

将 `prd-to-editable-demo/` 安装到兼容 Agent 的 Skill 目录后运行。以 Codex 为例：

```bash
mkdir -p "$HOME/.codex/skills"
cp -R prd-to-editable-demo "$HOME/.codex/skills/prd-to-editable-demo"
```

然后运行：

```bash
node prd-to-editable-demo/bin/prd-to-editable-demo.mjs \
  --prd ./path/to/requirements.md \
  --out ./prototype-output
```

简单评审场景会生成 `index.html`，支持预览和编辑模式。编辑模式可以点选元素修改文案、颜色、显隐、禁用状态和跳转，并导出 `prototype.patches.json` 与 `agent-comments.json`。

复杂旅程、高保真设计稿、工程交付、Inspire 或 Figma 流程还原场景会生成 `specialist-handoff.json` 并停止本地模板生成。Agent 应按照交接包调用指定专业 Skill；状态码 3 表示“需要专业接管”，不是执行失败。

交接包会隔离图片 alt、富文本标签和链接等文档噪声，保留原 PRD/素材路径供专业能力使用，同时输出角色、目标、业务对象、动作、状态、证据和所选专业 Skill 的能力基线。专业结果只有补齐基线证据后才会标记为完成。

专业 Skill 产出本地 HTML bundle 后，可运行 `node bin/finalize-specialist.mjs --source <专业结果目录> --handoff <交接包> --out <统一交付目录>`。该步骤保留专业原型及所有素材，并生成可直接编辑的 `index.html`；未经注入的原版保存在 `index.original.html`。

## MVP 使用流程

1. 准备一个 Markdown 或纯文本 PRD。
2. 执行生成命令；如果返回本地路径，打开输出目录中的 `index.html`；如果要求专业接管，由 Agent 继续执行 `specialist-handoff.json`。
3. 在“预览”模式走通页面流程；需要修改时切换到“编辑”。
4. 点选元素修改文案或样式，必要时提交“让 Agent 修改”任务。
5. 将导出的补丁和反馈文件交给后续 Agent 或设计开发流程。

生成结果会同时包含页面清单、需求假设、修改补丁和评审反馈，方便复现与交接。

## 本地验证

```bash
cd prd-to-editable-demo
npm test
npm run smoke
npm run benchmark
```

浏览器端到端验收需要 Playwright，运行 `npm run test:browser`，覆盖页面跳转、元素编辑、撤销重做、刷新持久化以及补丁/Agent 任务导出。

## 生成可上传安装包

如果 AgentBuddy 无法读取 GitHub 仓库，推荐使用标准 ZIP 上传：

```bash
cd prd-to-editable-demo
npm run package
```

输出文件为 `dist/prd-to-editable-demo-skill.zip`。该安装包的根目录直接包含 `SKILL.md`，可以在 AgentBuddy 的「上传 Zip」入口使用。不要直接上传 GitHub 自动下载的仓库 ZIP，因为它通常会多包一层仓库目录。

当前版本默认服务于快速评审；复杂需求或专业输入不得静默降级成本地模板。专业 Skill 不可用时应清楚报告缺失能力，只有用户明确接受低保真草稿后才允许降级。
