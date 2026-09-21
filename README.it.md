<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.md">English</a> | <a href="README.pt-BR.md">Português (BR)</a>
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

## Architettura

```
packages/
  schema/          @world-forge/schema         — spatial types, validation, 2.5D fields
  export-ai-rpg/   @world-forge/export-ai-rpg  — AI RPG Engine export pipeline + CLI
  export-unreal/   @world-forge/export-unreal  — Unreal Engine 5 export pipeline + CLI (2.5D aware)
  export-godot/    @world-forge/export-godot   — Godot 4 export pipeline + .tscn scene generation
  renderer-2d/     @world-forge/renderer-2d    — PixiJS 2D canvas renderer
  editor/          @world-forge/editor         — React web authoring app
```

## Guida rapida

```bash
npm install
npm run build
npm run dev --workspace=packages/editor
```

Apri `http://localhost:5173` per avviare l'editor.

### Flusso di lavoro dell'editor

1. **Scegli una modalità** (dungeon, distretto, mondo, oceano, spazio, interno o ambiente selvaggio) per impostare le impostazioni predefinite della griglia e il vocabolario delle connessioni.
2. **Inizia con un kit:** scegli un kit iniziale o un modello di genere dal Template Manager, oppure inizia con un progetto vuoto.
3. **Dipingi le zone:** trascina sul canvas per creare zone, connetterle e assegnare i distretti.
4. **Posiziona le entità:** trascina PNG, nemici, mercanti, incontri e oggetti sulle zone.
5. **Verifica:** apri la scheda "Verifica" per lo stato di salute, la panoramica dei contenuti e l'esportazione riepilogativa (Markdown/JSON).
6. **Esporta:** apri la finestra modale "Esporta" per visualizzare lo stato di preparazione per ogni destinazione (✓ Pronto / ⚠ avvisi), configura le opzioni di destinazione, quindi scarica i pacchetti AI RPG Engine, UE5 o Godot 4. Le ricevute post-esportazione vengono aggregate in base alle dimensioni, al numero e ai dettagli di fedeltà. Inoltre: pacchetti di progetto (.wfproject.json) e riepiloghi di verifica.

### Esportazione da riga di comando (CLI)

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

## Pacchetti

### @world-forge/schema

Tipi TypeScript principali e validazione per la creazione di mondi.

- **Tipi spaziali:** `WorldMap`, `Zone`, `ZoneConnection`, `District`, `Landmark`, `SpawnPoint`, `EncounterAnchor`, `FactionPresence`, `PressureHotspot`
- **Tipi di contenuto:** `EntityPlacement`, `ItemPlacement`, `DialogueDefinition`, `PlayerTemplate`, `BuildCatalogDefinition`, `ProgressionTreeDefinition`
- **Livelli visivi:** `AssetEntry`, `AssetPack`, `Tileset`, `TileLayer`, `PropDefinition`, `PropPlacement`, `AmbientLayer`
- **Città + strutture:** `MarketNode`, `CraftingStation`, `Building`, `Hub`, `Stronghold`
- **Modellazione del mondo:** `Stratum` + `StratumLink` (livelli verticali), `HazardDefinition` (unione di effetti tipizzati), `ZoneEntryGate` + operandi dello stato della squadra `SpawnCondition` (`party-level`, `party-size`, `item`, `flag`, `member`, `class`)
- **Sistema di modalità:** `AuthoringMode` (7 modalità), profili specifici per la modalità per griglia/connessione/validazione
- **Presentazione:** `WorldPresentation` opzionale su `WorldProject`: vista dimetrica, impronta delle tessere, celle di ancoraggio delle zone, piastre del pavimento e una riga di occupazione per ogni personaggio. `presentationAdvisories()` esegue otto regole di controllo su di essa, inclusa quella più importante: una persona disegnata in una stanza, nella simulazione, viene posizionata all'esterno.
- **Validazione:** `validateProject()` (89 controlli strutturali con ricerche O(n) basate su mappa, `warningCount`), `advisoryValidation()` (suggerimenti specifici per la modalità, completezza dei metadati, denominazione delle risorse). La versione 4.0 JSON che omette gli array richiesti in seguito viene accettata dopo `normalizeProjectShape()` / `stampProjectSchemaVersion()`.
- **Unioni chiuse:** `VALID_CONNECTION_KINDS`, `VALID_ASSET_KINDS`, `VALID_ENTITY_ROLES`, `VALID_ITEM_SLOTS` e il resto dei set `VALID_*` vengono esportati da `@world-forge/schema`.
- **Utilità:** `assembleSceneData()` (collegamenti visivi con rilevamento di risorse mancanti), `scanDependencies()` (analisi del grafico di riferimento), `buildReviewSnapshot()` (classificazione dello stato di salute)

