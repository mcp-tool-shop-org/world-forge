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

<p align="center"><strong>v4.3.0</strong> — 1959 tests, 5 shipping packages + 1 planned Godot stub (6 total), 7 authoring modes, 2.5D authoring end-to-end</p>

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

## 快速入门

```bash
npm install
npm run build
npm run dev --workspace=packages/editor
```

打开 `http://localhost:5173` 以启动编辑器。

### 编辑器工作流程

1. **选择模式** — 地牢、区域、世界、海洋、太空、室内或荒野 — 以设置网格默认值和连接词汇。
2. **从模板开始** — 从模板管理器中选择一个入门模板或类型模板，或者从空白开始。
3. **绘制区域** — 在画布上拖动以创建区域，连接它们，并分配区域。
4. **放置实体** — 将 NPC、敌人、商人、遭遇和物品拖放到区域中。
5. **审查** — 打开“审查”选项卡，查看健康状态、内容概览，并导出摘要（Markdown/JSON）。
6. **导出** — 下载内容包、项目包（.wfproject.json）或审查摘要。

### 命令行导出

```bash
npx world-forge-export project.json --out ./my-pack
npx world-forge-export project.json --validate-only
```

## 包

### @world-forge/schema

用于世界创作的核心 TypeScript 类型和验证。

- **空间类型** — `WorldMap`、`Zone`、`ZoneConnection`、`District`、`Landmark`、`SpawnPoint`、`EncounterAnchor`、`FactionPresence`、`PressureHotspot`
- **内容类型** — `EntityPlacement`、`ItemPlacement`、`DialogueDefinition`、`PlayerTemplate`、`BuildCatalogDefinition`、`ProgressionTreeDefinition`
- **视觉层** — `AssetEntry`、`AssetPack`、`Tileset`、`TileLayer`、`PropDefinition`、`AmbientLayer`
- **模式系统** — `AuthoringMode`（7 个模式），特定于模式的网格/连接/验证配置文件。
- **验证** — `validateProject()`（54 个结构检查，使用基于地图的 O(n) 查找，`warningCount`），`advisoryValidation()`（特定于模式的建议，元数据完整性，资源命名）。
- **实用工具** — `assembleSceneData()`（具有缺失资源检测的视觉绑定），`scanDependencies()`（引用图分析），`buildReviewSnapshot()`（健康分类）。

### @world-forge/export-unreal

将 `WorldProject` 转换为适用于 2.5D 游戏的 Unreal Engine 5 内容包。

- **输出** — `pack.json`，每个区域和每个区域的原始数据资产 JSON，分组的实体生成清单，每个连接的关卡流式传输提示，世界分区单元提示，以及结构化的质量报告。
- **2.5D 字段** — `Zone.elevation`、`elevationRange`、`parallaxLayers`、`skylineRef` 被保留并转换为 UE 厘米 / Z 轴坐标。
- **坐标转换** — 纯函数（`pixelsToUnrealCm`、`elevationToZ`、`worldForgeToUnrealAxis`、`gridToUnrealAxis`）。默认世界比例为 1 个瓦片 = 100 厘米。
- **双向导入** — `importFromUnreal` 从 Unreal 包重建 `WorldProject`；仅限游戏数据的（对话、进度、构建）在质量报告中标记为已删除。
- **命令行** — `world-forge-export-unreal`，带有 `--out`、`--tile-size-cm`、`--validate-only` 和 `--verbose` 标志。

### @world-forge/export-godot

为计划中的 Godot 4 导出功能预留工作区位置（Fractured Road）。尚未实现。

### @world-forge/export-ai-rpg

将 `WorldProject` 转换为 ai-rpg-engine 的 `ContentPack` 格式。

- **导出** — 区域、区域、实体、物品、对话、玩家模板、构建目录、进度树、遭遇、派系、热点、清单和包元数据。
- **导入** — 8 个反向转换器从导出的 JSON 重建 `WorldProject`。
- **质量报告** — 结构化跟踪在转换过程中哪些内容是无损的、近似的或已删除的。
- **格式检测** — 自动检测 `WorldProject`、`ExportResult`、`ContentPack` 和 `ProjectBundle` 格式。
- **命令行** — `world-forge-export` 命令，带有 `--out`、`--validate-only` 和 `--verbose` 标志。

### @world-forge/renderer-2d

基于 PixiJS 的 2D 渲染器：带有平移/缩放的视口，带有区域覆盖，带有区域着色的连接箭头，按角色划分的实体图标，瓦片层，以及一个小地图。

