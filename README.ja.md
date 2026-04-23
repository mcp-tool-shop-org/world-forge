<p align="center">
  <a href="README.md">English</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
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

The company is committed to providing high-quality products and services.
(会社は、高品質な製品とサービスを提供することに尽力しています。)
<p align="center"><strong>v4.4.0</strong> — 2067 tests, 5 shipping packages + 1 planned Godot stub (6 total), 7 authoring modes, 2.5D authoring, Unreal pack versioning + signing + diff</p>
<!-- version:end -->

## アーキテクチャ

```
packages/
  schema/          @world-forge/schema         — spatial types, validation, 2.5D fields
  export-ai-rpg/   @world-forge/export-ai-rpg  — AI RPG Engine export pipeline + CLI
  export-unreal/   @world-forge/export-unreal  — Unreal Engine 5 export pipeline + CLI (2.5D aware)
  export-godot/    @world-forge/export-godot   — (planned) Godot 4 export lane, stub only
  renderer-2d/     @world-forge/renderer-2d    — PixiJS 2D canvas renderer
  editor/          @world-forge/editor         — React web authoring app
```

## クイックスタートガイド

```bash
npm install
npm run build
npm run dev --workspace=packages/editor
```

エディタを起動するには、`http://localhost:5173` をブラウザで開いてください。

### 編集ワークフロー

1. **モードの選択:** ダンジョン、地区、世界、海洋、宇宙、屋内、または自然環境など、作成する環境の種類を選択し、グリッドのデフォルト設定や関連用語を設定します。
2. **キットからの開始:** テンプレートマネージャーからスターターキットまたはジャンルテンプレートを選択して開始するか、または空白の状態から始めることができます。
3. **エリアの作成:** キャンバス上でドラッグしてエリアを作成し、それらを接続し、地区を割り当てます。
4. **要素の配置:** NPC、敵、商人、イベント、アイテムなどをエリア上に配置します。
5. **確認:** 「確認」タブを開き、状態、コンテンツの概要を確認し、概要をエクスポートします（Markdown/JSON形式）。
6. **エクスポート:** コンテンツパック、プロジェクトバンドル（.wfproject.json）、または確認概要をダウンロードします。

### コマンドラインインターフェースからのエクスポート機能

```bash
npx world-forge-export project.json --out ./my-pack
npx world-forge-export project.json --validate-only
```

## パッケージ
セット
商品構成
商品内容
詰め合わせ
詰め物
梱包
包装

### @world-forge/schema

ワールド構築のための、TypeScriptにおける主要な型定義と検証機能。

