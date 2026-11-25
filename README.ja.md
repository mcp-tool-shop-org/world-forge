<p align="center">
  <a href="README.md">English</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./assets/logo.png" alt="World Forge" width="400">
</p>

<p align="center">
  <img src="./site/public/screenshots/editor-canvas.jpg" alt="World Forge editor with the Chapel Threshold sample open and the Speed Panel showing actions for a zone" width="720">
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop-org/world-forge/actions/workflows/ci.yml"><img src="https://github.com/mcp-tool-shop-org/world-forge/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@world-forge/schema"><img src="https://img.shields.io/npm/v/@world-forge/schema?label=npm" alt="npm"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="MIT License"></a>
  <a href="https://mcp-tool-shop-org.github.io/world-forge/"><img src="https://img.shields.io/badge/Landing_Page-live-blue" alt="Landing Page"></a>
</p>

<p align="center">2D / 2.5D world authoring studio with peer export lanes for <a href="https://github.com/mcp-tool-shop-org/ai-rpg-engine">AI RPG Engine</a>, <a href="https://www.unrealengine.com/">Unreal Engine 5</a>, and <a href="https://godotengine.org/">Godot 4</a>.<br>One editor, many modes — paint zones, place entities, define districts, export a complete content pack for your engine of choice.</p>

<!-- version:start -->
<p align="center"><strong>v4.11.0</strong> — 3719 tests, 6 shipping packages, 7 authoring modes, tiles + interiors + town authoring + world modeling (vertical strata, typed hazards, party-gated zones), three export targets (AI RPG Engine, Unreal Engine 5, Godot 4), a measured Forge→Engine content contract, and an authored drawing contract for 2.5D clients</p>
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

`http://localhost:5173`を開いてエディターを起動します。

### エディターのワークフロー

1. **モードを選択** — ダンジョン、地区、ワールド、海、宇宙、インテリア、または荒野 — グリッドのデフォルトと接続語彙を設定します。
2. **キットから開始** — テンプレートマネージャーからスターターキットまたはジャンルテンプレートを選択するか、空の状態で開始します。
3. **ゾーンをペイント** — キャンバス上でドラッグしてゾーンを作成し、接続し、地区を割り当てます。
4. **エンティティを配置** — NPC、敵、商人、遭遇イベント、アイテムをゾーンに配置します。
5. **確認** — ヘルスステータス、コンテンツの概要、および要約エクスポート（Markdown / JSON）については、レビュータブを開きます。
6. **エクスポート** — エクスポートモーダルを開いて、ターゲットごとの準備状況を確認します（ボックスには、3つのターゲットすべての中で最も悪い状態が表示されます。ブロックされている場合は赤、アドバイス（遭遇タイプの翻訳/ドロップ、エンティティの配置の欠落、マルチゾーンプロジェクトでの接続の欠落、プレイヤーテンプレートの欠落、またはUE5の標高またはパララックス設定の欠落など）がリストされている場合は琥珀色、問題がない場合は緑色）。ターゲットオプションを設定し、AI RPG Engine、UE5、またはGodot 4パックをダウンロードします。エクスポート後のレシートには、サイズ、数、および忠実度に関する詳細が記載されます。また、プロジェクトバンドル（.wfproject.json）とレビューの概要も含まれます。

### CLIエクスポート

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

### @world-forge/schema

ワールド構築のためのコアTypeScriptタイプと検証。

- **空間タイプ** — `WorldMap`、`Zone`、`ZoneConnection`、`District`、`Landmark`、`SpawnPoint`、`EncounterAnchor`、`FactionPresence`、`PressureHotspot`
- **コンテンツタイプ** — `EntityPlacement`、`ItemPlacement`、`DialogueDefinition`、`PlayerTemplate`、`BuildCatalogDefinition`、`ProgressionTreeDefinition`
- **視覚レイヤー** — `AssetEntry`、`AssetPack`、`Tileset`、`TileLayer`、`PropDefinition`、`PropPlacement`、`AmbientLayer`
- **町と構造物** — `MarketNode`、`CraftingStation`、`Building`、`Hub`、`Stronghold`
- **ワールドモデリング** — `Stratum` + `StratumLink`（垂直レイヤー）、`HazardDefinition`（タイプ付きエフェクトのユニオン）、`ZoneEntryGate` + パーティの状態 `SpawnCondition`オペランド（`party-level`、`party-size`、`item`、`flag`、`member`、`class`）
- **モードシステム** — `AuthoringMode`（7つのモード）、モード固有のグリッド/接続/検証プロファイル
- **表現** — オプションの `WorldPresentation` を `WorldProject` に適用：等角投影、タイルのフットプリント、ゾーンアンカーセル、床のプレート、および各キャラクターごとの占有行。 `presentationAdvisories()` は、その中に重要なルール（シミュレーション上はその部屋の外にいる人物が部屋の中に描画されているケース）を含む、8つの推奨ルールを適用します。
- **検証** — `validateProject()`（マップベースのO(n)検索による89の構造チェック、`warningCount`）、`advisoryValidation()`（モード固有の提案、メタデータの完全性、アセットの命名）。後で必要となる配列を省略した v4.0 JSONは、`normalizeProjectShape()` / `stampProjectSchemaVersion()` の後に受け入れられます。
- **バレル上のクローズドユニオン** — `VALID_CONNECTION_KINDS`、`VALID_ASSET_KINDS`、`VALID_ENTITY_ROLES`、`VALID_ITEM_SLOTS`、および残りの `VALID_*` セットは、`@world-forge/schema` からエクスポートされます。
- **ユーティリティ** — `assembleSceneData()`（欠落したアセットを検出する視覚的なバインディング）、`scanDependencies()`（参照グラフ分析）、`buildReviewSnapshot()`（健全性分類）

