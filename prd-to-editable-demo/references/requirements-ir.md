# 需求语义结构

在运行统一入口前，由宿主 Agent 根据完整 PRD 生成 JSON。理解来自模型对上下文、角色、对象、动作和因果关系的分析；程序负责证据与结构校验，不负责用领域词表替代理解。

## 必填结构

```json
{
  "schemaVersion": 1,
  "extractionMode": "model-semantic",
  "confidence": "high",
  "title": "需求名称",
  "actor": "核心用户或角色",
  "goal": "用户要完成的结果",
  "businessObjects": ["业务对象"],
  "userActions": ["用户或系统动作"],
  "states": ["业务状态"],
  "screens": ["为完成任务所需的界面或交互层"],
  "pageContent": [
    { "screen": "界面名", "elements": ["必须呈现的内容模块或信息点"], "evidence": "PRD 原文片段" }
  ],
  "informationArchitecture": [
    { "parent": "界面名", "children": ["分类或下级入口"], "evidence": "PRD 原文片段" }
  ],
  "transitions": [
    { "from": "起点", "action": "触发动作", "to": "终点", "evidence": "PRD 原文片段" }
  ],
  "evidence": [
    { "kind": "business-object", "term": "对象", "quote": "PRD 原文片段" },
    { "kind": "user-action", "term": "动作", "quote": "PRD 原文片段" }
  ],
  "assumptions": ["为形成初版而作出的推断"],
  "gaps": ["PRD 未明确且会影响方案的内容"]
}
```

## 约束

- `quote` 和流转的 `evidence` 必须是 PRD 中逐字存在的连续片段。
- 每个 `businessObjects` 和 `userActions` 条目必须有同 kind、同 term 的证据。
- 每条流转的起点和终点必须存在于 `screens`。
- `pageContent` 保留每个页面的内容密度，不能只写页面名。`informationArchitecture` 保留 Tab、分类、分组和父子入口，不得拍平为无层级的标签。
- 上述两类条目只在 PRD 存在对应证据时填写；它们的 `evidence` 同样必须是 PRD 中逐字存在的连续片段。
- PRD 没写界面名称时可以基于任务语义命名，但须放入 `assumptions`；不得伪造原文证据。
- PRD 没写的角色、规则、状态、品牌规范或异常处理放入 `gaps`，不得当作事实。
- 行业和产品专有词可以出现在本次 JSON 中，但不得写回通用 Skill 代码或模板。
