<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.md">English</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./assets/logo.png" alt="World Forge" width="400">
</p>

<p align="center">
  <img src="./site/public/screenshots/editor-canvas.jpg" alt="World Forge editor with the Chapel Threshold sample open and the Speed Panel showing actions for a zone" width="720">
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop-org/world-forge/actions/workflows/ci.yml"><img src="https://github.com/mcp-tool-shop-org/world-forge/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@world-forge/schema"><img src="https://img.shields.io/npm/v/@world-forge/schema?label=npm" alt="npm"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="MIT License"></a>
  <a href="https://mcp-tool-shop-org.github.io/world-forge/"><img src="https://img.shields.io/badge/Landing_Page-live-blue" alt="Landing Page"></a>
</p>

<p align="center">2D / 2.5D world authoring studio with peer export lanes for <a href="https://github.com/mcp-tool-shop-org/ai-rpg-engine">AI RPG Engine</a>, <a href="https://www.unrealengine.com/">Unreal Engine 5</a>, and <a href="https://godotengine.org/">Godot 4</a>.<br>One editor, many modes — paint zones, place entities, define districts, export a complete content pack for your engine of choice.</p>

<!-- version:start -->
<p align="center"><strong>v4.10.0</strong> — 3718 tests, 6 shipping packages, 7 authoring modes, tiles + interiors + town authoring + world modeling (vertical strata, typed hazards, party-gated zones), three export targets (AI RPG Engine, Unreal Engine 5, Godot 4), a measured Forge→Engine content contract, and an authored drawing contract for 2.5D clients</p>
<!-- version:end -->

## 架构

```
packages/
  schema/          @world-forge/schema         — spatial types, validation, 2.5D fields
  export-ai-rpg/   @world-forge/export-ai-rpg  — AI RPG Engine export pipeline + CLI
  export-unreal/   @world-forge/export-unreal  — Unreal Engine 5 export pipeline + CLI (2.5D aware)
  export-godot/    @world-forge/export-godot   — Godot 4 export pipeline + .tscn scene generation
  renderer-2d/     @world-forge/renderer-2d    — PixiJS 2D canvas renderer
  editor/          @world-forge/editor         — React web authoring app
```

## 快速入门

```bash
npm install
npm run build
npm run dev --workspace=packages/editor
```

打开 `http://localhost:5173` 以启动编辑器。

### 编辑器工作流程

1. **选择模式**——地牢、区域、世界、海洋、空间、室内或荒野——以设置网格默认值和连接词汇。
2. **从一个工具包开始**——从模板管理器中选择一个入门工具包或类型模板，或者从空白开始。
3. **绘制区域**——在画布上拖动以创建区域，连接它们，分配区域。
4. **放置实体**——将 NPC、敌人、商人、遭遇事件和物品放置到区域中。
5. **审核**——打开“审核”选项卡，查看健康状态、内容概述和摘要导出（Markdown/JSON）。
6. **导出**——打开“导出”对话框，以检查每个目标目标的准备情况（该框显示所有三个目标中状态最差的情况：如果被阻止，则显示红色；如果存在警告，则显示琥珀色，包括遭遇类型转换/丢弃以及缺少实体放置、缺少多区域项目中的连接、缺少玩家模板或缺少 UE5 高度或视差设置；如果一切就绪，则显示绿色，没有需要报告的内容），配置目标选项，然后下载 AI RPG Engine、UE5 或 Godot 4 包。导出后的收据会根据大小、数量和保真度详细信息进行堆叠。此外，还有项目包（.wfproject.json）和审核摘要。

### CLI 导出

```bash
# AI RPG Engine
npx world-forge-export project.json --out ./my-pack
npx world-forge-export project.json --validate-only
npx world-forge-export --import ./my-pack --out ./round-trip

# Unreal Engine 5
npx world-forge-export-unreal project.json --out ./UnrealPack --sign
npx world-forge-export-unreal --summary ./UnrealPack

# Godot 4 — writes a loadable project root (project.godot + world.tscn)
npx world-forge-export-godot project.json --out ./GodotPack
npx world-forge-export-godot project.json --validate-only
```