### @world-forge/export-unreal

Converte un `WorldProject` in un pacchetto di contenuti Unreal Engine 5 ottimizzato per giochi 2.5D.

- **Output:** `pack.json`, JSON delle risorse dati primarie per zona e per distretto, manifesto di generazione di attori raggruppati, suggerimenti per lo streaming di livelli per connessione, suggerimenti per le celle di World Partition e un rapporto di fedeltà strutturato.
- **Campi 2.5D:** `Zone.elevation`, `elevationRange`, `parallaxLayers`, `skylineRef` vengono preservati e convertiti in coordinate UE cm / Z-up.
- **Trasformazione delle coordinate:** funzioni pure (`pixelsToUnrealCm`, `elevationToZ`, `worldForgeToUnrealAxis`, `gridToUnrealAxis`). La scala del mondo predefinita è 1 tessera = 100 cm.
- **Importazione a ciclo completo:** `importFromUnreal` ricostruisce un WorldProject da un pacchetto Unreal; i dati solo di gioco (dialoghi, progressione, build) vengono contrassegnati come eliminati nel rapporto di fedeltà.
- **CLI:** `world-forge-export-unreal` con `--out`, `--tile-size-cm`, `--validate-only`, `--verbose`.

### @world-forge/export-godot

Converte un `WorldProject` in un pacchetto di contenuti Godot 4 con testo della scena `.tscn`.

- **Output:** una directory principale del progetto Godot 4: `project.godot`, `world.tscn` (ExtResource `.tres`), texture copiate in `assets/`, `scripts/player.gd`, più `pack.json` e `fidelity.json`
- **CLI:** `world-forge-export-godot` con `--out`, `--validate-only`, `--include-world-tscn` / `--no-world-tscn`
- **Scena giocabile:** `buildWorldScene()` emette una scena `.tscn` navigabile: collisione per zona `StaticBody2D` + `NavigationRegion2D`, un `Camera2D` incorniciato, un personaggio giocatore `CharacterBody2D` e ordinamento y / profondità `z_index`
- **Tessere + interni:** `TileMapLayer` + `TileSet` (texture `tile_map_data` precalcolate per set di tessere di immagini), collisione delle pareti per cella `StaticBody2D` e posizionamenti di oggetti di scena `Node2D`
- **Città:** mercati + stazioni di creazione e edifici (impronte `StaticBody2D`) / hub / roccaforti come segnaposto `Node2D`, tutti con i loro dati come metadati
- **Modellazione del mondo:** strati verticali (banding per zona `z_index` + connettori `StratumLink`), pericoli tipizzati come regioni `Area2D` e metadati di ingresso della zona
- **Rapporto di fedeltà:** tracciamento strutturato di dati senza perdita di informazioni, dati approssimati e dati eliminati, verificati rispetto al motore Godot 4 reale (simulazione headless, 36 asserzioni)
- **Avvisi di presentazione:** un blocco `presentation` creato viene trasmesso intatto e i suoi avvisi vengono visualizzati su `warnings[]`, quindi una discrepanza tra disegno e simulazione è un risultato dell'esportazione piuttosto che una sorpresa sullo schermo.
- **Versione del formato:** `GODOT_PACK_FORMAT_VERSION` 1.1.0 (`files`, `zoneGates`, `migrateGodotPack`)

