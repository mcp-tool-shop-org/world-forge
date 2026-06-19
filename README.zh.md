<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.md">English</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./assets/logo.png" alt="World Forge" width="400">
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop-org/world-forge/actions/workflows/ci.yml"><img src="https://github.com/mcp-tool-shop-org/world-forge/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@world-forge/schema"><img src="https://img.shields.io/npm/v/@world-forge/schema?label=npm" alt="npm"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="MIT License"></a>
  <a href="https://mcp-tool-shop-org.github.io/world-forge/"><img src="https://img.shields.io/badge/Landing_Page-live-blue" alt="Landing Page"></a>
</p>

<p align="center">2D / 2.5D world authoring studio with peer export lanes for <a href="https://github.com/mcp-tool-shop-org/ai-rpg-engine">AI RPG Engine</a>, <a href="https://www.unrealengine.com/">Unreal Engine 5</a>, and <a href="https://godotengine.org/">Godot 4</a>.<br>One editor, many modes — paint zones, place entities, define districts, export a complete content pack for your engine of choice.</p>

<!-- version:start -->
<p align="center"><strong>v4.5.0</strong> — 2360 tests + e2e browser checks, 6 shipping packages, 7 authoring modes, tiles + interiors + town authoring + world modeling (vertical strata, typed hazards, party-gated zones), three export targets (AI RPG Engine, Unreal Engine 5, Godot 4)</p>
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
2. **从一个工具包开始**——从模板管理器中选择一个入门工具包或类型模板，或者从空白项目开始。
3. **绘制区域**——在画布上拖动以创建区域，连接它们，分配区域。
4. **放置实体**——将 NPC、敌人、商人、遭遇事件和物品放置到区域中。
5. **查看**——打开“查看”选项卡，了解健康状态、内容概述和摘要导出（Markdown/JSON）。
6. **导出**——打开“导出”对话框，查看每个目标的准备情况（✓ 准备就绪 / ⚠ 提示），配置目标选项，然后下载 AI RPG Engine、UE5 或 Godot 4 包。导出后的收据会记录大小、数量和保真度等详细信息。此外还有：项目包 (.wfproject.json) 和查看摘要。

### CLI 导出

```bash
# AI RPG Engine
npx world-forge-export project.json --out ./my-pack
npx world-forge-export project.json --validate-only

# Unreal Engine 5
npx world-forge-export-unreal project.json --out ./UnrealPack --sign
npx world-forge-export-unreal --summary ./UnrealPack
```

## 软件包

### @world-forge/schema

用于世界构建的核心 TypeScript 类型和验证。

- **空间类型**——`WorldMap`、`Zone`、`ZoneConnection`、`District`、`Landmark`、`SpawnPoint`、`EncounterAnchor`、`FactionPresence`、`PressureHotspot`
- **内容类型**——`EntityPlacement`、`ItemPlacement`、`DialogueDefinition`、`PlayerTemplate`、`BuildCatalogDefinition`、`ProgressionTreeDefinition`
- **视觉图层**——`AssetEntry`、`AssetPack`、`Tileset`、`TileLayer`、`PropDefinition`、`PropPlacement`、`AmbientLayer`
- **城镇 + 结构**——`MarketNode`、`CraftingStation`、`Building`、`Hub`、`Stronghold`
- **世界建模**——`Stratum` + `StratumLink`（垂直图层）、`HazardDefinition`（类型化的效果集合）、`ZoneEntryGate` + 派对状态 `SpawnCondition` 操作数（`party-level`、`party-size`、`item`、`flag`、`member`、`class`）
- **模式系统**——`AuthoringMode`（7 种模式），特定于模式的网格/连接/验证配置文件。
- **验证**——`validateProject()`（78 项结构检查，基于 Map 的 O(n) 查找，`warningCount`）、`advisoryValidation()`（特定于模式的建议、元数据完整性、资源命名）。
- **实用程序**——`assembleSceneData()`（带有缺失资源检测的视觉绑定）、`scanDependencies()`（引用图分析）、`buildReviewSnapshot()`（健康状况分类）。

### @world-forge/export-unreal

将 `WorldProject` 转换为 Unreal Engine 5 内容包，针对 2.5D 游戏进行了优化。