## 包

### @world-forge/schema

用于世界构建的核心 TypeScript 类型和验证。

- **空间类型**——`WorldMap`、`Zone`、`ZoneConnection`、`District`、`Landmark`、`SpawnPoint`、`EncounterAnchor`、`FactionPresence`、`PressureHotspot`
- **内容类型**——`EntityPlacement`、`ItemPlacement`、`DialogueDefinition`、`PlayerTemplate`、`BuildCatalogDefinition`、`ProgressionTreeDefinition`
- **视觉图层**——`AssetEntry`、`AssetPack`、`Tileset`、`TileLayer`、`PropDefinition`、`PropPlacement`、`AmbientLayer`
- **城镇 + 结构**——`MarketNode`、`CraftingStation`、`Building`、`Hub`、`Stronghold`
- **世界建模**——`Stratum` + `StratumLink`（垂直图层）、`HazardDefinition`（类型化效果联合）、`ZoneEntryGate` + 派对状态 `SpawnCondition` 操作数（`party-level`、`party-size`、`item`、`flag`、`member`、`class`）
- **模式系统**——`AuthoringMode`（7 种模式）、特定于模式的网格/连接/验证配置文件
- **呈现**——可选的 `WorldPresentation` 在 `WorldProject` 上：双等距视图、图块占位、区域锚定单元格、楼层平面图以及每个角色的占用行。`presentationAdvisories()` 在其上运行八条建议规则，包括最重要的规则——人物被绘制在某个房间内，而模拟却将其置于该房间之外。
- **验证**——`validateProject()`（89 个结构检查，使用基于地图的 O(n) 查找，`warningCount`）、`advisoryValidation()`（特定于模式的建议、元数据完整性、资源命名）。在 `normalizeProjectShape()` / `stampProjectSchemaVersion()` 之后，可以接受省略后续所需的数组的 v4.0 JSON。
- **桶上的封闭联合**——`VALID_CONNECTION_KINDS`、`VALID_ASSET_KINDS`、`VALID_ENTITY_ROLES`、`VALID_ITEM_SLOTS` 以及其余 `VALID_*` 集合从 `@world-forge/schema` 导出。
- **实用程序**——`assembleSceneData()`（带有缺失资源检测的视觉绑定）、`scanDependencies()`（引用图分析）、`buildReviewSnapshot()`（健康分类）

### @world-forge/export-unreal

将 `WorldProject` 转换为 Unreal Engine 5 内容包，该包针对 2.5D 游戏进行了优化。

- **输出**——`pack.json`、每个区域和每个区域的主要数据资源 JSON、分组的参与者生成清单、每个连接的关卡流提示、世界分区单元格提示以及结构化的保真度报告。
- **2.5D 字段**——`Zone.elevation`、`elevationRange`、`parallaxLayers`、`skylineRef` 已保留并转换为 UE cm / Z-up 坐标。
- **坐标转换**——纯函数（`pixelsToUnrealCm`、`elevationToZ`、`worldForgeToUnrealAxis`、`gridToUnrealAxis`）。默认世界比例为 1 个图块 = 100 厘米。
- **双向导入**——`importFromUnreal` 从 Unreal 包中重建 WorldProject；仅游戏数据（对话、进度、构建）在保真度报告中标记为已删除。
- **CLI**——`world-forge-export-unreal`，带有 `--out`、`--tile-size-cm`、`--validate-only`、`--verbose`。

### @world-forge/export-godot

将 `WorldProject` 转换为带有 `.tscn` 场景文本的 Godot 4 内容包。

