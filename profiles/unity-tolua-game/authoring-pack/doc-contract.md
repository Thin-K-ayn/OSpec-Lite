# 文档编写合同

## 目标
- 为刚完成 OSpec Lite 初始化的仓库生成“可直接用于未来读库与 code review”的项目文档。
- 让后续任何 LLM / 新同事仅通过 `AGENTS.md`、`.oslite/docs/project/*`、`.oslite/docs/agents/*` 就能在 10 分钟内建立正确心智模型。

## 文档范围
- `AGENTS.md`
- `CLAUDE.md`
- `.oslite/docs/project/overview.md`
- `.oslite/docs/project/architecture.md`
- `.oslite/docs/project/repo-map.md`
- `.oslite/docs/project/entrypoints.md`
- `.oslite/docs/project/glossary.md`
- `.oslite/docs/project/coding-rules.md`
- `.oslite/docs/agents/quickstart.md`
- `.oslite/docs/agents/change-playbook.md`

## 工作方式
- 先读仓库，再写文档；不要直接沿用默认扫描文案。
- 先填写 `evidence-map.md`，再回填正式文档。
- 优先服务未来 LLM 读库、定位入口、判断改动影响、做 code review。
- 不要写 README 风格宣传文案；要写工程读库文档。

## 关键写作规则
- 所有不能从代码确认的结论，必须标记为 `推断` 或 `待确认`。
- 证据不足时，不得把结论写成“确认”。
- 文档语言以中文为主，保留英文代码名、类名、目录名。
- 不要把临时目录、辅助目录、一次性工具目录当成正式项目结构写入核心文档。
- 对本 profile，默认把 `Script/MJGame.lua` 作为主入口起点。

## 排除范围
- 与当前文档范围无关的目录文档
- README 扩写
- 临时目录、辅助目录、一次性工具目录的内部实现
- 已被明确排除的非核心目录
