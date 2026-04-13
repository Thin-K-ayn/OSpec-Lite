# 补项目文档流程

## 当用户只说“用 unity-tolua-hall profile 去 init ospec-lite”时
1. 先判断仓库是否已经完成 `unity-tolua-hall` 初始化。
2. 如果还没有初始化：
   - 根据仓库目录名、README、显眼的产品命名推断项目名
   - 先向用户确认这个项目名
   - 如果用户没有指定 bootstrap agent，默认取当前宿主；仍不明确时用 `none`
   - 运行 `oslite init --profile unity-tolua-hall --project-name "<project-name>" --bootstrap-agent <codex|claude-code|none> .`
3. 如果仓库已经初始化，不要重复运行 `init`。

## 阶段一：先读仓库并填写证据地图
1. 先读 `project-brief.md`。
2. 按 `repo-reading-checklist.md` 的顺序探索仓库。
3. 在动正式文档前，先补 `evidence-map.md`。
4. 从 `Assets/_GameCenter/FrameWork/Behaviours/Launch.cs`、`Assets/_GameCenter/LuaFramework/Scripts/Main.cs`、`Assets/_GameCenter/ClientLua/Main.lua` 建立大厅启动链的整体心智模型。
5. 通过 `ViewManager.lua` 验证大厅 / 子游戏切换链。
6. 如果任务涉及子游戏逻辑，先进入 `Assets/_GameModule/<game>/`，再读该子游戏仓库自己的 `AGENTS.md` 或 `CLAUDE.md`。

## 阶段二：根据证据回填正式文档
1. 回填 `AGENTS.md`、`CLAUDE.md`、`.oslite/docs/project/*`、`.oslite/docs/agents/*`。
2. 关键章节统一使用：`结论 / 证据文件 / 确认状态 / 未确认点`。
3. 没有代码证据的结论，不能写成已确认。
4. 不要把 Editor-only、生成代码、测试场景、一次性工具目录写进大厅核心文档。
5. 子游戏专属结论要尽量留在对应 `Assets/_GameModule/<game>/` 仓库，不要未经证据就混进大厅主叙事。

## 停止前自查
- `project-brief.md` 已阅读
- `evidence-map.md` 已覆盖关键章节
- 正式文档中不再残留 `待补充`
- 每条证据路径都真实存在
- `oslite docs verify .` 已执行
