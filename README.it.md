<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.md">English</a> | <a href="README.pt-BR.md">Português (BR)</a>
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

<p align="center">2D / 2.5D world authoring studio with peer export lanes for <a href="https://github.com/mcp-tool-shop-org/ai-rpg-engine">AI RPG Engine</a>, <a href="https://www.unrealengine.com/">Unreal Engine 5</a>, and <a href="https://godotengine.org/">Godot 4</a>.<br>One editor, many modes — paint zones, place entities, define districts, export a complete content pack for your engine of choice.</p>

<!-- version:start -->
<p align="center"><strong>v4.6.0</strong> — 2747 tests, 6 shipping packages, 7 authoring modes, tiles + interiors + town authoring + world modeling (vertical strata, typed hazards, party-gated zones), three export targets (AI RPG Engine, Unreal Engine 5, Godot 4), and a measured Forge→Engine content contract</p>
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
2. **Inizia da un kit:** scegli un kit iniziale o un modello di genere dal Gestore dei modelli oppure inizia con una tela vuota.
3. **Dipingi le zone:** trascina sulla tela per creare zone, collegarle e assegnare i distretti.
4. **Posiziona le entità:** aggiungi PNG, nemici, mercanti, incontri e oggetti alle zone.
5. **Verifica:** apri la scheda di revisione per lo stato di salute, la panoramica dei contenuti e l'esportazione riepilogativa (Markdown/JSON).
6. **Esporta:** apri la finestra modale di esportazione per visualizzare lo stato di preparazione per ogni destinazione (✓ Pronto / ⚠ avvisi), configura le opzioni di destinazione, quindi scarica i pacchetti AI RPG Engine, UE5 o Godot 4. Le ricevute post-esportazione vengono raggruppate in base alle dimensioni, al numero e ai dettagli della fedeltà. Inoltre: pacchetti di progetto (.wfproject.json) e riepiloghi delle revisioni.

### Esportazione da CLI

```bash
# AI RPG Engine
npx world-forge-export project.json --out ./my-pack
npx world-forge-export project.json --validate-only

# Unreal Engine 5
npx world-forge-export-unreal project.json --out ./UnrealPack --sign
npx world-forge-export-unreal --summary ./UnrealPack
```

## Pacchetti

### @world-forge/schema

Tipi TypeScript principali e convalida per la creazione di mondi.

- **Tipi spaziali:** `WorldMap`, `Zone`, `ZoneConnection`, `District`, `Landmark`, `SpawnPoint`, `EncounterAnchor`, `FactionPresence`, `PressureHotspot`
- **Tipi di contenuto:** `EntityPlacement`, `ItemPlacement`, `DialogueDefinition`, `PlayerTemplate`, `BuildCatalogDefinition`, `ProgressionTreeDefinition`
- **Livelli visivi:** `AssetEntry`, `AssetPack`, `Tileset`, `TileLayer`, `PropDefinition`, `PropPlacement`, `AmbientLayer`
- **Città + strutture:** `MarketNode`, `CraftingStation`, `Building`, `Hub`, `Stronghold`
- **Modellazione del mondo:** `Stratum` + `StratumLink` (livelli verticali), `HazardDefinition` (unione di effetti tipizzati), `ZoneEntryGate` + operandi dello stato della squadra `SpawnCondition` (`party-level`, `party-size`, `item`, `flag`, `member`, `class`)
- **Sistema di modalità:** `AuthoringMode` (7 modalità), profili specifici per la modalità per griglia/connessione/convalida.
- **Convalida:** `validateProject()` (89 controlli strutturali con ricerche O(n) basate su mappa, `warningCount`), `advisoryValidation()` (suggerimenti specifici per la modalità, completezza dei metadati, denominazione delle risorse).
- **Utilità:** `assembleSceneData()` (collegamenti visivi con rilevamento di risorse mancanti), `scanDependencies()` (analisi del grafico di riferimento), `buildReviewSnapshot()` (classificazione dello stato di salute).