### @world-forge/export-unreal

`WorldProject`を、2.5Dゲーム用に調整されたUnreal Engine 5コンテンツパックに変換します。

- **出力** — `pack.json`、ゾーンごとおよび地区ごとのプライマリデータアセットJSON、グループ化されたアクター生成マニフェスト、接続ごとのレベルストリーミングヒント、ワールドパーティションセルヒント、および構造化された忠実度レポート。
- **2.5Dフィールド** — `Zone.elevation`、`elevationRange`、`parallaxLayers`、`skylineRef`は保持され、UE cm / Z-up座標に変換されます。
- **座標変換** — 純粋な関数（`pixelsToUnrealCm`、`elevationToZ`、`worldForgeToUnrealAxis`、`gridToUnrealAxis`）。デフォルトのワールドスケールは、1タイル= 100cmです。
- **ラウンドトリップインポート** — `importFromUnreal`は、UnrealパックからWorldProjectを再構築します。ゲームプレイのみのデータ（対話、進行、ビルド）は、忠実度レポートでドロップされたものとしてフラグが立てられます。
- **CLI** — `world-forge-export-unreal`、`--out`、`--tile-size-cm`、`--validate-only`、`--verbose`を使用します。

### @world-forge/export-godot

`WorldProject`を、`.tscn`シーンテキストを含むGodot 4コンテンツパックに変換します。

- **出力** — Godot 4プロジェクトのルート：`project.godot`、`world.tscn`（ExtResource `.tres`）、コピーされたテクスチャは`assets/`、`scripts/player.gd`の下に配置され、さらに`pack.json`と`fidelity.json`も含まれます。
- **CLI** — `world-forge-export-godot`、`--out`、`--validate-only`、`--include-world-tscn` / `--no-world-tscn`を使用します。
- **プレイ可能なシーン** — `buildWorldScene()`は、ナビゲート可能な`.tscn`を生成します：ゾーンごとの`StaticBody2D`コリジョン + `NavigationRegion2D`、フレーム化された`Camera2D`、`CharacterBody2D`プレイヤーポーン、およびyソート/`z_index`深度。
- **タイル + インテリア** — `TileMapLayer` + `TileSet`（画像タイルセット用にベイクされた`tile_map_data`）、セルごとの壁`StaticBody2D`コリジョン、およびプロップ`Node2D`配置。
- **町** — 市場 + クラフトステーション、および建物（`StaticBody2D`フットプリント）/ハブ/拠点は、メタデータとしてデータを保持した`Node2D`プレースホルダーとして機能します。
- **ワールドモデリング** — 垂直層（ゾーンごとの`z_index`バインディング + `StratumLink`コネクタ）、型付きの危険要素を`Area2D`領域として、およびゾーンエントリーゲートメタデータ。
- **忠実度レポート** — 損失なし、近似、およびドロップされたデータを構造的に追跡し、実際のGodot 4エンジンに対して検証します（ヘッドレススモーク、36のアサーション）。
- **プレゼンテーションアドバイス** — 作成された`presentation`ブロックは変更されずに保持され、そのアドバイスは`warnings[]`に適用されるため、描画/シミュレーションの不一致は、画面上で予期せぬ事態が発生するのではなく、エクスポート時の問題として検出されます。
- **フォーマットバージョン** — `GODOT_PACK_FORMAT_VERSION` 1.1.0（`files`、`zoneGates`、`migrateGodotPack`）

### @world-forge/export-ai-rpg

`WorldProject`を、ai-rpg-engineの`ContentPack`形式に変換します。

