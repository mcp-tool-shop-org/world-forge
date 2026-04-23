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

<p align="center">2D / 2.5D world authoring studio with peer export lanes for <a href="https://github.com/mcp-tool-shop-org/ai-rpg-engine">AI RPG Engine</a>, <a href="https://www.unrealengine.com/">Unreal Engine 5</a>, and (planned) Godot 4.<br>One editor, many modes — paint zones, place entities, define districts, export a complete content pack for your engine of choice.</p>

The company is committed to providing high-quality products and services.
该公司致力于提供高质量的产品和服务。
<p align="center"><strong>v4.4.0</strong> — 2067 tests, 5 shipping packages + 1 planned Godot stub (6 total), 7 authoring modes, 2.5D authoring, Unreal pack versioning + signing + diff</p>
<!-- version:end -->

## 架构

```
packages/
  schema/          @world-forge/schema         — spatial types, validation, 2.5D fields
  export-ai-rpg/   @world-forge/export-ai-rpg  — AI RPG Engine export pipeline + CLI
  export-unreal/   @world-forge/export-unreal  — Unreal Engine 5 export pipeline + CLI (2.5D aware)
  export-godot/    @world-forge/export-godot   — (planned) Godot 4 export lane, stub only
  renderer-2d/     @world-forge/renderer-2d    — PixiJS 2D canvas renderer
  editor/          @world-forge/editor         — React web authoring app
```

## 快速入门指南

```bash
npm install
npm run build
npm run dev --workspace=packages/editor
```

打开 `http://localhost:5173` 即可启动编辑器。

### 编辑工作流程

1. **选择模式**：选择“地牢”、“区域”、“世界”、“海洋”、“太空”、“室内”或“荒野”模式，以设置默认网格和连接词汇。
2. **从模板开始**：从模板管理器中选择一个入门模板或类型模板，或者从空白状态开始。
3. **绘制区域**：在画布上拖动以创建区域，连接它们，并分配区域所属的区域。
4. **放置实体**：将NPC、敌人、商人、遭遇事件和物品放置到区域中。
5. **审查**：打开“审查”选项卡，查看健康状况、内容概览，并导出摘要（Markdown/JSON格式）。
6. **导出**：下载内容包、项目捆绑包（.wfproject.json文件），或导出审查摘要。

### 命令行导出

```bash
npx world-forge-export project.json --out ./my-pack
npx world-forge-export project.json --validate-only
```

## 套餐

### @world-forge/schema

用于世界构建的核心 TypeScript 类型和验证功能。

- **空间类型** — `WorldMap`（世界地图）、`Zone`（区域）、`ZoneConnection`（区域连接）、`District`（行政区）、`Landmark`（地标）、`SpawnPoint`（生成点）、`EncounterAnchor`（遭遇点）、`FactionPresence`（势力存在点）、`PressureHotspot`（压力热点）
- **内容类型** — `EntityPlacement`（实体放置）、`ItemPlacement`（物品放置）、`DialogueDefinition`（对话定义）、`PlayerTemplate`（玩家模板）、`BuildCatalogDefinition`（构建目录定义）、`ProgressionTreeDefinition`（成长树定义）
- **视觉层级** — `AssetEntry`（资源条目）、`AssetPack`（资源包）、`Tileset`（瓦片集）、`TileLayer`（瓦片层）、`PropDefinition`（道具定义）、`AmbientLayer`（环境层）
- **模式系统** — `AuthoringMode`（7种模式），以及与特定模式相关的网格/连接/验证配置。
- **验证** — `validateProject()`（54项结构性检查，基于地图的O(n)查找，返回警告数量），`advisoryValidation()`（提供特定模式的建议，检查元数据完整性，以及资源命名）。
- **实用工具** — `assembleSceneData()`（创建视觉绑定，并检测缺失资源）、`scanDependencies()`（分析引用图）、`buildReviewSnapshot()`（健康状况评估）。

### @world-forge/export-unreal

将一个“世界项目”（WorldProject）转换为适用于Unreal Engine 5的、针对2.5D游戏优化的内容包。

