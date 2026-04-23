<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.md">English</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./logo.png" alt="World Forge" width="400">
</p>

# @world-forge/export-ai-rpg

用于 [World Forge](https://github.com/mcp-tool-shop-org/world-forge) 的导出流水线，将 `WorldProject` 转换为 [ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine) 的 `ContentPack`。

## 安装

```bash
npm install @world-forge/export-ai-rpg
```

## API

```typescript
import { exportToEngine } from '@world-forge/export-ai-rpg';

const result = exportToEngine(myProject);
if (!result.success) {
  console.error(result.errors);
} else {
  const { contentPack, manifest, packMeta, warnings } = result;
}
```

## 命令行界面 (CLI)

```bash
npx world-forge-export project.json --out ./my-pack
npx world-forge-export project.json --validate-only
```

## 选择哪个导出器？

World Forge 提供了多个游戏引擎导出器。选择与您的目标运行时相匹配的导出器：

| 导出器 | 目标 | 何时使用… |
|----------|--------|-----------|
| `@world-forge/export-ai-rpg` (此包) | [ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine) `ContentPack` | 您希望创建一个以文本为基础、以系统驱动为核心的 AI 角色扮演游戏，包括 NPC、区域、派系、对话图和成长树。 |
| `@world-forge/export-unreal` | Unreal Engine 5 的 2.5D 项目 | 您正在构建一个 2.5D 的 Unreal 游戏，需要将关卡/角色/数据表导出。 |
| `@world-forge/export-godot` | Godot 4 项目 | 您正在构建一个 Godot 4 角色扮演游戏，并且希望导出场景和资源。 |

如果您不确定，请从这里开始 (`export-ai-rpg`)，它是参考导出器，并且可以生成最丰富的系统层。

## 它转换的内容

| World Forge | 游戏引擎 |
|-------------|--------|
| 区域 | `ZoneDefinition[]` |
| 行政区 | `DistrictDefinition[]` |
| 实体放置 | `EntityBlueprint[]`（包含属性、资源、AI） |
| 物品放置 | `ItemDefinition[]`（包含插槽、稀有度、属性） |
| 项目元数据 | `GameManifest` + `PackMetadata` |

## 许可证

MIT