### @world-forge/export-unreal

Converte un `WorldProject` in un pacchetto di contenuti Unreal Engine 5 ottimizzato per giochi 2.5D.

- **Output:** `pack.json`, JSON delle risorse dati primarie per zona e per distretto, manifesto raggruppato degli attori generati, suggerimenti per lo streaming dei livelli per connessione, suggerimenti per le celle di World Partition e un rapporto strutturato sulla fedeltà.
- **Campi 2.5D:** `Zone.elevation`, `elevationRange`, `parallaxLayers`, `skylineRef` vengono preservati e convertiti in coordinate UE cm / Z-up.
- **Trasformazione delle coordinate:** funzioni pure (`pixelsToUnrealCm`, `elevationToZ`, `worldForgeToUnrealAxis`, `gridToUnrealAxis`). La scala del mondo predefinita è 1 tile = 100 cm.
- **Importazione a ciclo completo:** `importFromUnreal` ricostruisce un WorldProject da un pacchetto Unreal; i dati solo di gioco (dialoghi, progressione, build) vengono contrassegnati come eliminati nel rapporto sulla fedeltà.
- **CLI:** `world-forge-export-unreal` con `--out`, `--tile-size-cm`, `--validate-only`, `--verbose`.

### @world-forge/export-godot

Converte un `WorldProject` in un pacchetto di contenuti Godot 4 con testo della scena `.tscn`.

- **Output:** `pack.json`, risorse per zona, manifesto delle entità, collegamenti di navigazione, tabelle di bottino, marcatori di generazione, nodi di transizione, risorse di dialogo, collegamenti alle risorse e una scena del mondo `.tscn`.
- **Scena giocabile:** `buildWorldScene()` emette una scena `.tscn` navigabile: collisione `StaticBody2D` per zona + `NavigationRegion2D`, un `Camera2D` incorniciato e profondità di ordinamento y / `z_index`.
- **Tile + interni:** `TileMapLayer` + `TileSet` (texture `tile_map_data` precalcolate per set di tile immagine), collisione delle pareti per cella `StaticBody2D` e posizionamenti degli oggetti `Node2D`.
- **Città:** mercati + stazioni di creazione ed edifici (impronte `StaticBody2D`) / hub / roccaforti come segnaposto `Node2D`, tutti contenenti i loro dati come metadati.
- **Modellazione del mondo:** strati verticali (banding per zona `z_index` + connettori `StratumLink`), pericoli tipizzati come regioni `Area2D` e metadati della porta di ingresso alla zona.
- **Rapporto sulla fedeltà:** tracciamento strutturato dei dati senza perdite, approssimati o eliminati, verificato rispetto al motore Godot 4 reale (rendering in modalità headless, 36 asserzioni).
- **Versione del formato:** `GODOT_PACK_FORMAT_VERSION` 1.1.0 (`files`, `zoneGates`, `migrateGodotPack`)

### @world-forge/export-ai-rpg

Converte un `WorldProject` nel formato `ContentPack` di ai-rpg-engine.

- **Esportazione:** zone, distretti, entità, oggetti, dialoghi, modello del giocatore, catalogo delle build, alberi di progressione, incontri, fazioni, punti caldi, manifesto e metadati del pacchetto.
- **Importazione:** 8 convertitori inversi ricostruiscono un WorldProject dai JSON esportati.
- **Rapporto sulla fedeltà:** tracciamento strutturato di ciò che è stato senza perdite, approssimato o eliminato durante la conversione.
- **Rilevamento del formato:** rileva automaticamente i formati WorldProject, ExportResult, ContentPack e ProjectBundle.
- **CLI:** comando `world-forge-export` con flag `--out`, `--validate-only` e `--verbose`.

### @world-forge/renderer-2d

Renderer 2D basato su PixiJS: viewport con panoramica/zoom, sovrapposizioni di zona con colorazione dei distretti, frecce di connessione, icone di entità per ruolo, livelli di tile e una minimappa.

