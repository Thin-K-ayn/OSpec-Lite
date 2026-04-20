# OSpec Lite

[English](./README.md) | [简体中文](./README.zh-CN.md)

面向 Codex 和 Claude Code 的轻量级 agent-first 仓库引导工具。

`ospec-lite` 的目标是让仓库更容易被编码 agent 理解，也更方便团队审阅并安全修改。它会在 `.oslite/` 下初始化仓库本地指令、机器可读索引、小型项目知识层，以及轻量的 change 与 bug 工作流。

V1 刻意保持小而稳的能力边界：一次性 bootstrap、非破坏式 refresh、可选 profile、基于 profile 的确定性文档校验，以及简单的 change / bug 跟踪。

[为什么使用 OSpec Lite](#为什么使用-ospec-lite) | [会生成什么](#会生成什么) | [安装](#安装) | [用法](#用法) | [Profiles](#profiles) | [Codex 插件](#codex-插件) | [Plugins 模块](#plugins-模块) | [开发](#开发)

## 为什么使用 OSpec Lite

- 自动生成 `AGENTS.md` 和 `CLAUDE.md`，让 Codex 与 Claude Code 一进仓库就能拿到本地指引。
- 生成 `.oslite/index.json`，提供机器可读的仓库摘要。
- 创建 `.oslite/docs/project/*` 与 `.oslite/docs/agents/*`，把项目知识层和代码放在同一个仓库里维护。
- 支持纯内容型 profile，可追加 authoring pack 和轻量 agent wrapper，而不引入插件运行时。
- 在 `.oslite/changes/active/*` 下跟踪轻量变更，并在验证完成后归档。
- 在 `.oslite/bugs/queue.md` 里跟踪活跃 bug，把可复用经验写进滚动的 bug-memory 文件，并在记忆过大时自动 compact 失效知识。
- 通过 `oslite docs verify` 对 profile 驱动的文档进行确定性校验。
- 自带一组 repo-local 的 Codex companion plugins，并提供插件模块来继续安装或脚手架更多插件。

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
    queue.md
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

## 安装

在目标仓库中使用 `ospec-lite`：

```sh
npm install --save-dev ospec-lite
npx oslite init .
```

如果你是在本仓库中开发这个包：

```sh
npm install
npm run build
npm test
```

如果你是在当前 clone 下直接运行，而不是通过安装后的包调用，请使用 `node ./dist/cli/index.js ...`。

## 用法

### 初始化仓库

```sh
npx oslite init .
npx oslite init . --document-language zh-CN
npx oslite init . --profile unity-tolua-game --project-name "BuYuDaLuanDou" --bootstrap-agent codex
npx oslite init . --profile unity-tolua-hall --project-name "NeoHall" --bootstrap-agent codex
```

说明：

- 支持的文档语言只有 `en-US` 和 `zh-CN`。
- 在非交互环境下，当前内置 profile 都要求显式传入 `--project-name` 和 `--bootstrap-agent`。
- `--bootstrap-agent` 允许的值是 `codex`、`claude-code` 和 `none`。

### 查看 bootstrap 状态

```sh
npx oslite status .
npx oslite refresh .
```

`status` 会汇报仓库是否已初始化、当前使用的 profile、文档所在位置，以及 active / archived change 和 active / applied bug 的数量。
`refresh` 会更新 `.oslite/index.json` 与 `AGENTS.md` / `CLAUDE.md` 里的 managed section，同时报告哪些 human-owned 文档的建议内容已经漂移，但不会覆盖这些文档。

### 校验 profile 驱动的文档

```sh
npx oslite docs verify .
```

`docs verify` 仅适用于使用了 profile 初始化的仓库，因为它依赖 active profile 的 authoring pack 和 checklist 做校验。

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

推荐流程：

1. 先创建 change 目录。
2. 在大改之前先写 `request.md` 和 `plan.md`。
3. 在标记为 applied 之前先补齐 `change.json.affects`。
4. 再开始实现。
5. 实现完成后补 `apply.md`，再标记为 applied。
6. 验证时在 `verify.md` 里写明真实命令和结果，再标记为 verified。
7. 确认完成后再归档。

```sh
npx oslite change new improve-readme .
# 先补 request.md 和 plan.md，再开始改文件
npx oslite change apply .oslite/changes/active/improve-readme
npx oslite change verify .oslite/changes/active/improve-readme
npx oslite change archive .oslite/changes/active/improve-readme
```

### 跟踪并应用一个 bug 修复

bug item 可以理解成 defect 版本的 change：它用来把症状、排查、修复、验证，以及“这次为什么会想错”都放在一个地方。

它的价值主要在于：

- 让一个缺陷从报告到修复落地都留在同一个共享 queue section 里
- 强制把错误假设和真实代码逻辑写清楚
- 在 `.oslite/docs/project/bug-memory.md` 及其关联 segment 文件里积累以后能复用的提醒

`oslite bug new "<title>" .` 会创建：

```text
.oslite/bugs/queue.md
.oslite/docs/project/bug-memory.md
.oslite/docs/project/bug-memory/memory-0001.md
```

推荐流程：

1. 先创建 bug item，并在 `.oslite/bugs/queue.md` 里填写新的 `bug-####` section。
2. 在这个 queue section 里补齐症状、复现、排查证据和根因。
3. 完成修复后，把 `Fix Summary`、`File`、`Reason` 改成真实内容。
4. 运行 `oslite bug fix <bug-id>` 标记修复已完成。
5. 再补上真实验证证据，以及包含具体 `Check First` 路径的认知缺口记录。
6. 运行 `oslite bug apply <bug-id>`，把经验沉淀进 bug memory、把条目移出 active queue，并在需要时 compact 失效知识。

```sh
npx oslite bug new "startup ordering blocks cold boot" .
# 先补 .oslite/bugs/queue.md 里的新条目，再实现修复
npx oslite bug fix bug-0001 .
npx oslite bug apply bug-0001 .
```

## 典型 Profile 工作流

1. 用正确的 profile 执行 `oslite init`。
2. 先填写 `.oslite/docs/agents/authoring/evidence-map.md`，再整理最终文档。
3. 完成 `AGENTS.md`、`CLAUDE.md`、`.oslite/docs/project/*` 与 `.oslite/docs/agents/*`。
4. 最后执行 `oslite docs verify .`。

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

## Plugins 模块

`oslite plugins` 管理的是 repo-local Codex companion plugin 资产，不是可执行插件运行时。它负责维护 `plugins/<name>/` 与 `.agents/plugins/marketplace.json`，让仓库可以稳定地携带本地插件，而不是每次都手改 manifest 和 marketplace。

当前内置的 starter plugins：

- `ospec-lite-codex`：OSpec Lite 工作流 companion plugin

示例命令：

```sh
npx oslite plugins list .
npx oslite plugins install-defaults .
npx oslite plugins install ../shared-plugins/my-plugin .
npx oslite plugins create my-plugin . --with-skills --with-hooks
```

## 命令概览

```text
oslite init [path] [--document-language en-US|zh-CN] [--profile <profile-id>] [--project-name <name>] [--bootstrap-agent codex|claude-code|none]
oslite status [path]
oslite refresh [path]
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
