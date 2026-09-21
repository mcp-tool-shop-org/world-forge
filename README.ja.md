<p align="center">
  <a href="README.md">English</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./assets/logo.png" alt="World Forge" width="400">
</p>

<p align="center">
  <img src="./site/public/screenshots/editor-canvas.jpg" alt="World Forge editor canvas with painted zones" width="720">
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop-org/world-forge/actions/workflows/ci.yml"><img src="https://github.com/mcp-tool-shop-org/world-forge/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@world-forge/schema"><img src="https://img.shields.io/npm/v/@world-forge/schema?label=npm" alt="npm"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="MIT License"></a>
  <a href="https://mcp-tool-shop-org.github.io/world-forge/"><img src="https://img.shields.io/badge/Landing_Page-live-blue" alt="Landing Page"></a>
</p>

<p align="center">2D / 2.5D world authoring studio with peer export lanes for <a href="https://github.com/mcp-tool-shop-org/ai-rpg-engine">AI RPG Engine</a>, <a href="https://www.unrealengine.com/">Unreal Engine 5</a>, and <a href="https://godotengine.org/">Godot 4</a>.<br>One editor, many modes — paint zones, place entities, define districts, export a complete content pack for your engine of choice.</p>

<!-- version:start -->
<p align="center"><strong>v4.9.0</strong> — 3473 tests, 6 shipping packages, 7 authoring modes, tiles + interiors + town authoring + world modeling (vertical strata, typed hazards, party-gated zones), three export targets (AI RPG Engine, Unreal Engine 5, Godot 4), a measured Forge→Engine content contract, and an authored drawing contract for 2.5D clients</p>
<!-- version:end -->

## アーキテクチャ

```
packages/
  schema/          @world-forge/schema         — spatial types, validation, 2.5D fields
  export-ai-rpg/   @world-forge/export-ai-rpg  — AI RPG Engine export pipeline + CLI
  export-unreal/   @world-forge/export-unreal  — Unreal Engine 5 export pipeline + CLI (2.5D aware)
  export-godot/    @world-forge/export-godot   — Godot 4 export pipeline + .tscn scene generation
  renderer-2d/     @world-forge/renderer-2d    — PixiJS 2D canvas renderer
  editor/          @world-forge/editor         — React web authoring app
```

## クイックスタート

```bash
npm install
npm run build
npm run dev --workspace=packages/editor
```

エディターを起動するには、`http://localhost:5173`を開いてください。

### 編集者の作業フロー

1. **モードを選択** — ダンジョン、地区、ワールド、海、宇宙、屋内、または荒野 — から選択し、グリッドのデフォルト設定と接続語彙を設定します。
2. **キットから開始** — テンプレートマネージャーからスターターキットまたはジャンルテンプレートを選択するか、白紙の状態から開始します。
3. **ゾーンを描画** — キャンバス上でドラッグしてゾーンを作成し、それらを接続し、地区を割り当てます。
4. **エンティティを配置** — NPC、敵、商人、イベント、アイテムをゾーンに配置します。
5. **確認** — 「確認」タブを開き、状態、コンテンツの概要、および概要のエクスポート（Markdown/JSON）を確認します。
6. **エクスポート** — エクスポートモーダルを開き、ターゲットごとの準備状況（✓ 準備完了 / ⚠ 注意事項）を確認し、ターゲットオプションを設定してから、AI RPG Engine、UE5、またはGodot 4パッケージをダウンロードします。エクスポート後のレシートには、サイズ、数、詳細な情報が記載されます。また、プロジェクトバンドル（.wfproject.json）と確認の概要も含まれます。

### CLIによるエクスポート

```bash
# AI RPG Engine
npx world-forge-export project.json --out ./my-pack
npx world-forge-export project.json --validate-only
npx world-forge-export --import ./my-pack --out ./round-trip

# Unreal Engine 5
npx world-forge-export-unreal project.json --out ./UnrealPack --sign
npx world-forge-export-unreal --summary ./UnrealPack

# Godot 4 — writes a loadable project root (project.godot + world.tscn)
npx world-forge-export-godot project.json --out ./GodotPack
npx world-forge-export-godot project.json --validate-only
```