Un renderer autonomo pubblicato per i consumatori esterni che incorporano i dati di World Forge nella propria app PixiJS. **L'editor non lo utilizza:** la tela dell'editor è un'implementazione diretta di Canvas2D, quindi le funzionalità della minimappa e del viewport elencate sotto l'editor qui sotto sono proprie, non di questo pacchetto.

### @world-forge/editor

App Web React 19 + Vite con gestione dello stato di Zustand, annulla/ripeti con etichette delle azioni, salvataggio automatico (intervallo di 30 secondi, cronologia a 3 versioni, ripristino in caso di arresto anomalo), protezioni dello stato "sporco" su tutti i percorsi di caricamento del progetto, interruttore tema chiaro/scuro, trappole di messa a fuoco modale e commutazione degli strumenti basata sulla tastiera.

#### Schede dell'area di lavoro

| Scheda | Scopo |
|-----|---------|
| Mappa | Modifica di zone/entità/distretti sulla tela 2D. |
| Oggetti | Albero gerarchico: distretti → zone → entità/punti di riferimento/aree di generazione. |
| Giocatore | Modello del giocatore con statistiche, inventario, equipaggiamento e area di generazione. |
| Build | Archetipi, background, tratti, discipline, combo. |
| Alberi | Nodi di progressione con requisiti ed effetti. |
| Dialogo | Modifica dei nodi, collegamento delle scelte, rilevamento di riferimenti interrotti |
| Preset | Browser per preset di regione e incontri con possibilità di unire/sovrascrivere |
| Risorse | Libreria di risorse con ricerca filtrata per tipo, rilevamento di elementi orfani, pacchetti di risorse |
| Problemi | Validazione raggruppata in tempo reale con navigazione tramite clic per la messa a fuoco |
| Dipendenze | Scanner delle dipendenze con pulsanti di correzione integrati |
| Revisione | Dashboard sullo stato, panoramica dei contenuti, esportazione del riepilogo |
| Guida | Checklist per il primo utilizzo con riferimento alle scorciatoie da tastiera |

#### Canvas e modifica

- **Strumenti** — selezione, pittura di aree, connessione, posizionamento entità, punto di riferimento, generazione
- **Selezione multipla** — clic con Shift, selezione tramite rettangolo, Ctrl+A; spostamento con annullamento atomico
- **Allineamento** — allineamento a 6 direzioni (sinistra/destra/alto/basso/centro orizzontale/centro verticale) e distribuzione orizzontale/verticale
- **Aggancio** — aggancio dinamico ai bordi/centri degli oggetti vicini durante lo spostamento, con linee guida visive
- **Ridimensionamento** — 8 punti di controllo per area con aggancio al bordo, limitazione delle dimensioni minime, anteprima in tempo reale
- **Duplicazione** — Ctrl+D con ID, connessioni e assegnazioni di distretto rimappati
- **Copia/Incolla** — Ctrl+C / Ctrl+V con rimappatura degli ID e offset configurabile
- **Ciclo di clic** — ripetuti clic nella stessa posizione per scorrere gli oggetti sovrapposti
- **Menu contestuale** — clic destro per 7 azioni sensibili al contesto (proprietà, elimina, duplica, ecc.)
- **Anteprima della connessione** — linea tratteggiata ciano durante il posizionamento dello strumento di connessione
- **Minimappa** — panoramica 200×150 (in basso a destra), clic per spostarsi
- **Culling della viewport** — vengono renderizzati solo gli oggetti all'interno dei limiti visibili (margine di 64 pixel)
- **Statistiche sulle prestazioni** — attiva/disattiva la sovrapposizione di FPS/numero di oggetti/tempo di rendering
- **Visibilità per oggetto** — nasconde/mostra singoli oggetti (memorizzato in localStorage)
- **Livelli** — 7 interruttori di visibilità (griglia, connessioni, entità, punti di riferimento, generazione, sfondi, ambiente)

#### Navigazione e scorciatoie