### @world-forge/export-ai-rpg

Converte un `WorldProject` nel formato `ContentPack` di ai-rpg-engine.

- **Esportazione** — zone, distretti, entità, oggetti, dialoghi, modello giocatore, catalogo di costruzione, alberi di progressione, incontri, fazioni, punti caldi, manifesto e metadati del pacchetto
- **Importazione** — 8 convertitori inversi ricostruiscono un WorldProject dai dati JSON esportati; CLI `--import` / `--from-pack` scrive `world-project.json` (o stdout)
- **Report sulla fedeltà** — tracciamento strutturato di ciò che è stato senza perdita, approssimato o eliminato durante la conversione; `--out` scrive `fidelity.json` accanto al pacchetto
- **Rilevamento del formato** — rileva automaticamente i formati WorldProject, ExportResult, ContentPack e ProjectBundle
- **CLI** — `world-forge-export` con `--out`, `--import`, `--from-pack`, `--validate-only`, `--dry-run` e `--verbose`

### @world-forge/renderer-2d

Renderer 2D basato su PixiJS: viewport con panoramica/zoom, sovrapposizioni di zona con colorazione dei distretti, frecce di connessione, icone di entità per ruolo, livelli di tessere e una minimappa.

Un renderer autonomo pubblicato per i consumatori esterni che incorporano i dati di World Forge nella propria app PixiJS. **L'editor non lo utilizza:** il canvas dell'editor è un'implementazione diretta di Canvas2D, quindi le funzionalità di minimappa e viewport elencate di seguito nell'editor sono proprie, non di questo pacchetto.

### @world-forge/editor

App Web React 19 + Vite con gestione dello stato di Zustand, annulla/ripeti con etichette di azione, salvataggio automatico (intervallo di 30 secondi, cronologia di 3 versioni, ripristino in caso di arresto anomalo), protezioni dello stato "sporco" su tutti i percorsi di caricamento del progetto, interruttore del tema chiaro/scuro, trappole di messa a fuoco modale e commutazione degli strumenti basata sulla tastiera.

#### Schede dell'area di lavoro

| Scheda | Scopo |
|-----|---------|
| Mappa | Modifica di zone, entità e distretti sul canvas 2D |
| Oggetti | Albero gerarchico: distretti → zone → entità/punti di riferimento/punti di generazione |
| Giocatore | Modello del giocatore con statistiche, inventario, equipaggiamento, punto di generazione |
| Build | Archetipi, background, tratti, discipline, combo |
| Alberi | Nodi di avanzamento con requisiti ed effetti |
| Dialogo | Modifica dei nodi, collegamento delle scelte, rilevamento di riferimenti interrotti |
| Preset | Browser di preset per regioni e incontri con opzioni di unione/sovrascrittura |
| Risorse | Libreria di risorse con ricerca filtrata per tipo, rilevamento di elementi orfani, pacchetti di risorse |
| Problemi | Validazione raggruppata in tempo reale con navigazione tramite clic per la messa a fuoco |
| Dipendenze | Scanner di dipendenze con pulsanti di correzione integrati |
| Revisione | Dashboard di controllo, panoramica dei contenuti, esportazione del riepilogo |
| Guida | Checklist per il primo utilizzo con riferimento alle scorciatoie da tastiera |

#### Area di lavoro e modifica