- **输出**——Godot 4 项目根目录：`project.godot`、`world.tscn`（ExtResource `.tres`）、复制的纹理到 `assets/`、`scripts/player.gd`，以及 `pack.json` 和 `fidelity.json`
- **CLI**——`world-forge-export-godot`，带有 `--out`、`--validate-only`、`--include-world-tscn` / `--no-world-tscn`
- **可玩场景**——`buildWorldScene()` 导出一个可导航的 `.tscn`：每个区域的 `StaticBody2D` 碰撞 + `NavigationRegion2D`、一个框架 `Camera2D`、一个 `CharacterBody2D` 玩家角色以及 y 排序 / `z_index` 深度
- **图块 + 室内**——`TileMapLayer` + `TileSet`（为图像图块集烘焙 `tile_map_data`）、每个单元格的墙壁 `StaticBody2D` 碰撞以及道具 `Node2D` 放置
- **城镇**——市场 + 制作站，以及建筑物（`StaticBody2D` 占位）/枢纽/据点作为 `Node2D` 占位符，所有这些都将其数据作为元数据携带。
- **世界建模**——垂直层（每个区域的 `z_index` 带 + `StratumLink` 连接器）、类型化的危险作为 `Area2D` 区域以及区域入口门元数据
- **保真度报告**——对无损、近似和删除的数据进行结构化跟踪，并与真实的 Godot 4 引擎进行验证（无头烟雾，36 个断言）
- **呈现建议**——授权的 `presentation` 块会完整地传递，并且其建议会附加到 `warnings[]` 上，因此绘制/模拟不一致是一个导出结果，而不是屏幕上的意外情况。
- **格式版本**——`GODOT_PACK_FORMAT_VERSION` 1.1.0（`files`、`zoneGates`、`migrateGodotPack`）

### @world-forge/export-ai-rpg

将 `WorldProject` 转换为 ai-rpg-engine 的 `ContentPack` 格式。

- **导出**——区域、区域、实体、物品、对话、玩家模板、构建目录、进度树、遭遇事件（将 World Forge 遭遇类型转换为引擎的四种类型）、派系、热点、清单和包元数据。
- **导入**——8 个反向转换器从导出的 JSON 中重建 WorldProject；CLI `--import` / `--from-pack` 写入 `world-project.json`（或标准输出）。
- **保真度报告**——对转换过程中无损、近似或删除的内容进行结构化跟踪；`--out` 将 `fidelity.json` 写入包旁边。
- **格式检测**——自动检测 WorldProject、ExportResult、ContentPack 和 ProjectBundle 格式。
- **CLI**——`world-forge-export`，带有 `--out`、`--import`、`--from-pack`、`--validate-only`、`--dry-run` 和 `--verbose`。

### @world-forge/renderer-2d

基于 PixiJS 的 2D 渲染器：带有平移/缩放的视口、带有区域着色的区域叠加层、连接箭头、按角色区分的实体图标、图块图层和小地图。

一个独立的渲染器，用于外部消费者在其自己的 PixiJS 应用程序中嵌入 World Forge 数据。**编辑器不使用它**——编辑器的画布是直接的 Canvas2D 实现，因此下面列出的编辑器中的小地图和视口功能是它自身的，而不是此包的功能。

### @world-forge/editor

使用 Zustand 状态管理、带有操作标签的撤销/重做、自动保存（30 秒间隔，3 个版本历史记录，崩溃恢复）、所有项目加载路径上的脏状态保护、深色/浅色主题切换、模态焦点捕获以及键盘驱动的工具切换的 React 19 + Vite Web 应用程序。

#### 工作区选项卡

| 选项卡 | 用途 |
|-----|---------|
| 地图 | 在 2D 画布上编辑区域/实体/区域 |
| 玩家 | 带有属性、物品栏、装备和生成点的玩家模板 |
| 构建 | 原型、背景、特征、技能、组合 |
| 树 | 带有要求和效果的进度节点 |
| 对话 | 节点编辑、选项链接、检测断开的引用 |
| 对象 | 分层树：区域 → 区域 → 实体/地标/生成点 |
| 预设 | 带有合并/覆盖功能的区域和遭遇预设浏览器 |
| 资源 | 带有按类型过滤搜索、孤立资源检测和资源包的资源库 |
| 问题 | 实时分组验证，点击以聚焦导航 |
| 依赖项 | 带有内联修复按钮的依赖项扫描器 |
| 审核 | 健康仪表板、内容概述、摘要导出 |
| 指南 | 首次运行检查清单，带有快捷键参考（显示直到被关闭） |
| 导入 | 上次导入的完整性报告（导入后显示） |
| 差异 | 与导入的快照的语义差异（导入后显示） |

