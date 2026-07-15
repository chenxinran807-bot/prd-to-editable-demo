# 最终交付验证协议

## Input

已通过确定性保真检查的候选、冻结 baseline，以及实际最终交付目录或明确要求的 HTTP(S) URL。

## Output

浏览器级旅程报告：逐个核心 action 验证控件唯一、可见、可用、点击后到达预期页面/状态，并捕获页面错误、console error 与关键资源失败。默认对本地 HTML 启动临时本地服务验证，无需发布；仅用户明确要求在线或容器本身在线时验证 URL。

## Blocking

声明/渲染但不可达、disabled/hidden/重复控件、静态 notice、错误目标、运行时错误，或任一核心旅程未闭环均不得交付。专业 Inspire 还须验证预检与 `openedSkills`、`activatedSkills` 的来源、版本、package hash 一致。

## Prohibited shortcuts

不得要求本地 HTML 先发布；不得用静态检查、截图或“功能已实现”文本替代实走；不得用视觉 polish 抵消产品错误；不得覆盖上一已接受版本。

## Domain-neutral JSON example

```json
{"status":"passed","mode":"local","journeys":["submit-request"],"checks":["submit-request:start:form","submit-request:submit:receipt"]}
```

确定性通过后仍须主观视觉审查层级、平台原生感、密度、节奏、素材质量与业务语义；结论附可定位证据。Emoji 和文字假 Icon 为 0，素材有来源或明确待替换标记。
