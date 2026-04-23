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

<p align="center"><strong>v4.3.0</strong> — 1959 tests, 5 shipping packages + 1 planned Godot stub (6 total), 7 authoring modes, 2.5D authoring end-to-end</p>

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

## クイックスタート

```bash
npm install
npm run build
npm run dev --workspace=packages/editor
```

`http://localhost:5173` を開いて、エディターを起動します。

### エディターのワークフロー

1. **モードの選択:** ダンジョン、地区、ワールド、海、宇宙、屋内、または自然などのモードを選択し、グリッドのデフォルト設定と接続の語彙を設定します。
2. **キットから開始:** テンプレートマネージャーからスターターキットまたはジャンルテンプレートを選択するか、空白の状態から開始します。
3. **ゾーンの描画:** キャンバス上でドラッグしてゾーンを作成し、接続し、地区を割り当てます。
4. **エンティティの配置:** NPC、敵、商人、遭遇イベント、アイテムなどをゾーンに配置します。
5. **レビュー:** レビュータブを開いて、状態、コンテンツの概要を確認し、概要をエクスポートします（Markdown/JSON）。
6. **エクスポート:** コンテンツパック、プロジェクトバンドル（.wfproject.json）、またはレビュー概要をダウンロードします。

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
- **モードシステム:** `AuthoringMode` (7つのモード)、モードごとのグリッド/接続/検証プロファイル
- **検証:** `validateProject()` (マップベースのO(n)検索による54個の構造チェック、警告数)、`advisoryValidation()` (モードごとの提案、メタデータの完全性、アセット名のチェック)
- **ユーティリティ:** `assembleSceneData()` (アセットの欠落を検出するビジュアルバインディング)、`scanDependencies()` (参照グラフ分析)、`buildReviewSnapshot()` (状態分類)

### @world-forge/export-unreal

`WorldProject`を、2.5Dゲーム向けに調整されたUnreal Engine 5のコンテンツパックに変換します。

- **出力:** `pack.json`, 各ゾーンおよび地区のプライマリデータアセットJSON、グループ化されたアクターのスポーンマニフェスト、接続ごとのレベルストリーミングのヒント、ワールドパーティションのセルヒント、および構造化された品質レポート。
- **2.5Dフィールド:** `Zone.elevation`, `elevationRange`, `parallaxLayers`, `skylineRef` が保持され、UEのcm / Z-up座標に変換されます。
- **座標変換:** ピクセルからUnreal cmへの変換、高度からZ座標への変換、World Forge座標軸からUnreal座標軸への変換など、純粋な関数 (`pixelsToUnrealCm`, `elevationToZ`, `worldForgeToUnrealAxis`, `gridToUnrealAxis`) を使用します。 デフォルトのワールドスケールは、1タイル = 100cmです。
- **ラウンドトリップインポート:** `importFromUnreal` は、Unrealパックから`WorldProject`を再構築します。 ゲームプレイ関連データ（ダイアログ、進行、ビルド）は、品質レポートで「削除された」としてマークされます。
- **CLI:** `world-forge-export-unreal` コマンドで、`--out`, `--tile-size-cm`, `--validate-only`, `--verbose` オプションを使用します。

### @world-forge/export-godot

将来的に予定されているGodot 4のエクスポート機能のための、予約済みのワークスペース領域（Fractured Road）。 まだ実装されていません。

### @world-forge/export-ai-rpg

`WorldProject`を、ai-rpg-engineの`ContentPack`形式に変換します。

- **エクスポート:** ゾーン、地区、エンティティ、アイテム、ダイアログ、プレイヤーテンプレート、ビルドカタログ、進行ツリー、遭遇イベント、派閥、ホットスポット、マニフェスト、およびパックのメタデータ
- **インポート:** 8つの逆変換機能が、エクスポートされたJSONから`WorldProject`を再構築します。
- **品質レポート:** 変換中に、何が損失なく、近似され、または削除されたかを追跡します。
- **形式検出:** `WorldProject`, `ExportResult`, `ContentPack`, および`ProjectBundle`形式を自動的に検出します。
- **CLI:** `world-forge-export` コマンドで、`--out`, `--validate-only`, および`--verbose` オプションを使用します。