- **Strumenti** — selezione, pittura di aree, connessione, posizionamento di entità, punto di riferimento, generazione, posizionamento di oggetti, posizionamento di incontri
- **Selezione multipla** — clic con Shift, selezione tramite area, Ctrl+A; spostamento tramite trascinamento con annullamento atomico
- **Allineamento** — allineamento a 6 vie (sinistra/destra/alto/basso/centro orizzontale/centro verticale) e distribuzione orizzontale/verticale
- **Aggancio** — aggancio durante il trascinamento ai bordi/centri degli oggetti vicini con linee guida visive
- **Ridimensionamento** — 8 punti di manipolazione per area con aggancio ai bordi, limitazione delle dimensioni minime, anteprima in tempo reale
- **Duplicazione** — Ctrl+D con ID, connessioni e assegnazioni di distretto rimappati
- **Copia/Incolla** — Ctrl+C / Ctrl+V con rimappatura degli ID e offset configurabile
- **Ciclo di clic** — clic ripetuti nella stessa posizione per scorrere gli oggetti sovrapposti
- **Menu contestuale** — clic destro per 7 azioni sensibili al contesto (proprietà, elimina, duplica, ecc.)
- **Anteprima della connessione** — linea tratteggiata ciano durante il posizionamento dello strumento di connessione
- **Minimappa** — panoramica 200×150 (in basso a destra), clic per spostarsi
- **Culling della viewport** — renderizza solo gli oggetti all'interno dei limiti visibili (margine di 64 pixel)
- **Statistiche sulle prestazioni** — attiva/disattiva la sovrapposizione di FPS/numero di oggetti/tempo di rendering
- **Visibilità per oggetto** — nasconde/mostra singoli oggetti (memorizzata in localStorage)
- **Livelli** — controllo della visibilità (griglia, connessioni, entità, punti di riferimento, generazione, città, tessere, oggetti, ambiente; gli oggetti interagiscono con il livello degli oggetti)

#### Navigazione e scorciatoie

- **Viewport** — panoramica/zoom della telecamera, zoom con la rotellina del mouse (cursore ancorato), panoramica tramite trascinamento con la barra spaziatrice/tasto centrale/clic destro, adattamento automatico ai contenuti, doppio clic per centrare
- **Ricerca** — Ctrl+K apre la sovrapposizione per trovare qualsiasi oggetto per nome/ID con corrispondenza approssimativa, navigazione tramite tastiera e cronologia delle ricerche recenti (localStorage)
- **Pannello di velocità** — doppio clic destro per una tavolozza di comandi fluttuante con azioni sensibili al contesto, preferiti fissabili, macro e azioni rapide suggerite in base alla modalità
- **Scorciatoie da tastiera** — 21 scorciatoie da tastiera, tra cui la selezione degli strumenti (V/Z/C/E/L/S), Invio (apre i dettagli), P (applica il preset), Shift+P (salva il preset), Ctrl+C/V (copia/incolla), spostamento con le frecce (Shift = 5×)
- **Accessibilità** — trappole di messa a fuoco modali con Escape per chiudere, etichette ARIA su tutti i pulsanti con solo icone, albero di oggetti navigabile tramite tastiera, indicatore di modifiche annunciato da un lettore di schermo. Le operazioni spaziali sull'area di lavoro (posizionamento, selezione tramite area, ridimensionamento, disegno delle connessioni, panoramica) rimangono basate sul puntatore

#### Importazione ed esportazione

- **ContentPack** — esportazione consapevole dell'obiettivo per AI RPG Engine, Unreal Engine 5 o Godot 4 con badge di preparazione per ogni obiettivo, opzioni configurabili (dimensione delle tessere, prefissi delle scene, filtro dei bundle) e ricevute post-download
- **Bundle di progetto** — file `.wfproject.json` portatili con metadati di provenienza e informazioni sulle dipendenze
- **Bundle di kit** — esportazione/importazione `.wfkit.json` con validazione, gestione delle collisioni e tracciamento della provenienza
- **Importazione** — rileva automaticamente 4 formati con report di fedeltà strutturati
- **Diff** — tracciamento delle modifiche semantiche dall'importazione
- **Anteprima della scena** — composizione HTML/CSS in linea di tutti i collegamenti visivi delle aree