- **エクスポート** — ゾーン、地区、エンティティ、アイテム、ダイアログ、プレイヤーテンプレート、ビルドカタログ、プログレッションツリー、遭遇イベント（World Forgeの遭遇イベントタイプをエンジンの4つのタイプに変換）、派閥、ホットスポット、マニフェスト、およびパックメタデータ
- **インポート** — 8つの逆変換ツールが、エクスポートされたJSONからWorldProjectを再構築します。CLI `--import` / `--from-pack` は、`world-project.json`（または標準出力）に書き込みます。
- **忠実度レポート** — 変換中に失われなかったもの、近似されたもの、または削除されたものを構造的に追跡します。`--out` は、パックの横に `fidelity.json` を書き込みます。
- **フォーマット検出** — WorldProject、ExportResult、ContentPack、およびProjectBundle フォーマットを自動的に検出します。
- **CLI** — `world-forge-export`、`--out`、`--import`、`--from-pack`、`--validate-only`、`--dry-run`、および`--verbose` を使用します。

### @world-forge/renderer-2d

PixiJSベースの2Dレンダラー：パン/ズームを備えたビューポート、地区の色分けによるゾーンオーバーレイ、接続矢印、役割ごとのエンティティアイコン、タイルレイヤー、およびミニマップ。

World Forgeのデータを独自のPixiJSアプリに組み込む外部のユーザー向けに公開された、独立したレンダラー。 **エディターはこれを使用しません**。エディターのキャンバスは、直接的なCanvas2Dの実装であるため、以下に示すエディターに関するミニマップやビューポートの機能は、このパッケージではなく、エディター自体のものであり、独立して機能します。

### @world-forge/editor

Zustandによる状態管理、アクションラベルによるアンドゥ/リドゥ、自動保存（30秒間隔、3バージョンの履歴、クラッシュからの復旧）、すべてのプロジェクト読み込みパスにおけるダーティ状態ガード、ダーク/ライトテーマの切り替え、モーダルフォーカストラップ、キーボード操作によるツール切り替えを備えた、React 19 + ViteのWebアプリケーション。

#### ワークスペースタブ

| タブ | 目的 |
|-----|---------|
| マップ | 2Dキャンバス上でのゾーン/エンティティ/地区の編集 |
| プレイヤー | ステータス、インベントリ、装備、スポーンを備えたプレイヤーテンプレート |
| ビルド | アーキタイプ、背景、特性、専門分野、コンボ |
| ツリー | 要件と効果を備えた進行ノード |
| ダイアログ | ノードの編集、選択肢のリンク、不正参照の検出 |
| オブジェクト | 階層的なツリー：地区 → ゾーン → エンティティ/ランドマーク/スポーン |
| プリセット | マージ/上書き機能を備えた、地域および遭遇プリセットブラウザ |
| アセット | 種類でフィルタリングされた検索、孤立したアセットの検出、アセットパックを備えたアセットライブラリ |
| 問題 | クリックしてフォーカスするナビゲーションを備えた、ライブグループ化された検証 |
| 依存関係 | インラインの修正ボタンを備えた依存関係スキャナー |
| レビュー | 健全性ダッシュボード、コンテンツ概要、要約エクスポート |
| ガイド | 初回起動時のチェックリストとホットキーリファレンス（閉じるまで表示） |
| インポート | 最後のインポートに関する信頼性レポート（インポート後に表示） |
| 差分 | インポートされたスナップショットとの意味的な差分（インポート後に表示） |

#### キャンバスと編集

- **ツール** — 10種類のツール：選択、ゾーンペイント、接続、エンティティ配置、ランドマーク、スポーン、タイルペイント、プロップ配置、遭遇配置、アイテム配置
- **複数選択** — シフトクリック、ボックス選択、Ctrl+A；アトミックなアンドゥによるドラッグ移動
- **配置** — 6方向配置（左/右/上/下/中央-水平/中央-垂直）および水平/垂直方向の配置
- **スナップ** — 視覚的なガイドラインを使用して、ドラッグ中に近くのオブジェクトのエッジ/中央にスナップ
- **サイズ変更** — 各ゾーンに8つのハンドルがあり、エッジスナップ、最小サイズ制限、ライブプレビューが可能
- **複製** — Ctrl+Dで、ID、接続、地区割り当てを再マッピング
- **コピー/ペースト** — Ctrl+C / Ctrl+Vで、IDを再マッピングし、構成可能なオフセットを設定
- **クリックサイクル** — 同じ位置を繰り返しクリックすると、重なり合ったオブジェクトが順番に表示される
- **コンテキストメニュー** — 右クリックすると、7つのコンテキストに依存したアクションが表示される（プロパティの編集は、マップタブに切り替わり、選択したオブジェクト（エンティティを含む）の右側のサイドバーを展開し、削除、複製など）
- **接続プレビュー** — 接続ツールの配置中に、破線のシアン色の線が表示される
- **ミニマップ** — 200×150の概要（右下）、クリックするとジャンプ
- **ビューポートカリング** — 視認可能な範囲内のオブジェクトのみをレンダリングする（64ピクセルのマージン）
- **パフォーマンス統計** — FPS/オブジェクト数/レンダリング時間のオーバーレイを切り替える
- **オブジェクトごとの表示/非表示** — 個々のオブジェクトを表示/非表示にする（localStorageに保存）
- **レイヤー** — 表示/非表示の切り替え（グリッド、接続、エンティティ、ランドマーク、スポーン、背景、タイル、プロップ、環境光、標高；アイテムはアイテムレイヤーでヒットテストを行う）、さらにミニマップ、オブジェクトへのスナップ、パフォーマンス統計、レンダラー診断の切り替え