## パッケージ

### @world-forge/スキーマ

ワールド制作のための、TypeScript の基本的な型と検証機能。

- **空間タイプ** — `WorldMap`、`Zone`、`ZoneConnection`、`District`、`Landmark`、`SpawnPoint`、`EncounterAnchor`、`FactionPresence`、`PressureHotspot`
- **コンテンツタイプ** — `EntityPlacement`、`ItemPlacement`、`DialogueDefinition`、`PlayerTemplate`、`BuildCatalogDefinition`、`ProgressionTreeDefinition`
- **視覚レイヤー** — `AssetEntry`、`AssetPack`、`Tileset`、`TileLayer`、`PropDefinition`、`PropPlacement`、`AmbientLayer`
- **都市＋構造物** — `MarketNode`、`CraftingStation`、`Building`、`Hub`、`Stronghold`
- **ワールドモデリング** — `Stratum` + `StratumLink`（垂直レイヤー）、`HazardDefinition`（タイプ付きエフェクトのユニオン）、`ZoneEntryGate` + パーティ状態 `SpawnCondition`オペランド（`party-level`、`party-size`、`item`、`flag`、`member`、`class`）
- **モードシステム** — `AuthoringMode`（7つのモード）、モード固有のグリッド／接続／検証プロファイル
- **表現** — オプションの`WorldPresentation`を`WorldProject`に適用：等角投影、タイル配置、ゾーンアンカーセル、床のプレート、および各キャラクターごとの占有行。`presentationAdvisories()`は、その中に重要なものを含む8つの推奨ルールを適用します。具体的には、シミュレーションで部屋内に配置された人物が、実際に部屋の外に配置されるかどうかを検証します。
- **検証** — `validateProject()`（マップベースのO(n)検索による89の構造チェック、`warningCount`）、`advisoryValidation()`（モード固有の提案、メタデータ完全性、アセットの命名）。v4.0 JSONでは、後で必要となる配列が省略された場合でも、`normalizeProjectShape()` / `stampProjectSchemaVersion()`の後に受け入れられます。
- **バレル上のクローズドユニオン** — `VALID_CONNECTION_KINDS`、`VALID_ASSET_KINDS`、`VALID_ENTITY_ROLES`、`VALID_ITEM_SLOTS`、および残りの`VALID_*`セットは、`@world-forge/schema`からエクスポートされます。
- **ユーティリティ** — `assembleSceneData()`（欠落したアセットを検出する視覚的なバインディング）、`scanDependencies()`（参照グラフ分析）、`buildReviewSnapshot()`（健全性分類）

### @world-forge/export-unreal

`WorldProject`を、2.5Dゲーム用に最適化されたUnreal Engine 5のコンテンツパックに変換します。

- **Output** — `pack.json`, per-zone and per-district Primary Data Asset JSON, grouped actor spawn manifest, level-streaming hints per connection, World Partition cell hints, and a structured fidelity report.
- **2.5D fields** — `Zone.elevation`, `elevationRange`, `parallaxLayers`, `skylineRef` are preserved and converted into UE cm / Z-up coordinates.
- **Coordinate transform** — pure functions (`pixelsToUnrealCm`, `elevationToZ`, `worldForgeToUnrealAxis`, `gridToUnrealAxis`). Default world scale is 1 tile = 100 cm.
- **Round-trip import** — `importFromUnreal` reconstructs a WorldProject from an Unreal pack; gameplay-only data (dialogues, progression, builds) is flagged as dropped in the fidelity report.
- **CLI** — `world-forge-export-unreal` with `--out`, `--tile-size-cm`, `--validate-only`, `--verbose`.

### @world-forge/export-godot

`WorldProject`をGodot 4のコンテンツパックに変換し、`.tscn`のシーンテキストを含めます。

