# 渐进澄清协议

## Input

IR 中影响页面、流程或可见体验的 missing/conflicting blockers，以及已确认答案。

## Output

无 blocker 时输出 `null`；否则输出单一主题、最多 3 个决定的 turn，问题先写简短推荐与影响。答案写回对应 requirement，并将已完整解决项标为 confirmed。

## Blocking

P0/P1 关键 blocker 未获得用户答案时，不得冻结 baseline。清晰 PRD 不产生冗余问题。

## Prohibited shortcuts

不得自行决定关键缺口；不得一次混合多个主题；不得超过 3 个决定；不得默认展示长报告或完整 IR。

## Domain-neutral JSON example

```json
{"theme":"failure-path","questions":[{"id":"b1","theme":"failure-path","requirementId":"r1","priority":"P0","question":"建议保留当前页并允许重试；失败后应如何处理？","options":["留在当前页并重试","进入独立错误页"]}]}
```
