# PRD to Editable Demo

一个可安装到兼容 Agent 的 Skill：把 PRD 快速生成零依赖、可点击、可直接编辑的 HTML 评审原型。

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

生成的 `index.html` 支持预览和编辑模式。编辑模式可以点选元素修改文案、颜色、显隐、禁用状态和跳转，并导出 `prototype.patches.json` 与 `agent-comments.json`。

## MVP 使用流程

1. 准备一个 Markdown 或纯文本 PRD。
2. 执行生成命令，打开输出目录中的 `index.html`。
3. 在“预览”模式走通页面流程；需要修改时切换到“编辑”。
4. 点选元素修改文案或样式，必要时提交“让 Agent 修改”任务。
5. 将导出的补丁和反馈文件交给后续 Agent 或设计开发流程。

生成结果会同时包含页面清单、需求假设、修改补丁和评审反馈，方便复现与交接。

## 本地验证

```bash
cd prd-to-editable-demo
npm test
npm run smoke
```

当前版本默认走本地快速路径；当用户明确要求 Inspire、工程化交付或 Figma 切图还原时，会提示专业路径尚未接入并安全降级到本地生成。
