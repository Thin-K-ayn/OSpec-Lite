# 改动 Playbook

## 开始前
- 先给改动分类：启动、登录、大厅主流程、网络、热更、子游戏进入、原生边界、支付链路。
- 动行为前先读 `evidence-map.md`、`entrypoints.md`、`coding-rules.md`。
- 如果改动新增 Lua 类、复杂 Lua 函数、或参数语义不清的函数，记得补 EmmyLua 注解。
- 改非 Editor 的运行时 C# 之前，必须先拿到用户明确许可；除非用户本来就明确要求改这类 C#。
- `Assets/Editor/` 这类 Editor-only 脚本，如果用户明确指定要改，可以不额外二次确认。
- 如果改动触及支付、订单、票据校验、出入款、收银台、渠道计费等敏感区域，先和用户二次确认改动意图。

## 何时必须同步更新文档
- 改了 `Assets/_GameCenter/ClientLua/Main.lua`、`HallCenter.lua`、`ViewManager.lua`、`Network.lua`、`ResDownloadManager.lua`
- 改了启动链、切场景链、进入子游戏链、回大厅链
- 改了目录职责划分，或改动了团队规则，例如 Lua 注解策略、view/controller 结构、支付确认规则

## 何时不要写进核心项目文档
- `Assets/Editor/` 里的 Editor-only 工作
- `Assets/_GameWrap/Generate/` 下的生成代码更新
- 不影响大厅运行时的测试场景、一次性工具目录改动
- 不改变大厅行为或边界说明的第三方插件内部实现

## 完成前自查
- 需要同步的正式文档都已经更新，不只是 `evidence-map.md`
- 正式文档里不再残留 `待补充`
- 文档中的证据路径真实存在
- 已运行 `oslite docs verify .`
