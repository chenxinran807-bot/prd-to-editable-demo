# 确定性保真验证协议

## Input

冻结 baseline 和生成后的实际页面 model。

## Output

`verifyFidelity` 的机器可读 checks 与 traceability：页面、taxonomy、requirements、exact copy、actions、core journeys、视觉绑定及非 UI 泄漏全部通过；非 exact 视觉项另标主观审查。

## Blocking

缺页、层级变化、精确文案变化、背景/研究/指标/优先级泄漏、图片属性越界、静态 notice、错误目标、重复/不可达动作或核心旅程未闭环均失败。视觉精致不能抵消任何产品错误。

## Prohibited shortcuts

不得以“已声明”“已渲染”或静态成功提示代替功能；不得只看截图；不得用视觉评分冲掉产品保真失败。

## Domain-neutral JSON example

```json
{"status":"passed","checks":[{"name":"exact copy","passed":true},{"name":"core journeys","passed":true}],"traceability":[{"kind":"action","id":"a1","pageId":"p1","elementKeys":["submit"]}]}
```
