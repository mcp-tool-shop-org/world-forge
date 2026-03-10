<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.md">English</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./logo.png" alt="World Forge" width="400">
</p>

# @world-forge/editor

一个基于 React 19 的 Web 应用程序，用于 [World Forge](https://github.com/mcp-tool-shop-org/world-forge)——一个用于 AI 角色扮演游戏引擎的 2D 世界创作工作室。

## 功能

- **画布**：在 2D 网格上绘制区域，创建连接，放置实体、地标和遭遇，并支持缩放和平移视图。
- **多选**：通过单击、按住 Shift 键单击或框选来选择区域、实体、地标、生成点和遭遇；可以拖动选定的对象，并支持撤销操作。
- **遭遇编辑**：在区域上放置遭遇锚点，使用基于类型的画布标记（Boss、伏击、巡逻），可以编辑属性（敌人 ID、概率、冷却时间、标签）。
- **区域编辑**：扩展的区域面板，包含指标滑块、标签、控制派系、经济配置文件、派系存在管理以及压力热点编辑功能。
- **批量编辑**：批量分配区域、批量添加标签以及批量删除，适用于选择多个区域的情况。
- **预设系统**：区域和遭遇预设，支持合并/覆盖功能；内置 4 个区域预设，3 个遭遇预设；支持自定义预设的创建、读取、更新和删除，并使用 localStorage 存储。
- **键盘快捷键**：集中式快捷键注册表，包含 13 个快捷键：Escape、Ctrl+A、Ctrl+D、Ctrl+K、Delete、方向键微调、Enter（打开详细信息）、P（应用预设）、Shift+P（保存预设）。
- **双击**：双击画布上的任何对象以选中它，切换到“地图”选项卡，并将视口居中。
- **速度面板**：双击鼠标右键打开一个浮动命令面板，其中包含上下文相关的操作，可以固定常用功能（编辑模式下可重新排序）、最近操作、自定义分组、轻量级宏（带步骤编辑器）、搜索过滤以及键盘导航。
- **工作区选项卡**：地图、角色、构建、树木、对话、对象、预设、资源、问题、指南。
- **资源库**：管理角色肖像、精灵图、背景、图标和瓦片集，并提供特定类型的绑定。
- **撤销/重做**：通过 Zustand 实现 10 级历史记录堆栈。
- **导入/导出**：提供完整的数据报告，并支持语义差异跟踪。
- **验证**：包含 54 项结构检查，并支持点击以聚焦问题。
- **模板**：提供游戏类型入门示例和示例世界，方便快速上手。

## 快速开始

```bash
npm install
npm run dev --workspace=packages/editor
```

打开 `http://localhost:5173` 以启动编辑器。

## 许可证

MIT