#### ナビゲーションとショートカット

- **ビューポート** — カメラのパン/ズーム、マウスホイールによるズーム（カーソルを基準）、スペースキー／マウスの中ボタン／右クリックによるドラッグによるパン、キャンバスが最初にゾーンを含むプロジェクトを開いたとき（および「スピードパネル」の「コンテンツに合わせる」機能から必要に応じて）に、コンテンツに合わせて表示、ダブルクリックで中央に表示。
- **検索** — Ctrl+K を押すと、オーバーレイが表示され、あいまい検索、キーボード操作、および最近の検索履歴を使用して、名前またはIDで任意のオブジェクトを検索できます（localStorage）。
- **スピードパネル** — ポインターをキャンバス上に移動させた状態で（またはキャンバスにフォーカスし、選択または中央に固定した状態で）、`Q`（オプションで設定可能）キーを押すか、ダブル右クリックすると、その場で表示されるコンパクトメニューが拡張され、フローティングコマンドパレットに変わります。このパレットには、ポインターの下に2つ以上のオブジェクトがある場合に、ターゲットが重なり合うように表示されるスコープチップが含まれます（空の検索欄での`Tab`/`Shift+Tab`、フォーカスされたチップでの`ArrowLeft`/`ArrowRight`、またはクリック。最後に`Canvas`が表示され、閉じる際または`Esc`で非変更のキャンバスハイライト枠がクリアされ、丁寧なライブリージョン通知が行われます）。パレットが開くと固定された4バンド構成のレイアウトになり、ターゲットに問題がある場合はバンド1の上にオブジェクトごとのオプションの**クイックフィックス**行が視覚的に表示されます（ハイライトは引き続きバンド1のスロット1から開始されるため、開いた直後の`Enter`でスロット1が実行され、`ArrowDown`の順序は変更されず、`Alt+1`～`Alt+5`は移動しません。クイックフィックスには、スロット1から`ArrowUp`キーを押すか、クリックすることでアクセスできます。また、ヒットタイプごとに固定されたコンテキストデッキ、コピー可能な並べ替え可能なピンとマクロ、切り替え可能な最近使用した機能、固定されたカタロググループが含まれます）。RPGの類義語、頭文字、タイプミスへの対応、文字のハイライト表示、説明付きの`"Unavailable here"`アクション、ライブホットキーまたはエディターの場所を示すバッジ、インラインの複数ステップピッカー（`Quick Fix`は、プロジェクトの状態ごとにキャッシュされた修復と、「問題/依存関係/レビューで表示」ナビゲーション、`Assign District`はインラインの`+ Create District`でフィルターテキストを保持、`Apply Preset`は`Merge`/`Overwrite`、そして`Place Encounter Here`はライブAI RPGエクスポートとの互換性を示すバッジを含みます。空のフィルターまたは入力ステップの場合は、前の状態に戻ります（`Backspace`））、`Tab`でアクティブ化されるインラインのスカラー値編集（`Set Elevation`用）、キャンバスに委譲された空間ピッキング（`Connect From Here`、`Tab`でタイプを切り替え、`Shift+Click`でターゲットをチェーン化、単一ゾーンの`Merge Zones`で、`Shift+Click`による複数選択と画面外ゾーン名の検索、そして`Esc`でキャンセルし、以前の選択をそのまま保持）、説明的なラベル付きの単一エントリのアトミックアンドゥ、最大8つのセッション内で再生可能なステップから「最近のアクションからマクロを作成…」を実行し、アトミックな単一アンドゥマクロを実行し、インラインで不足している参照を置き換えるプロンプトを表示、そして「ここで最後の操作を繰り返す」機能が含まれます。
- **ホットキー** — ツール切り替え（V/Z/C/E/L/S/T/O/N/I）、Enter（マップタブでプロパティを開き、右側のサイドバーを展開）、P（プリセットを適用）、Shift+P（プリセットを保存）、Ctrl+C/V（コピー/ペースト）、矢印キーによる微調整（Shift＝5倍）など、合計29個のキーボードショートカット。
- **アクセシビリティ** — Escキーで閉じる機能を持つモーダルウィンドウ、すべてのアイコンのみのボタンにARIAラベルを付与、キーボードで操作可能なオブジェクトツリー、スクリーンリーダーで読み上げられる変更表示機能。空間キャンバスの操作（配置、ボックス選択、サイズ変更、接続線の描画、パン）は引き続きポインターベースで行われる。