- **Output** — a Godot 4 project root: `project.godot`, `world.tscn` (ExtResource `.tres`), copied textures under `assets/`, `scripts/player.gd`, plus `pack.json` and `fidelity.json`
- **CLI** — `world-forge-export-godot` with `--out`, `--validate-only`, `--include-world-tscn` / `--no-world-tscn`
- **Playable scene** — `buildWorldScene()` emits a navigable `.tscn`: per-zone `StaticBody2D` collision + `NavigationRegion2D`, a framed `Camera2D`, a `CharacterBody2D` player pawn, and y-sort / `z_index` depth
- **Tiles + interiors** — `TileMapLayer` + `TileSet` (baked `tile_map_data` for image tilesets), per-cell wall `StaticBody2D` collision, and prop `Node2D` placements
- **Town** — markets + crafting stations, and buildings (`StaticBody2D` footprints) / hubs / strongholds as `Node2D` placeholders, all carrying their data as metadata
- **World modeling** — vertical strata (per-zone `z_index` banding + `StratumLink` connectors), typed hazards as `Area2D` regions, and zone entry-gate metadata
- **Fidelity reporting** — structured tracking of lossless, approximated, and dropped data, verified against the real Godot 4 engine (headless smoke, 36 assertions)
- **Presentation advisories** — an authored `presentation` block is carried through untouched and its advisories ride on `warnings[]`, so a drawing/sim disagreement is an export finding rather than a surprise on screen
- **Format version** — `GODOT_PACK_FORMAT_VERSION` 1.1.0 (`files`, `zoneGates`, `migrateGodotPack`)

### @world-forge/export-ai-rpg

`WorldProject`を、ai-rpg-engineで使用される`ContentPack`形式に変換します。

- **エクスポート** — ゾーン、地区、エンティティ、アイテム、ダイアログ、プレイヤーテンプレート、ビルドカタログ、プログレッションツリー、遭遇、派閥、ホットスポット、マニフェスト、およびパックメタデータ。
- **インポート** — 8つの逆変換器が、エクスポートされたJSONからWorldProjectを再構築します。CLI `--import` / `--from-pack`は、`world-project.json`（または標準出力）に書き込みます。
- **忠実度レポート** — 変換中に何がロスレスで維持され、何が近似され、または削除されたかを構造的に追跡します。`--out`はパックの横に`fidelity.json`を書き込みます。
- **フォーマット検出** — WorldProject、ExportResult、ContentPack、およびProjectBundle形式を自動的に検出します。
- **CLI** — `world-forge-export`、オプションとして`--out`、`--import`、`--from-pack`、`--validate-only`、`--dry-run`、および`--verbose`。

### @world-forge/renderer-2d

PixiJSをベースにした2Dレンダラー：パン/ズーム機能を備えたビューポート、地域ごとに色分けされたゾーンオーバーレイ、接続を示す矢印、役割に応じたエンティティアイコン、タイルレイヤー、およびミニマップ。

これは、外部のユーザーがワールドフォージのデータを独自のPixiJSアプリケーションに組み込めるように公開された、独立したレンダラーです。**エディターはこれを使用しません**。エディターのキャンバスは、Canvas2Dを直接実装したものであり、以下に示すエディターに関連するミニマップやビューポートの機能は、このパッケージではなく、エディター独自の機能です。

### @world-forge/エディター

React 19とViteを使用したウェブアプリケーション。Zustandによる状態管理、アクションラベル付きの取り消し/やり直し機能、自動保存（30秒間隔、3バージョンの履歴、クラッシュからの復旧）、プロジェクトの読み込みパス全体での変更状態の保護、ダーク/ライトテーマの切り替え、モーダルウィンドウのフォーカス制御、キーボード操作によるツール切り替え機能を実装。

#### ワークスペースのタブ

| タブ | 目的 |
|-----|---------|
| 地図 | 2Dキャンバス上でのゾーン／エンティティ／エリアの編集 |
| 物体 | 階層構造のツリー：地区 → ゾーン → 拠点／ランドマーク／スポーン地点 |
| プレイヤー | ステータス、所持品、装備、スポーン地点を含むプレイヤーのテンプレート。 |
| ビルド | 原型、背景、特性、専門分野、コンボ |
| 木 | 要件と効果を持つ進行ノード |
| ダイアログ | ノードの編集、選択肢のリンク、参照エラーの検出 |
| プリセット | マージ/上書き機能付きのリージョンおよびエンカウンタープリセットブラウザ |
| アセット | 種類で絞り込み検索、孤立アセットの検出、アセットパックを備えたアセットライブラリ |
| 問題点 | クリックしてフォーカスするナビゲーションによる、ライブグループ化された検証 |
| 依存関係 | インラインの修正ボタンを備えた依存関係スキャナー |
| レビュー | 健全性ダッシュボード、コンテンツ概要、概要のエクスポート |
| ガイド | 初回起動時のチェックリストとホットキーのリファレンス |