- **空間タイプ:** `WorldMap`、`Zone`、`ZoneConnection`、`District`、`Landmark`、`SpawnPoint`、`EncounterAnchor`、`FactionPresence`、`PressureHotspot`
- **コンテンツタイプ:** `EntityPlacement`、`ItemPlacement`、`DialogueDefinition`、`PlayerTemplate`、`BuildCatalogDefinition`、`ProgressionTreeDefinition`
- **ビジュアルレイヤー:** `AssetEntry`、`AssetPack`、`Tileset`、`TileLayer`、`PropDefinition`、`AmbientLayer`
- **モードシステム:** `AuthoringMode` (7つのモード)、モードごとに異なるグリッド、接続、検証プロファイル
- **検証:** `validateProject()` (マップベースのO(n)検索による54項目の構造チェック、`warningCount`）、`advisoryValidation()` (モードごとの提案、メタデータの完全性、アセットの命名規則)
- **ユーティリティ:** `assembleSceneData()` (アセットの欠落を検出するビジュアルバインディング)、`scanDependencies()` (参照グラフ分析)、`buildReviewSnapshot()` (健全性分類)

### @world-forge/export-unreal

`WorldProject`を、Unreal Engine 5で動作する、2.5Dゲームに最適化されたコンテンツパックに変換します。

- **出力:** `pack.json`、ゾーンおよび地区ごとの主要データアセットJSON、グループ化されたアクタースポーンマニフェスト、接続ごとのレベルストリーミングヒント、ワールドパーティションのセルヒント、および構造化された品質レポート。
- **2.5Dフィールド:** `Zone.elevation`、`elevationRange`、`parallaxLayers`、`skylineRef`は保持され、UEのセンチメートル/Z軸上向き座標に変換されます。
- **座標変換:** 以下の純粋関数を使用します (`pixelsToUnrealCm`、`elevationToZ`、`worldForgeToUnrealAxis`、`gridToUnrealAxis`)。デフォルトの世界スケールは、1タイル = 100センチメートルです。
- **ラウンドトリップインポート:** `importFromUnreal`は、UnrealのパックファイルからWorldProjectを再構築します。ゲームプレイ関連データ（ダイアログ、進行、ビルド）は、品質レポートで「除外」としてマークされます。
- **コマンドラインインターフェース (CLI):** `world-forge-export-unreal` コマンドを使用し、`--out`、`--tile-size-cm`、`--validate-only`、`--verbose`などのオプションを指定できます。

### @world-forge/export-godot

Godot 4のエクスポート機能（Fractured Roadプロジェクト）に関する、現在未実装の作業スペースを確保しました。

### @world-forge/export-ai-rpg

`WorldProject`を、ai-rpg-engineで使用される`ContentPack`形式に変換します。

- **エクスポート:** ゾーン、地区、エンティティ、アイテム、ダイアログ、プレイヤーテンプレート、ビルドカタログ、進行ツリー、遭遇イベント、派閥、ホットスポット、マニフェスト、およびパックのメタデータ
- **インポート:** 8つの逆変換機能が、エクスポートされたJSONファイルからWorldProjectを再構築します。
- **忠実度レポート:** 変換中に損失、近似、または削除された内容を構造的に追跡します。
- **フォーマット検出:** WorldProject、ExportResult、ContentPack、およびProjectBundleのフォーマットを自動的に検出します。
- **コマンドラインインターフェース (CLI):** `world-forge-export`コマンドで、`--out`、`--validate-only`、および`--verbose`オプションを使用します。

### @world-forge/renderer-2d

PixiJSをベースとした2Dレンダリング機能：パン/ズーム機能付きのビューポート、地区ごとに色分けされたオーバーレイ表示、接続を示す矢印、役割に応じたエンティティアイコン、タイルレイヤー、およびミニマップ。

### @world-forge/editor

React 19とViteを使用したウェブアプリケーションで、Zustandによる状態管理、アクションラベル付きの元に戻す/やり直す機能、30秒ごとの自動保存（3つのバージョン履歴）、ダーク/ライトテーマの切り替え、および未保存の変更に対する警告機能を搭載しています。

#### 作業領域のタブ

| タブ。 | 目的。 |
|-----|---------|
| 地図。 | 2Dキャンバス上での、エリア、エンティティ、または区画の編集。 |
| オブジェクト。 | 階層構造：地域 → ゾーン → エンティティ/ランドマーク/スポーン地点。 |
| プレイヤー | プレイヤーのテンプレート。統計情報、所持品、装備、出現場所などが含まれます。 |
| ビルド。 | 原型、背景、特性、専門分野、連携技。 |
| 木々 | 進行に必要な条件と効果を持つノード。 |
| 対話。
会話。
対話形式。
対話文。 | ノードの編集、選択肢の関連付け、参照切れの検出。 |
| プリセット。 | 地域設定と遭遇設定を保存・読み込みできるブラウザ機能。マージ（統合）または上書き機能も搭載。 |
| 資産 | 資産ライブラリ。キーワードによる絞り込み検索、未使用アセットの検出機能、アセットパックに対応。 |
| 問題点
課題
懸念事項
論点
問題
事柄
件
件名
議題 | クリック操作でフォーカスを移動させながら、リアルタイムでグループ化された入力項目の検証を行う機能。 |
| Deps | 依存関係をスキャンし、その結果をインラインで表示する機能。また、問題のある依存関係を修正するためのボタンが組み込まれています。 |
| レビュー. | 健康状態のダッシュボード、コンテンツ概要、要約のエクスポート機能。 |
| ガイド. | 初回起動時に表示されるチェックリスト（ショートカットキーの参照情報付き）。 |

#### キャンバスと編集機能

- **ツール**：選択、エリア塗り、接続、エンティティ配置、ランドマーク、スポーン
- **複数選択**：Shiftキーを押しながらクリック、ボックス選択、Ctrl+A；アトミックなアンドゥ機能付きドラッグ移動
- **配置**：6方向への配置（左/右/上/下/中央（水平）/中央（垂直））と、水平/垂直方向への均等配置
- **スナップ**：近くのオブジェクトの端や中心に、視覚的なガイドラインを表示しながらドラッグでスナップ
- **サイズ変更**：エリアごとに8つのハンドルがあり、端へのスナップ、最小サイズ制限、リアルタイムプレビュー
- **複製**：Ctrl+Dで複製。ID、接続、および地区の割り当てを再マッピング
- **コピー/ペースト**：Ctrl+C / Ctrl+Vでコピー/ペースト。IDの再マッピングと、設定可能なオフセット
- **クリックサイクル**：同じ位置で繰り返しクリックすると、重なり合うオブジェクトを順番に選択
- **コンテキストメニュー**：右クリックで、状況に応じた7つのアクション（プロパティ、削除、複製など）を表示
- **接続プレビュー**：接続ツールを使用中に、破線のシアン色の線でプレビューを表示
- **ミニマップ**：200×150ピクセルの概要表示（右下）。クリックするとジャンプ
- **ビューポートの描画範囲**：表示範囲内のオブジェクトのみを描画（64ピクセルのマージン）
- **パフォーマンス統計**：FPS、オブジェクト数、レンダリング時間のオーバーレイを切り替え表示
- **オブジェクトごとの表示/非表示**：個々のオブジェクトの表示/非表示を切り替え（localStorageに保存）
- **レイヤー**：7つの表示/非表示切り替え（グリッド、接続、エンティティ、ランドマーク、スポーン、背景、環境光）

#### ナビゲーションとショートカット機能について

- **表示領域:** パン/ズーム機能（カメラ操作）、マウスホイールによるズーム（カーソル位置を基準）、スペースキー/中央ボタンクリック/右クリックによるドラッグによるパン操作、コンテンツに合わせて自動調整、ダブルクリックで中央に表示
- **検索:** Ctrl+Kを押すと、オーバーレイが表示され、名前/IDによるオブジェクト検索が可能（あいまい検索に対応）。キーボード操作に対応し、最近の検索履歴も保存されます（localStorageを使用）。
- **スピードパネル:** 右クリックを2回行うと、状況に応じて適切なアクションを表示するコマンドパレットが表示されます。お気に入り、マクロ、および現在のモードに合わせたクイックアクションをピン留めできます。
- **ショートカットキー:** Enterキー（詳細を表示）、Pキー（プリセットを適用）、Shift+Pキー（プリセットを保存）、Ctrl+C/Vキー（コピー/ペースト）など、15種類のキーボードショートカットがあります。

#### 輸入と輸出

- **ContentPack**: 完全な検証機能付きで、ワンクリックでai-rpg-engine形式にエクスポートできます。
- **プロジェクトバンドル**: プロジェクトのメタデータと依存関係情報を含む、持ち運び可能な`.wfproject.json`ファイルです。
- **キットバンドル**: 検証、衝突処理、およびトレーサビリティ機能付きの`.wfkit.json`のエクスポート/インポートを行います。
- **インポート**: 4つの形式を自動的に検出し、構造化された詳細なレポートを提供します。
- **差分**: インポート以降のセマンティックな変更を追跡します。
- **シーンプレビュー**: すべてのゾーンの視覚的な要素をHTML/CSSでインラインで構成します。

## 編集モード

World Forgeでは、**ジャンル**（ファンタジー、サイバーパンク、海賊など）と**モード**（ダンジョン、海洋、宇宙など）を区別します。 ジャンルは雰囲気であり、モードは規模です。 モードは、グリッドのデフォルト設定、接続の種類、検証の提案、ガイドの表現、およびプリセットのフィルタリングを制御します。

| モード | グリッド | タイル | 主要な接続 |
|------|------|------|-----------------|
| ダンジョン | 30×25 | 32 | ドア、階段、通路、隠し通路、危険 |
| 地区/都市 | 50×40 | 32 | 道、ドア、通路、ポータル |
| 地域/世界 | 80×60 | 48 | 道、ポータル、通路 |
| 海洋/海 | 60×50 | 48 | 水路、ルート、ポータル、危険 |
| 宇宙 | 100×80 | 64 | ドッキング、ワープ、通路、ポータル |
| 屋内 | 20×15 | 24 | ドア、階段、通路、隠し通路 |
| 自然 | 60×50 | 48 | 小道、道、通路、危険 |

モードはプロジェクト作成時に設定され、`WorldProject`オブジェクトの`mode?: AuthoringMode`として保存されます。 各モードは、接続の種類、エンティティの役割、ゾーン名、およびスピードパネルの提案など、**スマートなデフォルト設定**を提供します。これらの設定は自動的に調整されます。

## 編集画面

### ワールド構造

- 空間レイアウト、近隣、出口、光、音、危険、およびインタラクティブ要素を持つゾーン
- 12種類の接続（通路、ドア、階段、道、ポータル、隠し通路、危険、水路、ルート、ドッキング、ワープ、小道）があり、それぞれ異なる視覚スタイル、エッジに沿ったルーティング、方向を示す矢印、および条件付きの破線スタイルが適用されます。
- 派閥の支配、経済プロファイル、メトリクススライダー、タグ、およびゾーンの中心に配置された地区名ラベルを持つ地区
- ゾーン内の特定の場所に名前を付けられたランドマーク
- スポーンポイント、遭遇ポイント（タイプに基づいたカラーリング）、派閥の存在、およびプレッシャーポイント

### コンテンツ

- 統計、リソース、AIプロファイル、およびカスタムメタデータを持つエンティティの配置
- スロット、レアリティ、ステータス修正、および付与されるアクションを持つアイテムの配置
- 分岐のある会話、条件、および効果を持つダイアログツリー
- キャンバス上の遭遇ポイント：ボス/待ち伏せ/パトロールの種類を示す赤い菱形のマーカー

### キャラクターシステム

- プレイヤーテンプレート（初期ステータス、インベントリ、装備、スポーンポイント）
- ビルドカタログ（アーキタイプ、バックグラウンド、特性、専門分野、複合スキル、関連スキル）
- 成長ツリー（スキル/アビリティノード、要件、および効果）

### 資産

- アセットマニフェスト（ポートレート、スプライト、背景、アイコン、タイルセット）で、種類ごとに異なる設定が適用されます。
- アセットパック（名前付き、バージョン管理されたグループで、互換性メタデータ、テーマ、およびライセンス情報が含まれます）
- シーンプレビュー（すべてのゾーンの視覚的な要素をインラインで構成し、アセットの欠落を検出します）

### ワークフロー

- リージョンプリセット（9種類、モードでフィルタリング可能）とエンカウンタープリセット（10種類）を搭載。マージ/上書き機能、およびカスタムプリセットの作成・編集・削除・更新機能をサポート。
- スターターキット（7種類、モードごとに異なる）を搭載。キットのエクスポート/インポート（`.wfkit.json`形式）、衝突処理、およびトレーサビリティ機能を備えています。
- レイアウトテンプレート（6種類のゾーン配置）と、ダイアログテンプレート（5種類の会話の開始例）を提供。
- ゾーンのマージ機能と、バッチでのエンティティ配置機能（グリッド、ランダム、円形パターン）。
- 30秒ごとの自動保存機能と、3つのバージョンの復元履歴。
- Ctrl+Kキーによる、すべてのオブジェクトタイプを対象とした検索機能。ファジーマッチングと最近の履歴に対応。
- スピードパネルのコマンドパレット。お気に入り、マクロ、カスタムグループ、およびモードの提案機能を搭載。
- 15種類の集中管理されたキーボードショートカット。
- プロジェクトメタデータエディタ（作者、ライセンス、カテゴリ、タグ）。
- レビュー統計（ロールの分布、接続の種類、エンカウンターの種類、地区ごとのゾーン数）。
- ContentPack JSON、プロジェクトバンドル、およびレビューサマリーへのエクスポート機能。
- 4種類のフォーマットからのインポート機能。構造の忠実度レポート、修復の提案、および意味的な差分追跡機能を搭載。

[`dogfood/WALKTHROUGH.md`](dogfood/WALKTHROUGH.md) を参照すると、現在の機能がChapel Thresholdのエクスポートハンドシェイクによって検証されていることがわかります。

## Dogfoodディレクトリ

`dogfood/`ディレクトリには、ユニットテスト以外の、作成からエクスポートまでのパイプライン全体を検証するための統合テスト環境が含まれています。Chapel Thresholdの例 (`chapel-threshold.ts`) は、小規模ながらも完全なワールドプロジェクトを構築し、エクスポートを実行し、その結果を `dogfood/output/` に出力します。これにより、スキーマタイプ、検証、およびエクスポートパイプラインが、隔離されたモックではなく、実際のデータを使用してエンドツーエンドで機能することを確認できます。

## エンジン互換性

エクスポートされるコンテンツは、[ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine) がサポートするコンテンツタイプです。エクスポートされたContentPackは、[claude-rpg](https://github.com/mcp-tool-shop-org/claude-rpg) に直接ロードできます。

## セキュリティ

- **アクセスするデータ:** ローカルディスク上のプロジェクトファイル（ユーザーが作成したJSON）、サーバー側のストレージは使用しません。
- **アクセスしないデータ:** テレメトリー、分析、ローカル開発サーバー以外のネットワークリクエストは行いません。
- **権限:** APIキー、シークレット、認証情報は不要です。
- **ソースコードにシークレット、トークン、または認証情報は含まれていません。**

## ライセンス

MIT

---

[MCP Tool Shop](https://mcp-tool-shop.github.io/) が開発しました。
