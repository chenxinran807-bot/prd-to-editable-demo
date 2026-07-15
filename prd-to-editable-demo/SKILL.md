---
name: prd-to-editable-demo
description: Use when turning a PRD, requirements, screenshots, or product idea into a reviewable interactive prototype with traceable product and visual fidelity.
intent: prd-to-editable-demo
type: workflow
---

# PRD to Editable Demo

## Purpose

把 PRD 转成可评审、可编辑、可真实走通的交互原型。首要目标是对 PRD、用户确认和明确绑定的图片参考保持可见产品保真；生成容器只是后续路由。此单 Skill、单一安装的公共 workflow 自带核心协议；未安装其他 Skill 不影响核心能力。

## Key Concepts

- **结构不是摘要**：无损理解不能降低信息密度。保留全部 PRD 信息并分类用途；默认只有 `product_requirement` 进入 UI。背景、研究、指标、优先级和交付元数据没有明确产品证据时绝不渲染。
- **渐进澄清**：清晰 PRD 不重复提问。任何影响页面、流程或可见体验的关键缺口/冲突必须问用户，不能自行决定；每轮一个主题、最多 3 个决定，先给简短推荐，不展示长报告或完整 IR。
- **冻结执行**：用户确认后建立版本化、冻结 baseline。不得再解释、优化或改写精确文案、布局、层级与流程；核心闭环不能被额外功能挤占。
- **图片绑定**：每张图分别记录范围、属性、保真级别和排除项，不默认拼成 moodboard。`exact`、`high`、`local`、`inspiration` 含义不同，后三者须主观审查；冲突必须问用户。
- **完成是行为事实**：声明、渲染、静态提示或不可达按钮都不算完成。视觉精致不能抵消产品错误。

## Application

严格按以下顺序执行，并只在进入该阶段时读取对应协议：

1. **无损 v2 理解**：完整阅读 [requirements-ir.md](references/requirements-ir.md)，建立源文覆盖、用途、层级、页面、区域、动作与核心旅程。
2. **渐进澄清**：读取 [clarification.md](references/clarification.md)。若没有关键 blocker，直接继续；否则得到用户确认后更新 IR。
3. **视觉绑定**：有图片时读取 [visual-reference.md](references/visual-reference.md)，逐图绑定，禁止无范围混合。
4. **冻结 baseline**：读取 [execution-contract.md](references/execution-contract.md)，版本化冻结 `PRD module -> page position -> component -> state -> trigger -> next page/state`。
5. **生成页面切片**：按 baseline 的页面、区域和层级顺序生成；精确文案逐字保留，非 UI 信息不渲染。
6. **确定性保真检查**：读取 [fidelity-verification.md](references/fidelity-verification.md)，先检查层级、文案、范围、路径与泄漏。
7. **验证实际最终交付物**：再读 [quality-gates.md](references/quality-gates.md)，在实际交付物中走完核心路径。本地 HTML 是默认终态，不要求发布；仅当用户明确要求在线或容器本身在线时检查 URL。
8. **容器完成**：最后读取 [capability-policy.md](references/capability-policy.md)。简单评审可交付本地 HTML；高保真、品牌或用户要求 Inspire 编辑时才进入 Inspire 路由。

统一入口：

```bash
node bin/prd-to-editable-demo.mjs --prd <prd-path> --requirements <requirements-ir.json> --out <output-directory>
```

宿主以 `model-semantic` 建立需求模型，明确业务对象并保存逐字原文证据；启发式解析只允许作为低置信兜底，不得以领域词表替代核心理解。关键证据不足时必须澄清，不得静默降级。专业接管信号写入 `specialist-handoff.json`。

专业模式以 Inspire 作为唯一专业最终容器。专业路由不得把 `private:prd-to-editable-demo` 作为 `--skill`；它不是 Inspire Builder 业务设计 Skill。外部 Agent 编排 Skill 与 `<source:key@version>` 业务设计 Skill 身份分离；必须验证可见性，并确认 `activatedSkills` 与 `openedSkills` 同时包含预检的来源、key、版本和 package hash；未激活、未打开即失败：

```bash
node bin/run-inspire-pipeline.mjs --handoff <specialist-handoff.json> --design-skill <source:key@version> --out <delivery-directory>
```

迭代已有原型时追加 `--ref <assetId>`。用户可直接在 Inspire 中编辑；不得要求导出修改任务给另一个 Agent。缺少授权、品牌素材或业务设计能力时保存进度并明确阻塞/降级，不能静默把本地结果冒充专业终态。可发现工具只作可验证增强。

## Example

一个领域中立 PRD 同时写了“提交后显示原文 `Request received`”和“调研显示转化率可能提升 12%”。前者映射到结果页的精确文案与提交动作；后者保留为 `research_evidence`，不显示在 UI。若 PRD 未说明提交失败后留在当前页还是进入错误页，这会改变流程，先以“建议留在当前页并允许重试”为首选，仅询问该主题；确认后冻结 baseline，再生成并实走提交路径。

## Common Pitfalls

- **反模式**：把 PRD 压成几个卡片，用背景、指标和优先级填满首页，再用“点击后提示成功”冒充闭环。
- 不得将章节标题机械变成页面，不得展示完整 IR 给用户，不得在确认后“顺手优化”文案或布局。
- Emoji 数量必须为 0；不得用文字或符号冒充 Icon。素材须有来源，品牌缺失时阻塞发布。
- 自动检查通过不代表视觉优秀；品牌原生感、层级、密度和素材质量仍需主观视觉验收。
- 兼容回收可用 `finalize-specialist.mjs` 保留 `index.original.html` 并由 `verify-specialist.mjs` 验证，但不能替代所选容器的正式终态。

## References

交互和视觉细节按需读取 [interaction-design.md](references/interaction-design.md) 与 [visual-quality.md](references/visual-quality.md)。交付前运行测试、benchmark、smoke，并报告未能执行的真实浏览器检查。
