# 编码与 Review 规则

## 命名与注解
结论：
- 待补充：总结该大厅仓库真实存在的命名习惯、view / controller 命名、注释要求，以及 EmmyLua / ToLua 相关规则。
证据文件：
- `Assets/_GameCenter/ClientLua/CC.lua`
- `Assets/_GameCenter/ClientLua/View`
- `Assets/_GameCenter/ClientLua/Model`
确认状态：
- 待确认
未确认点：
- 待补充：是否还存在目录级、模块级的命名约束？

## 运行时 C# 修改策略
结论：
- 待补充：说明团队对运行时 C# 的规则，即默认只有在用户明确许可后才能改动打包内 C#，而 Unity Editor 脚本是主要例外。
证据文件：
- `Assets/_GameCenter/FrameWork`
- `Assets/_GameCenter/LuaFramework/Scripts`
- `Assets/Editor`
确认状态：
- 待确认
未确认点：
- 待补充：当前仓库里哪些目录可以稳定视为 Editor-only？

## 支付改动策略
结论：
- 待补充：说明真钱支付、订单、票据校验、出入款、收银台、渠道计费等改动必须先与用户二次确认。
证据文件：
- `Assets/_GameCenter/ClientLua`
- `Assets/_GameCenter/FrameWork`
- `Channel`
- `UnityInterface`
确认状态：
- 待确认
未确认点：
- 待补充：仓库当前有哪些支付相关目录、模块、SDK 桥接属于确认敏感区？

## 模块装配与 require 约定
结论：
- 待补充：说明 `CC.Init()` / `CC.SetFileRequire()` 的约定，以及 Manager / Define / DataMgr 模块如何装配。
证据文件：
- `Assets/_GameCenter/ClientLua/CC.lua`
- `Assets/_GameCenter/ClientLua/Main.lua`
确认状态：
- 待确认
未确认点：
- 待补充：哪些模块必须通过 `CC` 访问，哪些允许直接 `require`？

## 视图与控制边界
结论：
- 待补充：说明 View、controller、ViewManager 之间的职责分界。
证据文件：
- `Assets/_GameCenter/ClientLua/Model/Manager/ViewManager.lua`
- `Assets/_GameCenter/ClientLua/View`
确认状态：
- 待确认
未确认点：
- 待补充：哪些 view 属于特殊情况，不遵循常规 ViewManager 路径？

## 生命周期与通知清理
结论：
- 待补充：说明 pause / resume / back、通知清理、timer、view teardown 的处理方式。
证据文件：
- `Assets/_GameCenter/ClientLua/Model/HallCenter.lua`
- `Assets/_GameCenter/ClientLua/Model/Manager/ViewManager.lua`
- `Assets/_GameCenter/ClientLua/Common`
确认状态：
- 待确认
未确认点：
- 待补充：是否存在共享的 unregister / dispose 模式需要特别写明？

## 资源、热更与切场景风险
结论：
- 待补充：总结热更、下载、AssetBundle 重载、切场景、进入子游戏时最容易出问题的规则。
证据文件：
- `Assets/_GameCenter/ClientLua/Model/ResDownload/ResDownloadManager.lua`
- `Assets/_GameCenter/LuaFramework/Scripts/Manager/NEO_PARTY_GAMES_GameManager.cs`
- `Assets/_GameCenter/ClientLua/Model/Manager/ViewManager.lua`
确认状态：
- 待确认
未确认点：
- 待补充：哪些改动最容易同时影响大厅与子游戏？

## 常见 Review 坑位
结论：
- 待补充：总结常见回归点，例如全局状态副作用、重连状态漂移、自动进入副作用、清理遗漏等。
证据文件：
- `Assets/_GameCenter/ClientLua/Main.lua`
- `Assets/_GameCenter/ClientLua/Model/Network/Network.lua`
- `Assets/_GameCenter/ClientLua/Model/ResDownload/ResDownloadManager.lua`
确认状态：
- 待确认
未确认点：
- 待补充：是否还有大厅仓库特有的高频坑位需要加进来？
