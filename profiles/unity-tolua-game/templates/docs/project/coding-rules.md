# 编码约定

## 命名与注释
结论：
- 待补充：总结该仓库真实存在的命名习惯、注释要求与 EmmyLua / ToLua 相关规则。

证据文件：
- `Script/MJGame.lua`

确认状态：
- 待确认

未确认点：
- 待补充：如果规则只在部分模块生效，请明确适用范围。

## 模块边界
结论：
- 待补充：说明 View、Manager、Controller、Network、Resource 等模块边界如何划分。

证据文件：
- `.oslite/docs/agents/authoring/evidence-map.md`

确认状态：
- 待确认

未确认点：
- 待补充：如果现实代码与理想边界不一致，请把偏差写清楚。

## 生命周期清理
结论：
- 待补充：说明 Init / Start / Enter / Exit / Release 以及事件、定时器、Action 的收口方式。

证据文件：
- `.oslite/docs/agents/authoring/evidence-map.md`

确认状态：
- 待确认

未确认点：
- 待补充：如果存在易遗漏的清理点，请写成显式风险。

## 配置与资源修改
结论：
- 待补充：说明配置修改、资源映射、资源加载路径变更时要额外检查哪些地方。

证据文件：
- `.oslite/docs/agents/authoring/evidence-map.md`

确认状态：
- 待确认

未确认点：
- 待补充：如果项目没有独立资源映射层，也请明确写出。

## Code Review 高频坑位
结论：
- 待补充：总结最常见的 review 风险，例如生命周期未收口、资源映射遗漏、状态残留、接口边界误判等。

证据文件：
- `.oslite/docs/agents/authoring/evidence-map.md`

确认状态：
- 待确认

未确认点：
- 待补充：如果某些坑位只适用于特定子系统，请标明适用范围。
