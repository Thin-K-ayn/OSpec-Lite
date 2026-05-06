# 快速读库

## 推荐阅读顺序
1. 先看 `.oslite/docs/agents/authoring/fill-project-docs.md`
2. 再看 `.oslite/docs/agents/authoring/project-brief.md`
3. 再看 `.oslite/docs/agents/authoring/repo-reading-checklist.md`
4. 从 `Script/MJGame.lua` 开始建立入口链认知
5. 写完 `.oslite/docs/agents/authoring/evidence-map.md` 后，再读 `.oslite/docs/project/*`

## 推荐检索关键词
- `MJGame`
- `Start`
- `Enter`
- `Exit`
- `Release`
- `Open`
- `Replace`
- `Request`
- `AssetBundle`
- `protobuf`

## Review 优先检查项
- 入口判断是否真实来自代码，而不是模板猜测
- 生命周期清理是否有证据支持
- 网络、资源、UI、宿主边界是否被写清楚
- 排除目录是否被误写进核心项目文档

## 工作汇报
- `oslite report . --cadence daily|weekly`：在终端生成当前 OSpec Lite 工作摘要。
- `oslite report write . --cadence daily|weekly`：在 `.oslite/reports/<cadence>/` 下写入 Markdown 和 JSON report artifacts。
- `oslite report schedule . --cadence daily|weekly`：写入仓库本地 report schedule；之后让 cron、CI 或 agent automation 反复执行 `oslite report run .`。

## 不要浪费时间的区域
- 临时目录
- 辅助目录
- 一次性工具目录
- 未被证据确认的历史资料目录