#### 画布和编辑

- **工具**——10 种工具：选择、区域绘制、连接、实体放置、地标、生成点、瓷砖绘制、道具放置、遭遇放置、物品放置
- **多选**——Shift + 点击、框选、Ctrl + A；拖动移动，具有原子撤销功能
- **对齐**——6 种对齐方式（左/右/上/下/水平居中/垂直居中）以及水平/垂直分布
- **吸附**——拖动时吸附到附近对象的边缘/中心，并带有视觉引导线
- **调整大小**——每个区域有 8 个手柄，带有边缘吸附、最小尺寸限制和实时预览
- **复制**——Ctrl + D，重新映射 ID、连接和区域分配
- **复制/粘贴**——Ctrl + C / Ctrl + V，重新映射 ID 并可配置偏移量
- **点击循环**——在同一位置重复点击，循环显示重叠的对象
- **上下文菜单**——右键单击，用于 7 种上下文相关的操作（“编辑属性”切换到“地图”选项卡，并展开右侧边栏以显示所选对象，包括实体，以及删除、复制等）
- **连接预览**——在连接工具放置期间显示虚线青色线条
- **小地图**——200×150 概览（右下角），点击可跳转
- **视口裁剪**——仅渲染可见边界内的对象（64 像素边距）
- **性能统计**——切换 FPS/对象计数/渲染时间叠加层
- **每个对象的可见性**——隐藏/显示单个对象（在 localStorage 中持久保存）
- **图层**——可见性切换（网格、连接、实体、地标、生成点、背景、瓷砖、道具、环境、高度；物品与物品图层进行碰撞检测），以及小地图、吸附到对象、性能统计和渲染器诊断的切换

#### 导航和快捷键

- **视口**——平移/缩放相机，鼠标滚轮缩放（以光标为中心），空格键/鼠标中键/右键单击拖动平移，画布首次打开包含区域的项目时自动调整到最佳显示（以及从“速度面板”的“自动调整到最佳显示”功能中按需触发），双击以居中显示。
- **搜索**——按下 Ctrl+K 打开叠加层，通过名称/ID 模糊匹配查找任何对象，支持键盘导航和最近搜索历史记录（localStorage）。
- **速度面板**——将光标悬停在画布上（或画布处于焦点状态，并以选择或中心为基准），按下 `Q`（可在“选项”中配置），或者双击右键，将即时单次右键单击的紧凑菜单扩展为浮动命令面板，当两个或多个可见对象位于光标下方时，会显示重叠目标范围提示（在空搜索时显示 `Tab`/`Shift+Tab`，显示 `ArrowLeft`/`ArrowRight`，或者单击，最后显示 `Canvas`，关闭时清除非破坏性的画布高亮轮廓/`Esc`，并显示礼貌的实时区域提示），打开时采用固定的四条布局（如果目标存在问题，则在第一条布局上方显示可选的“快速修复”行——高亮仍然从第 1 栏第 1 槽位开始，因此打开时按 `Enter` 会执行第 1 槽位，`ArrowDown` 的顺序不变，并且 `Alt+1`–`Alt+5` 永远不会偏移；可从第 1 槽位按 `ArrowUp` 或单击访问“快速修复”——该行位于按命中类型划分的固定上下文面板、复制的可重排固定项与宏、可切换的近期常用项以及固定目录分组之上），分层搜索（支持 RPG 同义词、首字母、拼写容错、字符高亮、带原因说明的 `"Unavailable here"` 操作、实时快捷键或编辑器位置徽章），内联多步骤选择器（按项目状态缓存的 `Quick Fix` 修复与“在问题/依赖项/审核中显示”导航、带保留筛选文本的内联 `+ Create District` 的 `Assign District`、带 `Merge`/`Overwrite` 的 `Apply Preset`、带实时 AI RPG 导出兼容性徽章的 `Place Encounter Here`；在空筛选器或输入步骤中按 `Backspace` 返回上一步），按下 `Tab` 激活内联标量值编辑功能，用于 `Set Elevation`，画布委托的空间选择（`Connect From Here`，使用 `Tab` 循环连接类型，并使用 `Shift+Click` 目标链，单区域 `Merge Zones`，带有 `Shift+Click` 多选和屏幕外区域名称搜索，以及 `Esc` 取消，保留先前的选择），单条原子撤销，带有描述性标签，“从最近的操作中创建宏…”，最多可以从最多 8 个会话中可重放的步骤中创建宏，并使用原子单次撤销宏执行和内联缺失引用替换提示，“在此处重复上次操作”。
- **快捷键**——29 个键盘快捷键，包括工具切换（V/Z/C/E/L/S/T/O/N/I），Enter（在“地图”选项卡中打开属性，并展开右侧边栏），P（应用预设），Shift+P（保存预设），Ctrl+C/V（复制/粘贴），箭头微调（Shift = 5 倍）。
- **辅助功能**——使用 Escape 键关闭的模式焦点陷阱，所有仅图标按钮上都有 ARIA 标签，可使用键盘导航的对象树，屏幕阅读器会提示脏标志。空间画布操作（放置、框选、调整大小、连接绘制、平移）仍然基于指针。

