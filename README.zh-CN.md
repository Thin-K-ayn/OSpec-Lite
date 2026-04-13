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

```sh
npx oslite change new improve-readme .
# 修改文件并补充 change 记录
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