- **输出结果**：`pack.json` 文件，每个区域和每个行政区的主要数据资产 JSON 文件，分组的角色生成清单，每个连接的关卡流式传输提示，世界分区单元提示，以及一份结构化的质量报告。
- **2.5D 字段**：`Zone.elevation`（区域高度）、`elevationRange`（高度范围）、`parallaxLayers`（视差图层）和 `skylineRef`（地平线引用）会被保留并转换为 Unreal 引擎的厘米/Z轴向上坐标系。
- **坐标转换**：使用纯函数进行坐标转换，包括 `pixelsToUnrealCm`（像素到 Unreal 厘米）、`elevationToZ`（高度到 Z 轴）、`worldForgeToUnrealAxis`（WorldForge 到 Unreal 轴）和 `gridToUnrealAxis`（网格到 Unreal 轴）。默认的世界比例为：1 个瓦格 = 100 厘米。
- **双向导入**：`importFromUnreal` 函数可以从 Unreal 引擎的包文件重建 WorldProject；仅与游戏相关的游戏数据（对话、进度、构建）会在质量报告中被标记为已忽略。
- **命令行界面 (CLI)**：使用 `world-forge-export-unreal` 命令，并带有 `--out`（输出目录）、`--tile-size-cm`（瓦格大小，单位厘米）、`--validate-only`（仅验证）和 `--verbose`（详细模式）等参数。

### @world-forge/export-godot

为计划中的 Godot 4 导出功能（“破碎之路”项目）预留的工作空间。尚未实现。

### @world-forge/导出AI角色扮演游戏

将 `WorldProject` 转换为 ai-rpg-engine 引擎的 `ContentPack` 格式。

- **导出** — 包括区域、行政区划、实体、物品、对话、玩家模板、构建目录、成长树、遭遇、派系、热点、清单以及包的元数据。
- **导入** — 8个反向转换器可以从导出的JSON文件中重建一个WorldProject项目。
- **精确度报告** — 结构化地跟踪在转换过程中哪些内容是无损的，哪些是近似的，以及哪些被舍弃的。
- **格式检测** — 自动检测WorldProject项目、导出结果、内容包和项目包的格式。
- **命令行界面 (CLI)** — 使用 `world-forge-export` 命令，并带有 `--out`、`--validate-only` 和 `--verbose` 选项。

### @world-forge/renderer-2d

基于 PixiJS 的 2D 渲染引擎，具有以下功能：可缩放和平移的视口，带有区域颜色标识的区域叠加层，连接箭头，根据角色显示实体图标，分层瓦片地图，以及一个迷你地图。

### @world-forge/editor

一个使用 React 19 + Vite 构建的 Web 应用程序，具有 Zustand 状态管理、带动作标签的撤销/重做功能、自动保存（30 秒节流，3 个版本历史记录）、深色/浅色主题切换，以及未保存更改的保护。

#### 工作区标签

| 标签 | 用途 |
|-----|---------|
| 地图 | 在 2D 视图中编辑区域/实体/行政区划。 |
| 对象 | 分层树结构：行政区划 → 区域 → 实体/地标/生成点 |
| 角色 | 角色模板，包含属性、物品栏、装备、生成点。 |
| 构建 | 原型、背景、特性、技能、组合。 |
| 树 | 带有要求和效果的进度节点。 |
| 对话 | 节点编辑、选项链接、断链检测。 |
| 预设 | 区域和遭遇预设浏览器，支持合并/覆盖。 |
| 资源 | 资源库，带有类型过滤的搜索功能、孤立资源检测、资源包。 |
| 问题 | 实时分组验证，带点击聚焦的导航。 |
| 依赖 | 依赖扫描器，带有内联修复按钮。 |
| 审查 | 健康仪表盘、内容概览、摘要导出。 |
| 指南 | 首次运行检查清单，包含快捷键参考。 |

#### 画布与编辑