#### キャンバスと編集

- **ツール** — 選択、領域ペイント、接続、エンティティ配置、ランドマーク、スポーン、アイテム配置、エンカウンター配置
- **複数選択** — Shift + クリック、ボックス選択、Ctrl + A。アトミックなアンドゥによるドラッグ移動
- **配置** — 6方向配置（左/右/上/下/水平中央/垂直中央）と水平/垂直方向の配置
- **スナップ** — 視覚的なガイドラインを使用して、近くのオブジェクトのエッジ/中央にドラッグ時にスナップ
- **サイズ変更** — 各ゾーンに8つのハンドルがあり、エッジスナップ、最小サイズ制限、ライブプレビューが可能
- **複製** — Ctrl + D。ID、接続、および地区割り当てを再マッピング
- **コピー/ペースト** — Ctrl + C / Ctrl + V。IDを再マッピングし、構成可能なオフセットを設定
- **クリックサイクル** — 同じ位置を繰り返しクリックすると、重なり合ったオブジェクトが順番に表示される
- **コンテキストメニュー** — 右クリックすると、7つのコンテキストに依存したアクション（プロパティ、削除、複製など）が表示される
- **接続プレビュー** — 接続ツールの配置中に、破線のシアン色の線が表示される
- **ミニマップ** — 200×150の概要（右下）。クリックするとジャンプする
- **ビューポートカリング** — 画面に表示される範囲内のオブジェクトのみをレンダリングする（64ピクセルのマージン）
- **パフォーマンス統計** — FPS / オブジェクト数 / レンダリング時間のオーバーレイを切り替える
- **オブジェクトごとの表示/非表示** — 個々のオブジェクトを表示/非表示にする（localStorageに保存）
- **レイヤー** — 表示/非表示の切り替え（グリッド、接続、エンティティ、ランドマーク、スポーン、町、タイル、プロップス、環境光。アイテムはアイテムレイヤーでヒットテストを行う）

#### ナビゲーションとショートカット

- **ビューポート** — カメラのパン/ズーム、マウスホイールによるズーム（カーソルを基準）、スペースバー/中央のボタン/右クリックによるドラッグパン、コンテンツに自動的にフィット、ダブルクリックして中央に表示
- **検索** — Ctrl + Kを押すと、あいまい一致、キーボードナビゲーション、および最近の検索履歴（localStorage）を使用して、名前/IDで任意のオブジェクトを検索できるオーバーレイが開く
- **スピードパネル** — 右クリックを2回クリックすると、コンテキストに応じたアクション、ピン留め可能なプリセット、マクロ、およびモードに合わせたクイックアクションを備えたフローティングコマンドパレットが表示される
- **ホットキー** — 21個のキーボードショートカット（ツール切り替え（V / Z / C / E / L / S）、詳細の表示（Enter）、プリセットの適用（P）、プリセットの保存（Shift + P）、コピー/ペースト（Ctrl + C / V）、矢印キーによる微調整（Shift = 5倍））
- **アクセシビリティ** — Escapeキーで閉じることができるモーダルフォーカストラップ、すべてのアイコンのみのボタンにARIAラベルを適用、キーボードで操作できるオブジェクトツリー、スクリーンリーダーで読み上げられる変更インジケーター。空間キャンバス操作（配置、ボックス選択、サイズ変更、接続描画、パン）は、ポインタベースのまま

#### インポートとエクスポート

