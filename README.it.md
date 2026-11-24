<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.md">English</a> | <a href="README.pt-BR.md">Português (BR)</a>
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
<p align="center"><strong>v4.10.0</strong> — 3718 tests, 6 shipping packages, 7 authoring modes, tiles + interiors + town authoring + world modeling (vertical strata, typed hazards, party-gated zones), three export targets (AI RPG Engine, Unreal Engine 5, Godot 4), a measured Forge→Engine content contract, and an authored drawing contract for 2.5D clients</p>
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
2. **Inizia con un kit:** scegli un kit di partenza o un modello di genere dal Gestore dei modelli, oppure inizia con un progetto vuoto.
3. **Dipingi le zone:** trascina sulla tela per creare zone, connetterle e assegnare i distretti.
4. **Posiziona le entità:** trascina NPC, nemici, mercanti, incontri e oggetti sulle zone.
5. **Verifica:** apri la scheda di verifica per lo stato di salute, la panoramica dei contenuti e l'esportazione riepilogativa (Markdown/JSON).
6. **Esporta:** apri la finestra modale di esportazione per controllare lo stato di preparazione per ciascun target (la casella mostra lo stato peggiore tra tutti e tre i target: rosso quando è bloccato, giallo con avvisi elencati, incluse le traduzioni e le omissioni dei tipi di incontro, nonché il posizionamento mancante delle entità, l'assenza di connessioni nei progetti multi-zona, il modello giocatore mancante o le impostazioni di elevazione o parallasse mancanti di UE5, e verde quando è pronto e non ci sono problemi), configura le opzioni di target, quindi scarica AI RPG Engine, UE5 o i pacchetti Godot 4. Le ricevute post-esportazione vengono raggruppate per dimensione, conteggio e dettagli di fedeltà. Inoltre: pacchetti di progetto (.wfproject.json) e riepiloghi di verifica.

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
- **Città e strutture:** `MarketNode`, `CraftingStation`, `Building`, `Hub`, `Stronghold`
- **Modellazione del mondo:** `Stratum` + `StratumLink` (livelli verticali), `HazardDefinition` (unione di effetti tipizzati), `ZoneEntryGate` + operandi dello stato della squadra `SpawnCondition` (`party-level`, `party-size`, `item`, `flag`, `member`, `class`)
- **Sistema di modalità:** `AuthoringMode` (7 modalità), profili specifici per modalità per griglia/connessione/validazione
- **Presentazione:** `WorldPresentation` opzionale su `WorldProject`: vista dimetrica, impronta della tessera, celle di ancoraggio della zona, piastre del pavimento e una riga di occupazione per ogni personaggio. `presentationAdvisories()` esegue otto regole di controllo, inclusa quella più importante: una persona disegnata in una stanza viene posizionata al di fuori della stanza nella simulazione.
- **Validazione:** `validateProject()` (89 controlli strutturali con ricerche O(n) basate su mappa, `warningCount`), `advisoryValidation()` (suggerimenti specifici per modalità, completezza dei metadati, denominazione delle risorse). v4.0 JSON che omette gli array richiesti in seguito viene accettato dopo `normalizeProjectShape()` / `stampProjectSchemaVersion()`.
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
- **Scena giocabile:** `buildWorldScene()` emette una `.tscn` navigabile: collisione per zona `StaticBody2D` + `NavigationRegion2D`, un `Camera2D` incorniciato, un personaggio giocatore `CharacterBody2D` e ordinamento y / profondità `z_index`.
- **Tessere e interni:** `TileMapLayer` + `TileSet` (`tile_map_data` precalcolate per set di tessere di immagini), collisione delle pareti per cella `StaticBody2D` e posizionamenti di oggetti di scena `Node2D`.
- **Città:** mercati + stazioni di creazione e edifici (impronte `StaticBody2D`) / hub / fortezze come segnaposto `Node2D`, tutti con i loro dati come metadati.
- **Modellazione del mondo:** strati verticali (banding per zona `z_index` + connettori `StratumLink`), pericoli tipizzati come regioni `Area2D` e metadati di ingresso della zona.
- **Rapporto di fedeltà:** tracciamento strutturato dei dati senza perdite, approssimati o eliminati, verificato rispetto al motore Godot 4 reale (fumo headless, 36 asserzioni).
- **Avvisi di presentazione:** un blocco `presentation` creato viene trasmesso intatto e i suoi avvisi vengono visualizzati su `warnings[]`, quindi una discrepanza tra disegno e simulazione è un risultato dell'esportazione piuttosto che una sorpresa sullo schermo.
- **Versione del formato:** `GODOT_PACK_FORMAT_VERSION` 1.1.0 (`files`, `zoneGates`, `migrateGodotPack`).

### @world-forge/export-ai-rpg

Converte un `WorldProject` nel formato `ContentPack` di ai-rpg-engine.

- **Esportazione:** zone, distretti, entità, oggetti, dialoghi, modello giocatore, catalogo di build, alberi di progressione, incontri (traduzione dei tipi di incontro di World Forge nei quattro tipi del motore), fazioni, punti caldi, manifesto e metadati del pacchetto.
- **Importazione:** 8 convertitori inversi ricostruiscono un WorldProject dal JSON esportato; CLI `--import` / `--from-pack` scrive `world-project.json` (o stdout).
- **Rapporto di fedeltà:** tracciamento strutturato di ciò che è stato senza perdite, approssimato o eliminato durante la conversione; `--out` scrive `fidelity.json` accanto al pacchetto.
- **Rilevamento del formato:** rileva automaticamente i formati WorldProject, ExportResult, ContentPack e ProjectBundle.
- **CLI:** `world-forge-export` con `--out`, `--import`, `--from-pack`, `--validate-only`, `--dry-run` e `--verbose`.

### @world-forge/renderer-2d

Renderer 2D basato su PixiJS: viewport con panoramica/zoom, sovrapposizioni di zona con colorazione dei distretti, frecce di connessione, icone di entità per ruolo, livelli di tessere e una minimappa.

Un renderer autonomo, pubblicato per l'utilizzo da parte di utenti esterni, che incorpora i dati di World Forge nelle loro applicazioni PixiJS. **L'editor non lo utilizza**; la tela dell'editor è un'implementazione Canvas2D diretta, quindi le funzionalità della minimappa e della finestra di visualizzazione elencate di seguito per l'editor sono specifiche di quest'ultimo e non del presente pacchetto.

### @world-forge/editor

Applicazione web React 19 + Vite con gestione dello stato tramite Zustand, funzionalità di annullamento/ripetizione con etichette di azione, salvataggio automatico (intervallo di 30 secondi, cronologia di 3 versioni, ripristino in caso di crash), protezioni per lo stato "modificato" su tutti i percorsi di caricamento del progetto, commutazione tra tema chiaro e scuro, trappole di focus modali e commutazione degli strumenti tramite tastiera.

#### Schede dell'area di lavoro

| Scheda | Scopo |
|-----|---------|
| Mappa | Modifica di zone/entità/distretti sulla tela 2D |
| Giocatore | Modello del giocatore con statistiche, inventario, equipaggiamento, punto di generazione |
| Configurazioni | Archetipi, background, tratti, discipline, combinazioni |
| Alberi | Nodi di progressione con requisiti ed effetti |
| Dialoghi | Modifica dei nodi, collegamento delle scelte, rilevamento di riferimenti interrotti |
| Oggetti | Albero gerarchico: distretti → zone → entità/punti di riferimento/punti di generazione |
| Predefiniti | Browser di predefiniti per regioni e incontri con possibilità di unire/sovrascrivere |
| Risorse | Libreria di risorse con ricerca filtrata per tipo, rilevamento di elementi orfani, pacchetti di risorse |
| Problemi | Validazione raggruppata in tempo reale con navigazione tramite clic per mettere a fuoco |
| Dipendenze | Scanner delle dipendenze con pulsanti di correzione integrati |
| Revisione | Dashboard sullo stato di salute, panoramica dei contenuti, esportazione del riepilogo |
| Guida | Checklist per il primo utilizzo con riferimento alle scorciatoie da tastiera (visualizzata fino alla sua chiusura) |
| Importazione | Report sulla fedeltà dell'ultima importazione (visualizzato dopo un'importazione) |
| Differenza | Differenza semantica rispetto all'istantanea importata (visualizzata dopo un'importazione) |

