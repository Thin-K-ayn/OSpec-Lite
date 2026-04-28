# OSpec Lite

[English](./README.md) | [简体中文](./README.zh-CN.md)

面向 Codex 和 Claude Code 的轻量级 agent-first 仓库引导工具。

`ospec-lite` 的目标是让仓库更容易被编码 agent 理解，也更方便团队审阅并安全修改。它会在 `.oslite/` 下初始化仓库本地指令、机器可读索引、小型项目知识层，以及轻量的 change 与 bug 工作流。

V1 刻意保持小而稳的能力边界：一次性 bootstrap、非破坏式 refresh、可选 profile、基于 profile 的确定性文档校验，以及简单的 change / bug 跟踪。

[为什么使用 OSpec Lite](#为什么使用-ospec-lite) | [快速开始](#快速开始) | [会生成什么](#会生成什么) | [Profiles](#profiles) | [Codex 插件](#codex-插件) | [Plugins 模块](#plugins-模块) | [命令参考](#命令参考) | [开发](#开发)

## 为什么使用 OSpec Lite

- 自动生成 `AGENTS.md` 和 `CLAUDE.md`，让 Codex 与 Claude Code 一进仓库就能拿到本地指引。
- 生成 `.oslite/index.json`，提供机器可读的仓库摘要。
- 创建 `.oslite/docs/project/*` 与 `.oslite/docs/agents/*`，把项目知识层和代码放在同一个仓库里维护。
- 支持纯内容型 profile，可追加 authoring pack 和轻量 agent wrapper，而不引入插件运行时。
- 在 `.oslite/changes/active/*` 下跟踪轻量变更，并在验证完成后归档。
- 在 `.oslite/bugs/active-bugs.md` 里跟踪活跃 bug，把可复用经验写进滚动的 bug-memory 文件，并在记忆过大时自动 compact 失效知识。
- 通过 `oslite docs verify` 对 profile 驱动的文档进行确定性校验。
- 通过 `oslite report` 生成非破坏式的日报或周报。
- 自带一组 repo-local 的 Codex companion plugins，并提供插件模块来继续安装或脚手架更多插件。

## 快速开始

开始使用 `oslite` 时，直接告诉你的编码 agent，也就是 Codex 或 Claude Code，让它为你安装并初始化。不要一开始就自己输入 CLI 命令。

```text
请在当前仓库安装 ospec-lite，初始化 OSpec Lite，检查生成的文件，并告诉我哪些内容需要 review。
```

OSpec Lite 也内置了一些针对特定项目结构和技术框架的 profiles。如果你的仓库匹配其中之一，请告诉 agent 在初始化时使用对应 profile：

- [`unity-tolua-game`](./profiles/unity-tolua-game/README.md)：带有 `Script/MJGame.lua` 的 Unity + ToLua 子游戏仓库
- [`unity-tolua-hall`](./profiles/unity-tolua-hall/README.md)：带有 `Assets/_GameCenter/...` 启动链路文件的 Unity + ToLua 大厅 / Lobby 仓库

如果是使用 profile 的 Unity + ToLua 仓库，告诉它：

```text
请在当前仓库安装 ospec-lite，并用 unity-tolua-game profile 初始化 OSpec Lite。项目名用 "BuYuDaLuanDou"，bootstrap agent 用 codex。然后检查生成的 authoring pack，并告诉我还需要哪些代码证据。
```

如果要生成中文文档，告诉它：

```text
请在当前仓库安装 ospec-lite，并用 zh-CN 文档初始化 OSpec Lite。完成后用普通语言解释生成的文件。
```

之后继续通过告诉 agent 目标来使用 OSpec Lite：

```text
检查 OSpec Lite 状态，并刷新仓库知识层。
为 improve-readme 创建一个 OSpec Lite change，并在工作过程中维护 change 记录。
为 "startup ordering blocks cold boot" 创建一个 OSpec Lite bug，并在验证后 apply bug memory lesson。
运行 OSpec Lite docs verification，并解释所有缺失要求。
生成一份每周 OSpec Lite 工作汇报。
```

agent 应该自己判断要运行哪些 `oslite` 命令。只有在你想直接控制终端时，才需要看下面的命令参考。

### 跟踪一个轻量 change

一个 change 是围绕单个非琐碎任务的仓库内工作记录。它不是 git branch，也不是 commit。你可以把它理解成“最小可审阅工作单元”：把需求、计划、实际改动和验证记录放在代码旁边。

它的价值主要在于：

- 让人和 agent 在动手前先对范围达成一致
- 把需求、计划、实施、验证拆开记录，方便交接和 review
- 在归档后保留“为什么改、怎么改、怎么验”的历史线索

什么时候值得开一个 change：

- 会改多个文件
- 会改变行为、接口、规则或架构认知
- 需要明确的 review 说明或验证步骤
- 这项工作可能跨多个会话、多个提交，甚至需要中途交接

`oslite change new <slug> .` 会创建：

```text
.oslite/changes/active/<slug>/
  change.json
  request.md
  plan.md
  apply.md
  verify.md
```

各文件职责：

- `request.md`：记录用户请求、范围和验收说明
- `plan.md`：记录动手前的实现思路、预计影响文件和风险
- `apply.md`：记录实际改了什么，以及和计划不一致的地方
- `verify.md`：记录执行过的命令、结果、人工验证和剩余风险
- `change.json`：机器可读的状态和元数据

告诉你的 agent：

```text
请为 improve-readme 创建一个 OSpec Lite change，并在工作过程中维护 request、plan、apply 和 verify 记录。
```

推荐的 agent 流程：

1. 先创建 change 目录。
2. 在大改之前先写 `request.md` 和 `plan.md`。
3. 在标记为 applied 之前先补齐 `change.json.affects`。
4. 再开始实现。
5. 实现完成后补 `apply.md`，再标记为 applied。
6. 验证时在 `verify.md` 里写明真实命令和结果，再标记为 verified。
7. 确认完成后再归档。

agent 会在记录从需求推进到已验证工作的过程中使用 `oslite change new`、`oslite change apply`、`oslite change verify` 和 `oslite change archive`。

### 跟踪并应用一个 bug 修复

bug item 可以理解成 defect 版本的 change：它用来把症状、排查、修复、验证，以及“这次为什么会想错”都放在一个地方。

它的价值主要在于：

- 让一个缺陷从报告到修复落地都留在同一个共享 active bug section 里
- 强制把错误假设和真实代码逻辑写清楚
- 在 `.oslite/docs/project/bug-memory.md` 及其关联 segment 文件里积累以后能复用的提醒

`oslite bug new "<title>" .` 会创建：

```text
.oslite/bugs/active-bugs.md
.oslite/docs/project/bug-memory.md
.oslite/docs/project/bug-memory/memory-0001.md
```

告诉你的 agent：

```text
请为 "startup ordering blocks cold boot" 创建一个 OSpec Lite bug，记录症状、复现、根因、修复、验证和应该沉淀的 bug memory lesson。
```

推荐的 agent 流程：

1. 先创建 bug item，并在 `.oslite/bugs/active-bugs.md` 里填写新的 `bug-####` section。
2. 在这个 active bug section 里补齐症状、复现、排查证据和根因。
3. 完成修复后，把 `Fix Summary`、`File`、`Reason` 改成真实内容。
4. 运行 `oslite bug fix <bug-id>` 标记修复已完成。
5. 再补上真实验证证据，以及包含具体 `Check First` 路径的认知缺口记录。
6. 运行 `oslite bug apply <bug-id>`，把经验沉淀进 bug memory、把条目移出 active queue，并在需要时 compact 失效知识。

## 会生成什么

`oslite init` 是一次性 bootstrap。对一个全新的仓库执行通用初始化时，会生成：

```text
.oslite/
  config.json
  index.json
  docs/
    project/
      overview.md
      architecture.md
      repo-map.md
      coding-rules.md
      glossary.md
      entrypoints.md
      bug-memory.md
      bug-memory/
    agents/
      quickstart.md
      change-playbook.md
      bug-playbook.md
  bugs/
    active-bugs.md
  changes/
    active/
    archived/

AGENTS.md
CLAUDE.md
```

如果选择了 profile，还可能额外生成：

```text
.oslite/docs/agents/authoring/*
.codex/skills/oslite-fill-project-docs/SKILL.md
.claude/commands/oslite-fill-project-docs.md
```

如果仓库已经初始化过，`oslite init` 会报告当前状态并直接退出，而不会重写已有知识层。
如果仓库后续发生了结构变化，可以运行 `oslite refresh`：它会重新扫描仓库，只更新 machine-managed 产物，并提示哪些 human-owned 文档需要人工复核。

## 典型 Profile 工作流

告诉你的 agent profile、项目名和 bootstrap agent，然后让它：

1. 用正确的 profile 初始化仓库。
2. 先检查生成的 authoring pack，再写最终文档。
3. 先用具体代码证据填写 `.oslite/docs/agents/authoring/evidence-map.md`。
4. 完成 `AGENTS.md`、`CLAUDE.md`、`.oslite/docs/project/*` 与 `.oslite/docs/agents/*`。
5. 最后运行 docs verification，并解释是否还有缺口。

## Profiles

| Profile | 目标仓库 | 必需仓库锚点 | 输出语言 |
| --- | --- | --- | --- |
| `unity-tolua-game` | Unity + ToLua 子游戏仓库 | `Script/MJGame.lua` | `zh-CN` |
| `unity-tolua-hall` | Unity + ToLua 大厅 / Lobby 仓库 | `Assets/_GameCenter/...` 启动链路文件 | `zh-CN` |

当前内置的两个 profile 都：

- 是纯内容型 asset pack，不是可执行插件
- 会追加 `.oslite/docs/agents/authoring/*`
- 可以生成仓库本地的 Codex 与 Claude Code wrapper
- 在 init 时要求 `projectName` 和 `bootstrapAgent`

Profile 文档：

- [profiles/README.md](./profiles/README.md)
- [profiles/unity-tolua-game/README.md](./profiles/unity-tolua-game/README.md)
- [profiles/unity-tolua-hall/README.md](./profiles/unity-tolua-hall/README.md)

## Codex 插件

本仓库现在自带一组 repo-local 的 Codex companion plugins，位于 [`plugins/`](./plugins)。

- 核心工作流插件：[`plugins/ospec-lite-codex/`](./plugins/ospec-lite-codex)
- 仓库 marketplace：[`.agents/plugins/marketplace.json`](./.agents/plugins/marketplace.json)
- 主技能：`$ospec-lite-workflow`

在 Codex 中打开本仓库后，让它读取 repo-local marketplace。这个插件不会替代 `oslite` CLI；它的作用是教 Codex 何时调用 CLI，以及怎样稳定地遵循 profile 驱动的 OSpec Lite 工作流。

示例提示词：

- `用 OSpec Lite 初始化这个仓库。`
- `检查 OSpec Lite 状态，并解释缺失的 markers。`
- `继续补 profile 文档，并运行 oslite docs verify。`
- `为 add-login-flow 创建一个 OSpec Lite change。`
- `为这个仓库设置一个每周 OSpec Lite 汇报 automation。`

## Plugins 模块

`oslite plugins` 管理的是 repo-local Codex companion plugin 资产，不是可执行插件运行时。它负责维护 `plugins/<name>/` 与 `.agents/plugins/marketplace.json`，让仓库可以稳定地携带本地插件，而不是每次都手改 manifest 和 marketplace。

当前内置的 starter plugins：

- `ospec-lite-codex`：OSpec Lite 工作流 companion plugin

告诉你的 agent：

```text
请列出当前仓库的 OSpec Lite repo-local plugins。如果缺少内置 defaults，请安装它们，并解释 plugins/ 和 .agents/plugins/marketplace.json 发生了什么变化。
```

## 命令参考

下面是上述工作流背后可能用到的原始 CLI 命令。它们适合 automation、debug，以及偏好直接控制终端的维护者。

```text
oslite init [path] [--document-language en-US|zh-CN] [--profile <profile-id>] [--project-name <name>] [--bootstrap-agent codex|claude-code|none]
oslite status [path]
oslite refresh [path]
oslite report [path] [--cadence daily|weekly]
oslite bug new <title> [path]
oslite bug fix <bug-id> [path]
oslite bug apply <bug-id> [path]
oslite docs verify [path]
oslite plugins list [path]
oslite plugins install <plugin-name|plugin-path> [path] [--installation AVAILABLE|INSTALLED_BY_DEFAULT|NOT_AVAILABLE] [--authentication ON_INSTALL|ON_USE] [--force]
oslite plugins install-defaults [path] [--force]
oslite plugins create <plugin-name> [path] [--display-name <name>] [--description <text>] [--category <category>] [--with-skills] [--with-hooks] [--with-scripts] [--with-assets] [--with-mcp] [--with-apps] [--no-marketplace] [--installation AVAILABLE|INSTALLED_BY_DEFAULT|NOT_AVAILABLE] [--authentication ON_INSTALL|ON_USE] [--force]
oslite change new <slug> [path]
oslite change apply <change-path>
oslite change verify <change-path>
oslite change archive <change-path>
```

## 文档

- [docs/ospec-lite-v1-core-spec.md](./docs/ospec-lite-v1-core-spec.md)

## 开发

```sh
npm install
npm run build
npm run typecheck
npm test
```
