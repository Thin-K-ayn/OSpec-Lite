# 变更行动手册

## change 是什么

- 一个 change 对应一个非琐碎任务的仓库内工作记录。
- 它不是 git branch，也不是 commit。
- 它的作用是把“需求、计划、实际改动、验证结果”拆开记录，方便 review、交接和追溯。

## change 目录里有什么

每个 active change 都在 `.oslite/changes/active/<slug>/` 下，通常包括：

- `request.md`：需求和范围
- `plan.md`：计划、预期影响文件、风险
- `apply.md`：实际做了什么
- `verify.md`：怎么验证、还剩什么风险
- `change.json`：状态和元数据

## 推荐节奏

1. 先用 `oslite change new <slug> .` 建 change。
2. 大改前先补 `request.md` 和 `plan.md`。
3. 改完后补 `apply.md`，再标记 `applied`。
4. 验证后补 `verify.md`，再标记 `verified`。
5. 确认结束后再归档。

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