## Modalità di creazione

World Forge separa il **genere** (fantasy, cyberpunk, pirata) dalla **modalità** (dungeon, oceano, spazio). Il genere è l'atmosfera, la modalità è la scala. La modalità regola le impostazioni predefinite della griglia, il vocabolario delle connessioni, i suggerimenti di validazione, la formulazione della guida e il filtro dei preset.

| Modalità | Griglia | Tessera | Connessioni chiave |
|------|------|------|-----------------|
| Dungeon | 30×25 | 32 | porta, scala, passaggio, segreto, pericolo |
| Distretto / Città | 50×40 | 32 | strada, porta, passaggio, portale |
| Regione / Mondo | 80×60 | 48 | strada, portale, passaggio |
| Oceano / Mare | 60×50 | 48 | canale, percorso, portale, pericolo |
| Spazio | 100×80 | 64 | attracco, salto, passaggio, portale |
| Interno | 20×15 | 24 | porta, scala, passaggio, segreto |
| Natura selvaggia | 60×50 | 48 | sentiero, strada, passaggio, pericolo |

La modalità viene impostata durante la creazione di un progetto e memorizzata come `mode?: AuthoringMode` su `WorldProject`. Ogni modalità fornisce **impostazioni predefinite intelligenti**: i tipi di connessione, i ruoli delle entità, i nomi delle aree e i suggerimenti del pannello di velocità si adattano automaticamente.

## Area di lavoro

### Struttura del mondo

