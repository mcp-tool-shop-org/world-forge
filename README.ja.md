<p align="center">
  <a href="README.md">English</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./assets/logo.png" alt="World Forge" width="400">
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop-org/world-forge/actions/workflows/ci.yml"><img src="https://github.com/mcp-tool-shop-org/world-forge/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@world-forge/schema"><img src="https://img.shields.io/npm/v/@world-forge/schema" alt="npm schema"></a>
  <a href="https://www.npmjs.com/package/@world-forge/export-ai-rpg"><img src="https://img.shields.io/npm/v/@world-forge/export-ai-rpg" alt="npm export"></a>
  <a href="https://www.npmjs.com/package/@world-forge/renderer-2d"><img src="https://img.shields.io/npm/v/@world-forge/renderer-2d" alt="npm renderer"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="MIT License"></a>
  <a href="https://mcp-tool-shop-org.github.io/world-forge/"><img src="https://img.shields.io/badge/Landing_Page-live-blue" alt="Landing Page"></a>
</p>

<p align="center">2D world authoring studio for <a href="https://github.com/mcp-tool-shop-org/ai-rpg-engine">AI RPG Engine</a>.<br>One editor, many modes — paint zones, place entities, define districts, export a complete ContentPack ready to play.</p>

## アーキテクチャ

```
packages/
  schema/          @world-forge/schema        — spatial types, validation
  export-ai-rpg/   @world-forge/export-ai-rpg — engine export pipeline + CLI
  renderer-2d/     @world-forge/renderer-2d   — PixiJS 2D canvas renderer
  editor/          @world-forge/editor         — React web authoring app
```

## クイックスタート

```bash
npm install
npm run build
npm run dev --workspace=packages/editor
```

`http://localhost:5173` を開いて、エディターを起動します。

### エディターのワークフロー

1. **モードの選択:** ダンジョン、地域、世界、海、宇宙、屋内、または自然環境など、グリッドのデフォルト設定と接続語彙を設定するためのモードを選択します。
2. **キットから開始:** テンプレートマネージャーからスターターキットまたはジャンルテンプレートを選択するか、空白の状態から開始します。
3. **ゾーンのペイント:** キャンバス上でドラッグしてゾーンを作成し、接続し、地域を割り当てます。
4. **エンティティの配置:** NPC、敵、商人、遭遇イベント、アイテムなどをゾーンに配置します。
5. **レビュー:** ヘルスステータス、コンテンツ概要、および概要のエクスポート（Markdown/JSON）を表示するために、レビュータブを開きます。
6. **エクスポート:** ContentPack、プロジェクトバンドル（.wfproject.json）、またはレビュー概要をダウンロードします。

### CLIによるエクスポート

```bash
npx world-forge-export project.json --out ./my-pack
npx world-forge-export project.json --validate-only
```

## パッケージ

### @world-forge/schema

ワールド作成のためのコアTypeScript型と検証機能。

- **空間型:** `WorldMap`, `Zone`, `ZoneConnection`, `District`, `Landmark`, `SpawnPoint`, `EncounterAnchor`, `FactionPresence`, `PressureHotspot`
- **コンテンツ型:** `EntityPlacement`, `ItemPlacement`, `DialogueDefinition`, `PlayerTemplate`, `BuildCatalogDefinition`, `ProgressionTreeDefinition`
- **ビジュアルレイヤー:** `AssetEntry`, `AssetPack`, `Tileset`, `TileLayer`, `PropDefinition`, `AmbientLayer`
- **モードシステム:** `AuthoringMode` (7つのモード)、モード固有のグリッド/接続/検証プロファイル
- **検証:** `validateProject()` (54個の構造チェック)、`advisoryValidation()` (モード固有の提案)
- **ユーティリティ:** `assembleSceneData()` (アセット不足を検出するビジュアルバインディング)、`scanDependencies()` (参照グラフ分析)、`buildReviewSnapshot()` (ヘルス分類)

### @world-forge/export-ai-rpg

`WorldProject`を、ai-rpg-engineの`ContentPack`形式に変換します。

- **エクスポート:** ゾーン、地域、エンティティ、アイテム、ダイアログ、プレイヤーテンプレート、ビルドカタログ、プログレッシオンツリー、遭遇イベント、派閥、ホットスポット、マニフェスト、およびパックメタデータ
- **インポート:** 8つの逆変換機能により、エクスポートされたJSONからWorldProjectを再構築します。
- **忠実度レポート:** 変換中に損失、近似、または削除された内容を構造的に追跡します。
- **フォーマット検出:** WorldProject、ExportResult、ContentPack、およびProjectBundleの形式を自動的に検出します。
- **CLI:** `--out`および`--validate-only`フラグを持つ`world-forge-export`コマンド