#### 导入和导出

- **ContentPack**——按目标导出到 AI RPG Engine、Unreal Engine 5 或 Godot 4，针对每个目标提供就绪状态提示，可配置的选项（图块大小、场景前缀、捆绑包筛选），以及下载完成后的收据。
- **项目捆绑包**——可移植的 `.wfproject.json` 文件，包含来源元数据和依赖信息。
- **工具包捆绑包**——带有验证、碰撞处理和来源跟踪的 `.wfkit.json` 导出/导入。
- **导入**——自动检测 4 种格式，并提供结构化的保真度报告。
- **差异**——自导入以来，跟踪语义变化。
- **场景预览**——所有区域视觉绑定的内联 HTML/CSS 组合。

## 创作模式

World Forge 将**类型**（奇幻、赛博朋克、海盗）与**模式**（地牢、海洋、太空）区分开。类型是风格——模式是规模。模式控制网格默认值、连接词汇、验证建议、指南措辞和预设筛选。

| 模式 | 网格 | 图块 | 关键连接 |
|------|------|------|-----------------|
| 地牢 | 30×25 | 32 | 门、楼梯、通道、秘密、危险 |
| 区域/城市 | 50×40 | 32 | 道路、门、通道、传送门 |
| 区域/世界 | 80×60 | 48 | 道路、传送门、通道 |
| 海洋/海洋 | 60×50 | 48 | 水道、路线、传送门、危险 |
| 太空 | 100×80 | 64 | 对接、曲速、通道、传送门 |
| 内部 | 20×15 | 24 | 门、楼梯、通道、秘密 |
| 荒野 | 60×50 | 48 | 小路、道路、通道、危险 |

模式在创建项目时设置，并以 `mode?: AuthoringMode` 形式存储在 `WorldProject` 中。每种模式都提供**智能默认值**——连接类型、实体角色、区域名称和“速度面板”建议会自动调整。

## 创作表面

### 世界结构

- 具有空间布局、相邻区域、出口、光照、噪音、危险因素和可交互对象的区域
- 12 种连接类型（通道、门、楼梯、道路、传送门、秘密通道、危险区域、通道、路线、对接点、传送、小路），具有独特的视觉风格、边缘锚定路由、方向箭头和有条件虚线样式
- 具有派系控制、经济概况、指标滑块、标签和区域中心点的区域名称标签的区域
- 地标（区域内的命名兴趣点）
- 生成点、遭遇锚点（基于类型的颜色标记）、派系存在和压力热点
- **垂直分层**——离散的层（表面/地下/天空，或建筑物楼层），具有带符号的顺序、z 范围、层间可见性和连接器（楼梯/梯子/电梯）；区域分配到某个分层
- **类型的环境危险**——共享的危险库（伤害/状态/即死/点燃效果、触发时间、地形移动成本、可通行性、视野阻挡、天气限制），每个区域引用
- **区域入口通行门**——基于派对状态（等级/规模/物品/标志/成员/职业）的入口通行，作为硬性或建议性通行，并带有作者编写的“显示锁”理由
- **表现占用**——对于 2.5D 客户端：具有瓦片占位和跨度、锚定单元和可选楼板的等距视图，以及每个角色（包括玩家）的占用行（角色包、区域、单元、朝向）