- **输出**——`pack.json`、每个区域和每个区域的主要数据资源 JSON、分组的 Actor 生成清单、每个连接的关卡流提示、世界分区单元提示以及结构化的保真度报告。
- **2.5D 字段**——`Zone.elevation`、`elevationRange`、`parallaxLayers`、`skylineRef` 会被保留并转换为 UE cm / Z 向上坐标。
- **坐标转换**——纯函数（`pixelsToUnrealCm`、`elevationToZ`、`worldForgeToUnrealAxis`、`gridToUnrealAxis`）。默认世界比例为 1 个图块 = 100 厘米。
- **双向导入**——`importFromUnreal` 从 Unreal 包中重建 WorldProject；仅游戏数据（对话、进度、构建）会在保真度报告中标记为已删除。
- **CLI**——`world-forge-export-unreal`，带有 `--out`、`--tile-size-cm`、`--validate-only` 和 `--verbose` 选项。

### @world-forge/export-godot

将 `WorldProject` 转换为 Godot 4 内容包，并使用 `.tscn` 场景文本。

- **输出**——`pack.json`、每个区域的资源、实体清单、导航链接、战利品表、生成标记、过渡节点、对话资源、资源绑定以及世界 `.tscn` 场景。
- **可玩场景**——`buildWorldScene()` 生成一个可导航的 `.tscn`：每个区域的 `StaticBody2D` 碰撞 + `NavigationRegion2D`，一个带边框的 `Camera2D` 以及 y 排序 / `z_index` 深度。
- **图块 + 室内**——`TileMapLayer` + `TileSet`（烘焙后的图像图块集的 `tile_map_data`），每个单元格的墙壁 `StaticBody2D` 碰撞以及道具 `Node2D` 放置。
- **城镇**——市场 + 工作站，以及建筑物（`StaticBody2D` 占位）/枢纽/据点作为 `Node2D` 占位符，所有这些都将它们的数据作为元数据进行存储。
- **世界建模**——垂直地层（每个区域的 `z_index` 分段 + `StratumLink` 连接器）、类型化的危险区域作为 `Area2D` 区域以及区域入口门元数据。
- **保真度报告**——对无损、近似和已删除数据的结构化跟踪，并针对真实的 Godot 4 引擎进行验证（无头烟雾，36 项断言）。
- **格式版本**——`GODOT_PACK_FORMAT_VERSION` 1.0.0。

### @world-forge/export-ai-rpg

将 `WorldProject` 转换为 ai-rpg-engine 的 `ContentPack` 格式。

- **导出**——区域、区域、实体、物品、对话、玩家模板、构建目录、进度树、遭遇事件、派系、热点、清单和包元数据。
- **导入**——8 个反向转换器从导出的 JSON 中重建 WorldProject。
- **保真度报告**——对在转换过程中无损、近似或已删除的内容进行结构化跟踪。
- **格式检测**——自动检测 WorldProject、ExportResult、ContentPack 和 ProjectBundle 格式。
- **CLI**——`world-forge-export` 命令，带有 `--out`、`--validate-only` 和 `--verbose` 标志。

### @world-forge/renderer-2d

基于 PixiJS 的 2D 渲染器：具有平移/缩放功能的视口，带有区域颜色显示的区域叠加层、连接箭头、按角色显示实体图标、图块图层和迷你地图。

### @world-forge/editor

React 19 + Vite Web 应用，具有 Zustand 状态管理、带有操作标签的撤销/重做功能、自动保存（30 秒延迟，3 个版本历史记录，崩溃恢复）、所有项目加载路径上的脏状态保护、深色/浅色主题切换、模态焦点陷阱以及键盘驱动的工具切换。

#### 工作区选项卡

| 选项卡 | 用途 |
|-----|---------|
| 地图 | 在二维画布上编辑区域/实体/区域 |
| 对象 | 分层树：区域 → 区域 → 实体/地标/生成点 |
| 玩家 | 带有属性、物品栏、装备和生成点的玩家模板 |
| 构建 | 原型、背景、特征、技能、组合 |
| 树 | 具有要求和效果的进度节点 |
| 对话 | 节点编辑、选项链接、断开引用检测 |
| 预设 | 区域和遭遇预设浏览器，支持合并/覆盖 |
| 资源 | 资源库，具有按类型筛选的搜索功能、孤立资源的检测以及资源包 |
| 问题 | 实时分组验证，点击以聚焦导航 |
| 依赖项 | 依赖项扫描器，带有内联修复按钮 |
| 审核 | 健康仪表板、内容概览、摘要导出 |
| 指南 | 首次运行检查清单，包含快捷键参考 |

#### 画布和编辑