### @world-forge/renderer-2d

PixiJSベースの2Dレンダラー：パン/ズーム機能付きのビューポート、地域着色によるゾーンオーバーレイ、接続矢印、役割ごとのエンティティアイコン、タイルレイヤー、およびミニマップ。

### @world-forge/editor

React 19 + Viteウェブアプリケーションで、Zustandによる状態管理と、アンドゥ/リドゥ機能を搭載。

#### ワークスペースタブ

| タブ | 目的 |
|-----|---------|
| マップ | 2Dキャンバス上でのゾーン/エンティティ/地域の編集 |
| オブジェクト | 階層構造のツリー：地域 → ゾーン → エンティティ/ランドマーク/スポーン |
| プレイヤー | ステータス、インベントリ、装備、スポーンを含むプレイヤーテンプレート |
| ビルド | アーキタイプ、バックグラウンド、特性、専門分野、コンボ |
| ツリー | 要件と効果を持つプログレッシオンノード |
| ダイアログ | ノードの編集、選択肢のリンク、参照切れの検出 |
| プリセット | 地域と遭遇イベントのプリセットブラウザで、マージ/上書き機能を提供 |
| アセット | 種類でフィルタリングされた検索機能、孤立アセットの検出、アセットパックを含むアセットライブラリ |
| 問題 | グループ化されたライブ検証で、クリックするとフォーカスされるナビゲーション |
| 依存関係 | インラインでの修正ボタンを備えた依存関係スキャナー |
| レビュー | 健康ダッシュボード、コンテンツ概要、エクスポート機能 |
| ガイド | 初回起動時のチェックリストとホットキー参照 |

#### キャンバスと編集

- **ツール**：選択、エリア塗り、接続、エンティティ配置、ランドマーク、スポーン
- **複数選択**：Shiftキー + クリック、ボックス選択、Ctrl+A；アトミックなアンドゥ機能付きドラッグ移動
- **配置**：6方向の配置（左/右/上/下/中央（水平）/中央（垂直））と水平/垂直方向の均等配置
- **スナップ**：近くのオブジェクトのエッジや中心にドラッグすると、視覚的なガイドラインが表示され、スナップ
- **リサイズ**：エリアごとに8つのハンドルがあり、エッジスナップ、最小サイズ制限、リアルタイムプレビュー
- **複製**：Ctrl+DでID、接続、およびエリアの割り当てを再設定して複製
- **クリックサイクル**：同じ位置で繰り返しクリックすると、重なっているオブジェクトを順番に選択
- **レイヤー**：7つの表示/非表示切り替え（グリッド、接続、エンティティ、ランドマーク、スポーン、背景、環境光）

#### ナビゲーションとショートカット

- **ビューポート**：カメラのパン/ズーム、マウスホイールによるズーム（カーソル固定）、スペースキー/マウスの中ボタン/右クリックによるドラッグパン、コンテンツに合わせて自動調整、ダブルクリックで中央に移動
- **検索**：Ctrl+Kでオーバーレイを開き、名前/IDで任意のオブジェクトを検索（キーボード操作可能）
- **スピードパネル**：右クリックを2回で、コンテキストに応じたアクション、お気に入り、マクロ、およびモードに応じたクイックアクションを表示するフローティングコマンドパレットを表示
- **ホットキー**：Enterキー（詳細表示）、Pキー（プリセット適用）、Shift+Pキー（プリセット保存）など、13個のキーボードショートカット

#### インポートとエクスポート

- **コンテンツパック**：完全な検証付きで、AI-RPGエンジン形式へのワンクリックエクスポート
- **プロジェクトバンドル**：メタデータと依存関係情報を含む、ポータブルな`.wfproject.json`ファイル
- **キットバンドル**：検証、衝突処理、およびトレーサビリティ機能付きの`.wfkit.json`のエクスポート/インポート
- **インポート**：4つの形式を自動検出し、構造的な詳細レポートを表示
- **差分**：インポート以降の変更を追跡
- **シーンプレビュー**：すべてのエリアの視覚的なバインディングをHTML/CSSでレンダリング

## 制作モード

World Forgeでは、**ジャンル**（ファンタジー、サイバーパンク、海賊）と**モード**（ダンジョン、海洋、宇宙）を区別します。ジャンルは雰囲気、モードはスケールです。モードは、グリッドのデフォルト設定、接続の種類、検証の提案、ガイドの表現、およびプリセットのフィルタリングを制御します。