### 内容

- 具有属性、资源、AI 概况和自定义元数据的实体放置
- 具有插槽、稀有度、属性修改器和授予的动词的物品放置
- 具有分支对话、条件和效果的对话树
- 画布上的遭遇锚点——带有 Boss/伏击/巡逻类型的红色菱形标记

### 城镇和内部空间

- 瓦片绘制——基于图像的瓦片集（按行/列切片），带有彩色矩形回退、拖动画笔、图层和每个瓦片的“Solid”可通行性，用于墙壁碰撞
- 内部空间的道具放置（调色板+画布渲染），带有放置工具
- 城镇经济——市场节点（供应类别、价格修正、违禁品）和制作站（站类型、配方），每个区域进行编辑
- 城镇结构——建筑物（可进入的占位面，并与内部区域链接）、枢纽（服务+连接节点）和据点（加强的派系据点）

### 角色系统

- 玩家模板（起始属性、物品栏、装备、生成点）
- 构建目录（原型、背景、特征、学科、交叉职称、关联）
- 进度树（具有要求和效果的技能/能力节点）

### 资源

- 资源清单（肖像、精灵、背景、图标、瓦片集），具有特定类型的绑定
- 资源包（命名、版本化的分组，具有兼容性元数据、主题、许可证）
- 场景预览（所有区域视觉绑定的内联组合，并检测缺失的资源）

### 工作流程

- 区域预设（9 个内置，按模式过滤）和遭遇预设（10 个内置），具有合并/覆盖应用和自定义预设的创建/读取/更新/删除功能
- 启动工具包（7 个内置，特定于模式），具有工具包导出/导入（`.wfkit.json`），可选的“速度面板”固定和宏预设（`speedPanelPresets`），合并时不会覆盖现有的用户预设，碰撞处理和来源跟踪
- 从“速度面板”进行区域合并（包括交互式画布区域选择，当选择的区域少于 2 个时）
- 布局模板、对话模板和批量实体放置（网格/随机/圆形）存在于代码中，但尚未可以通过编辑器 UI 访问
- 自动保存，30 秒延迟和 3 个版本的恢复历史
- Ctrl+K 搜索所有对象类型，具有模糊匹配和最近历史记录
- “速度面板”命令调色板，具有重叠目标范围芯片（在空搜索时为 `Tab`/`Shift+Tab`，非破坏性画布高亮显示，以及礼貌的实时区域公告），固定的上下文卡组（以及当命中对象存在问题时，带有上下文的“快速修复”行），复制的可重新排序的收藏夹，可切换的指数衰减频率的最近记录，固定的目录组，分层的 RPG 同义词/拼写错误搜索，实时的按键绑定徽章，参数化和最近操作的宏（`Create Macro from Recent Actions…`，具有原子单步撤销和缺失 ID 替换提示），自定义组，模式建议，内联多步骤和 `Tab` 药丸输入，画布空间选择，带有屏幕外区域过滤器和 `Tab` 连接类型循环，AI RPG 导出建议，描述性的原子撤销，以及“在此处重复上次操作”（`wf.speedPanel.v2`）
- 29 个集中的键盘快捷键（包括 10 个工具切换键）
- 项目元数据编辑器（作者、许可证、类别、标签）
- 审查统计信息（角色分布、连接类型、遭遇类型、每个区域的区域数量）
- 导出到 ContentPack JSON、项目包和审查摘要
- 从 4 种格式导入，并提供结构化保真度报告、修复建议和语义差异跟踪

请参阅 [`dogfood/WALKTHROUGH.md`](dogfood/WALKTHROUGH.md)，了解 Chapel Threshold 导出握手，以证明当前的表面。

## 内部测试目录

