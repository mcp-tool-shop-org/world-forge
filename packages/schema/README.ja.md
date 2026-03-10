<p align="center">
  <a href="README.md">English</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./logo.png" alt="World Forge" width="400">
</p>

# @world-forge/schema

[World Forge](https://github.com/mcp-tool-shop-org/world-forge)（AI RPG エンジンのための 2D 世界制作スタジオ）で使用される、主要な TypeScript 型定義。

## 型定義

- **空間:** `WorldMap`（世界地図）、`Zone`（エリア）、`ZoneExit`（エリアの出口）、`ZoneConnection`（エリア間の接続）、`Landmark`（ランドマーク）、`Interactable`（インタラクト可能なオブジェクト）
- **地区:** `District`（地区）、`DistrictMetrics`（地区の指標）、`EconomyProfile`（経済プロファイル）、`FactionPresence`（派閥の存在）、`PressureHotspot`（プレッシャーのホットスポット）
- **エンティティ:** `EntityPlacement`（エンティティの配置、`EntityStats`（エンティティのステータス）、`EntityResources`（エンティティのリソース）、`EntityAI`（エンティティのAI）を含む）、`ItemPlacement`（アイテムの配置、`ItemSlot`（アイテムの装着場所）、`ItemRarity`（アイテムのレアリティ）を含む）、`SpawnPoint`（スポーンポイント）、`EncounterAnchor`（遭遇ポイント）、`CraftingStation`（クラフトステーション）、`MarketNode`（マーケットノード）
- **ビジュアル:** `Tileset`（タイルセット）、`TileDefinition`（タイルの定義）、`TileLayer`（タイルレイヤー）、`PropDefinition`（プロップの定義）、`PropPlacement`（プロップの配置）、`AmbientLayer`（アンビエントレイヤー）
- **プロジェクト:** `WorldProject`（作成された世界のコンテナ）
- **検証:** `validateProject()`（54 の構造チェックを含む）

## インストール

```bash
npm install @world-forge/schema
```

## 使用方法

```typescript
import type { WorldProject, Zone, EntityPlacement } from '@world-forge/schema';
import { validateProject } from '@world-forge/schema';

const result = validateProject(myProject);
if (!result.valid) {
  console.error(result.errors);
}
```

## ライセンス

MIT
