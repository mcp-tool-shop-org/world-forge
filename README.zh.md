<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.md">English</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./assets/logo.png" alt="World Forge" width="400">
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop-org/world-forge/actions/workflows/ci.yml"><img src="https://github.com/mcp-tool-shop-org/world-forge/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@world-forge/schema"><img src="https://img.shields.io/npm/v/@world-forge/schema" alt="npm schema"></a>
  <a href="https://www.npmjs.com/package/@world-forge/export-ai-rpg"><img src="https://img.shields.io/npm/v/@world-forge/export-ai-rpg" alt="npm export"></a>
  <a href="https://www.npmjs.com/package/@world-forge/renderer-2d"><img src="https://img.shields.io/npm/v/@world-forge/renderer-2d" alt="npm renderer"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="MIT License"></a>
  <a href="https://mcp-tool-shop-org.github.io/world-forge/"><img src="https://img.shields.io/badge/Landing_Page-live-blue" alt="Landing Page"></a>
</p>

<p align="center">2D world authoring studio for <a href="https://github.com/mcp-tool-shop-org/ai-rpg-engine">AI RPG Engine</a>.<br>One editor, many modes — paint zones, place entities, define districts, export a complete ContentPack ready to play.</p>

## 架构

```
packages/
  schema/          @world-forge/schema        — spatial types, validation
  export-ai-rpg/   @world-forge/export-ai-rpg — engine export pipeline + CLI
  renderer-2d/     @world-forge/renderer-2d   — PixiJS 2D canvas renderer
  editor/          @world-forge/editor         — React web authoring app
```

## 快速开始

```bash
npm install
npm run build
npm run dev --workspace=packages/editor
```

打开 `http://localhost:5173` 以启动编辑器。

### 编辑器工作流程

1. **选择模式** — 地牢、区域、世界、海洋、太空、室内或荒野 — 以设置网格默认值和连接词汇表。
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
- **验证** — `validateProject()`（54 个结构检查），`advisoryValidation()`（特定于模式的建议）。
- **实用工具** — `assembleSceneData()`（具有缺失资源检测的视觉绑定），`scanDependencies()`（引用图分析），`buildReviewSnapshot()`（健康分类）。

### @world-forge/export-ai-rpg

将 `WorldProject` 转换为 ai-rpg-engine 的 `ContentPack` 格式。

- **导出** — 区域、区域、实体、物品、对话、玩家模板、构建目录、进度树、遭遇、派系、热点、清单和包元数据。
- **导入** — 8 个反向转换器可以从导出的 JSON 文件重建 `WorldProject`。
- **保真度报告** — 结构化跟踪在转换过程中哪些内容未丢失、已近似或已删除。
- **格式检测** — 自动检测 `WorldProject`、`ExportResult`、`ContentPack` 和 `ProjectBundle` 格式。
- **命令行** — `world-forge-export` 命令，带有 `--out` 和 `--validate-only` 标志。

### @world-forge/renderer-2d

基于 PixiJS 的 2D 渲染器：带有缩放和平移的视口，带有区域着色的区域叠加层，连接箭头，按角色排列的实体图标，瓦片层和一个小地图。

### @world-forge/editor

使用 React 19 + Vite 构建的 Web 应用程序，具有 Zustand 状态管理和撤消/重做功能。

#### 工作区选项卡

| 选项卡 | 用途 |
|-----|---------|
| 地图 | 在 2D 画布上编辑区域/实体/区域。 |
| 对象 | 分层树：区域 → 区域 → 实体/地标/生成点。 |
| 玩家 | 带有属性、物品栏、装备和生成点的玩家模板。 |
| 构建 | 原型、背景、特质、技能、组合。 |
| 树 | 带有要求和效果的进度节点。 |
| 对话 | 节点编辑、选择链接、断开引用检测。 |
| 预设 | 区域和遭遇预设浏览器，支持合并/覆盖。 |
| 资源 | 带有按类型过滤的搜索、孤立对象检测和资源包的资源库。 |
| 问题 | 实时分组验证，带有单击聚焦的导航。 |
| 依赖 | 依赖扫描器，带有内联修复按钮。 |
| 审查 | 健康仪表盘，内容概览，导出摘要 |
| 指南 | 首次运行检查清单，包含快捷键参考 |

#### 画布与编辑

- **工具** — 选择、区域填充、连接、实体放置、地标、生成
- **多选** — Shift+单击、框选、Ctrl+A；拖动移动，支持原子级撤销
- **对齐** — 6向对齐（左/右/上/下/居中-水平/居中-垂直）以及水平/垂直分布
- **吸附** — 拖动时吸附到附近对象的边缘/中心，并显示辅助线
- **调整大小** — 每个区域有8个调整大小的句柄，支持边缘吸附、最小尺寸限制、实时预览
- **复制** — Ctrl+D，复制时重新映射ID、连接和区域分配
- **单击循环** — 在同一位置重复单击，循环选择重叠的对象
- **图层** — 7个可见性切换（网格、连接、实体、地标、生成、背景、环境）

#### 导航与快捷键

