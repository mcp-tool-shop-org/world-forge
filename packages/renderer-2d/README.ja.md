<p align="center">
  <a href="README.md">English</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./logo.png" alt="World Forge" width="400">
</p>

# @world-forge/renderer-2d

[World Forge](https://github.com/mcp-tool-shop-org/world-forge) のワールドマップ用、PixiJSベースの2Dレンダラー。

## インストール

```bash
npm install @world-forge/renderer-2d
```

## コンポーネント

- **WorldViewport**: パン、ズーム、グリッド表示機能を持つ、PixiJSアプリケーションのラッパー。
- **ZoneOverlayRenderer**: 地区の色分け、選択/ホバー表示機能を持つ、ゾーン境界のレンダラー。`setShowElevation` で 2.5D の標高キュー（ドロップシャドウ、沈降ティント、複数レベルの破線アウトライン）を切り替えます。
- **ConnectionRenderer**: ゾーン間の接続線、一方通行には矢印、条件付きには点線を表示するレンダラー。
- **EntityRenderer**: 役割に基づいたエンティティアイコン（NPC、敵、商人、ボス）を表示するレンダラー。
- **TileLayerRenderer**: タグに基づいた色分けで、Zオーダーで配置されたタイルレイヤーを表示するレンダラー。
- **MinimapRenderer**: ビューポートの位置を示す、縮小表示のミニマップレンダラー。
- **DiagnosticsOverlay**: 各レンダラーの `className`、`childCount`、`destroyed` フラグを一覧表示する開発者向け HUD。

## ライセンス

MIT