#### インポートとエクスポート

- **ContentPack** — ターゲットを認識したAI RPG Engine、Unreal Engine 5、またはGodot 4へのエクスポート。ターゲットごとの準備状況バッジ、設定可能なオプション（タイルサイズ、シーンのプレフィックス、バンドルフィルタリング）、およびダウンロード後のレシート
- **プロジェクトバンドル** — プロベナンスメタデータと依存関係情報を含む、移植可能な`.wfproject.json`ファイル
- **キットバンドル** — `.wfkit.json`のエクスポート/インポート、検証、コリジョン処理、およびプロベナンス追跡
- **インポート** — 構造化された忠実度レポートを備えた4つの形式を自動検出
- **差分** — インポート以降のセマンティックな変更の追跡
- **シーンプレビュー** — すべてのゾーンの視覚的バインディングのインラインHTML/CSSコンポジション

## オーサリングモード

World Forgeは、**ジャンル**（ファンタジー、サイバーパンク、海賊）と**モード**（ダンジョン、海洋、宇宙）を分離します。ジャンルは風味であり、モードは規模です。モードは、グリッドのデフォルト、接続の語彙、検証の提案、ガイドの文言、およびプリセットのフィルタリングを制御します。

| モード | グリッド | タイル | 主要な接続 |
|------|------|------|-----------------|
| ダンジョン | 30×25 | 32 | ドア、階段、通路、秘密の場所、危険 |
| 地区/都市 | 50×40 | 32 | 道路、ドア、通路、ポータル |
| 地域/世界 | 80×60 | 48 | 道路、ポータル、通路 |
| 海洋/海 | 60×50 | 48 | 水路、ルート、ポータル、危険 |
| 宇宙 | 100×80 | 64 | ドッキング、ワープ、通路、ポータル |
| インテリア | 20×15 | 24 | ドア、階段、通路、秘密の場所 |
| 荒野 | 60×50 | 48 | 小道、道路、通路、危険 |

モードは、プロジェクトの作成時に設定され、`WorldProject`に`mode?: AuthoringMode`として保存されます。各モードは**スマートなデフォルト**を提供します。接続の種類、エンティティの役割、ゾーン名、およびスピードパネルの提案は自動的に調整されます。

## オーサリングサーフェス

### ワールド構造

- 空間的なレイアウト、隣接するエリア、出口、光、騒音、危険、インタラクション可能なオブジェクトを持つゾーン
- 12種類の接続タイプ（通路、ドア、階段、道、ポータル、秘密の通路、危険、チャネル、ルート、ドッキング、ワープ、トレイル）。それぞれ異なる視覚的なスタイル、エッジに固定されたルーティング、方向を示す矢印、条件付きの点線スタイルを持つ。
- 勢力による支配、経済プロファイル、メトリクススライダー、タグ、ゾーンの中心に配置された地区名ラベルを持つ地区。
- ランドマーク（ゾーン内の名前付きの興味深い場所）。
- スポーンポイント、エンカウンターアンカー（タイプに基づいた色の指定）、勢力の存在、プレッシャーホットスポット。
- **垂直層** - 離散的なレイヤー（表面/地下/空、または建物の階）。符号付きの順序、Z範囲、層間の可視性、コネクター（階段/はしご/エレベーター）を持つ。ゾーンは層に割り当てられる。
- **タイプ指定された環境の危険** - 共有の危険ライブラリ（ダメージ/ステータス/即死/発火効果、トリガータイミング、地形の移動コスト、通過可能性、視界の遮断、天候の制御）。ゾーンごとに参照される。
- **ゾーンエントリーパーティーゲート** - パーティーの状態（レベル/人数/アイテム/フラグ/メンバー/クラス）に基づいてゲートエントリーを制御する。ハードまたはアドバイザリーゲートとして機能し、「ロックを表示する」理由が設定されている。
- **プレゼンテーション占有** - 2.5Dクライアントの場合：タイルフットプリントとスパンを持つ等角投影ビュー、アンカーセル、オプションのフロアプレート（ゾーンごと）、およびアクター（プレイヤーを含む）ごとの占有行（キャラクターパック、ゾーン、セル、向き）。

### コンテンツ

- ステータス、リソース、AIプロファイル、カスタムメタデータを持つエンティティの配置。
- スロット、レア度、ステータス修正、付与されるアクションを持つアイテムの配置。
- 分岐する会話、条件、効果を持つダイアログツリー。
- キャンバス上のエンカウンターアンカー - 赤いダイヤモンド型のマーカーで、ボス/待ち伏せ/パトロールのタイプを示す。

### 町と内部