- **工具** — 选择、区域绘制、连接、实体放置、地标、生成点
- **多选** — 按住 Shift 键并单击、框选、Ctrl+A；拖动移动，支持原子撤销
- **对齐** — 六种方式的对齐（左/右/上/下/水平居中/垂直居中）以及水平/垂直分布
- **吸附** — 在拖动时，画布会吸附到附近对象的边缘/中心，并显示视觉引导线
- **调整大小** — 每个区域有 8 个控制点，支持边缘吸附、最小尺寸限制和实时预览
- **复制** — Ctrl+D，重新映射 ID、连接和区域分配
- **复制/粘贴** — Ctrl+C / Ctrl+V，重新映射 ID 并配置偏移量
- **循环点击** — 在同一位置重复单击，可在重叠的对象之间进行切换
- **上下文菜单** — 右键单击以执行 7 个与上下文相关的操作（属性、删除、复制等）
- **连接预览** — 连接工具放置时显示虚线青色线条
- **小地图** — 200×150 概览图（右下角），点击可跳转
- **视口裁剪** — 只渲染可见区域内的对象（64 像素边距）
- **性能统计信息** — 切换 FPS/对象数量/渲染时间叠加显示
- **每个对象的可见性** — 隐藏/显示单个对象（保存在 localStorage 中）
- **图层** — 7 个可见性切换开关（网格、连接、实体、地标、生成点、背景、环境光）

#### 导航和快捷键

- **视口** — 平移/缩放相机，鼠标滚轮缩放（以光标为中心），空格键/中间鼠标按钮/右键单击拖动进行平移，自动适应内容，双击居中
- **搜索** — Ctrl+K 打开叠加层，按名称/ID 查找任何对象，支持模糊匹配、键盘导航和最近的搜索历史记录（localStorage）
- **速度面板** — 双击右键可打开浮动命令调板，其中包含与上下文相关的操作、可固定收藏夹、宏以及模式建议的快速操作
- **快捷键** — 21 个键盘快捷键，包括工具切换（V/Z/C/E/L/S）、Enter（打开详细信息）、P（应用预设）、Shift+P（保存预设）、Ctrl+C/V（复制/粘贴）、箭头微调（Shift = 5 倍）
- **辅助功能** — 使用 Escape 关闭的模式焦点陷阱，所有仅图标按钮上都有 ARIA 标签，可使用键盘导航的对象树，屏幕阅读器会播报已更改的指示器。空间画布操作（放置、框选、调整大小、绘制连接、平移）仍然基于指针

#### 导入和导出

- **内容包** — 针对 AI RPG Engine、Unreal Engine 5 或 Godot 4 进行目标导向的导出，具有每个目标的就绪状态徽章、可配置的选项（瓷砖大小、场景前缀、捆绑筛选）和下载后收据
- **项目捆绑包** — 可移植的 `.wfproject.json` 文件，其中包含来源元数据和依赖项信息
- **工具包捆绑包** — `.wfkit.json` 导出/导入，具有验证、冲突处理和来源跟踪功能
- **导入** — 自动检测 4 种格式，并提供结构化的保真度报告
- **差异** — 自导入以来的语义更改跟踪
- **场景预览** — 所有区域视觉绑定的内联 HTML/CSS 组合

## 创作模式

World Forge 将**类型**（奇幻、赛博朋克、海盗）与**模式**（地牢、海洋、太空）区分开。类型是风格，模式是规模。模式控制网格默认值、连接词汇、验证建议、指南措辞和预设筛选。

| 模式 | 网格 | 瓷砖 | 关键连接 |
|------|------|------|-----------------|
| 地牢 | 30×25 | 32 | 门、楼梯、通道、秘密、危险 |
| 区域/城市 | 50×40 | 32 | 道路、门、通道、传送门 |
| 区域/世界 | 80×60 | 48 | 道路、传送门、通道 |
| 海洋/海 | 60×50 | 48 | 水道、路线、传送门、危险 |
| 太空 | 100×80 | 64 | 对接、曲速、通道、传送门 |
| 内部空间 | 20×15 | 24 | 门、楼梯、通道、秘密 |
| 荒野 | 60×50 | 48 | 小路、道路、通道、危险 |

模式在创建项目时设置，并作为 `mode?: AuthoringMode` 存储在 `WorldProject` 中。每种模式都提供**智能默认值** — 连接类型、实体角色、区域名称和速度面板建议会自动调整。

## 创作表面

### 世界结构

- 具有空间布局、相邻区域、出口、光照、噪音、危险因素和可交互对象的区域。
- 12种连接类型（通道、门、楼梯、道路、传送门、秘密通道、危险区域、渠道、路线、对接点、跃迁点、小路），具有独特的视觉风格、边缘锚定路由、方向箭头和有条件虚线样式。
- 具有派系控制、经济概况、指标滑块、标签以及位于区域中心的区域名称标签的区域。
- 地标（区域内的命名兴趣点）。
- 生成点、遭遇锚点（基于类型的颜色标记）、派系存在以及压力热点。
- **垂直分层**——离散的图层（表面/地下/天空，或建筑物楼层），具有带符号的顺序、z 范围、图层间可见性以及连接器（楼梯/梯子/电梯）；区域分配到某个图层。
- **类型的环境危险因素**——共享的危险库（伤害/状态/即死/点燃效果、触发时间、地形移动成本、可通行性、视野阻挡、天气限制），每个区域引用。
- **区域入口派系门**——基于派系状态（等级/规模/物品/标志/成员/职业）的门禁，作为硬性或建议性的门禁，并带有作者编写的“显示锁”理由。

