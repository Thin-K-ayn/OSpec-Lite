# OSpec Lite

[English](./README.md) | [简体中文](./README.zh-CN.md)

面向 Codex 和 Claude Code 的轻量级 agent-first 仓库引导工具。

`ospec-lite` 的目标是让仓库更容易被编码 agent 理解，也更方便团队审阅并安全修改。它会在 `.oslite/` 下初始化仓库本地指令、机器可读索引、小型项目知识层，以及轻量的 change 工作流。

V1 刻意保持小而稳的能力边界：一次性 bootstrap、可选 profile、基于 profile 的确定性文档校验，以及简单的 change 跟踪。

[为什么使用 OSpec Lite](#为什么使用-ospec-lite) | [会生成什么](#会生成什么) | [安装](#安装) | [用法](#用法) | [Profiles](#profiles) | [Codex 插件](#codex-插件) | [开发](#开发)

## 为什么使用 OSpec Lite

- 自动生成 `AGENTS.md` 和 `CLAUDE.md`，让 Codex 与 Claude Code 一进仓库就能拿到本地指引。
- 生成 `.oslite/index.json`，提供机器可读的仓库摘要。
- 创建 `.oslite/docs/project/*` 与 `.oslite/docs/agents/*`，把项目知识层和代码放在同一个仓库里维护。
- 支持纯内容型 profile，可追加 authoring pack 和轻量 agent wrapper，而不引入插件运行时。
- 在 `.oslite/changes/active/*` 下跟踪轻量变更，并在验证完成后归档。
- 通过 `oslite docs verify` 对 profile 驱动的文档进行确定性校验。
- 自带一个 repo-local 的 Codex companion plugin，让 Codex 能发现并遵循 `ospec-lite` 工作流。

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
    agents/
      quickstart.md
      change-playbook.md
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
```

`status` 会汇报仓库是否已初始化、当前使用的 profile、文档所在位置，以及 active 和 archived change 的数量。

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
- `verify.md`：记录跑过的检查、人工验证和剩余风险
- `change.json`：机器可读的状态和元数据

推荐流程：

1. 先创建 change 目录。
2. 在大改之前先写 `request.md` 和 `plan.md`。
3. 再开始实现。
4. 实现完成后补 `apply.md`，再标记为 applied。
5. 验证完成后补 `verify.md`，再标记为 verified。
6. 确认完成后再归档。

```sh
npx oslite change new improve-readme .
# 先补 request.md 和 plan.md，再开始改文件
npx oslite change apply .oslite/changes/active/improve-readme
npx oslite change verify .oslite/changes/active/improve-readme
npx oslite change archive .oslite/changes/active/improve-readme
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

本仓库现在自带一个 repo-local 的 Codex companion plugin，位于 [`plugins/ospec-lite-codex/`](./plugins/ospec-lite-codex)。

- 插件 manifest：[`plugins/ospec-lite-codex/.codex-plugin/plugin.json`](./plugins/ospec-lite-codex/.codex-plugin/plugin.json)
- 仓库 marketplace：[`.agents/plugins/marketplace.json`](./.agents/plugins/marketplace.json)
- 主技能：`$ospec-lite-workflow`

在 Codex 中打开本仓库后，让它读取 repo-local marketplace。这个插件不会替代 `oslite` CLI；它的作用是教 Codex 何时调用 CLI，以及怎样稳定地遵循 profile 驱动的 OSpec Lite 工作流。

示例提示词：

- `用 OSpec Lite 初始化这个仓库。`
- `检查 OSpec Lite 状态，并解释缺失的 markers。`
- `继续补 profile 文档，并运行 oslite docs verify。`
- `为 add-login-flow 创建一个 OSpec Lite change。`

## 命令概览

```text
oslite init [path] [--document-language en-US|zh-CN] [--profile <profile-id>] [--project-name <name>] [--bootstrap-agent codex|claude-code|none]
oslite status [path]
oslite docs verify [path]
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