- **ContentPack** — AI RPG Engine、Unreal Engine 5、または Godot 4へのターゲットに合わせたエクスポート。ターゲットごとの準備状況バッジ、構成可能なオプション（タイルサイズ、シーンのプレフィックス、バンドルフィルタリング）、およびダウンロード後のレシート
- **プロジェクトバンドル** — プロベナンスメタデータと依存関係情報を含む、移植可能な`.wfproject.json`ファイル
- **キットバンドル** — `.wfkit.json`のエクスポート/インポート。検証、衝突処理、およびプロベナンス追跡
- **インポート** — 構造化された忠実度レポートを使用して、4つの形式を自動的に検出
- **差分** — インポート以降のセマンティックな変更の追跡
- **シーンプレビュー** — すべてのゾーンの視覚的なバインディングのインラインHTML / CSSコンポジション

## 作成モード

World Forgeは、**ジャンル**（ファンタジー、サイバーパンク、海賊）と**モード**（ダンジョン、海洋、宇宙）を分離します。ジャンルは風味であり、モードは規模です。モードは、グリッドのデフォルト、接続の語彙、検証の提案、ガイドの文言、およびプリセットのフィルタリングを制御します。

| モード | グリッド | タイル | 主要な接続 |
|------|------|------|-----------------|
| ダンジョン | 30×25 | 32 | ドア、階段、通路、秘密の場所、危険 |
| 地区/都市 | 50×40 | 32 | 道路、ドア、通路、ポータル |
| リージョン/ワールド | 80×60 | 48 | 道路、ポータル、通路 |
| 海洋/海 | 60×50 | 48 | 水路、ルート、ポータル、危険 |
| 宇宙 | 100×80 | 64 | ドッキング、ワープ、通路、ポータル |
| インテリア | 20×15 | 24 | ドア、階段、通路、秘密の場所 |
| 荒野 | 60×50 | 48 | 小道、道路、通路、危険 |

モードは、プロジェクトの作成時に設定され、`WorldProject`に`mode?: AuthoringMode`として保存されます。各モードは**スマートなデフォルト**を提供します。接続の種類、エンティティの役割、ゾーンの名前、およびスピードパネルの提案は、自動的に調整されます。

## 作成サーフェス

### ワールド構造

- 空間的なレイアウト、隣接するエリア、出口、光、騒音、危険、およびインタラクション可能なオブジェクトを含むゾーン
- 12種類の接続（通路、ドア、階段、道路、ポータル、秘密の通路、危険、チャネル、ルート、ドッキング、ワープ、トレイル）があり、それぞれ異なる視覚スタイル、エッジに固定されたルーティング、方向を示す矢印、条件付きの破線スタイルを持つ
- 勢力による支配、経済プロファイル、メトリックのスライダー、タグ、およびゾーンの中心に配置された地区名ラベルを持つ地区
- ランドマーク（ゾーン内の名前付きの興味深い場所）
- スポーンポイント、遭遇ポイント（タイプに基づく色分け）、勢力の存在、および危険なホットスポット
- **垂直層** - 離散的なレイヤー（表面/地下/空、または建物の階）で、順序、z範囲、層間の可視性、およびコネクタ（階段/はしご/エレベーター）が定義されている。ゾーンは特定の層に割り当てられる
- **種類の異なる環境の危険** - 共有の危険ライブラリ（ダメージ/ステータス/即死/発火効果、トリガータイミング、地形の移動コスト、通行可能性、視界の遮断、天候による制限）があり、ゾーンごとに参照される
- **ゾーンへの進入ゲート** - パーティーの状態（レベル/人数/アイテム/フラグ/メンバー/クラス）に基づいてゲートが開き、ハードまたは推奨されるゲートとして機能し、作成された「ロックを表示する」理由が示される
- **プレゼンテーションの配置** - 2.5Dクライアントの場合：タイルベースのフットプリントと範囲を持つ等角投影ビュー、アンカーセル、およびゾーンごとのオプションの床板、およびプレイヤーを含む各アクターの配置行（キャラクターパック、ゾーン、セル、向き）

### コンテンツ

- ステータス、リソース、AIプロファイル、およびカスタムメタデータを持つエンティティの配置
- スロット、レア度、ステータス修正、および付与されるアクションを持つアイテムの配置
- 分岐する会話、条件、および効果を持つダイアログツリー
- キャンバス上の遭遇ポイント（赤いダイヤモンド型のマーカーで、ボス/待ち伏せ/パトロールのタイプを示す）