- タイルペイント - 画像を背景にしたタイルセット（行/列でスライス）。色のついた長方形のフォールバック、ドラッグブラシ、レイヤー、および壁の衝突用のタイルごとの「Solid」の歩行可能性を持つ。
- インテリア用のプロップ配置（パレット+キャンバスレンダリング）、配置ツール付き。
- 町の経済 - 市場ノード（供給カテゴリ、価格修正、違法品）、およびクラフトステーション（ステーションタイプ、レシピ）。ゾーンごとに編集可能。
- 町の構造 - 建物（インテリアゾーンへのリンクを持つ、アクセス可能なフットプリント）、ハブ（サービス+接続ノード）、および要塞（要塞化された勢力の拠点）。

### キャラクターシステム

- プレイヤーテンプレート（開始ステータス、インベントリ、装備、スポーンポイント）。
- ビルドカタログ（アーキタイプ、背景、特性、専門分野、クロスタイトル、関係性）。
- プログレッションツリー（要件と効果を持つスキル/アビリティノード）。

### アセット

- アセットマニフェスト（ポートレート、スプライト、背景、アイコン、タイルセット）。種類ごとにバインディングを設定。
- アセットパック（名前付き、バージョン管理されたグループ。互換性のメタデータ、テーマ、ライセンスを含む）。
- シーンプレビュー（すべてのゾーンの視覚的なバインディングをインラインで構成。アセットの欠落を検出）。

### ワークフロー

- リージョンプリセット（9種類の内蔵プリセット、モードでフィルタリング）、エンカウンタープリセット（10種類の内蔵プリセット）。マージ/上書きの適用、カスタムプリセットの作成/読み取り/更新/削除（CRUD）が可能。
- スターターキット（7種類の内蔵プリセット、モード固有）。キットのエクスポート/インポート（`.wfkit.json`）、オプションのスピードパネルピン＆マクロプリセット（`speedPanelPresets`）。既存のユーザープリセットを上書きせずにマージ。衝突処理、および出所の追跡。
- スピードパネルからのゾーンマージ（インタラクティブなキャンバスゾーンの選択を含む。選択されているゾーンが2つ未満の場合）。
- レイアウトテンプレート、ダイアログテンプレート、およびバッチエンティティ配置（グリッド/ランダム/円）。これらはコードに存在し、エディターUIからはまだアクセスできない。
- 30秒間隔で自動保存。3バージョンの復元履歴。
- Ctrl+Kで、あいまい一致と最近の履歴を使用して、すべてのオブジェクトタイプを検索。
- スピードパネルコマンドパレット。オーバーラップするターゲットスコープチップ（空の検索時に`Tab`/`Shift+Tab`、キャンバスの非変更ハイライト、および丁寧なライブリージョンアナウンスメント）。固定コンテキストデッキ（および、ヒットしたオブジェクトに問題がある場合に表示されるコンテキストに応じた**クイックフィックス**行）。コピー可能な再配置可能なお気に入り。切り替え可能な指数減衰型の最近使用アイテム。固定カタロググループ。階層化されたRPGの同義語/スペルミス検索。ライブキーバインディングバッジ。パラメータ化された最近のアクションマクロ（`Create Macro from Recent Actions…`、アトミックな単一の元に戻しと、IDの欠落に対するプロンプト）。カスタムグループ。モードの提案。インラインの複数ステップと`Tab`ピル入力。オフスクリーンゾーンフィルターと`Tab`の接続タイプのサイクルを持つ、キャンバスの空間的な選択。AI RPGのエクスポートに関するアドバイス。説明的なアトミックな元に戻し。**ここで最後の操作を繰り返す**（`wf.speedPanel.v2`）。
- 29種類の集中型キーボードショートカット（10種類のツール切り替えキーを含む）。
- プロジェクトメタデータエディター（作成者、ライセンス、カテゴリ、タグ）。
- 統計の確認（役割の分布、接続タイプ、エンカウンタータイプ、地区ごとのゾーン）。
- ContentPack JSON、プロジェクトバンドル、およびレビューサマリーへのエクスポート。
- 構造化された忠実度レポート、修正の提案、およびセマンティック差分追跡を備えた、4つの形式からのインポート。

現在の表面を証明する、Chapel Thresholdのエクスポートハンドシェイクについては、[`dogfood/WALKTHROUGH.md`](dogfood/WALKTHROUGH.md)を参照してください。

## Dogfoodディレクトリ

`dogfood/`ディレクトリには、ユニットテスト外で、完全な作成からエクスポートへのパイプラインをテストする統合テストハーネスが含まれています。Chapel Thresholdの例（`chapel-threshold.ts`）は、小さくても完全なワールドプロジェクトを構築し、エクスポートを実行し、出力を`dogfood/output/`に書き込みます。これにより、スキーマタイプ、検証、およびエクスポートパイプラインが、実際のデータでエンドツーエンドで機能することが証明されます。単なる分離されたモックではありません。

## エンジン互換性

