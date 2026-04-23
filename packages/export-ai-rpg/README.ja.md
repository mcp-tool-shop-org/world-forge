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
if (!result.success) {
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

## どのエクスポート機能を使用しますか？

World Forge には、複数のエンジン向けエクスポート機能が用意されています。ターゲットとなる実行環境に合ったものを選択してください。

| エクスポート機能 | ターゲット | 使用するタイミング |
|----------|--------|-----------|
| `@world-forge/export-ai-rpg` (このパッケージ) | [ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine) の `ContentPack` | テキストベースで、システム駆動型の AI RPG を作りたい場合。NPC、地区、派閥、会話グラフ、成長ツリーなど。 |
| `@world-forge/export-unreal` | Unreal Engine 5 の 2.5D プロジェクト | Unreal Engine で 2.5D ゲームを開発しており、レベル、アクター、データテーブルを連携させたい場合。 |
| `@world-forge/export-godot` | Godot 4 プロジェクト | Godot 4 で RPG を開発しており、シーンとリソースをインポートしたい場合。 |

迷った場合は、まずこちら (`export-ai-rpg`) から始めてください。これは参照エクスポート機能であり、最も豊富なシステムレイヤーを提供します。

## 変換されるもの

| World Forge | エンジン |
|-------------|--------|
| ゾーン | `ZoneDefinition[]` |
| 地区 | `DistrictDefinition[]` |
| エンティティの配置 | `EntityBlueprint[]` (ステータス、リソース、AI 付き) |
| アイテムの配置 | `ItemDefinition[]` (スロット、レアリティ、修正値 付き) |
| プロジェクトのメタデータ | `GameManifest` + `PackMetadata` |

## ライセンス

MIT
