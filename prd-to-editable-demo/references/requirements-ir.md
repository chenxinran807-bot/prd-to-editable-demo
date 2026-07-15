# 无损需求 IR v2 协议

## Input

完整 PRD 原文（不先摘要）及用户已确认内容。

## Output

符合 `schemas/requirements-ir-v2.schema.json` 并通过 `validateRequirementsIrV2` 的 JSON。每个有意义原文块进入 `sourceCoverage`；`sourceUnits` 将内容标为 `product_requirement`、`acceptance_criterion`、`design_constraint`、`business_context`、`research_evidence` 或 `delivery_metadata`。指标和优先级按上下文归入非产品用途，除非原文明确要求用户可见。

结构不是摘要：保留信息密度、原文证据、taxonomy 父子关系、页面/区域顺序、动作端点与核心旅程。只有具备 `product_requirement` 证据的 requirement 可设 `uiEligible: true`。

## Blocking

源文存在未映射信息、证据不是逐字子串、层级断裂、旅程不连续，或影响页面/流程/可见体验的内容为 missing/conflicting 时阻塞进入生成并交给澄清协议。

## Prohibited shortcuts

不得按章节标题造页面；不得丢掉背景或研究（应分类保存）；不得把背景、研究、指标、优先级、交付元数据当默认 UI；不得用行业词表或完整 IR 展示替代理解。

## Domain-neutral JSON example

```json
{
  "schemaVersion": 2,
  "sourceUnits": [{"id":"s1","purpose":"product_requirement","certainty":"explicit","quote":"Submit opens the receipt"}],
  "sourceCoverage": [{"quote":"Submit opens the receipt","sourceIds":["s1"]}],
  "requirements": [{"id":"r1","text":"Open receipt","sourceIds":["s1"],"uiEligible":true,"taxonomyIds":["t1"]}],
  "taxonomy": [{"id":"t1","label":"Request","parentId":null}],
  "pages": [{"id":"p1","name":"Form","regionIds":["g1"]},{"id":"p2","name":"Receipt","regionIds":[]}],
  "regions": [{"id":"g1","pageId":"p1","name":"Actions"}],
  "actions": [{"id":"a1","name":"Submit","fromPageId":"p1","toPageId":"p2","regionId":"g1","requirementIds":["r1"]}],
  "coreJourneys": [{"id":"j1","name":"Submit request","actionIds":["a1"],"startPageId":"p1","expectedEndPageId":"p2"}],
  "blockers": []
}
```
