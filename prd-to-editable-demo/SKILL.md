---
name: prd-to-editable-demo
description: Use when a user asks to turn a PRD, requirement document, screenshot, Figma flow, or product idea into a reviewable interactive prototype, especially when the result must remain editable in Inspire or needs native mobile product quality.
---

# PRD To Editable Demo

这是 PRD 到可编辑交互原型的统一入口。先形成可追溯的需求模型，再按输入调用最少的专业能力；专业场景始终以 Inspire 作为最终原型容器，避免生成多套互相竞争的结果。

## 工作原则

1. 先产出可演示初版，推断与缺口单独记录；不得把 PRD 章节标题直接当页面。
2. 需求模型至少包含用户角色、目标、业务对象、用户动作、状态/分支、事实证据、推断和缺口。
3. 页面、控件和跳转必须可追溯到需求模型。禁止用“功能首页”“操作结果”“继续”等空洞占位词冒充理解。
4. 简单、低保真评审可走本地 HTML 快速路径；复杂、多状态、高保真或品牌场景必须进入专业路径，不得静默降级。
5. 专业路径中，`prd-generator`、`pm-kakaxi-skills`、Open Design、花叔 Design、`figma-flow-to-html-demo`、`vne-prototype` 只提供适用的理解、视觉或工程输入；Inspire 是唯一最终容器。

## 统一入口

```bash
node bin/prd-to-editable-demo.mjs --prd <prd-path> --out <output-directory>
```

可重复传入 `--asset <素材路径>`，也可使用 `--intent` 和 `--url`。若输出 `specialist-handoff.json` 并以状态码 3 结束，这是专业接管信号，不是失败。

## 专业交付到 Inspire

这里有两个不能混用的 Skill 身份：

- `prd-to-editable-demo` 是安装在 Aime、Codex 等宿主中的**外部 Agent 编排 Skill**，负责理解 PRD、路由和调用命令。
- `<source:key@version>` 是 Inspire Builder 运行时可见的**Inspire Builder 业务设计 Skill**，负责生成时的业务视觉与交互约束。

不得把 `private:prd-to-editable-demo` 作为 Inspire 的 `--skill` 参数；它不是 Builder 业务设计包。当前 owner 的抖音商城独立端候选应使用 `private:douyin-mall-independent-app-prototype-guidance@3`。其他使用者必须先从 `inspire-prototype skills visible --json` 中选择自己确实可见的业务设计 Skill，并固定来源与版本。

获得交接包后执行：

```bash
node bin/run-inspire-pipeline.mjs \
  --handoff <specialist-handoff.json> \
  --design-skill <source:key@version> \
  --out <delivery-directory>
```

修改已有原型时直接基于最新已接受版本生成候选：

```bash
node bin/run-inspire-pipeline.mjs \
  --handoff <specialist-handoff.json> \
  --design-skill <source:key@version> \
  --ref <assetId> \
  --out <delivery-directory>
```

必须先验证 Inspire 登录状态和指定版本的业务设计 Skill 可见。生成完成后，还必须核对返回的 `skillTrace.activatedSkills` 与 `skillTrace.openedSkills` 均包含预检时解析出的同一来源、key、版本和 package hash；未真正激活并打开时视为失败，即使平台返回了 `success` 和 `assetId` 也不得交付。生成后记录 `assetId`、父版本、预览链接和收纳箱链接；确定性审查失败时不得覆盖上一已接受版本。

## 原生设计底线

- Emoji 数量必须为 0，不得用星号、圆点或文字符号冒充 Icon。
- 图标必须使用有来源、许可和业务角色记录的 SVG；缺失官方品牌资产时明确阻塞发布。
- 禁止通用紫色渐变、桌面侧栏、假手机外壳、无来源品牌标识和未批准外链素材。
- 必须覆盖 PRD 必要动作、成功/失败/空状态和清晰触控标签。
- 自动规则通过不等于设计优秀；品牌原生感、视觉层级、素材质量和业务语义仍须主观视觉验收。

## 编辑与迭代

用户对图片、Icon、位置、大小、文字和颜色的手动精修，直接在 Inspire 中完成并保留撤销。Agent 修改必须基于当前 `assetId` 创建新版本；不得要求用户导出修改任务再发给另一个 Agent，也不得声称平台未提供的节点级 API 能实现像素级自然语言修改。

向用户交付 Inspire `previewUrl` 和 `inboxDeepLink`。本地目录保存 `inspire-plan.json`、`inspire-delivery.json`、`native-design-report.json` 和 `NEXT.md`，但不得生成与 Inspire 竞争的专业 `index.html`。

## 本地快速路径与兼容回收

只有简单评审任务才直接交付本地 `index.html`、`prototype.manifest.json`、`assumptions.md` 和补丁文件。若非 Inspire 专业能力只能产出本地 HTML bundle，可用 `finalize-specialist.mjs` 保留原版为 `index.original.html`，再运行 `verify-specialist.mjs`；该兼容路径不得替代 Inspire 专业终态。

交付前运行 `npm test`、`npm run benchmark` 和 `npm run smoke`。专业能力缺失、设计 Skill 不可见、审查失败或主观验收未完成时，必须如实报告，不得宣称达到专业基线。
