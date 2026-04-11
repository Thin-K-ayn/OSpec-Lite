# 变更行动手册

## 开始前
- 先更新 `.oslite/docs/agents/authoring/project-brief.md` 中的 repo 特有信息。
- 先读 `.oslite/docs/agents/authoring/repo-reading-checklist.md`，再补齐 `.oslite/docs/agents/authoring/evidence-map.md`。
- 没有证据文件时，不要把结论写成“确认”。

## 何时必须同步更新文档
- 主流程、启动链、退出链、宿主边界发生变化。
- 主代码目录职责或导航方式发生变化。
- 网络入口、资源入口、配置映射入口发生变化。
- 代码约定、生命周期收口方式、review 高频坑位发生变化。

## 何时不要写进核心项目文档
- 临时目录
- 临时工具
- 一次性脚本
- `Editor/` 等明确排除目录的内部实现

## 完成前自查
- `.oslite/docs/agents/authoring/evidence-map.md` 已补齐关键章节。
- `.oslite/docs/project/*` 与 `.oslite/docs/agents/*` 已按证据回填。
- 已运行 `oslite docs verify .` 并清完所有失败项。
