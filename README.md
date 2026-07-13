# PRD to Editable Demo

一个可安装到兼容 Agent 的 Skill：把 PRD 快速生成零依赖、可点击、可直接编辑的 HTML 评审原型。

## 快速开始

将 `prd-to-editable-demo/` 安装到你的 Agent Skill 目录后运行：

```bash
node prd-to-editable-demo/bin/prd-to-editable-demo.mjs \
  --prd ./path/to/requirements.md \
  --out ./prototype-output
```

生成的 `index.html` 支持预览和编辑模式。编辑模式可以点选元素修改文案、颜色、显隐、禁用状态和跳转，并导出 `prototype.patches.json` 与 `agent-comments.json`。

## 本地验证

```bash
cd prd-to-editable-demo
npm test
npm run smoke
```

当前版本默认走本地快速路径；当用户明确要求 Inspire、工程化交付或 Figma 切图还原时，会提示专业路径尚未接入并安全降级到本地生成。