- **工具** — 选择、区域填充、连接、放置实体、地标、生成点。
- **多选** — Shift 键点击、框选、Ctrl+A；拖动移动，支持原子级撤销。
- **对齐** — 6 种对齐方式（左/右/上/下/居中-水平/居中-垂直）以及水平/垂直分布。
- **吸附** — 拖动时吸附到附近对象的边缘/中心，带有视觉引导线。
- **调整大小** — 每个区域有 8 个调整大小的句柄，带有边缘吸附、最小尺寸限制、实时预览。
- **复制** — Ctrl+D，重新映射 ID、连接和行政区划。
- **复制/粘贴** — Ctrl+C / Ctrl+V，重新映射 ID，并支持可配置的偏移量。
- **点击循环** — 在相同位置重复点击，循环选择重叠的对象。
- **上下文菜单** — 右键单击，显示 7 个上下文相关的操作（属性、删除、复制等）。
- **连接预览** — 在连接工具放置时，显示一条虚线青色线。
- **小地图** — 200x150 的概览视图（位于右下角），点击可跳转。
- **视口裁剪** — 仅渲染位于可见范围内的对象（64 像素边距）。
- **性能统计** — 切换 FPS/对象数量/渲染时间叠加显示。
- **每个对象的可见性** — 隐藏/显示单个对象（保存在 localStorage 中）。
- **图层** — 7 个可见性切换（网格、连接、实体、地标、生成点、背景、环境）。

#### 导航与快捷键

- **视口** — 移动/缩放相机，鼠标滚轮缩放（光标固定）、空格键/中键拖动移动、自动适应内容、双击居中。
- **搜索** — Ctrl+K 打开覆盖层，通过名称/ID 模糊搜索任何对象，支持键盘导航和最近搜索历史记录（localStorage）。
- **速度面板** — 双击右键，显示一个浮动命令面板，带有上下文相关的操作、可固定收藏夹、宏、以及模式建议的快速操作。
- **快捷键** — 15 个键盘快捷键，包括 Enter 键（打开详细信息）、P 键（应用预设）、Shift+P 键（保存预设）、Ctrl+C/V 键（复制/粘贴）。

#### 导入与导出

- **内容包 (ContentPack)**：一键导出为 ai-rpg-engine 格式，并进行完整验证。
- **项目包 (Project bundles)**：可移植的 `.wfproject.json` 文件，包含来源元数据和依赖信息。
- **工具包 (Kit bundles)**：`.wfkit.json` 文件的导出/导入功能，支持验证、碰撞处理和来源追踪。
- **导入 (Import)**：自动检测 4 种格式，并提供结构化报告以显示导入结果。
- **差异比较 (Diff)**：跟踪自导入以来的语义性变更。
- **场景预览 (Scene preview)**：在页面内实时渲染所有区域的视觉元素，使用 HTML/CSS 技术。

## 创作模式

World Forge 将“类型”（如奇幻、赛博朋克、海盗）与“模式”（如地下城、海洋、太空）区分开来。“类型”决定了游戏风格，“模式”则决定了游戏规模。模式会影响默认网格设置、连接词汇、验证建议、引导语以及预设过滤选项。

| 模式。 | 网格。 | 瓷砖。 | 关键连接。 |
|------|------|------|-----------------|
| 地牢。 | 30乘以25。 | 32 | 门、楼梯、通道、秘密、危险。 |
| 区/市 | 50 x 40 | 32 | 道路、门、通道、入口。 |
| 区域 / 世界 | 80 x 60 | 48 | 道路、入口、通道。 |
| 海洋/海。 | 60乘以50。 | 48 | 通道，路线，门户，危险。 |
| 空间。 | 100 x 80 | 64 | 停泊、扭曲、通道、入口。 |
| 内部。 | 20乘以15。 | 24 | 门、楼梯、通道、秘密。 |
| 荒野。 | 60乘以50。 | 48 | 小路、道路、通道、危险。 |

在创建项目时，会设置模式，并将该模式以 `mode?: AuthoringMode` 的形式存储在 `WorldProject` 对象中。每个模式都提供**智能默认设置**，例如连接类型、实体角色、区域名称以及“速度面板”的建议，这些设置会根据实际情况自动调整。

