# PRD to Editable Demo

一个可安装到 Aime、Codex 等兼容 Agent 的统一入口 Skill：先理解 PRD，再选择最少的专业能力；简单评审交付本地 HTML，专业场景始终交付到 Inspire，由 Inspire 承担预览、手动编辑和版本管理。

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

简单评审场景会生成本地 `index.html`。复杂旅程、高保真、品牌或多状态场景生成 `specialist-handoff.json`，随后运行：

```bash
node prd-to-editable-demo/bin/run-inspire-pipeline.mjs \
  --handoff ./prototype-output/specialist-handoff.json \
  --design-skill workspace:<business-skill>@<version> \
  --out ./inspire-delivery
```

当前 owner 可用的私有候选是 `private:douyin-mall-independent-app-prototype-guidance@3`。它已通过结构、运行和商业事实边界回归，但仍缺少官方设计源与品牌素材，因此只用于私有验证，尚未分享或公开发布。

注意这里是双 Skill 架构：安装到 Aime/Codex 的 `prd-to-editable-demo` 是外部编排入口，不能作为 Inspire 的 `--skill`；`--design-skill` 必须填写 Inspire Builder 的可见业务设计 Skill，例如上面的私有候选。流程会同时校验 `activatedSkills` 和 `openedSkills` 的来源、key、版本及包哈希；若 Inspire 静默回退到 `mobile-shell` 等内置 Skill，命令会失败且不会交付该资产。

已有原型的 Agent 迭代增加 `--ref <当前已接受 assetId>`。命令返回 Inspire 预览和收纳箱链接；图片、Icon、位置、大小、文字和颜色的手动精修直接在 Inspire 中完成，不再导出修改任务给另一个 Agent。

状态码 3 表示“需要专业接管”，不是执行失败。内部可按场景利用 `prd-generator`、`pm-kakaxi-skills`、Open Design、花叔 Design、`vne-prototype` 或 `figma-flow-to-html-demo`，但它们提供的是需求、视觉或工程输入，不再各自成为最终原型容器。

交接包会隔离图片 alt、富文本标签和链接等文档噪声，保留原 PRD/素材路径供专业能力使用，同时输出角色、目标、业务对象、动作、状态、证据和所选专业 Skill 的能力基线。专业结果只有补齐基线证据后才会标记为完成。

一键 Inspire 流程会验证登录与指定版本的业务设计 Skill，保存资产谱系并执行确定性审查。Emoji、文字伪图标、通用紫色渐变、桌面模式、假手机框、无来源图标或 PRD 动作/状态缺失都会阻止候选版本覆盖上一已接受版本。自动通过后仍需主观视觉验收。

非 Inspire 的历史本地 HTML bundle 仍可用 `finalize-specialist.mjs` 和 `verify-specialist.mjs` 兼容回收，原版保存在 `index.original.html`；这不是新的专业终态。

## MVP 使用流程

1. 准备一个 Markdown 或纯文本 PRD。
2. 执行统一入口；简单任务打开本地 `index.html`，专业任务由 Agent 自动继续执行 `specialist-handoff.json`。
3. 专业任务从命令返回的链接进入 Inspire，走通核心流程并完成主观视觉验收。
4. 小调整直接用 Inspire 编辑器修改并撤销；Agent 修改则引用最新已接受 `assetId` 生成下一候选版本。
5. 审查失败时查看 `native-design-report.json`；上一已接受版本保持不变。

本地快速路径仍保留页面清单、需求假设和补丁；专业路径保存 Inspire 计划、资产谱系、审查报告和后续说明。

## 本地验证

```bash
cd prd-to-editable-demo
npm test
npm run smoke
npm run benchmark
```

浏览器端到端验收需要 Playwright，运行 `npm run test:browser`，覆盖本地快速路径的页面跳转与编辑能力；Inspire 专业路径由 CLI 集成测试和平台内视觉验收覆盖。

## 生成可上传安装包

如果 AgentBuddy 无法读取 GitHub 仓库，推荐使用标准 ZIP 上传：

```bash
cd prd-to-editable-demo
npm run package
```

输出文件为 `dist/prd-to-editable-demo-skill.zip`。该安装包的根目录直接包含 `SKILL.md`，可以在 AgentBuddy 的「上传 Zip」入口使用。不要直接上传 GitHub 自动下载的仓库 ZIP，因为它通常会多包一层仓库目录。

当前版本默认服务于快速评审；复杂需求或专业输入不得静默降级成本地模板。专业 Skill 不可用时应清楚报告缺失能力，只有用户明确接受低保真草稿后才允许降级。