エクスポートは、次の3つのエンジンをターゲットとしています。

- **[ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine)** - ContentPack形式：エクスポートされたパックをロードし、ワールドを実行する決定論的なシミュレーションランタイム。
- **Unreal Engine 5** - 2.5Dを意識したコンテンツパック。プライマリデータアセット、アクターのスポーンマニフェスト、およびワールドパーティションのヒントを含む。
- **Godot 4** - `.tscn`シーン生成。ゾーンリソース、ナビゲーションリンク、およびエンティティマニフェストを含む。

### Forge→Engineのコンテンツ契約

エクスポーターが動作することと、ワールドが起動することは同じではありません。v4.6.0 は AI RPG Engine レーンにおけるそのギャップを解消し、さらに有用なことに、残りのギャップを仮定ではなく数値にします。

- **計測されたエクスポートテーブル**（`docs/c0-alignment/`） - リーフパスの差分計算により、作成されたすべてのフィールドをたどり、実際に実行時に到達するものを記録します。これは、すべてのテスト実行で生成、チェックイン、検証されるため、「エクスポートで残ったもの」は、単なる主張ではなく、監査可能です。
- **誠実なマニフェスト** - 出力されるパックには、実際のエンジンのセマンティックバージョン範囲、実際のモジュール ID、コンテンツハッシュ、およびコンパイルされた出口条件が含まれます。モジュール ID は実際のコンテンツに基づいて制限され、クラフトステーションがないパックはクラフトモジュールを要求しなくなります。
- **空間語彙の交差** - エンティティごとの配置、コンパイルされたスポーン条件、型付きの危険性、エントリーゲート、シーン記述子は、スキーマだけでなく、エンジンのコンテンツパックに到達します。
- **忠実度のレポートは契約を守ります**。各パスは、ロスレスでエクスポートされたもの、近似されたもの、または削除されたものを報告します。フィールドが移行できない場合、エクスポートはそのことを明示します。静かに成功することはありません。
- **レジストリサンプルゲート**（`packages/editor/src/__tests__/sample-gate.test.ts`） - `SAMPLE_WORLDS`、`BUILTIN_KITS`、`GENRE_TEMPLATES`、および`MODE_STARTERS`からすべてのエントリを動的にロードし、ストアのロード、`validateProject()`、AI RPGエクスポートがゼロのエンカウンターブロッカー（`exportToEngine` + `listAiRpgEncounterBlockers`）、完全な`@ai-rpg-engine/content-schema`検証（`validateGameContent`および`loadContent`）、およびUnreal Engine 5（`exportToUnreal`）とGodot 4（`exportToGodot`）のエクスポートが成功したことを確認します。
- **AI RPGエクスポートにおけるエンカウンタータイプの変換** - AI RPGエクスポートツールのみが、World Forgeの作成されたエンカウンタータイプを`@ai-rpg-engine/content-schema`の4つのタイプ（`ambush`、`patrol`、`horde`、`duel`）に変換し、`worldforge-type:<original>`を`tags[]`に保持し、`approximated`の忠実度エントリ（`encounter-type-translated`）を記録し、`hazard`と`discovery`のアンカーをパックから除外し、`dropped`の忠実度エントリ（`encounter-type-dropped`）を記録し、それでもマップされていないカスタム文字列を名前で拒否します。

| World Forge `encounterType` | AI RPG `ContentPack` 出力 | 忠実度とタグ |
|---|---|---|
| `boss` | `duel` | `approximated`, `worldforge-type:boss` |
| `beast`, `haunt`, `caravan-raid` | `ambush` | `approximated`, `worldforge-type:<original>` |
| `pirate` | `patrol` | `approximated`, `worldforge-type:pirate` |
| `boarding`, `brawl` | `horde` | `approximated`, `worldforge-type:<original>` |
| `hazard`, `discovery` | `ContentPack.encounterAnchors`から省略 | `dropped` |
| `ambush`, `patrol`, `horde`, `duel` | 変更なし | 変更なし、忠実度エントリなし |
| その他のカスタム文字列 | 拒否（`exportToEngine`は`listAiRpgEncounterBlockers`とともに`success: false`を返し、CLIの終了コードは1） | ブロック |

- **AI RPGエクスポートにおけるダイアログ話者ID** - `@world-forge/export-ai-rpg`は、解決できない`dialogues[].speakers`のエントリを名前で示して拒否し（`exportToEngine`は`listAiRpgDialogueSpeakerBlockers`とともに、`speakerBlockers`を含む`success: false`を返し、エクスポートモーダルはブロックされ、CLIは`1`で終了します）、ダイアログIDと解決できない話者の両方を示します。`speaker: ''`のノードは、そのダイアログを持つすべてのエンティティ（`dialogueId`）がその記載された話者である場合、またはどのエンティティもそのダイアログを持たない場合にのみ、ダイアログに記載された唯一の話者で補完されます。そのダイアログを持つエンティティのいずれかが別のエンティティである場合は、ダイアログID、ノードID、およびそのエンティティのIDを示して拒否され、`dialogues[].speakers`のエントリが0個または複数の場合は、ダイアログIDとノードIDを示して拒否されます。空でないノードの話者は、変更されずにエクスポートされます。