- **Viewport** — panoramica/zoom della telecamera, zoom con la rotellina del mouse (ancorato al cursore), panoramica tramite trascinamento con la barra spaziatrice/tasto centrale/clic destro, adattamento automatico ai contenuti, doppio clic per centrare
- **Ricerca** — Ctrl+K apre una sovrapposizione per trovare qualsiasi oggetto per nome/ID con corrispondenza approssimativa, navigazione tramite tastiera e cronologia delle ricerche recenti (localStorage)
- **Pannello velocità** — doppio clic destro per una tavolozza di comandi fluttuante con azioni sensibili al contesto, preferiti fissabili, macro e azioni rapide suggerite in base alla modalità
- **Scorciatoie da tastiera** — 21 scorciatoie da tastiera tra cui la selezione degli strumenti (V/Z/C/E/L/S), Invio (apre i dettagli), P (applica il preset), Shift+P (salva il preset), Ctrl+C/V (copia/incolla), spostamento con le frecce (Shift = 5×)
- **Accessibilità** — trappole di messa a fuoco modali con Escape per chiudere, etichette ARIA su tutti i pulsanti con solo icone, albero degli oggetti navigabile tramite tastiera, indicatore di modifiche annunciato da un lettore di schermo. Le operazioni sul canvas spaziale (posizionamento, selezione tramite rettangolo, ridimensionamento, disegno delle connessioni, panoramica) rimangono basate sul puntatore

#### Importazione ed esportazione

- **ContentPack** — esportazione consapevole del target per AI RPG Engine, Unreal Engine 5 o Godot 4 con badge di prontezza per ciascun target, opzioni configurabili (dimensione delle tile, prefissi della scena, filtro dei bundle) e ricevute post-download
- **Bundle di progetto** — file `.wfproject.json` portatili con metadati di provenienza e informazioni sulle dipendenze
- **Bundle di kit** — esportazione/importazione `.wfkit.json` con validazione, gestione delle collisioni e tracciamento della provenienza
- **Importazione** — rileva automaticamente 4 formati con report strutturati sulla fedeltà
- **Diff** — tracciamento semantico delle modifiche dall'importazione
- **Anteprima della scena** — composizione HTML/CSS inline di tutti i collegamenti visivi delle aree

## Modalità di creazione

World Forge separa il **genere** (fantasy, cyberpunk, pirata) dalla **modalità** (dungeon, oceano, spazio). Il genere è un elemento stilistico; la modalità definisce la scala. La modalità regola le impostazioni predefinite della griglia, il vocabolario delle connessioni, i suggerimenti di validazione, la formulazione della guida e il filtro dei preset.

| Modalità | Griglia | Tile | Connessioni chiave |
|------|------|------|-----------------|
| Dungeon | 30×25 | 32 | porta, scala, passaggio, segreto, pericolo |
| Distretto / Città | 50×40 | 32 | strada, porta, passaggio, portale |
| Regione / Mondo | 80×60 | 48 | strada, portale, passaggio |
| Oceano / Mare | 60×50 | 48 | canale, percorso, portale, pericolo |
| Spazio | 100×80 | 64 | attracco, salto iperdimensionale, passaggio, portale |
| Interno | 20×15 | 24 | porta, scala, passaggio, segreto |
| Natura selvaggia | 60×50 | 48 | sentiero, strada, passaggio, pericolo |

La modalità viene impostata durante la creazione di un progetto e memorizzata come `mode?: AuthoringMode` su `WorldProject`. Ogni modalità fornisce **impostazioni predefinite intelligenti**: i tipi di connessione, i ruoli delle entità, i nomi delle aree e i suggerimenti del pannello velocità si adattano automaticamente.

## Superficie di creazione

### Struttura del mondo