`dogfood/` 目录包含一个集成测试框架，该框架在单元测试之外执行完整的从创建到导出的流水线。Chapel Threshold 示例（`chapel-threshold.ts`）构建一个小型但完整的世界项目，将其运行通过导出，并将输出写入 `dogfood/output/`。这证明了模式类型、验证和导出流水线是否能够端到端地使用真实数据工作——而不仅仅是孤立的模拟。

## 引擎兼容性

导出目标是三个引擎：

- **[ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine)** — ContentPack 格式：确定性模拟运行时，它加载导出的包并运行世界
- **Unreal Engine 5** — 具有主数据资源、角色生成清单和世界分区提示的 2.5D 感知的资源包
- **Godot 4** — `.tscn` 场景生成，具有区域资源、导航链接和实体清单

### Forge→Engine 内容协议

一个正在运行的导出器与一个启动的世界是不同的。v4.6.0 为 AI RPG Engine 通道弥合了这一差距，并且——更重要的是——将剩余的差距变成了一个数字，而不是一个假设。

- **一个经过测量的导出表**（`docs/c0-alignment/`）——一个叶路径差异器会遍历每个已编写的字段，并记录哪些字段实际上会到达运行时。它会在每次测试运行时生成、签入和验证，因此“导出后保留的内容”是可以审计的，而不是简单地断言。
- **一个诚实的清单**——导出的包包含真实的引擎语义版本范围、真实的模块 ID、内容哈希和编译后的退出条件。模块 ID 与实际内容相关联：没有制作站的包将不再声明制作模块。
- **空间词汇的交叉**——每个实体的放置位置，以及编译后的生成条件、类型的危险、入口门和场景描述符，都会到达引擎的内容包，而不仅仅是模式。
- **保真度报告保持一致。** 每个通道都会报告哪些内容是无损的、近似的或已删除的。如果某个字段无法跨越，导出会说明这一点——它不会悄悄地成功。
- **注册样本门控**（`packages/editor/src/__tests__/sample-gate.test.ts`）——动态加载 `SAMPLE_WORLDS`、`BUILTIN_KITS`、`GENRE_TEMPLATES` 和 `MODE_STARTERS` 中的每个条目，断言存储加载、`validateProject()`、AI RPG 导出成功，并且没有遇到任何阻碍因素（`exportToEngine` + `listAiRpgEncounterBlockers`）、完整的 `@ai-rpg-engine/content-schema` 验证（`validateGameContent` 和 `loadContent`），以及 Unreal Engine 5（`exportToUnreal`）和 Godot 4（`exportToGodot`）的导出。
- **AI RPG 导出中的遭遇类型转换**——仅 AI RPG 导出器会将 World Forge 的作者编写的遭遇类型转换为 `@ai-rpg-engine/content-schema` 的四种类型（`ambush`、`patrol`、`horde`、`duel`），同时保留 `worldforge-type:<original>` 在 `tags[]` 中的信息，并记录一个 `approximated` 保真度条目（`encounter-type-translated`），将 `hazard` 和 `discovery` 锚点从包中移除，并记录一个 `dropped` 保真度条目（`encounter-type-dropped`），并且仍然会拒绝未映射的自定义字符串：

| World Forge `encounterType` | AI RPG `ContentPack` 输出 | 保真度和标签 |
|---|---|---|
| `boss` | `duel` | `approximated`, `worldforge-type:boss` |
| `beast`, `haunt`, `caravan-raid` | `ambush` | `approximated`, `worldforge-type:<original>` |
| `pirate` | `patrol` | `approximated`, `worldforge-type:pirate` |
| `boarding`, `brawl` | `horde` | `approximated`, `worldforge-type:<original>` |
| `hazard`, `discovery` | 从 `ContentPack.encounterAnchors` 中省略 | `dropped` |
| `ambush`, `patrol`, `horde`, `duel` | 未更改 | 未更改，没有保真度条目 |
| 任何其他自定义字符串 | 拒绝（`exportToEngine` 返回 `success: false` 以及 `listAiRpgEncounterBlockers`，CLI 退出代码为 1） | 已阻止 |