`ai-rpg-engine` `^4.0.0`が必要です。

**AI RPG Engine 4.0.0に対する既知のギャップ**（2026年11月25日のブートテストに基づく）。このリリースのChapel Thresholdサンプルのエクスポートは、公開されたエンジンにロードされ、そのゾーン間を移動できます。これらの部分はまだプレイに到達していません。

- **ゲート付きの出口**。エンジンは`zones[].neighbors`に沿ってのみ移動します。パックをロードするときに`zones[].exits`とパックの`connections`を破棄するため、ゲート付きの出口経由でしか到達できないゾーンには入れません。サンプルでは、地下聖堂（クリプト）とその内部のエンカウンターがこれに該当します。
- **カスタムの挙動プロファイル**。AI RPG Engine 4.0 の `validate` と `sidecar` は、既定で知らない `aiProfile` を拒否します（`--unresolved-ai-profile fail`）。これはエンジン 4.0 の CLI の仕様によるもので、組み込みプロファイルだけを使ったブートテストの結果ではありません。このエクスポーターはすべての役割に組み込みプロファイルを書き込むため、そのエクスポートは読み込まれます。カスタムの `ai.profileId` を与えたエンティティには、そのプロファイルを登録するホストか、`--unresolved-ai-profile warn` が必要です。
- **サイドカー経由のダイアログ**。エンジンのサイドカーは、パックを読み込むときにダイアログを破棄します。ブートテストでは、エンジンのインプロセス JSON ブートレシピで、ロードゲートを無効にしたときにだけ動作しました。ゲートを有効にすると、レシピはパックを拒否しました。マニフェストにレシピが登録しないモジュールが含まれ、プレイヤーを追加したことでコンテンツハッシュが変わったためです。
- **その他のパックデータ**。エンジンは、パックをロードするときにこれらを破棄し、それぞれの名前と理由を示します：ゾーンの説明と危険要素、派閥の存在、圧力ホットスポット、スポーンポイント、プレイヤーテンプレート、戦利品テーブル、ランドマーク、層と層のリンク、トランジション、クラフトステーション、マーケットノード、建物、ハブ、拠点、ビルドカタログ、および進行ツリー。

### 描画契約

ワールドは、クライアントがどのように描画すべきかを指定することもできます。`WorldProject.presentation`はオプションであり、追加されます。ほとんどのワールドにはそれがないため、それがないためにペナルティを受けることはありません。これには、等角投影ビュー、タイルのフットプリント、ゾーンアンカーセル、ゾーンごとのフロアプレート、およびアクターごとの1つの占有行が含まれます。

これは、2.5Dワールドが同時に3つのグリッドで記述され、エクスポートがそれらのうちの**どれも**変換しないためです。

| グリッド | ユニット | 所有者 | ハッシュ化 |
|---|---|---|---|
| シミュレーション占有 | ゾーンID | エンジンの`WorldState` | はい - 権威 |
| 等角セル | 256x128のダイヤモンド、3つの範囲 | クライアントのビュー、`presentation`経由 | 決して |
| Forgeの直交座標 | `gridX` / `gridY` | エディターとGodotの`.tscn` | 決して |

等角セルは、`gridX`/`gridY`から派生することはありません。サンドボックススケールは、名前でブロックをスキップするため、絶対的なダイヤモンドセルは誤って乗算されることはありません。シミュレーションは、常に人がどの部屋にいるかについて、最終的な決定権を持ちます。`presentationAdvisories()`はそれを声に出して言います。`exportToGodot`はそれを`warnings[]`に報告し、ステージフィクスチャレーンは、`--strict`を使用して致命的なものにすることができます。

ブロックは、Godotステージフィクスチャの`pack.json`上で移動します。それは、`export-ai-rpg`レーンを移動しません。エンジンの`ContentPack`には追加のスロットがなく、ローダーは厳密です。計測されたエクスポートテーブルは、そこで削除されたことを報告し、それ以外に解釈することはありません。

## セキュリティ

- **アクセスされたデータ:** ローカルディスク上のプロジェクトファイル（ユーザーが作成したJSON）、サーバー側のストレージなし
- **アクセスされていないデータ:** テレメトリ、分析、ローカル開発サーバーを超えたネットワークリクエストなし
- **権限:** APIキー、秘密鍵、認証情報なし
- **ソースコードに秘密鍵、トークン、または認証情報は含まれていません**

## ライセンス

MIT

---

[MCP Tool Shop](https://mcp-tool-shop.github.io/)によって作成