| モード | グリッド | タイル | 主要な接続 |
|------|------|------|-----------------|
| ダンジョン | 30×25 | 32 | ドア、階段、通路、隠し通路、危険 |
| 都市/街 | 50×40 | 32 | 道、ドア、通路、ポータル |
| 地域/世界 | 80×60 | 48 | 道、ポータル、通路 |
| 海洋/海 | 60×50 | 48 | 水路、航路、ポータル、危険 |
| 宇宙 | 100×80 | 64 | ドッキング、ワープ、通路、ポータル |
| 屋内 | 20×15 | 24 | ドア、階段、通路、隠し通路 |
| 自然 | 60×50 | 48 | 小道、道、通路、危険 |

モードはプロジェクト作成時に設定され、`WorldProject`の`mode?: AuthoringMode`として保存されます。各モードは、接続の種類、エンティティの役割、エリアの名前、およびスピードパネルの提案など、**スマートなデフォルト設定**を提供します。これらの設定は自動的に調整されます。

## 制作領域

### ワールド構造

- 空間的なレイアウト、近隣、出入口、光、騒音、危険、インタラクション要素を持つエリア
- 12種類の接続方法（通路、ドア、階段、道路、ポータル、隠し通路、危険、チャネル、ルート、ドッキング、ワープ、トレイル）があり、それぞれ異なる視覚的なスタイル、エッジに沿ったルーティング、方向を示す矢印、および条件付きの点線スタイルを採用
- 派閥の支配、経済プロファイル、指標スライダー、タグ、およびエリアの中心に配置されたエリア名ラベルを持つ地区
- ランドマーク（エリア内の名前付きの興味深い地点）
- スポーンポイント、遭遇ポイント（タイプに基づいたカラーリング）、派閥の存在、およびプレッシャーの集中ポイント

### コンテンツ

- 統計、リソース、AIプロファイル、およびカスタムメタデータを持つエンティティの配置
- スロット、レアリティ、ステータス修正、および付与されるアクションを持つアイテムの配置
- 分岐のある会話、条件、および効果を持つダイアログツリー
- キャンバス上の遭遇ポイント — ボス/待ち伏せ/パトロールのタイプを示す赤い菱形マーカー

### キャラクターシステム

- プレイヤーテンプレート（初期ステータス、インベントリ、装備、スポーンポイント）
- ビルドカタログ（アーキタイプ、バックグラウンド、特性、専門分野、複合称号、関連スキル）
- プログレスツリー（スキル/アビリティのノードと、その要件および効果）

### アセット

- アセットマニフェスト（ポートレート、スプライト、背景、アイコン、タイルセット）で、種類ごとに異なる設定
- アセットパック（名前付き、バージョン管理されたグループで、互換性に関するメタデータ、テーマ、ライセンスを含む）
- シーンプレビュー（すべてのエリアの視覚的な要素を組み合わせて表示し、不足しているアセットを検出）

### ワークフロー

- リージョンプリセット（9つ内蔵、モードによってフィルタリング）および遭遇プリセット（10つ内蔵）で、マージ/上書き適用が可能。カスタムプリセットの作成、編集、削除も可能
- スターターキット（7つ内蔵、モード固有）で、キットのエクスポート/インポート（`.wfkit.json`）、衝突判定、および追跡機能
- Ctrl+Kで、接続や遭遇を含むすべてのオブジェクトタイプを検索
- スピードパネルコマンドパレットで、お気に入り、マクロ、カスタムグループ、およびモードの提案を表示
- 13個の集中キーボードショートカット
- ContentPack JSON、プロジェクトバンドル、およびレビューサマリーへのエクスポート
- 4つの形式からのインポートで、構造化されたフィードバックレポートと、意味的な差分追跡

Chapel Thresholdのエクスポートハンドシェイクの例は、[`dogfood/WALKTHROUGH.md`](dogfood/WALKTHROUGH.md) を参照してください。これにより、現在の環境での動作を確認できます。

## エンジン互換性

エクスポート先は、[ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine) でサポートされているコンテンツタイプです。エクスポートされたContentPackは、[claude-rpg](https://github.com/mcp-tool-shop-org/claude-rpg) に直接読み込むことができます。

## セキュリティ

- **アクセスするデータ:** ローカルディスク上のプロジェクトファイル（ユーザーが作成したJSON）、サーバー側のストレージは使用しません。
- **アクセスしないデータ:** テレメトリー、分析、ローカル開発サーバー以外のネットワークリクエストは行いません。
- **権限:** APIキー、シークレット、認証情報は不要です。
- **ソースコードにシークレット、トークン、または認証情報は含まれていません。**

## ライセンス

MIT

---

開発: [MCP Tool Shop](https://mcp-tool-shop.github.io/)