### @world-forge/renderer-2d

PixiJSベースの2Dレンダラー：パン/ズーム機能付きのビューポート、地区の色分けによるゾーンオーバーレイ、接続を示す矢印、役割ごとのエンティティアイコン、タイルレイヤー、およびミニマップ。

### @world-forge/editor

React 19 + Vite ウェブアプリケーション。Zustandによる状態管理、アクションラベル付きの元に戻す/やり直し機能、自動保存（30秒ごとのスロットリング、3バージョン履歴）、ダーク/ライトテーマの切り替え、未保存変更の保護機能。

#### ワークスペースタブ

| タブ | 目的 |
|-----|---------|
| マップ | 2Dキャンバス上でのゾーン/エンティティ/地区の編集 |
| オブジェクト | 階層構造：地区 → ゾーン → エンティティ/ランドマーク/スポーン |
| プレイヤー | プレイヤーテンプレート（ステータス、インベントリ、装備、スポーン地点を含む） |
| ビルド | アーキタイプ、背景、特性、専門分野、コンボ |
| ツリー | 要件と効果を持つ進行ノード |
| ダイアログ | ノードの編集、選択肢のリンク、参照切れの検出 |
| プリセット | 地域と遭遇のプリセットブラウザ（マージ/上書き機能付き） |
| アセット | 種類でフィルタリングされた検索、孤立アセットの検出、アセットパックを含むアセットライブラリ |
| 問題点 | クリックでフォーカスする、グループ化されたライブ検証 |
| 依存関係 | インラインでの修正ボタンを備えた依存関係スキャナ |
| レビュー | ヘルスダッシュボード、コンテンツ概要、要約のエクスポート |
| ガイド | 初回起動時のチェックリストとホットキー参照 |

#### キャンバスと編集

- **ツール** — 選択、ゾーンペイント、接続、エンティティ配置、ランドマーク、スポーン
- **複数選択** — Shiftクリック、ボックス選択、Ctrl+A; ドラッグによる移動（アトミックな元に戻す）
- **整列** — 6方向の整列（左/右/上/下/中央（水平）/中央（垂直））と水平/垂直方向の分布
- **スナップ** — ドラッグ中に、近くのオブジェクトの端/中心にスナップ（視覚的なガイドライン付き）
- **リサイズ** — ゾーンごとに8つのハンドル（端のスナップ、最小サイズの制限、ライブプレビュー）
- **複製** — Ctrl+D（再マッピングされたID、接続、地区の割り当て）
- **コピー/ペースト** — Ctrl+C / Ctrl+V（IDの再マッピングと設定可能なオフセット）
- **クリックサイクル** — 同じ位置での繰り返しクリックで、重なり合うオブジェクトを切り替え
- **コンテキストメニュー** — 右クリックで、状況に応じた7つのアクションを表示（プロパティ、削除、複製など）
- **接続プレビュー** — 接続ツールを使用している間、破線のシアン色の線が表示
- **ミニマップ** — 200×150の概要表示（右下）、クリックでジャンプ
- **ビューポートのクリッピング** — 画面内に収まるオブジェクトのみをレンダリング（64pxのマージン）
- **パフォーマンス統計** — FPS/オブジェクト数/レンダリング時間のオーバーレイを切り替え
- **オブジェクトごとの可視性** — 個々のオブジェクトを非表示/表示（localStorageに保存）
- **レイヤー** — 7つの可視性切り替え（グリッド、接続、エンティティ、ランドマーク、スポーン、背景、アンビエント）

#### ナビゲーションとショートカット