- Zone con disposizione spaziale, elementi adiacenti, uscite, illuminazione, rumore, pericoli ed elementi interattivi
- 12 tipi di connessione (passaggio, porta, scala, strada, portale, segreto, pericolo, canale, percorso, punto di attracco, teletrasporto, sentiero) con stili visivi distinti, ancoraggio dei bordi per il routing, frecce direzionali e stile tratteggiato condizionale
- Distretti con controllo di fazione, profili economici, cursori di metriche, tag ed etichette con il nome del distretto nei centroidi delle zone
- Punti di riferimento (punti di interesse denominati all'interno delle zone)
- Punti di generazione, ancoraggi per incontri (colorazione basata sul tipo), presenza di fazioni e punti caldi di pressione
- **Strati verticali**: livelli discreti (superficie / sotterraneo / cielo, o piani di un edificio) con ordine definito, intervallo Z, visibilità tra i livelli e connettori (scale / scale a pioli / ascensori); le zone vengono assegnate a uno strato
- **Pericoli ambientali tipizzati**: una libreria condivisa di pericoli (effetti di danno / stato / uccisione istantanea / incendio, tempistica di attivazione, costo di movimento del terreno, transitabilità, blocco della visuale, condizioni meteorologiche) a cui si fa riferimento per ogni zona
- **Porte di accesso alle zone**: accesso tramite porte in base allo stato del gruppo (livello / dimensione / oggetti / flag / membri / classi) come porta rigida o di avviso con una motivazione "mostra la serratura" definita
- **Occupazione della presentazione**: per client 2.5D: una vista dimetrica con un'impronta e un'estensione di tile, una cella di ancoraggio e una piastra di pavimento opzionale per zona, e una riga di occupazione (pacchetto di personaggi, zona, cella, orientamento) per ogni attore, incluso il giocatore

### Contenuti

- Posizionamento di entità con statistiche, risorse, profili di intelligenza artificiale e metadati personalizzati
- Posizionamento di oggetti con slot, rarità, modificatori di statistiche e abilità concesse
- Alberi di dialogo con conversazioni ramificate, condizioni ed effetti
- Ancoraggi per incontri sulla tela: marcatori a forma di rombo rossi con tipi di boss / imboscata / pattuglia

### Città e interni

- Pittura di tile: set di tile basati su immagini (suddivisione per riga / colonna) con fallback di rettangolo colorato, pennello trascinabile, livelli e "transitabilità" per tile per la collisione con i muri
- Posizionamento di oggetti di scena per interni (palette + rendering sulla tela), con uno strumento di posizionamento
- Economia della città: nodi di mercato (categorie di approvvigionamento, modificatore di prezzo, merce di contrabbando) e stazioni di creazione (tipo di stazione, ricette), modificati per zona
- Strutture della città: edifici (impronte accessibili con un collegamento alla zona interna), hub (nodi di servizio + connettività) e fortezze (sedi fortificate delle fazioni)

### Sistemi dei personaggi

- Modello del giocatore (statistiche iniziali, inventario, equipaggiamento, punto di generazione)
- Catalogo di build (archetipi, background, tratti, discipline, titoli incrociati, relazioni)
- Alberi di progressione (nodi di abilità / capacità con requisiti ed effetti)

### Risorse

- Manifest degli asset (ritratti, sprite, sfondi, icone, set di tile) con binding specifici per tipo
- Pacchetti di asset (raggruppamenti denominati e con versioni, con metadati di compatibilità, tema, licenza)
- Anteprima della scena (composizione inline di tutti i binding visivi delle zone con rilevamento di asset mancanti)

### Flusso di lavoro

- Preset di regione (9 predefiniti, filtrati per modalità) e preset di incontro (10 predefiniti) con applicazione di unione / sovrascrittura e preset personalizzati CRUD
- Kit di avvio (7 predefiniti, specifici per modalità) con esportazione / importazione del kit (`.wfkit.json`), gestione delle collisioni e tracciamento della provenienza
- Modelli di layout (6 disposizioni di zone predefinite) e modelli di dialogo (5 inizi di conversazione)
- Unione di zone e posizionamento di entità in batch (modelli a griglia / casuale / cerchio)
- Salvataggio automatico con intervallo di 30 secondi e cronologia di ripristino di 3 versioni
- Ricerca con Ctrl+K su tutti i tipi di oggetti con corrispondenza approssimativa e cronologia recente
- Pannello di velocità con tavolozza di comandi, preferiti fissabili, macro, gruppi personalizzati e suggerimenti per la modalità
- 21 scorciatoie da tastiera centralizzate (incluse 6 per la selezione degli strumenti)
- Editor dei metadati del progetto (autore, licenza, categoria, tag)
- Statistiche di revisione (distribuzione dei ruoli, tipi di connessione, tipi di incontro, zone per distretto)
- Esportazione in ContentPack JSON, pacchetti di progetto e riepiloghi di revisione
- Importazione da 4 formati con segnalazione strutturata della fedeltà, suggerimenti di correzione e tracciamento delle differenze semantiche

Consultare [`dogfood/WALKTHROUGH.md`](dogfood/WALKTHROUGH.md) per l'esempio di esportazione di Chapel Threshold che dimostra la configurazione attuale.

## Directory Dogfood

La directory `dogfood/` contiene un set di test di integrazione che esegue l'intero flusso di lavoro dall'autore all'esportazione al di fuori dei test unitari. L'esempio di Chapel Threshold (`chapel-threshold.ts`) crea un piccolo ma completo progetto di mondo, lo esegue attraverso l'esportazione e scrive l'output in `dogfood/output/`. Ciò dimostra che i tipi di schema, la convalida e il flusso di lavoro di esportazione funzionano end-to-end con dati reali, e non solo con simulacri isolati.

## Compatibilità con il motore

L'esportazione è destinata a tre motori:

- **[ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine)**: formato ContentPack: l'ambiente di simulazione deterministica che carica un pacchetto esportato ed esegue il mondo
- **Unreal Engine 5**: pacchetto di contenuti compatibile con 2.5D con asset di dati primari, manifesti di generazione di attori e suggerimenti per la partizione del mondo
- **Godot 4**: generazione di scene `.tscn` con risorse di zona, collegamenti di navigazione e manifesti di entità

### Il contratto di contenuto Forge→Engine

Un esportatore che viene eseguito non è la stessa cosa di un mondo che si avvia. La versione 4.6.0 colma
quel divario per la sezione AI RPG Engine e, cosa ancora più utile, trasforma il divario rimanente
in un numero anziché in un'ipotesi.

- **Una tabella di esportazione controllata** (`docs/c0-alignment/`) — un percorso a foglia che verifica le differenze, esaminando
ogni campo definito e registrando quali di essi raggiungono effettivamente l'ambiente di esecuzione. Viene
generata, inserita nel sistema di controllo delle versioni e verificata a ogni esecuzione dei test, quindi "ciò che sopravvive all'esportazione"
può essere verificato, anziché semplicemente affermato.
- **Un manifesto affidabile** — il pacchetto emesso contiene un intervallo di versioni del motore reale,
ID di moduli reali, un hash del contenuto e condizioni di uscita compilate. Gli ID dei moduli sono
vincolati al contenuto reale: un pacchetto senza stazioni di creazione non dichiara più il
modulo di creazione.
- **Il vocabolario spaziale si interseca** — i posizionamenti per entità con condizioni di generazione compilate,
tipi di pericoli, porte di accesso e descrittori di scena raggiungono il pacchetto di contenuti del motore,
e non solo lo schema.
- **La segnalazione della fedeltà mantiene il contratto.** Ogni canale segnala cosa è stato trasmesso senza perdite,
cosa è stato approssimato o cosa è stato eliminato. Se un campo non può essere trasmesso, l'esportazione lo indica — non
ha successo silenziosamente.

Richiede `ai-rpg-engine` `^3.8.0`.

### Il contratto di rendering

Un mondo può anche specificare come un client dovrebbe **renderizzarlo**. `WorldProject.presentation`
è opzionale e aggiuntivo — la maggior parte dei mondi non ne hanno e non vengono penalizzati per questo —
e contiene la vista dimetrica, l'impronta della tessera, una cella di ancoraggio della zona e una piastra del pavimento per zona e una riga di occupazione per attore.

Esiste perché un mondo 2.5D è descritto da tre griglie contemporaneamente e
l'esportazione converte tra **nessuna** di esse:

| Griglia | Unità | Proprietario | Hash |
|---|---|---|---|
| Occupazione simulata | ID zona | il `WorldState` del motore | sì — autorevole |
| Cella dimetrica | Diamante 256x128, estensione 3 | la vista del client, tramite `presentation` | mai |
| Cartesiano di Forge | `gridX` / `gridY` | l'editor e il `.tscn` di Godot | mai |

Una cella dimetrica non deriva mai da `gridX`/`gridY` e la scala del sandbox
salta il blocco per nome, quindi una cella di diamante assoluta non può essere moltiplicata
accidentalmente. La simulazione vince sempre una disputa su in quale stanza si trova una persona;
`presentationAdvisories()` lo dice ad alta voce, `exportToGodot` lo segnala su
`warnings[]` e il canale di elementi di scena può renderlo fatale con `--strict`.

Il blocco si sposta sul `pack.json` degli elementi di scena di Godot. Non
si sposta sul canale `export-ai-rpg` — il `ContentPack` del motore non ha uno slot aggiuntivo
e il suo caricatore è rigoroso — e la tabella di esportazione controllata lo segnala come
eliminato lì, anziché implicare il contrario.

## Sicurezza

- **Dati interessati:** file di progetto sul disco locale (JSON creato dall'utente), nessun archivio sul server
- **Dati NON interessati:** nessun telemetria, nessuna analisi, nessuna richiesta di rete oltre al server di sviluppo locale
- **Autorizzazioni:** nessuna chiave API, nessun segreto, nessuna credenziale
- **Nessun segreto, token o credenziale nel codice sorgente**

## Licenza

MIT

---

Creato da [MCP Tool Shop](https://mcp-tool-shop.github.io/)