### @world-forge/editor

React 19 + Vite Web应用程序，使用Zustand状态管理，支持撤销/重做功能（带有操作标签），自动保存（30秒节流，保留3个版本历史），支持深色/浅色主题切换，以及未保存更改的保护。

#### 工作区标签

| 标签 | 用途 |
|-----|---------|
| 地图 | 在2D画布上编辑区域/实体/行政区划 |
| 对象 | 分层树结构：行政区划 → 区域 → 实体/地标/生成点 |
| 角色 | 角色模板，包含属性、物品栏、装备、生成点 |
| 构建 | 原型、背景、属性、技能、组合 |
| 技能树 | 带有要求和效果的技能节点 |
| 对话 | 节点编辑、选项链接、断链检测 |
| 预设 | 区域和遭遇预设浏览器，支持合并/覆盖 |
| 资源 | 资源库，带有按类型过滤的搜索功能、孤立资源检测、资源包 |
| 问题 | 实时分组验证，点击聚焦导航 |
| 依赖 | 依赖扫描器，带有内联修复按钮 |
| 审查 | 健康仪表盘、内容概览、导出摘要 |
| 指南 | 首次运行检查清单，包含快捷键参考 |

#### 画布与编辑

- **工具** — 选择、区域填充、连接、实体放置、地标、生成点
- **多选** — Shift键+点击、框选、Ctrl+A；拖动移动，支持原子级撤销
- **对齐** — 6种对齐方式（左/右/上/下/居中-水平/居中-垂直）以及水平/垂直分布
- **吸附** — 拖动时吸附到附近对象的边缘/中心，带有视觉引导线
- **调整大小** — 每个区域有8个控制点，支持边缘吸附、最小尺寸限制、实时预览
- **复制** — Ctrl+D，重新映射ID、连接和行政区划
- **复制/粘贴** — Ctrl+C / Ctrl+V，重新映射ID，支持可配置的偏移量
- **点击循环** — 在同一位置重复点击，循环选择重叠的对象
- **上下文菜单** — 右键单击，显示7个上下文相关的操作（属性、删除、复制等）
- **连接预览** — 在连接工具放置时，显示一条虚线青色线
- **小地图** — 200x150像素的概览（位于右下角），点击可跳转
- **视口裁剪** — 仅渲染位于可见范围内的对象（64像素边距）
- **性能统计** — 切换显示FPS/对象数量/渲染时间
- **每个对象的可见性** — 隐藏/显示单个对象（保存在localStorage中）
- **图层** — 7个可见性切换按钮（网格、连接、实体、地标、生成点、背景、环境）

#### 导航与快捷键

- **视口** — 移动/缩放相机，鼠标滚轮缩放（光标固定）、空格键/中键拖动移动、自动适应内容、双击居中
- **搜索** — Ctrl+K打开覆盖层，通过名称/ID搜索任何对象，支持模糊匹配、键盘导航以及最近搜索历史（localStorage）
- **速度面板** — 双击右键，显示一个浮动命令面板，带有上下文相关的操作、可固定收藏、宏、以及模式建议的快速操作
- **快捷键** — 15个键盘快捷键，包括Enter键（打开详细信息）、P键（应用预设）、Shift+P键（保存预设）、Ctrl+C/V键（复制/粘贴）

#### 导入与导出

- **内容包** — 一键导出为ai-rpg-engine格式，并进行完整验证
- **项目包** — 便携的`.wfproject.json`文件，包含元数据和依赖信息
- **套件包** — `.wfkit.json`导出/导入，带有验证、碰撞处理和溯源跟踪
- **导入** — 自动检测4种格式，并提供结构化报告
- **差异** — 自导入以来，跟踪语义变更
- **场景预览** — 在线渲染所有区域的视觉绑定（HTML/CSS）

## 创作模式

World Forge 将 **类型**（奇幻、赛博朋克、海盗）与 **模式**（地牢、海洋、太空）区分开来。 类型是风格，模式是规模。 模式控制网格的默认设置、连接词汇、验证建议、引导用语以及预设过滤。