### 内容

- 具有属性、资源、AI 概况和自定义元数据的实体放置。
- 具有插槽、稀有度、属性修改器以及授予的动作的物品放置。
- 具有分支对话、条件和效果的对话树。
- 画布上的遭遇锚点——带有 Boss/伏击/巡逻类型的红色菱形标记。

### 城镇与室内环境

- 平铺绘制——基于图像的平铺集（按行/列切片），具有彩色矩形回退、拖动画笔、图层以及每个平铺的“实体”可通行性，用于墙壁碰撞。
- 用于室内环境的道具放置（调色板 + 画布渲染），带有放置工具。
- 城镇经济——市场节点（供应类别、价格修正器、违禁品）和制作站（站点类型、配方），每个区域进行编辑。
- 城镇结构——建筑物（可进入的占地面积，并与室内区域链接）、枢纽（服务 + 连接节点）以及据点（加强的派系据点）。

### 角色系统

- 玩家模板（起始属性、物品栏、装备、生成点）。
- 构建目录（原型、背景、特征、学科、交叉职称、关联）。
- 进度树（具有要求和效果的技能/能力节点）。

### 资源

- 资源清单（肖像、精灵图、背景、图标、平铺集），具有特定类型的绑定。
- 资源包（命名、版本化的分组，带有兼容性元数据、主题、许可证）。
- 场景预览（所有区域视觉绑定的内联组合，并检测缺失的资源）。

### 工作流程

- 区域预设（9 个内置，按模式过滤）和遭遇预设（10 个内置），具有合并/覆盖应用以及自定义预设的创建、读取、更新、删除功能。
- 起始工具包（7 个内置，特定于模式），具有工具包导出/导入 (`.wfkit.json`)、碰撞处理和来源跟踪功能。
- 布局模板（6 个预构建的区域排列）和对话模板（5 个对话开场白）。
- 区域合并和批量实体放置（网格/随机/圆形图案）。
- 自动保存，30 秒延迟和 3 版本恢复历史记录。
- Ctrl+K 在所有对象类型中搜索，具有模糊匹配和最近历史记录功能。
- 速度面板命令调色板，带有可固定收藏夹、宏、自定义组和模式建议。
- 21 个集中的键盘快捷键（包括 6 个工具切换键）。
- 项目元数据编辑器（作者、许可证、类别、标签）。
- 审查统计信息（角色分布、连接类型、遭遇类型、每个区域的区域数量）。
- 导出到 ContentPack JSON、项目包和审查摘要。
- 从 4 种格式导入，并提供结构化保真度报告、修复建议和语义差异跟踪。

请参阅 [`dogfood/WALKTHROUGH.md`](dogfood/WALKTHROUGH.md)，了解 Chapel Threshold 导出握手协议，以证明当前的表面。

## Dogfood 目录

`dogfood/` 目录包含一个集成测试框架，该框架在单元测试之外执行完整的从创作到导出的流水线。Chapel Threshold 示例 (`chapel-threshold.ts`) 构建了一个小型但完整的世界项目，并将其运行通过导出流程，并将输出写入 `dogfood/output/`。这证明了模式类型、验证和导出流水线是否能够端到端地使用真实数据工作——而不仅仅是孤立的模拟数据。

## 引擎兼容性

导出目标为三个引擎：

- **[ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine)** — ContentPack 格式，可由 [claude-rpg](https://github.com/mcp-tool-shop-org/claude-rpg) 加载。
- **Unreal Engine 5** — 具有主数据资源、角色生成清单和世界分区提示的 2.5D 感知的内容包。
- **Godot 4** — `.tscn` 场景生成，带有区域资源、导航链接和实体清单。

## 安全性

- **涉及的数据：**本地磁盘上的项目文件（用户创建的 JSON），没有服务器端存储。
- **不涉及的数据：**没有遥测数据、没有分析数据，除了本地开发服务器之外没有网络请求。
- **权限：**没有 API 密钥、没有密码、没有凭据。
- **源代码中没有秘密信息、令牌或凭据。**

## 许可证

MIT

---

由 [MCP Tool Shop](https://mcp-tool-shop.github.io/) 构建。