#### Tela e modifica

- **Strumenti** — 10 strumenti: selezione, pittura di zone, connessione, posizionamento di entità, punto di riferimento, punto di generazione, pittura di tessere, posizionamento di oggetti, posizionamento di incontri, posizionamento di oggetti
- **Selezione multipla** — clic con tasto Maiusc, selezione tramite area, Ctrl+A; spostamento tramite trascinamento con annullamento atomico
- **Allineamento** — allineamento a 6 vie (sinistra/destra/alto/basso/centro orizzontale/centro verticale) e distribuzione orizzontale/verticale
- **Aggancio** — aggancio durante il trascinamento ai bordi/centri degli oggetti vicini con linee guida visive
- **Ridimensionamento** — 8 maniglie per zona con aggancio ai bordi, limitazione delle dimensioni minime, anteprima in tempo reale
- **Duplicazione** — Ctrl+D con ID, connessioni e assegnazioni di distretto rimappati
- **Copia/Incolla** — Ctrl+C / Ctrl+V con rimappatura degli ID e offset configurabile
- **Ciclo di clic** — clic ripetuti nella stessa posizione per scorrere gli oggetti sovrapposti
- **Menu contestuale** — clic con il tasto destro per 7 azioni sensibili al contesto (Modifica proprietà passa alla scheda Mappa ed espande la barra laterale destra per l'oggetto selezionato, comprese le entità, più elimina, duplica, ecc.)
- **Anteprima della connessione** — linea tratteggiata ciano durante il posizionamento dello strumento di connessione
- **Minimappa** — panoramica 200×150 (in basso a destra), clic per passare alla posizione
- **Culling della finestra di visualizzazione** — renderizza solo gli oggetti all'interno dei limiti visibili (margine di 64 pixel)
- **Statistiche sulle prestazioni** — attiva/disattiva la sovrapposizione di FPS/numero di oggetti/tempo di rendering
- **Visibilità per oggetto** — nasconde/mostra singoli oggetti (memorizzato in localStorage)
- **Livelli** — interruttori di visibilità (griglia, connessioni, entità, punti di riferimento, punti di generazione, background, tessere, oggetti, ambiente, elevazione; gli oggetti interagiscono con il livello degli oggetti), più interruttori per la minimappa, aggancio agli oggetti, statistiche sulle prestazioni e diagnostica del renderer

#### Navigazione e scorciatoie

- **Viewport** — panoramica/zoom della telecamera, zoom con la rotellina del mouse (ancorato al cursore), trascinamento con la barra spaziatrice/tasto centrale del mouse/clic destro, adattamento al contenuto quando la tela apre per la prima volta un progetto con zone (e su richiesta dal pannello "Velocità", tramite l'opzione "Adatta al contenuto"), doppio clic per centrare
- **Ricerca** — Ctrl+K apre una sovrapposizione per trovare qualsiasi oggetto per nome/ID con corrispondenza approssimativa, navigazione tramite tastiera e cronologia delle ricerche recenti (localStorage)
- **Pannello Velocità** — premere `Q` (configurabile nelle Opzioni) con il puntatore sopra la tela (o con la tela selezionata, ancorato alla selezione o al centro) oppure fare doppio clic con il tasto destro per espandere il menu compatto attivato con un singolo clic con il tasto destro, trasformandolo in una tavolozza di comandi fluttuante, con suggerimenti di ambito sovrapposti quando due o più oggetti visibili si trovano sotto il puntatore (`Tab`/`Shift+Tab` in caso di ricerca vuota, `ArrowLeft`/`ArrowRight`, oppure clic, con `Canvas` per ultimo, un contorno di evidenziazione della tela che non modifica i dati e che viene cancellato alla chiusura/`Esc`, e annunci informativi in tempo reale), un layout fisso a quattro bande quando si apre (una riga opzionale di **Correzioni rapide** per oggetto visualizzata sopra la Banda 1 quando si verificano problemi sull'oggetto di destinazione; l'evidenziazione inizia comunque nella posizione 1 della Banda 1, quindi `Enter` all'apertura attiva la posizione 1, l'ordine di `ArrowDown` rimane invariato e `Alt+1`–`Alt+5` non si spostano; accedere alle Correzioni rapide tramite `ArrowUp` dalla posizione 1 o facendo clic; sopra una serie fissa di opzioni per tipo di operazione, con puntatori e macro copiabili e riordinabili, suggerimenti recenti attivabili/disattivabili e gruppi di catalogo fissi), ricerca a più livelli con sinonimi RPG, iniziali, tolleranza agli errori di battitura, evidenziazione dei caratteri, azioni spiegate `"Unavailable here"`, badge in tempo reale per scorciatoie o posizione nell'editor, selettori a più passaggi integrati (`Quick Fix` per le correzioni e navigazione **Mostra in Problemi/Dipendenze/Revisioni** memorizzata in base allo stato del progetto, `Assign District` con filtro integrato `+ Create District`, `Apply Preset` con `Merge`/`Overwrite` e `Place Encounter Here` con badge di compatibilità per l'esportazione AI RPG in tempo reale; `Backspace` in caso di filtro o passaggi di input vuoti, si torna indietro), modifica integrata del valore scalare attivata da `Tab` per `Set Elevation`, selezione spaziale delegata alla tela (`Connect From Here`, connessioni tipizzate con `Tab` per cambiare tipo e `Shift+Click` per concatenare gli obiettivi, selezione in una singola zona `Merge Zones` con `Shift+Click` per selezione multipla e ricerca del nome della zona al di fuori dello schermo, e `Esc` per annullare mantenendo la selezione precedente), annullamento atomico con etichette descrittive, **Crea macro dalle azioni recenti…** da un massimo di 8 passaggi ripetibili durante la sessione, con esecuzione di macro di annullamento singolo e suggerimenti integrati per la sostituzione di riferimenti mancanti, e **Ripeti l'ultima azione qui**
- **Scorciatoie** — 29 scorciatoie da tastiera, tra cui la selezione degli strumenti (V/Z/C/E/L/S/T/O/N/I), Invio (apre le proprietà nella scheda Mappa ed espande la barra laterale destra), P (applica un preset), Maiusc+P (salva un preset), Ctrl+C/V (copia/incolla), frecce per spostare (Maiusc = 5×)
- **Accessibilità** — trappole di focus modali con Esc per chiudere, etichette ARIA su tutti i pulsanti con solo icone, albero di oggetti navigabile tramite tastiera, indicatore di modifiche annunciato da un lettore di schermo. Le operazioni sulla tela (posizionamento, selezione di aree, ridimensionamento, disegno di connessioni, panoramica) rimangono basate sul puntatore

#### Importazione ed esportazione

- **ContentPack** — esportazione con consapevolezza dell'obiettivo verso AI RPG Engine, Unreal Engine 5 o Godot 4 con badge di preparazione per ogni obiettivo, opzioni configurabili (dimensione delle tessere, prefissi delle scene, filtri dei pacchetti) e ricevute post-download
- **Pacchetti di progetto** — file `.wfproject.json` portatili con metadati di provenienza e informazioni sulle dipendenze
- **Pacchetti di risorse** — esportazione/importazione `.wfkit.json` con convalida, gestione delle collisioni e tracciamento della provenienza
- **Importazione** — rileva automaticamente 4 formati con report di fedeltà strutturati
- **Differenze** — tracciamento delle modifiche semantiche dall'importazione
- **Anteprima della scena** — composizione HTML/CSS integrata di tutti i collegamenti visivi delle zone

## Modalità di creazione

World Forge separa il **genere** (fantasy, cyberpunk, pirata) dalla **modalità** (dungeon, oceano, spazio). Il genere è un elemento di stile, la modalità è la scala. La modalità regola le impostazioni predefinite della griglia, il vocabolario delle connessioni, i suggerimenti di convalida, la formulazione delle guide e i filtri dei preset.

| Modalità | Griglia | Tessera | Connessioni chiave |
|------|------|------|-----------------|
| Dungeon | 30×25 | 32 | porta, scala, passaggio, segreto, pericolo |
| Distretto / Città | 50×40 | 32 | strada, porta, passaggio, portale |
| Regione / Mondo | 80×60 | 48 | strada, portale, passaggio |
| Oceano / Mare | 60×50 | 48 | canale, percorso, portale, pericolo |
| Spazio | 100×80 | 64 | attracco, salto, passaggio, portale |
| Interno | 20×15 | 24 | porta, scala, passaggio, segreto |
| Natura selvaggia | 60×50 | 48 | sentiero, strada, passaggio, pericolo |

La modalità viene impostata durante la creazione di un progetto e memorizzata come `mode?: AuthoringMode` su `WorldProject`. Ogni modalità fornisce **impostazioni predefinite intelligenti**: i tipi di connessione, i ruoli delle entità, i nomi delle zone e i suggerimenti del pannello Velocità si adattano automaticamente.

## Superficie di creazione

### Struttura del mondo

- Zone con disposizione spaziale, elementi adiacenti, uscite, illuminazione, rumore, pericoli ed elementi interattivi
- 12 tipi di connessione (passaggio, porta, scala, strada, portale, segreto, pericolo, canale, percorso, punto di attracco, teletrasporto, sentiero) con stili visivi distinti, instradamento ancorato ai bordi, frecce direzionali e stile tratteggiato condizionale
- Distretti con controllo di fazioni, profili economici, cursori di metriche, tag ed etichette con il nome del distretto nei centroidi delle zone
- Punti di riferimento (punti di interesse denominati all'interno delle zone)
- Punti di generazione, ancoraggi per incontri (colorazione basata sul tipo), presenza di fazioni e punti caldi di pressione
- **Strati verticali**: livelli discreti (superficie / sotterraneo / cielo, o piani di un edificio) con ordine definito, intervallo Z, visibilità tra i livelli e connettori (scale / scale a pioli / ascensori); le zone vengono assegnate a uno strato
- **Pericoli ambientali tipizzati**: una libreria condivisa di pericoli (effetti di danno / stato / uccisione istantanea / incendio, tempistica di attivazione, costo di movimento del terreno, transitabilità, blocco della visuale, condizioni meteorologiche) a cui si fa riferimento per ogni zona
- **Porte di accesso alle zone**: accesso tramite porte in base allo stato del gruppo (livello / dimensione / oggetti / flag / membri / classi) come porta rigida o porta di avviso con una motivazione "mostra la serratura" definita dall'autore
- **Occupazione della presentazione**: per client 2.5D: una vista dimetrica con un'impronta e un'estensione di tile, una cella di ancoraggio e una piastra di pavimento opzionale per zona, e una riga di occupazione (pacchetto di personaggi, zona, cella, orientamento) per ogni attore, incluso il giocatore

### Contenuti

- Posizionamento di entità con statistiche, risorse, profili di intelligenza artificiale e metadati personalizzati
- Posizionamento di oggetti con slot, rarità, modificatori di statistiche e abilità concesse
- Alberi di dialogo con conversazioni ramificate, condizioni ed effetti
- Ancoraggi per incontri sulla tela: marcatori a forma di diamante rosso con tipi di boss / imboscata / pattuglia

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
- Kit di avvio (7 predefiniti, specifici per modalità) con esportazione / importazione del kit (`.wfkit.json`), opzionale pin del pannello rapido e preset di macro (`speedPanelPresets`) uniti senza sovrascrivere i preset utente esistenti, gestione delle collisioni e tracciamento della provenienza
- Unione di zone dal pannello rapido (incluso il prelievo interattivo delle zone sulla tela quando sono selezionate meno di 2 zone)
- Modelli di layout, modelli di dialogo e posizionamento batch di entità (griglia / casuale / cerchio) esistono nel codice, ma non sono ancora accessibili dall'interfaccia utente dell'editor
- Salvataggio automatico con intervallo di 30 secondi e cronologia di ripristino di 3 versioni
- Ricerca con Ctrl+K su tutti i tipi di oggetti con corrispondenza fuzzy e cronologia recente
- Palette dei comandi del pannello rapido con chip di ambito di destinazione sovrapposti (`Tab`/`Shift+Tab` sulla ricerca vuota, evidenziazione della tela non modificante e annunci educati nella regione live), mazzi di contesto fissi (e riga "correzione rapida" contestuale quando si verificano problemi sull'oggetto selezionato), preferiti riordinabili copiati, frequenza recente esponenziale commutabile, gruppi di catalogo fissi, ricerca di sinonimi / errori di battitura RPG a più livelli, badge di associazione delle chiavi live, macro parametrizzate e recenti (`Create Macro from Recent Actions…` con annullamento singolo atomico e richieste di sostituzione dell'ID mancante), gruppi personalizzati, suggerimenti di modalità, input inline a più passaggi e `Tab`, prelievo spaziale sulla tela con filtro della zona fuori schermo e ciclo di `Tab` tipi di connessione, avvisi di esportazione AI RPG, annullamento atomico descrittivo e **Ripeti ultima azione qui** (`wf.speedPanel.v2`)
- 29 scorciatoie da tastiera centralizzate (incluse 10 chiavi per la commutazione degli strumenti)
- Editor dei metadati del progetto (autore, licenza, categoria, tag)
- Statistiche di revisione (distribuzione dei ruoli, tipi di connessione, tipi di incontro, zone per distretto)
- Esportazione in ContentPack JSON, pacchetti di progetto e riepiloghi di revisione
- Importazione da 4 formati con segnalazione strutturata della fedeltà, suggerimenti di correzione e tracciamento delle differenze semantiche

Vedi [`dogfood/WALKTHROUGH.md`](dogfood/WALKTHROUGH.md) per l'handshake di esportazione Chapel Threshold che dimostra la superficie corrente.

## Directory Dogfood

La directory `dogfood/` contiene un insieme di test di integrazione che esegue l'intero flusso di lavoro dall'autore all'esportazione al di fuori dei test unitari. L'esempio Chapel Threshold (`chapel-threshold.ts`) crea un piccolo ma completo progetto di mondo, lo esegue attraverso l'esportazione e scrive l'output in `dogfood/output/`. Ciò dimostra che i tipi di schema, la convalida e il flusso di lavoro di esportazione funzionano end-to-end con dati reali, non solo con simulacri isolati.

## Compatibilità con il motore

L'esportazione è destinata a tre motori:

- **[ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine)** — ContentPack formato: l'ambiente di runtime di simulazione deterministica che carica un pacchetto esportato ed esegue il mondo
- **Unreal Engine 5**: pacchetto di contenuti consapevole del 2.5D con Asset dati primari, manifesti di generazione di attori e suggerimenti di World Partition
- **Godot 4**: generazione di scene `.tscn` con risorse di zona, collegamenti di navigazione e manifesti di entità

### Il contratto di contenuto Forge→Engine

Un esportatore in esecuzione non è la stessa cosa di un mondo che viene avviato. v4.6.0 colma
questa lacuna per la linea di AI RPG Engine e, cosa ancora più utile, trasforma la lacuna rimanente
in un numero anziché in un'ipotesi.

- **Una tabella di esportazione misurata** (`docs/c0-alignment/`): un'analisi del percorso a foglia esamina
ogni campo definito dall'autore e registra quali di essi raggiungono effettivamente l'ambiente di esecuzione. Viene
generata, inserita e verificata in ogni test, quindi "ciò che sopravvive all'esportazione"
può essere verificato anziché semplicemente affermato.
- **Un manifesto affidabile:** il pacchetto emesso contiene un intervallo di versioni del motore reale,
ID di moduli reali, un hash dei contenuti e condizioni di uscita compilate. Gli ID dei moduli sono
vincolati a contenuti reali: un pacchetto senza stazioni di creazione non può più affermare di contenere il
modulo di creazione.
- **Il vocabolario spaziale si incrocia:** i posizionamenti per entità con condizioni di generazione compilate,
pericoli tipizzati, porte di ingresso e descrittori di scena raggiungono il pacchetto di contenuti del motore, non solo lo schema.
- **La segnalazione della fedeltà mantiene il contratto:** ogni linea di sviluppo segnala cosa è stato preservato senza perdite,
approssimato o eliminato. Quando un campo non può essere trasferito, l'esportazione lo indica: non ha successo in silenzio.
- **Gate di esempio del registro** (`packages/editor/src/__tests__/sample-gate.test.ts`): carica dinamicamente ogni voce da `SAMPLE_WORLDS`, `BUILTIN_KITS`, `GENRE_TEMPLATES` e `MODE_STARTERS`, verificando il caricamento dell'archivio, `validateProject()`, il successo dell'esportazione AI RPG con zero elementi di blocco (`exportToEngine` + `listAiRpgEncounterBlockers`), la convalida completa `@ai-rpg-engine/content-schema` (`validateGameContent` e `loadContent`) e le esportazioni per Unreal Engine 5 (`exportToUnreal`) e Godot 4 (`exportToGodot`).
- **Traduzione del tipo di incontro nell'esportazione AI RPG:** solo l'esportatore AI RPG traduce i tipi di incontro definiti dall'autore di World Forge nei quattro tipi di `@ai-rpg-engine/content-schema` (`ambush`, `patrol`, `horde`, `duel`), preservando `worldforge-type:<original>` su `tags[]` e registrando una voce di fedeltà `approximated` (`encounter-type-translated`), escludendo gli ancoraggi `hazard` e `discovery` dal pacchetto con una voce di fedeltà `dropped` (`encounter-type-dropped`) e rifiutando comunque le stringhe personalizzate non mappate per nome:

| World Forge `encounterType` | Output AI RPG `ContentPack` | Fedeltà e tag |
|---|---|---|
| `boss` | `duel` | `approximated`, `worldforge-type:boss` |
| `beast`, `haunt`, `caravan-raid` | `ambush` | `approximated`, `worldforge-type:<original>` |
| `pirate` | `patrol` | `approximated`, `worldforge-type:pirate` |
| `boarding`, `brawl` | `horde` | `approximated`, `worldforge-type:<original>` |
| `hazard`, `discovery` | omesso da `ContentPack.encounterAnchors` | `dropped` |
| `ambush`, `patrol`, `horde`, `duel` | invariato | invariato, nessuna voce di fedeltà |
| qualsiasi altra stringa personalizzata | rifiutato (`exportToEngine` restituisce `success: false` insieme a `listAiRpgEncounterBlockers`, l'interfaccia a riga di comando termina con codice 1) | bloccato |

- **ID degli oratori del dialogo nell'esportazione AI RPG:** `@world-forge/export-ai-rpg` rifiuta le voci `dialogues[].speakers` non risolte per nome (`exportToEngine` restituisce `success: false` con `speakerBlockers` insieme a `listAiRpgDialogueSpeakerBlockers`, la finestra modale di esportazione viene bloccata, l'interfaccia a riga di comando termina con codice `1`), indicando sia l'ID del dialogo che l'oratore non risolto. Un nodo con `speaker: ''` viene popolato solo dall'unico oratore elencato nel dialogo quando ogni entità che contiene quel dialogo (`dialogueId`) è l'oratore elencato o nessuna entità lo contiene; viene rifiutato per ID del dialogo, ID del nodo e ID dell'entità portante quando una qualsiasi entità portante è un'entità diversa e viene rifiutato per ID del dialogo e ID del nodo quando `dialogues[].speakers` ha zero o più voci. Gli oratori dei nodi non vuoti vengono esportati invariati.

Richiede `ai-rpg-engine` `^3.12.2`.

**Lacune note rispetto a AI RPG Engine 3.12.2** (da un test di avvio del 24-11-2026). L'esportazione di questa versione del campione Chapel Threshold viene caricata nel motore pubblicato e il passaggio tra le sue zone funziona. Queste parti non raggiungono ancora l'ambiente di gioco:

- **Uscite vincolate:** il motore si muove solo lungo `zones[].neighbors`. Elimina `zones[].exits` e `connections` del pacchetto quando carica il pacchetto, quindi non è possibile entrare in una zona raggiungibile solo attraverso un'uscita vincolata. Nel campione, si tratta della cripta e dell'incontro al suo interno.
- **Comportamento dei PNG:** il motore risolve l'attributo `aiProfile` di un'entità solo dai profili che l'host passa, o da `entityAi` del pacchetto, che questo esportatore non scrive ancora. Fino a quando non lo farà, i PNG esportati rimarranno inattivi.
- **Dialoghi tramite il sidecar:** i dialoghi vengono riprodotti quando un host avvia il pacchetto in-process, come nella ricetta di avvio JSON del motore. Il processo sidecar del motore li scarta quando carica il pacchetto.
- **Altri dati del pacchetto:** il motore li elimina quando carica il pacchetto e assegna a ciascuno di essi un motivo: descrizioni e pericoli delle zone, presenze delle fazioni, punti caldi di pressione, punti di generazione, il modello del giocatore, tabelle di bottino, punti di riferimento, strati e collegamenti tra strati, transizioni, stazioni di creazione, nodi di mercato, edifici, hub, fortezze, il catalogo di costruzione e gli alberi di progressione.

### Il contratto di rendering

Un mondo può anche specificare come un client dovrebbe **renderizzarlo**. `WorldProject.presentation`
è opzionale e aggiuntivo: la maggior parte dei mondi non ne hanno e non vengono penalizzati per questo,
e contiene la vista dimetrica, l'impronta della tessera, una cella di ancoraggio della zona e una piastra del pavimento per zona e una riga di occupazione per ogni attore.

Esiste perché un mondo 2.5D è descritto da tre griglie contemporaneamente e
l'esportazione converte tra **nessuna** di esse:

| Griglia | Unità | Proprietario | Hash |
|---|---|---|---|
| Occupazione simulata | ID zona | l'attributo `WorldState` del motore | sì, autorevole |
| Cella dimetrica | diamante 256x128, estensione 3 | la vista del client, tramite `presentation` | mai |
| Cartesiano di Forge | `gridX` / `gridY` | l'editor e Godot `.tscn` | mai |

Una cella dimetrica non deriva mai da `gridX`/`gridY` e la scala della sandbox
ignora il blocco per nome, quindi una cella di diamante assoluta non può essere moltiplicata
accidentalmente. La simulazione vince sempre una disputa su quale stanza si trova una persona;
`presentationAdvisories()` lo afferma ad alta voce, `exportToGodot` lo segnala su
`warnings[]` e la linea di elementi di scena può renderlo fatale con `--strict`.

Il blocco si sposta sull'attributo `pack.json` dell'elemento di scena di Godot. **Non**
si sposta lungo la linea `export-ai-rpg`: l'attributo `ContentPack` del motore non ha uno slot aggiuntivo
e il suo caricatore è rigoroso, e la tabella di esportazione misurata lo segnala come
eliminato lì anziché suggerire il contrario.

## Sicurezza

- **Dati toccati:** file di progetto sul disco locale (JSON creato dall'utente), nessun archivio sul server
- **Dati NON toccati:** nessun telemetria, nessuna analisi, nessuna richiesta di rete oltre al server di sviluppo locale
- **Autorizzazioni:** nessuna chiave API, nessun segreto, nessuna credenziale
- **Nessun segreto, token o credenziale nel codice sorgente**

## Licenza

MIT

---

Realizzato da [MCP Tool Shop](https://mcp-tool-shop.github.io/).