- **ビューポート** — カメラのパン/ズーム、マウスホイールによるズーム（カーソル固定）、スペースキー/マウスの中ボタン/右クリックによるドラッグパン、コンテンツに合わせて自動調整、ダブルクリックで中央に移動
- **検索** — Ctrl+Kで、名前/IDによるオブジェクトの検索オーバーレイを開く（あいまい検索、キーボードナビゲーション、最近の検索履歴（localStorage））
- **スピードパネル** — ダブル右クリックで、コンテキストに応じたアクション、ピン留め可能なお気に入り、マクロ、およびモードに応じたクイックアクションを表示する、フローティングコマンドパレットを表示
- **ホットキー** — Enter（詳細を開く）、P（プリセットを適用）、Shift+P（プリセットを保存）、Ctrl+C/V（コピー/ペースト）など、15個のキーボードショートカット

#### インポートとエクスポート

- **コンテンツパック** — 完全な検証付きで、ワンクリックでai-rpg-engine形式でエクスポート
- **プロジェクトバンドル** — プロベナンスメタデータと依存関係情報を含む、ポータブルな`.wfproject.json`ファイル
- **キットバンドル** — 検証、衝突処理、およびプロベナンス追跡機能付きの`.wfkit.json`のエクスポート/インポート
- **インポート** — 4つの形式を自動的に検出し、構造化されたフィードバックを提供
- **差分** — インポート以降の変更を追跡
- **シーンプレビュー** — すべてのゾーンの視覚的なバインディングをHTML/CSSで構成

## コンテンツ作成モード

World Forgeでは、**ジャンル**（ファンタジー、サイバーパンク、海賊）と**モード**（ダンジョン、海洋、宇宙）を区別します。ジャンルは雰囲気であり、モードは規模です。モードは、グリッドのデフォルト設定、接続の種類、検証の提案、ガイドの表現、およびプリセットフィルタリングを制御します。

| モード | グリッド | タイル | 主要な接続 |
|------|------|------|-----------------|
| ダンジョン | 30×25 | 32 | ドア、階段、通路、秘密、危険 |
| 地区/都市 | 50×40 | 32 | 道、ドア、通路、ポータル |
| 地域/世界 | 80×60 | 48 | 道、ポータル、通路 |
| 海洋/海 | 60×50 | 48 | 水路、ルート、ポータル、危険 |
| 宇宙 | 100×80 | 64 | ドッキング、ワープ、通路、ポータル |
| 内装 | 20×15 | 24 | ドア、階段、通路、秘密 |
| 未開地 | 60×50 | 48 | 道、ルート、通路、危険 |

モードは、プロジェクトを作成する際に設定され、`WorldProject`オブジェクトの`mode?: AuthoringMode`として保存されます。各モードは、接続の種類、エンティティの役割、ゾーンの名前、およびスピードパネルの提案など、**スマートなデフォルト設定**を提供し、これらは自動的に適応します。

## コンテンツ作成領域

### ワールド構造

- 空間的なレイアウト、隣接ゾーン、出口、光、音、危険、およびインタラクション可能な要素を持つゾーン
- 12種類の接続（通路、ドア、階段、道、ポータル、秘密、危険、水路、ルート、ドッキング、ワープ、道）があり、それぞれ異なる視覚スタイル、エッジにアンカーされたルーティング、方向を示す矢印、および条件付きの破線スタイルを備えています。
- 派閥の支配、経済プロファイル、メトリックのスライダー、タグ、およびゾーンの中心に配置された地区名ラベルを持つ地区
- ゾーン内の特定の場所（ランドマーク）
- スポーンポイント、遭遇ポイント（タイプに基づいたカラーリング）、派閥の存在、およびプレッシャーポイント

### コンテンツ

- 統計、リソース、AIプロファイル、およびカスタムメタデータを持つエンティティの配置
- スロット、レアリティ、ステータス修正、および付与されるアクションを持つアイテムの配置
- 分岐のある会話、条件、および効果を持つダイアログツリー
- キャンバス上の遭遇ポイント（赤い菱形のマーカーで、ボス/待ち伏せ/パトロールの種類を示します）