- **视口** — 移动/缩放相机，鼠标滚轮缩放（光标固定）、空格键/中键拖动移动、自动适应内容、双击居中
- **搜索** — Ctrl+K 弹出覆盖层，可以通过名称/ID搜索任何对象，支持键盘导航
- **速度面板** — 双击右键弹出命令面板，提供上下文相关的操作、可固定收藏、宏，以及根据模式推荐的快速操作
- **快捷键** — 13个键盘快捷键，包括Enter（打开详细信息）、P（应用预设）、Shift+P（保存预设）

#### 导入与导出

- **内容包** — 一键导出为ai-rpg-engine格式，并进行完整验证
- **项目包** — 包含元数据和依赖信息的便携式`.wfproject.json`文件
- **工具包** — `.wfkit.json`导出/导入，支持验证、碰撞处理和溯源跟踪
- **导入** — 自动检测4种格式，并提供结构化报告
- **差异** — 跟踪自导入以来的语义性更改
- **场景预览** — 实时渲染所有区域的视觉绑定，生成HTML/CSS

## 创作模式

World Forge将**类型**（奇幻、赛博朋克、海盗）与**模式**（地牢、海洋、太空）分开。 类型是风格——模式是规模。 模式控制网格默认设置、连接词汇、验证建议、提示语以及预设筛选。

| 模式 | 网格 | 瓷砖 | 关键连接 |
|------|------|------|-----------------|
| 地牢 | 30×25 | 32 | 门、楼梯、通道、秘密、危险 |
| 区域/城市 | 50×40 | 32 | 道路、门、通道、传送门 |
| 区域/世界 | 80×60 | 48 | 道路、传送门、通道 |
| 海洋/海 | 60×50 | 48 | 水道、航线、传送门、危险 |
| 太空 | 100×80 | 64 | 对接、跃迁、通道、传送门 |
| 室内 | 20×15 | 24 | 门、楼梯、通道、秘密 |
| 荒野 | 60×50 | 48 | 小路、道路、通道、危险 |

模式在创建项目时设置，并存储在`WorldProject`中的`mode?: AuthoringMode`字段中。 每个模式都提供**智能默认设置**——连接类型、实体角色、区域名称以及速度面板建议会自动调整。

## 创作表面

### 世界结构

- 具有空间布局、邻近区域、出口、光照、噪音、危险因素和可交互元素的区域。
- 12 种连接类型（通道、门、楼梯、道路、传送门、隐藏区域、危险区域、通道、路线、对接点、传送点、路径），具有独特的视觉风格、边缘对齐的路由、方向箭头和条件性虚线样式。
- 区域，具有派系控制、经济概况、指标滑块、标签以及位于区域中心的区域名称标签。
- 标志性地点（区域内的命名兴趣点）。
- 出现点、遭遇点（基于类型的颜色区分）、派系存在以及压力热点。

### 内容

- 实体放置，包括属性、资源、AI 配置文件和自定义元数据。
- 物品放置，包括插槽、稀有度、属性修正器和可执行动作。
- 对话树，包括分支对话、条件和效果。
- 遭遇点，位于画布上，以红色菱形标记显示，并标注为 Boss/伏击/巡逻类型。

### 角色系统

- 玩家模板（起始属性、背包、装备、出现点）。
- 构建目录（原型、背景、特质、专长、跨标题、关联）。
- 进度树（技能/能力节点，包括要求和效果）。

### 资源

- 资源清单（头像、精灵图、背景、图标、瓦片集），具有特定类型的绑定。
- 资源包（命名、版本控制的组，包含兼容性元数据、主题和许可证）。
- 场景预览（所有区域视觉绑定的内联组合，并检测缺失的资源）。

### 工作流程

- 区域预设（9 个内置，按模式过滤）和遭遇预设（10 个内置），支持合并/覆盖，并提供自定义预设的创建、读取、更新和删除功能。
- 启动套件（7 个内置，特定于模式），支持套件导出/导入（`.wfkit.json`），碰撞处理和来源跟踪。
- 使用 Ctrl+K 搜索所有对象类型，包括连接和遭遇。
- 速度面板命令调色板，支持固定常用命令、宏、自定义组和模式建议。
- 13 个集中式键盘快捷键。
- 导出为 ContentPack JSON、项目包和审查摘要。
- 导入 4 种格式，并提供结构化保真度报告和语义差异跟踪。

请参阅 [`dogfood/WALKTHROUGH.md`](dogfood/WALKTHROUGH.md)，以验证 Chapel Threshold 导出过程，证明当前版本。

## 引擎兼容性

导出的内容适用于 [ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine) 的内容类型。导出的 ContentPack 可以直接由 [claude-rpg](https://github.com/mcp-tool-shop-org/claude-rpg) 加载。

## 安全性

- **访问数据：** 本地磁盘上的项目文件（用户创建的 JSON），不涉及服务器端存储。
- **未访问数据：** 不收集任何遥测数据、分析数据，也不进行任何网络请求，仅限于本地开发服务器。
- **权限：** 不使用任何 API 密钥、密钥或凭据。
- **源代码中不包含任何密钥、令牌或凭据。**

## 许可证

MIT

---

构建者：[MCP Tool Shop](https://mcp-tool-shop.github.io/)
