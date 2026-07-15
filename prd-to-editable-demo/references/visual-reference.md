# 图片参考绑定协议

## Input

每张图片、IR 页面/区域上下文，以及用户对参考用途的说明。

## Output

符合 `schemas/visual-reference-manifest.schema.json` 并通过 `validateVisualReferences` 的逐图 manifest。每张图单独声明 `scope`、`bindings`（属性与 fidelity）、`exclude`。`exact` 不可改；`high` 高度接近；`local` 仅局部采用；`inspiration` 只提取方向。后三者必须记录主观审查。

## Blocking

同一范围同一属性出现 exact 冲突、范围未知、或用户没有说明哪张图控制哪项且结果会改变可见体验时询问用户。

## Prohibited shortcuts

不得把多图默认混成 moodboard；颜色参考不得偷带布局，布局参考不得偷带颜色；不得省略排除项或用“参考整体感觉”冒充绑定。

## Domain-neutral JSON example

```json
[
  {"id":"palette","asset":"palette.png","scope":{"pageId":"p1"},"bindings":[{"property":"color","fidelity":"high"}],"exclude":["layout"]},
  {"id":"structure","asset":"wireframe.png","scope":{"pageId":"p1"},"bindings":[{"property":"layout","fidelity":"exact"}],"exclude":["color"]}
]
```