- **AI RPG 导出中的对话发言者 ID**——`@world-forge/export-ai-rpg` 会按名称拒绝未解析的 `dialogues[].speakers` 条目（`exportToEngine` 返回带 `speakerBlockers` 的 `success: false`，与 `listAiRpgDialogueSpeakerBlockers` 一致，导出模态框被阻止，CLI 以 `1` 退出），并同时指明对话 ID 和未解析的发言者。`speaker: ''` 的节点仅在携带该对话（`dialogueId`）的每个实体都是对话中列出的唯一发言者（或没有任何实体携带该对话）时，才会用该唯一发言者自动填充；若任何携带实体为其他实体，则会指明对话 ID、节点 ID 和携带实体 ID 予以拒绝；若 `dialogues[].speakers` 有零个或多个条目，则会指明对话 ID 和节点 ID 予以拒绝。非空的节点发言者原样导出。

需要 `ai-rpg-engine` `^3.12.2`。

**相对于 AI RPG Engine 3.12.2 的已知差距**（来自 2026-11-24 的启动测试）。此版本导出的 Chapel Threshold 示例可在已发布的引擎中加载，区域之间的移动也可正常运行。以下部分尚未进入实际游玩：

- **门控出口。** 引擎仅沿着 `zones[].neighbors` 移动。当它加载包时，它会删除 `zones[].exits` 和包中的 `connections`，因此，您只能通过门控出口到达的区域，无法在那里进入。在示例中，这就是地下墓穴和其中的遭遇。
- **NPC 行为。** 引擎仅从其主机传递的配置文件或从包的 `entityAi` 中解析实体的 `aiProfile`，而此导出器尚未编写。在编写之前，导出的 NPC 将保持静止状态。
- **通过 sidecar 运行时的对话。** 当宿主像引擎的 JSON 启动方案那样在进程内启动内容包时，对话可以正常运行；而引擎的 sidecar 进程在加载内容包时会丢弃对话。
- **其他包数据。** 引擎在加载包时会删除这些数据，并为每个数据命名其原因：区域描述和危险、派系存在、压力热点、生成点、玩家模板、战利品表、地标、地层和地层链接、过渡、制作站、市场节点、建筑物、枢纽、据点、构建目录和进度树。

### 绘制契约

世界还可以指定客户端应该如何**绘制**它。`WorldProject.presentation` 是可选的，并且是累积的——大多数世界都没有，并且不会因此受到惩罚——它包含双高程视图、图块占位、每个区域的区域锚单元格和楼板，以及每个角色的一个占用行。

它存在的原因是，一个 2.5D 世界同时由三个网格描述，并且导出不会在它们之间进行转换：

| 网格 | 单元 | 所有者 | 哈希 |
|---|---|---|---|
| 模拟占用 | 区域 ID | 引擎的 `WorldState` | 是——权威 |
| 双高程单元格 | 256x128 菱形，跨度为 3 | 客户端的视图，通过 `presentation` | 永远不会 |
| Forge 卡尔特坐标 | `gridX` / `gridY` | 编辑器和 Godot `.tscn` | 永远不会 |

双高程单元格永远不会从 `gridX`/`gridY` 派生，并且沙盒缩放会跳过该块，因此绝对的菱形单元格不会意外地被乘。模拟始终会赢得关于某人位于哪个房间的争论；`presentationAdvisories()` 会大声说出来，`exportToGodot` 会在 `warnings[]` 上报告，并且舞台固定装置通道可以使用 `--strict` 使其致命。

该块在 Godot 舞台固定装置的 `pack.json` 上移动。它**不**会沿着 `export-ai-rpg` 通道移动——引擎的 `ContentPack` 没有累积插槽，并且其加载器是严格的——并且经过测量的导出表会报告它在那里被删除，而不是暗示其他情况。

## 安全性

- **访问的数据：**本地磁盘上的项目文件（用户创建的 JSON），没有服务器端存储
- **未访问的数据：**没有遥测、没有分析、没有超出本地开发服务器的网络请求
- **权限：**没有 API 密钥、没有密钥、没有凭据
- **源代码中没有密钥、令牌或凭据**

## 许可证

MIT

---

由 [MCP Tool Shop](https://mcp-tool-shop.github.io/) 构建
