<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.md">English</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./logo.png" alt="World Forge" width="400">
</p>

# @world-forge/export-ai-rpg

用于 [World Forge](https://github.com/mcp-tool-shop-org/world-forge) 的导出流水线，用于将 `WorldProject` 转换为 [ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine) 的 `ContentPack`。

## 安装

```bash
npm install @world-forge/export-ai-rpg
```

## API

```typescript
import { exportToEngine } from '@world-forge/export-ai-rpg';

const result = exportToEngine(myProject);
if ('ok' in result) {
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

## 转换内容

| World Forge | 引擎 |
|-------------|--------|
| 区域 | `ZoneDefinition[]` |
| 行政区 | `DistrictDefinition[]` |
| 实体放置 | `EntityBlueprint[]`（包含属性、资源、AI） |
| 物品放置 | `ItemDefinition[]`（包含插槽、稀有度、属性） |
| 项目元数据 | `GameManifest` + `PackMetadata` |

## 许可证

MIT