### 町と内部空間

- タイルペイント - 画像ベースのタイルセット（行/列でスライス）、カラー矩形のフォールバック、ドラッグブラシ、レイヤー、および壁の衝突判定のためのタイルごとの「Solid」の通行可能性を持つ
- 内部空間用のプロップ配置（パレット+キャンバスレンダリング）、配置ツール付き
- 町の経済 - 市場ノード（供給カテゴリ、価格修正、違法品）、および作成ステーション（ステーションタイプ、レシピ）があり、ゾーンごとに編集可能
- 町の構造 - 建物（内部ゾーンへのリンクを持つ、アクセス可能なフットプリント）、ハブ（サービス+接続ノード）、および要塞（強化された勢力の拠点）

### キャラクターシステム

- プレイヤーテンプレート（開始ステータス、インベントリ、装備、スポーンポイント）
- ビルドカタログ（アーキタイプ、背景、特性、専門分野、クロスタイトル、関係）
- プログレッションツリー（要件と効果を持つスキル/能力ノード）

### アセット

- アセットマニフェスト（ポートレート、スプライト、背景、アイコン、タイルセット）で、種類ごとのバインディングを定義
- アセットパック（名前付き、バージョン管理されたグループで、互換性メタデータ、テーマ、ライセンスを含む）
- シーンプレビュー（ゾーンのすべての視覚的バインディングをインラインで構成し、アセットの欠落を検出）

### ワークフロー

- リージョンプリセット（9種類、モードでフィルタリング）、および遭遇プリセット（10種類、モードでフィルタリング）があり、マージ/上書きの適用、およびカスタムプリセットの作成/読み取り/更新/削除が可能
- スターターキット（7種類、モード固有）、キットのエクスポート/インポート（`.wfkit.json`）、衝突処理、および出所の追跡が可能
- レイアウトテンプレート（6種類の事前構築されたゾーン配置）、およびダイアログテンプレート（5種類の会話の開始）
- ゾーンのマージ、およびバッチエンティティの配置（グリッド/ランダム/円形のパターン）
- 30秒間隔で自動保存、および3バージョンの復元履歴
- Ctrl+Kで、あいまい一致と最近の履歴を使用して、すべてのオブジェクトタイプを検索
- ピン留め可能なFavorites、マクロ、カスタムグループ、およびモードの提案を備えた、スピードパネルコマンドパレット
- 21種類の集中型キーボードショートカット（6つのツール切り替えキーを含む）
- プロジェクトメタデータエディター（作成者、ライセンス、カテゴリ、タグ）
- レビュー統計（役割の分布、接続の種類、遭遇の種類、地区ごとのゾーン数）
- ContentPack JSON、プロジェクトバンドル、およびレビューサマリーへのエクスポート
- 構造化された忠実度レポート、修正の提案、およびセマンティック差分追跡を備えた、4つの形式からのインポート

現在の表面を証明する、チャペル・スレッショルドのエクスポートハンドシェイクについては、[`dogfood/WALKTHROUGH.md`](dogfood/WALKTHROUGH.md)を参照してください。

## ドッグフードディレクトリ

`dogfood/`ディレクトリには、ユニットテスト外で、完全な作成からエクスポートまでのパイプラインをテストする統合テストハーネスが含まれています。チャペル・スレッショルドの例（`chapel-threshold.ts`）は、小さくても完全なワールドプロジェクトを構築し、エクスポートを実行し、出力を`dogfood/output/`に書き込みます。これにより、スキーマタイプ、検証、およびエクスポートパイプラインが、実際のデータでエンドツーエンドで機能することが証明されます。単なる孤立したモックではありません。

## エンジンとの互換性

エクスポートは、次の3つのエンジンを対象としています。

