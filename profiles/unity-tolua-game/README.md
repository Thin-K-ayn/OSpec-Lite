# Unity + ToLua Game Profile

`unity-tolua-game` 是一个面向 Unity + ToLua 游戏仓库的 OSpec Lite profile。

它的目标不是直接写死项目事实，而是把仓库初始化成一个更适合 Codex / Claude Code 读库、补文档、做 code review 的工作流。

## 适用团队

这个 profile 是专门给 Unity 子游戏项目组使用的。

更具体地说，它面向的是：
- 使用 Unity + ToLua 的子游戏仓库
- 需要让 Codex / Claude Code 更快建立读库心智模型的项目组
- 希望把“初始化 -> 证据整理 -> 项目文档补全 -> verify”串成固定工作流的团队

## 适用场景

适用于满足以下条件的仓库：
- 主代码目录以 `Script/` 为核心
- 使用 Unity + ToLua 风格的 Lua 模块化组织
- 主入口锚点为 `Script/MJGame.lua`

## 推荐给团队成员的说法

最推荐直接对 agent 说：

```text
帮我用 unity-tolua-game 的 profile 去 init ospec-lite；如果还没初始化，请先推断项目名并向我确认。然后先补 evidence-map，再补正式项目文档，最后跑 oslite docs verify。
```

如果你想把项目名先填好，可以直接发这一句：

```text
帮我用 unity-tolua-game 的 profile 去 init ospec-lite；如果还没初始化，请先推断项目名并向我确认。然后先补 evidence-map，再补正式项目文档，最后跑 oslite docs verify。项目名称是 XXXX（这里记得填一下，不填估计它会自己乱写）。
```

如果是英文环境，可以说：

```text
Help me use the unity-tolua-game profile to init ospec-lite. If the repo is not initialized yet, infer the project name and ask me to confirm it first. Then fill evidence-map before the final docs, and finish with oslite docs verify.
```

## 在 Codex / Claude Code 中怎么用

推荐项目先安装本地依赖：

```powershell
npm.cmd install --save-dev ospec-lite@0.1.0
```

安装完成后，子游戏项目组成员不需要手动拆命令，直接在 Codex 或 Claude Code 里说下面这句即可：

```text
帮我用 unity-tolua-game 的 profile 去 init ospec-lite；如果还没初始化，请先推断项目名并向我确认。然后先补 evidence-map，再补正式项目文档，最后跑 oslite docs verify。
```

如果已经知道项目名，也可以直接用这句：

```text
帮我用 unity-tolua-game 的 profile 去 init ospec-lite；如果还没初始化，请先推断项目名并向我确认。然后先补 evidence-map，再补正式项目文档，最后跑 oslite docs verify。项目名称是 XXXX（这里记得填一下，不填估计它会自己乱写）。
```

默认预期是 agent 自己完成这些步骤：
1. 判断仓库是否已经完成 `unity-tolua-game` 初始化
2. 如未初始化，先推断项目名并向用户确认
3. 运行 `oslite init --profile unity-tolua-game ...`
4. 先补 `docs/agents/authoring/evidence-map.md`
5. 再补 `AGENTS.md`、`CLAUDE.md`、`docs/project/*`、`docs/agents/*`
6. 最后运行 `oslite docs verify .`

## Agent 预期行为

当用户只说“用 unity-tolua-game profile 去 init ospec-lite”时，agent 应该：

1. 先判断仓库是否已经完成 `unity-tolua-game` 初始化。
2. 如果没有初始化：
   - 从仓库目录名、README、显眼的产品命名中推断项目名。
   - 先向用户确认这个项目名；如果用户没有继续纠正，才把它作为 `--project-name` 传给 `oslite init`。
   - 结合当前环境选择 `--bootstrap-agent`，不明确时使用 `none`。
3. 初始化完成后，先填写 `.oslite/docs/agents/authoring/evidence-map.md`。
4. 再回填 `AGENTS.md`、`CLAUDE.md`、`.oslite/docs/project/*`、`.oslite/docs/agents/*`。
5. 最后运行 `oslite docs verify .`。

## 这个 profile 会生成什么

- `AGENTS.md`
- `CLAUDE.md`
- `.oslite/docs/project/*`
- `.oslite/docs/agents/*`
- `.oslite/docs/agents/authoring/*`
- `.codex/skills/oslite-fill-project-docs/SKILL.md`
- `.claude/commands/oslite-fill-project-docs.md`

## 注意事项

- 这个 profile 会写死一个入口锚点：`Script/MJGame.lua`
- 除此之外，其余项目事实应该来自仓库阅读和证据整理，而不是模板预设
- 在非交互环境里运行 `init` 时，建议显式传入：
  - `--project-name`
  - `--bootstrap-agent`
