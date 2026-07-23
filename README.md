# PRD Demo Skills

本仓库保存 PRD 到交互原型能力的可审计源码。

## 当前正式版：`prd-demo`

仓库目录仍保留为 `prd-to-editable-demo/`，其中内容已完整升级为当前在 Skills 平台和 Mira 发布的 `prd-demo` 正式工作流。它覆盖：

- 逐项需求确认；
- 三种真实视觉方向探索；
- 用户动线图逐节点确认；
- 高保真交互原型生成；
- 有真实截图证据的三层 QA；
- `html-editor` 标注回改；
- Figma 批量采集任务的可选消费。

Skills 平台正式版本：`1.0.10`。

本地验证：

```bash
python3 -m unittest discover -s prd-to-editable-demo/test -v
python3 prd-to-editable-demo/scripts/build_release.py
```