- **[ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine)** - ContentPack形式：エクスポートされたパックをロードしてワールドを実行する、決定論的なシミュレーションランタイム
- **Unreal Engine 5** - 2.5D対応のコンテンツパックで、プライマリデータアセット、アクターのスポーンマニフェスト、およびワールドパーティションのヒントが含まれる
- **Godot 4** - `.tscn`シーン生成で、ゾーンリソース、ナビゲーションリンク、およびエンティティマニフェストを使用

### Forge→Engineのコンテンツ契約

実行されるエクスポーターは、ワールドが起動するのと同じではありません。v4.6.0は、AI RPG Engineのパイプラインにおいて、そのギャップを解消し、さらに重要なことに、残りのギャップを仮定ではなく数値として表現します。

- **計測されたエクスポートテーブル**（`docs/c0-alignment/`）—リーフパスの差分を追跡し、作成されたすべてのフィールドを検証し、実際に実行時にどのフィールドが到達するかを記録します。これは、すべてのテスト実行で生成、チェックイン、および検証されるため、「エクスポートで残るもの」は、仮定ではなく、監査可能です。
- **信頼できるマニフェスト**—出力されるパックには、実際のエンジンセマンティックバージョン範囲、実際のモジュールID、コンテンツハッシュ、およびコンパイルされた終了条件が含まれます。モジュールIDは、実際のコンテンツに基づいて制限されます。つまり、作成ステーションがないパックは、作成モジュールを主張しません。
- **空間語彙の交差**—エンティティごとの配置、コンパイルされたスポーン条件、型付きの危険性、エントリゲート、およびシーン記述子は、スキーマだけでなく、エンジンのコンテンツパックに到達します。
- **忠実度のレポートは契約を維持します**。各レーンは、損失が発生しなかったもの、近似されたもの、または削除されたものを報告します。フィールドが交差できない場合、エクスポートはそのことを明示します。つまり、静かに成功することはありません。

`ai-rpg-engine` `^3.8.0`が必要です。

### 描画契約

ワールドは、クライアントがどのように描画すべきかを指定することもできます。`WorldProject.presentation`はオプションであり、追加機能です。ほとんどのワールドにはこれがないため、これがないことに対してペナルティが科されることはありません。これには、等角投影ビュー、タイルのフットプリント、ゾーンごとのアンカーセルとフロアプレート、およびアクターごとの1つの占有行が含まれます。

これは、2.5Dワールドが一度に3つのグリッドで記述され、エクスポートがそれらのグリッド間で変換しないために存在します。

| グリッド | ユニット | 所有者 | ハッシュ化 |
|---|---|---|---|
| シミュレーションによる占有 | ゾーンID | エンジンの`WorldState` | はい—権威 |
| 等角セル | 256x128のダイヤモンド、スパン3 | クライアントのビュー、`presentation`経由 | 決して |
| フォージのデカルト座標 | `gridX` / `gridY` | エディターとGodotの`.tscn` | 決して |

等角セルは、`gridX`/`gridY`から導出されることはなく、サンドボックススケールはブロックを名前でスキップするため、絶対的なダイヤモンドセルが誤って乗算されることはありません。シミュレーションは、常に人がどの部屋にいるかについての紛争に勝ちます。`presentationAdvisories()`はそれを声に出して言います。`exportToGodot`はそれを`warnings[]`に報告し、ステージフィクスチャレーンはそれを`--strict`で致命的にすることができます。

ブロックは、Godotステージフィクスチャの`pack.json`を通過します。これは、`export-ai-rpg`レーンを通過しません。エンジンの`ContentPack`には追加のスロットがなく、ローダーは厳密であるため、計測されたエクスポートテーブルは、そこで削除されたものとして報告し、それ以外を暗示することはありません。

## セキュリティ

- **アクセスされるデータ:** ローカルディスク上のプロジェクトファイル（ユーザーが作成したJSON）、サーバー側のストレージはなし
- **アクセスされないデータ:** テレメトリ、分析、ローカル開発サーバーを超えたネットワークリクエストはなし
- **権限:** APIキー、秘密鍵、認証情報はなし
- **ソースコードに秘密鍵、トークン、または認証情報は含まれていません**

## ライセンス

MIT

---

[MCP Tool Shop](https://mcp-tool-shop.github.io/)によって作成されました。
