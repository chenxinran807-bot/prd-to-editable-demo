# 冻结执行协议

## Input

无关键 blocker 的确认后 IR、已验证视觉 manifest，以及上一 baseline（若迭代）。

## Output

由 `compileExecutionBaseline` 生成的深冻结、递增版本 baseline。逐项映射 `PRD module -> page position -> component -> state -> trigger -> next page/state`，保留 taxonomy、页面和区域顺序、精确文案、动作端点、核心旅程与非 UI 保护内容。

## Blocking

任何未解决 P0/P1、悬空目标、重复实体、错误区域归属或不连续核心旅程都阻塞生成。

## Prohibited shortcuts

确认后不得重新解释、优化或改写 exact copy、布局、层级和流程；不得扁平化嵌套结构；额外功能不得改变或挤占核心闭环。

## Domain-neutral JSON example

```json
{"version":3,"pages":[{"id":"p1","regions":[{"id":"g1"}],"requirements":[{"id":"r1","exactCopy":"Request received"}],"actions":[{"id":"a1","fromPageId":"p1","toPageId":"p2","regionId":"g1"}]}],"coreJourneys":[{"id":"j1","startPageId":"p1","actionIds":["a1"],"expectedEndPageId":"p2"}]}
```
