# Unity + ToLua Hall Profile

`unity-tolua-hall` 是一个面向 Unity + ToLua 大厅仓库的 OSpec Lite profile。

它的目标不是直接写死项目事实，而是把仓库初始化成一个更适合 Codex / Claude Code 读库、补文档、做 code review 的工作流。

## 适用团队

这个 profile 是专门给 Unity 大厅项目组使用的。

更具体地说，它面向的是：
- 负责大厅主流程、宿主启动、热更、网络、支付与回大厅流程的团队
- 需要让 Codex / Claude Code 更快建立大厅仓库心智模型的项目组
- 希望把“初始化 -> 证据整理 -> 项目文档补全 -> verify”串成固定工作流的团队

## 适用场景

适用于满足以下条件的仓库：
- 这是大厅仓库，而不是某个单独子游戏仓库
- 核心运行时围绕 `Assets/_GameCenter/`
- 启动链锚点为 `Assets/_GameCenter/FrameWork/Behaviours/Launch.cs`、`Assets/_GameCenter/LuaFramework/Scripts/Main.cs`、`Assets/_GameCenter/ClientLua/Main.lua`
- 子游戏模块通常挂在 `Assets/_GameModule/<game>/`
- 需要在大厅文档里明确区分大厅逻辑与子游戏逻辑的阅读边界

## 推荐给团队成员的说法

最推荐直接对 agent 说：

```text
安装并阅读 npm package ospec-lite。如果当前仓库还没用 oslite init 过，则帮我用 unity-tolua-hall 的 profile 去 init ospec-lite；如果这个工程还没初始化，请先推断项目名并向我确认。然后先补 evidence-map，再补正式项目文档，最后跑 oslite docs verify。
```

如果你想把项目名先填好，可以直接发这一句：

```text
安装并阅读 npm package ospec-lite。如果当前仓库还没用 oslite init 过，则帮我用 unity-tolua-hall 的 profile 去 init ospec-lite；如果这个工程还没初始化，请先推断项目名并向我确认。然后先补 evidence-map，再补正式项目文档，最后跑 oslite docs verify。
```

如果是英文环境，可以说：

```text
Install and read the ospec-lite npm package. If the current repo has not been initialized with `oslite init` yet, help me init ospec-lite with the unity-tolua-hall profile. If the repo is not initialized yet, infer the project name and ask me to confirm it first. Then fill evidence-map before the final docs, and finish with oslite docs verify.
```

## 在 Codex / Claude Code 中怎么用

推荐项目先安装本地依赖：

```powershell
npm.cmd install --save-dev ospec-lite
```

安装完成后，大厅项目组成员不需要记 GitHub repo 地址或本机绝对路径，直接按下面这句触发即可：

```text
安装并阅读 npm package ospec-lite。如果当前仓库还没用 oslite init 过，则帮我用 unity-tolua-hall 的 profile 去 init ospec-lite；如果这个工程还没初始化，请先推断项目名并向我确认。然后先补 evidence-map，再补正式项目文档，最后跑 oslite docs verify。
```

如果已经知道项目名，也可以直接用这句：

```text
安装并阅读 npm package ospec-lite。如果当前仓库还没用 oslite init 过，则帮我用 unity-tolua-hall 的 profile 去 init ospec-lite；如果这个工程还没初始化，请先推断项目名并向我确认。然后先补 evidence-map，再补正式项目文档，最后跑 oslite docs verify。
```

默认预期是 agent 自己完成这些步骤：
1. 判断仓库是否已经完成 `unity-tolua-hall` 初始化
2. 如未初始化，先推断项目名并向用户确认
3. 在目标工程根目录 `<repo-root>` 上运行 `oslite init --profile unity-tolua-hall ... "<repo-root>"`
4. 先补 `docs/agents/authoring/evidence-map.md`
5. 再补 `AGENTS.md`、`CLAUDE.md`、`docs/project/*`、`docs/agents/*`
6. 最后运行 `oslite docs verify "<repo-root>"`

## Agent 预期行为

当用户只说“用 unity-tolua-hall profile 去 init ospec-lite”时，agent 应该：

1. 先判断仓库是否已经完成 `unity-tolua-hall` 初始化。
2. 如果没有初始化：
   - 从仓库目录名、README、显眼的产品命名中推断项目名。
   - 先向用户确认这个项目名；如果用户没有继续纠正，才把它作为 `--project-name` 传给 `oslite init`。
   - 如果用户已经给了明确的工程路径，优先在那个 `<repo-root>` 上执行命令；否则默认当前工作目录就是目标工程根目录。
   - 结合当前环境选择 `--bootstrap-agent`，不明确时使用 `none`。
3. 初始化完成后，先填写 `.oslite/docs/agents/authoring/evidence-map.md`。
4. 再回填 `AGENTS.md`、`CLAUDE.md`、`.oslite/docs/project/*`、`.oslite/docs/agents/*`。
5. 最后运行 `oslite docs verify "<repo-root>"`。

## 这个 profile 会生成什么

- `AGENTS.md`
- `CLAUDE.md`
- `.oslite/docs/project/*`
- `.oslite/docs/agents/*`
- `.oslite/docs/agents/authoring/*`
- `.codex/skills/oslite-fill-project-docs/SKILL.md`
- `.claude/commands/oslite-fill-project-docs.md`

## 注意事项

- 这个 profile 会写死大厅启动锚点：`Assets/_GameCenter/ClientLua/Main.lua`
- 子游戏逻辑默认从 `Assets/_GameModule/<game>/` 开始判断，并优先读取该子游戏仓库自己的 `AGENTS.md` 或 `CLAUDE.md`
- 非 Editor 的运行时 C# 修改默认需要先征求用户许可，因为通常会涉及 APK 重新发布
- 涉及支付、下单、票据校验、出入款、收银台、渠道计费等真钱流程时，必须先与用户二次确认再改
- 除这些已知规则外，其余项目事实应该来自仓库阅读和证据整理，而不是模板预设
- 在非交互环境里运行 `init` 时，建议显式传入：
  - `--project-name`
  - `--bootstrap-agent`
