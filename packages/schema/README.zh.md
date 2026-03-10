<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.md">English</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./logo.png" alt="World Forge" width="400">
</p>

# @world-forge/schema

用于 [World Forge](https://github.com/mcp-tool-shop-org/world-forge) 的核心 TypeScript 类型，World Forge 是一个用于 AI 角色扮演引擎的 2D 世界创作工具。

## 类型

- **空间：** `WorldMap`（世界地图）、`Zone`（区域）、`ZoneExit`（区域出口）、`ZoneConnection`（区域连接）、`Landmark`（地标）、`Interactable`（可互动对象）
- **区域：** `District`（区域）、`DistrictMetrics`（区域指标）、`EconomyProfile`（经济概况）、`FactionPresence`（势力存在）、`PressureHotspot`（压力热点）
- **实体：** `EntityPlacement`（实体放置，包含 `EntityStats`（实体属性）、`EntityResources`（实体资源）、`EntityAI`（实体 AI））、`ItemPlacement`（物品放置，包含 `ItemSlot`（物品栏）、`ItemRarity`（物品稀有度））、`SpawnPoint`（生成点）、`EncounterAnchor`（遭遇点）、`CraftingStation`（制作站）、`MarketNode`（市场节点）
- **视觉：** `Tileset`（瓦片集）、`TileDefinition`（瓦片定义）、`TileLayer`（瓦片层）、`PropDefinition`（道具定义）、`PropPlacement`（道具放置）、`AmbientLayer`（环境层）
- **项目：** `WorldProject`（世界项目）——完整的创作世界容器
- **验证：** `validateProject()` 函数，包含 54 个结构性检查

## 安装

```bash
npm install @world-forge/schema
```

## 用法

```typescript
import type { WorldProject, Zone, EntityPlacement } from '@world-forge/schema';
import { validateProject } from '@world-forge/schema';

const result = validateProject(myProject);
if (!result.valid) {
  console.error(result.errors);
}
```

## 许可证

MIT
