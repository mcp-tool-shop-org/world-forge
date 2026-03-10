<p align="center">
  <a href="README.md">English</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./logo.png" alt="World Forge" width="400">
</p>

# @world-forge/export-ai-rpg

[World Forge](https://github.com/mcp-tool-shop-org/world-forge) 用のエクスポートパイプライン。`WorldProject` を [ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine) の `ContentPack` に変換します。

## インストール

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

## CLI

```bash
npx world-forge-export project.json --out ./my-pack
npx world-forge-export project.json --validate-only
```

## 変換対象

| World Forge | エンジン |
|-------------|--------|
| ゾーン | `ZoneDefinition[]` |
| 地区 | `DistrictDefinition[]` |
| エンティティの配置 | `EntityBlueprint[]` (ステータス、リソース、AIを含む) |
| アイテムの配置 | `ItemDefinition[]` (スロット、レアリティ、修正値を含む) |
| プロジェクトのメタデータ | `GameManifest` + `PackMetadata` |

## ライセンス

MIT