- Zone con disposizione spaziale, elementi adiacenti, uscite, illuminazione, rumore, pericoli ed elementi interattivi.
- 12 tipi di connessione (passaggio, porta, scala, strada, portale, segreto, pericolo, canale, percorso, punto di attracco, teletrasporto, sentiero) con stili visivi distinti, ancoraggio dei bordi per il routing, frecce direzionali e stile tratteggiato condizionale.
- Distretti con controllo delle fazioni, profili economici, cursori di metriche, tag ed etichette con il nome del distretto nei centroidi delle zone.
- Punti di riferimento (punti di interesse nominati all'interno delle zone).
- Punti di generazione, ancoraggi per gli incontri (colorazione basata sul tipo), presenza delle fazioni e punti caldi di pressione.
- **Strati verticali:** livelli discreti (superficie/sotterraneo/cielo o piani dell'edificio) con ordine definito, intervallo z, visibilità tra i livelli e connettori (scale/rampe/ascensori); le zone vengono assegnate a uno strato.
- **Pericoli ambientali tipizzati:** una libreria condivisa di pericoli (effetti di danno/stato/uccisione istantanea/incendio, tempistica dell'attivazione, costo di movimento del terreno, transitabilità, blocco della visuale, condizioni meteorologiche) a cui si fa riferimento per ogni zona.
- **Portali di ingresso alle zone:** accesso tramite portale in base allo stato del gruppo (livello/dimensione/oggetti/flag/membri/classi), come porta rigida o indicativa con una motivazione "mostra la serratura" definita dall'autore.

### Contenuti

- Posizionamento di entità con statistiche, risorse, profili IA e metadati personalizzati.
- Posizionamento di oggetti con slot, rarità, modificatori delle statistiche e abilità concesse.
- Alberi di dialogo con conversazioni ramificate, condizioni ed effetti.
- Ancoraggi per gli incontri sulla tela: marcatori a forma di diamante rosso con tipi di boss/imboscata/pattuglia.

### Città e interni

- Pittura delle tessere: set di tessere basati su immagini (suddivisione per riga/colonna) con fallback a rettangoli colorati, pennello trascinabile, livelli e "Solidità" per ogni tessera per la collisione con i muri.
- Posizionamento di oggetti d'arredo per gli interni (palette + rendering sulla tela), con uno strumento di posizionamento.
- Economia della città: nodi del mercato (categorie di offerta, modificatore dei prezzi, merce di contrabbando) e stazioni di creazione (tipo di stazione, ricette), modificati per ogni zona.
- Strutture cittadine: edifici (impronte percorribili con collegamento alla zona interna), hub (nodi di servizio + connettività) e fortezze (sedi fortificate delle fazioni).

### Sistemi dei personaggi

- Modello del giocatore (statistiche iniziali, inventario, equipaggiamento, punto di generazione).
- Catalogo di build (archetipi, background, tratti, discipline, titoli incrociati, relazioni).
- Alberi di progressione (nodi di abilità con requisiti ed effetti).

### Risorse

- Manifest degli asset (ritratti, sprite, sfondi, icone, set di tessere) con associazioni specifiche per tipo.
- Pacchetti di asset (nominati, raggruppamenti con versioni e metadati di compatibilità, tema, licenza).
- Anteprima della scena (composizione in linea di tutti gli elementi visivi della zona con rilevamento degli asset mancanti).

### Flusso di lavoro

- Preset di regione (9 predefiniti, filtrati per modalità) e preset di incontro (10 predefiniti) con applicazione di fusione/sovrascrittura e CRUD personalizzato dei preset.
- Kit iniziali (7 predefiniti, specifici per la modalità) con esportazione/importazione del kit (`.wfkit.json`), gestione delle collisioni e tracciamento della provenienza.
- Modelli di layout (6 disposizioni di zone predefinite) e modelli di dialogo (5 frasi di apertura).
- Fusione di zone e posizionamento in batch di entità (modelli a griglia/casuale/circolare).
- Salvataggio automatico con intervallo di 30 secondi e cronologia di ripristino di 3 versioni.
- Ricerca Ctrl+K su tutti i tipi di oggetti con corrispondenza approssimativa e cronologia recente.
- Pannello della velocità: tavolozza dei comandi con preferiti fissabili, macro, gruppi personalizzati e suggerimenti per la modalità.
- 21 scorciatoie da tastiera centralizzate (incluse 6 chiavi per il cambio strumento).
- Editor dei metadati del progetto (autore, licenza, categoria, tag).
- Statistiche di revisione (distribuzione dei ruoli, tipi di connessione, tipi di incontro, zone per distretto).
- Esportazione in ContentPack JSON, pacchetti di progetto e riepiloghi di revisione.
- Importazione da 4 formati con segnalazione strutturata della fedeltà, suggerimenti di correzione e tracciamento delle differenze semantiche.

Consultare [`dogfood/WALKTHROUGH.md`](dogfood/WALKTHROUGH.md) per l'esempio dell'handshake di esportazione di Chapel Threshold che dimostra la configurazione attuale.

## Directory Dogfood

La directory `dogfood/` contiene un insieme di test di integrazione che esegue l'intero flusso di lavoro dall'autore all'esportazione al di fuori dei test unitari. L'esempio Chapel Threshold (`chapel-threshold.ts`) crea un piccolo ma completo progetto, lo elabora tramite l'esportazione e scrive l'output in `dogfood/output/`. Ciò dimostra che i tipi di schema, la convalida e il flusso di lavoro di esportazione funzionano end-to-end con dati reali, non solo con simulacri isolati.

## Compatibilità del motore

L'esportazione è rivolta a tre motori:

- **[ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine)**: formato ContentPack: l'ambiente di simulazione deterministica che carica un pacchetto esportato ed esegue il mondo.
- **Unreal Engine 5**: content pack consapevole del 2,5D con Primary Data Assets, manifesti di generazione degli attori e suggerimenti per World Partition.
- **Godot 4**: generazione di scene `.tscn` con risorse di zona, collegamenti di navigazione e manifesti di entità.

### Il contratto tra Forge ed Engine

Un esportatore che viene eseguito non è la stessa cosa di un mondo che si avvia. La versione 4.6.0 colma tale divario per il percorso AI RPG Engine e, soprattutto, trasforma il divario rimanente in un numero anziché in un'ipotesi.

- **Una tabella di esportazione controllata** (`docs/c0-alignment/`) — un algoritmo che analizza i percorsi ad albero e verifica ogni campo definito, registrando quali effettivamente vengono utilizzati in fase di esecuzione. Viene generata, salvata e verificata a ogni ciclo di test, quindi ciò che "sopravvive all'esportazione" può essere controllato anziché semplicemente affermato.
- **Un file manifest affidabile** — il pacchetto esportato contiene un intervallo di versioni semantiche reale del motore, ID modulo reali, un hash dei contenuti e condizioni di uscita compilate. Gli ID modulo sono legati ai contenuti effettivi: un pacchetto senza stazioni di creazione non include più il modulo di creazione.
- **Il vocabolario spaziale viene trasferito** — le posizioni per entità con condizioni di generazione compilate, tipi di pericoli, porte di accesso e descrittori di scena vengono trasferiti al pacchetto di contenuti del motore, e non solo allo schema.
- **La segnalazione della fedeltà mantiene la coerenza.** Ogni elemento segnala cosa è stato preservato senza perdite, approssimato o eliminato. Se un campo non può essere trasferito, l'esportazione lo indica esplicitamente; non avviene in silenzio.

Richiede `ai-rpg-engine` `^3.8.0`.

## Sicurezza

- **Dati interessati:** file di progetto sul disco locale (JSON creato dall'utente), nessun archivio lato server
- **Dati NON interessati:** nessuna telemetria, nessuna analisi, nessuna richiesta di rete oltre al server di sviluppo locale
- **Autorizzazioni:** nessuna chiave API, nessun segreto, nessuna credenziale
- **Nessun segreto, token o credenziale nel codice sorgente**

## Licenza

MIT

---

Realizzato da [MCP Tool Shop](https://mcp-tool-shop.github.io/)