## 内容创作界面

### 世界结构

- 区域：包含空间布局、邻近区域、出口、光照、噪音、危险因素以及可交互元素。
- 12种连接方式（通道、门、楼梯、道路、传送门、秘密通道、危险区域、通道、路线、对接点、跃迁点、路径），每种方式具有独特的视觉风格，采用边缘对齐的连接方式，带有指示方向的箭头，并根据条件采用虚线样式。
- 区域：包含派系控制、经济概况、指标滑块、标签以及位于区域中心的区域名称标签。
- 标志性地点（区域内的重要地点，带有名称）。
- 出现点、遭遇点（根据类型进行颜色区分）、派系存在点以及高压力区域。

### 内容

- 实体放置，包含属性、资源、人工智能配置以及自定义元数据。
- 物品放置，包含槽位、稀有度、属性加成以及赋予的动词。
- 对话树，包含分支对话、条件和效果。
- 场景锚点，画布上以红色菱形标记显示，用于表示Boss、伏击或巡逻点。

### 字符系统

- 角色模板（起始属性、物品栏、装备、出生点）
- 构建目录（原型、背景、特性、专长、跨领域技能、关联关系）
- 升级树（带有要求和效果的技能/能力节点）

### 资源

- 资源清单（包括角色形象、精灵图、背景图、图标、瓦片集等），并根据资源类型进行分类。
- 资源包（命名、版本控制的资源集合，包含兼容性信息、主题和许可信息）。
- 场景预览（在线组合所有区域的视觉资源，并检测缺失的资源）。

### 工作流程

- 区域预设（9个内置，按模式过滤）和遭遇预设（10个内置），支持合并/覆盖应用，以及自定义预设的创建、读取、更新和删除（CRUD）功能。
- 启动套件（7个内置，特定模式），支持套件导出/导入（`.wfkit.json`格式），碰撞检测，以及溯源跟踪。
- 布局模板（6种预定义的区域布局）和对话模板（5种对话开场白）。
- 区域合并和批量实体放置（网格/随机/圆形模式）。
- 自动保存，每30秒保存一次，并保留3个版本的历史记录。
- 使用Ctrl+K搜索所有对象类型，支持模糊匹配和最近历史记录。
- 速度面板命令调色板，支持固定常用功能、宏、自定义分组和模式建议。
- 15个集中式键盘快捷键。
- 项目元数据编辑器（作者、许可证、类别、标签）。
- 审查统计信息（角色分布、连接类型、遭遇类型、每个区域的区域数量）。
- 导出为ContentPack JSON、项目包和审查摘要。
- 导入4种格式，提供结构化完整性报告、修复建议和语义差异跟踪。

请参考[`dogfood/WALKTHROUGH.md`](dogfood/WALKTHROUGH.md)以了解Chapel Threshold导出流程，验证当前版本的功能。

## 内部测试目录

`dogfood/`目录包含一个集成测试框架，用于在单元测试之外，全面测试从创作到导出的整个流程。Chapel Threshold示例（`chapel-threshold.ts`）构建一个小型但完整的世界项目，将其导出，并将输出写入`dogfood/output/`目录。这证明了模式类型、验证以及导出流水线在真实数据下的端到端工作情况，而不仅仅是孤立的模拟。

## 引擎兼容性

导出的内容针对[ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine)的内容类型。导出的ContentPack可以直接由[claude-rpg](https://github.com/mcp-tool-shop-org/claude-rpg)加载。

## 安全性

- **访问数据：** 本地磁盘上的项目文件（用户创建的JSON文件），不涉及服务器端存储。
- **未访问数据：** 不收集任何遥测数据、分析数据，也不进行任何超出本地开发服务器的网络请求。
- **权限：** 不使用任何API密钥、密钥或凭据。
- **源代码中不包含任何密钥、令牌或凭据。**

## 许可证

MIT

---

由[MCP Tool Shop](https://mcp-tool-shop.github.io/)构建。
