# 填写项目文档

## 如果用户只是说“用 `unity-tolua-game` profile 去 init ospec-lite”
1. 先判断仓库是否已经完成 `unity-tolua-game` 初始化。
2. 如果还没有初始化：
   - 如果用户已经给了明确的工程路径，记为 `<repo-root>`；否则默认当前工作目录就是目标工程根目录，也就是 `<repo-root>`
   - 先从仓库目录名、现有 README、明显的产品命名中推断项目名。
   - 向用户确认这个项目名；如果用户没有纠正，再把它作为 `--project-name` 使用。
   - 如果用户没有明确指定 bootstrap agent，则默认使用当前 agent 环境；如果当前环境不明确，则使用 `none`。
   - 运行：`oslite init --profile unity-tolua-game --project-name "<项目名>" --bootstrap-agent <codex|claude-code|none> "<repo-root>"`
3. 如果已经初始化，不要重复运行 `init`，直接继续下面的读库流程。

## 阶段一：先读仓库并填写证据地图
1. 先阅读 `project-brief.md`，确认 repo 特有提示与排除目录。
2. 按 `repo-reading-checklist.md` 逐项探索仓库。
3. 先补齐 `evidence-map.md`，不要直接跳到正式文档。
4. 对本 profile，默认从 `Script/MJGame.lua` 开始建立主入口认知。

## 阶段二：根据证据回填正式文档
1. 再回填 `AGENTS.md`、`CLAUDE.md`、`.oslite/docs/project/*`、`.oslite/docs/agents/*`。
2. 对关键章节统一使用：`结论 / 证据文件 / 确认状态 / 未确认点`。
3. 没有证据文件时，不得把结论写成“确认”。
4. 不要把临时目录、辅助目录、一次性工具目录扩写进核心项目文档。

## 停止前自查
- `project-brief.md` 已核对
- `evidence-map.md` 已补齐关键章节
- 正式文档没有遗留 `待补充`、`TODO`、空 bullet
- 所有证据路径真实存在
- 已运行 `oslite docs verify "<repo-root>"`

## 最终文档应回答
- 项目从哪里启动
- 主流程如何流转
- 核心模块各自负责什么
- 网络从哪里发、从哪里收
- 资源从哪里加载
- 哪些文件改动风险最高
- 应该按什么顺序读代码