| 模式 | 网格 | 瓦片 | 关键连接 |
|------|------|------|-----------------|
| 地牢 | 30×25 | 32 | 门、楼梯、通道、秘密、危险 |
| 区域/城市 | 50×40 | 32 | 道路、门、通道、传送门 |
| 区域/世界 | 80×60 | 48 | 道路、传送门、通道 |
| 海洋/海 | 60×50 | 48 | 航道、路线、传送门、危险 |
| 太空 | 100×80 | 64 | 对接、跃迁、通道、传送门 |
| 室内 | 20×15 | 24 | 门、楼梯、通道、秘密 |
| 荒野 | 60×50 | 48 | 小路、道路、通道、危险 |

模式在创建项目时设置，并以 `mode?: AuthoringMode` 的形式存储在 `WorldProject` 中。 每个模式都提供 **智能默认设置**，连接类型、实体角色、区域名称以及速度面板建议会自动调整。

## 创作界面

### 世界结构

- 具有空间布局、邻居、出口、光照、噪音、危险和可交互元素的区域
- 12 种连接类型（通道、门、楼梯、道路、传送门、秘密、危险、航道、路线、对接、跃迁、小路），具有不同的视觉风格、边缘锚定路由、方向箭头以及条件性虚线样式
- 区域具有派系控制、经济概况、指标滑块、标签以及在区域中心点的区域名称标签
- 标志性地点（区域内的命名兴趣点）
- 初始点、遭遇锚点（基于类型的颜色）、派系存在以及压力热点

### 内容

- 带有属性、资源、AI 配置文件和自定义元数据的实体放置
- 带有插槽、稀有度、属性修正器和授予动词的物品放置
- 对话树，包含分支对话、条件和效果
- 遭遇锚点位于画布上，以红色菱形标记显示，并带有 Boss/伏击/巡逻类型

### 角色系统

- 玩家模板（起始属性、物品栏、装备、初始点）
- 构建目录（原型、背景、特质、学科、交叉称号、羁绊）
- 进度树（带有要求和效果的技能/能力节点）

### 资源

- 资源清单（头像、精灵、背景、图标、瓦片集），具有特定类型的绑定
- 资源包（命名、版本控制的组，包含兼容性元数据、主题和许可证）
- 场景预览（所有区域视觉绑定的内联组合，并检测缺失的资源）

### 工作流程

- 区域预设（9个内置，按模式过滤）和遭遇预设（10个内置），支持合并/覆盖应用，以及自定义预设的创建、读取、更新和删除（CRUD）功能。
- 启动套件（7个内置，特定模式），支持套件导出/导入（`.wfkit.json`格式），碰撞检测，以及溯源跟踪。
- 布局模板（6种预定义的区域布局）和对话模板（5种对话开场白）。
- 区域合并和批量实体放置（网格/随机/圆形模式）。
- 自动保存，每30秒保存一次，并保留3个版本的历史记录。
- 使用Ctrl+K在所有对象类型中进行搜索，支持模糊匹配和最近历史记录。
- 速度面板命令调色板，支持固定常用功能，宏，自定义分组，以及模式建议。
- 15个集中式键盘快捷键。
- 项目元数据编辑器（作者、许可证、类别、标签）。
- 审查统计信息（角色分布、连接类型、遭遇类型、每个区域的区域数量）。
- 导出为ContentPack JSON格式、项目包和审查摘要。
- 导入4种格式，提供结构完整性报告、修复建议和语义差异跟踪。

请参考[`dogfood/WALKTHROUGH.md`](dogfood/WALKTHROUGH.md)以了解Chapel Threshold导出流程，验证当前版本的功能。

## 内部测试目录

`dogfood/`目录包含一个集成测试框架，用于在单元测试之外，全面测试从创作到导出的整个流程。Chapel Threshold示例（`chapel-threshold.ts`）构建一个小型但完整的世界项目，将其导出，并将输出写入`dogfood/output/`目录。这证明了模式类型、验证以及导出流水线在真实数据下的端到端工作情况，而不仅仅是孤立的模拟。

## 引擎兼容性

导出的内容针对[ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine)的内容类型。导出的ContentPack可以直接由[claude-rpg](https://github.com/mcp-tool-shop-org/claude-rpg)加载。

## 安全性

- **访问数据：** 本地磁盘上的项目文件（用户创建的JSON文件），不涉及服务器端存储。
- **未访问数据：** 不收集任何遥测数据，不进行任何分析，不进行任何超出本地开发服务器的网络请求。
- **权限：** 不使用任何API密钥、密钥或凭据。
- **源代码中不包含任何密钥、令牌或凭据。**

## 许可证

MIT

---

由[MCP Tool Shop](https://mcp-tool-shop.github.io/)构建。