### キャラクターシステム

- プレイヤーテンプレート（初期ステータス、インベントリ、装備、スポーンポイント）
- ビルドカタログ（アーキタイプ、バックグラウンド、特性、専門分野、複合スキル、関連スキル）
- プログレッシオンツリー（スキル/アビリティのノードと、その要件と効果）

### アセット

- アセットマニフェスト（ポートレート、スプライト、背景、アイコン、タイルセット）で、種類ごとに異なる設定が適用されます。
- アセットパック（名前、バージョン、互換性メタデータ、テーマ、ライセンス情報を含むグループ）
- シーンプレビュー（すべてのゾーンの視覚的な要素を組み合わせて表示し、不足しているアセットを検出します）

### ワークフロー

- リージョンプリセット（9種類、モードでフィルタリング可能）とエンカウンタープリセット（10種類）を搭載。マージ/上書き機能、およびカスタムプリセットの作成・編集・削除・更新機能をサポート。
- スターターキット（7種類、モードごとに異なる）を搭載。キットのエクスポート/インポート（`.wfkit.json`形式）、衝突処理、およびトレーサビリティ機能を備えています。
- レイアウトテンプレート（6種類のゾーン配置）と、ダイアログテンプレート（5種類の会話開始フレーズ）を提供。
- ゾーンのマージ機能と、バッチでのエンティティ配置機能（グリッド、ランダム、円形パターン）。
- 30秒ごとの自動保存機能と、3つのバージョンの復元履歴。
- Ctrl+Kキーによる、すべてのオブジェクトタイプを対象とした検索機能。ファジーマッチングと最近の履歴に対応。
- スピードパネルのコマンドパレット。お気に入り、マクロ、カスタムグループ、およびモードの提案機能を搭載。
- 15種類の集中管理されたキーボードショートカット。
- プロジェクトメタデータエディタ（作者、ライセンス、カテゴリ、タグ）。
- レビュー統計（ロールの分布、接続の種類、エンカウンターの種類、地区ごとのゾーン数）。
- ContentPack JSON、プロジェクトバンドル、およびレビューサマリーへのエクスポート機能。
- 4つの形式からのインポート機能。構造の忠実度レポート、修復の提案、およびセマンティックな差分追跡機能を搭載。

Chapel Thresholdのエクスポートハンドシェイクに関する詳細は、[`dogfood/WALKTHROUGH.md`](dogfood/WALKTHROUGH.md) を参照してください。これにより、現在の機能が正常に動作していることを確認できます。

## Dogfoodディレクトリ

`dogfood/`ディレクトリには、ユニットテスト以外の、エンドツーエンドの作成からエクスポートまでのパイプラインを検証するための統合テスト環境が含まれています。Chapel Thresholdの例（`chapel-threshold.ts`）は、小さな規模ですが完全なワールドプロジェクトを作成し、エクスポートを実行し、その結果を`dogfood/output/`に書き出します。これにより、スキーマの種類、検証、およびエクスポートパイプラインが、実際のデータを使用してエンドツーエンドで機能することを確認できます。

## エンジン互換性

エクスポートされるコンテンツは、[ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine) がサポートするコンテンツタイプです。エクスポートされたContentPackは、[claude-rpg](https://github.com/mcp-tool-shop-org/claude-rpg) に直接ロードできます。

## セキュリティ

- **アクセスするデータ:** ローカルディスク上のプロジェクトファイル（ユーザーが作成したJSONファイル）、サーバー側のストレージは使用しません。
- **アクセスしないデータ:** テレメトリー、分析、ローカル開発サーバー以外のネットワークリクエストは行いません。
- **権限:** APIキー、シークレット、認証情報は不要です。
- **ソースコードにシークレット、トークン、または認証情報は含まれていません。**

## ライセンス

MIT

---

[MCP Tool Shop](https://mcp-tool-shop.github.io/) が開発しました。
