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

<p align="center">2D / 2.5D world authoring studio with peer export lanes for <a href="https://github.com/mcp-tool-shop-org/ai-rpg-engine">AI RPG Engine</a>, <a href="https://www.unrealengine.com/">Unreal Engine 5</a>, and (planned) Godot 4.<br>One editor, many modes — paint zones, place entities, define districts, export a complete content pack for your engine of choice.</p>

<p align="center"><strong>v4.3.0</strong> — 1959 tests, 5 shipping packages + 1 planned Godot stub (6 total), 7 authoring modes, 2.5D authoring end-to-end</p>

## Architettura

```
packages/
  schema/          @world-forge/schema         — spatial types, validation, 2.5D fields
  export-ai-rpg/   @world-forge/export-ai-rpg  — AI RPG Engine export pipeline + CLI
  export-unreal/   @world-forge/export-unreal  — Unreal Engine 5 export pipeline + CLI (2.5D aware)
  export-godot/    @world-forge/export-godot   — (planned) Godot 4 export lane, stub only
  renderer-2d/     @world-forge/renderer-2d    — PixiJS 2D canvas renderer
  editor/          @world-forge/editor         — React web authoring app
```

## Guida Rapida

```bash
npm install
npm run build
npm run dev --workspace=packages/editor
```

Aprire `http://localhost:5173` per avviare l'editor.

### Flusso di Lavoro dell'Editor

1. **Scegliere una modalità** — dungeon, distretto, mondo, oceano, spazio, interno o natura selvaggia — per impostare le impostazioni predefinite della griglia e il vocabolario delle connessioni.
2. **Partire da un kit** — scegliere un kit di partenza o un modello di genere dal gestore dei modelli, oppure iniziare da zero.
3. **Dipingere le zone** — trascinare sulla tela per creare zone, collegarle e assegnare distretti.
4. **Posizionare le entità** — trascinare NPC, nemici, mercanti, incontri e oggetti sulle zone.
5. **Revisione** — aprire la scheda "Revisione" per visualizzare lo stato di salute, la panoramica dei contenuti e l'esportazione del riepilogo (Markdown/JSON).
6. **Esportazione** — scaricare un ContentPack, un pacchetto di progetto (.wfproject.json) o un riepilogo della revisione.

### Esportazione tramite CLI

```bash
npx world-forge-export project.json --out ./my-pack
npx world-forge-export project.json --validate-only
```

## Pacchetti

### @world-forge/schema

Tipi e validazioni TypeScript fondamentali per la creazione di mondi.

- **Tipi spaziali** — `WorldMap`, `Zone`, `ZoneConnection`, `District`, `Landmark`, `SpawnPoint`, `EncounterAnchor`, `FactionPresence`, `PressureHotspot`
- **Tipi di contenuto** — `EntityPlacement`, `ItemPlacement`, `DialogueDefinition`, `PlayerTemplate`, `BuildCatalogDefinition`, `ProgressionTreeDefinition`
- **Livelli visivi** — `AssetEntry`, `AssetPack`, `Tileset`, `TileLayer`, `PropDefinition`, `AmbientLayer`
- **Sistema di modalità** — `AuthoringMode` (7 modalità), profili specifici per la modalità per la griglia/connessioni/validazione.
- **Validazione** — `validateProject()` (54 controlli strutturali con ricerche basate su mappa O(n), `warningCount`), `advisoryValidation()` (suggerimenti specifici per la modalità, completezza dei metadati, denominazione degli asset)
- **Utilità** — `assembleSceneData()` (associazione visiva con rilevamento di asset mancanti), `scanDependencies()` (analisi del grafo di riferimento), `buildReviewSnapshot()` (classificazione dello stato di salute)

### @world-forge/export-unreal

Converte un `WorldProject` in un pacchetto di contenuti per Unreal Engine 5, ottimizzato per giochi in 2.5D.

- **Output** — `pack.json`, dati primari JSON per zona e distretto, manifest dei punti di spawn degli attori raggruppati, suggerimenti di streaming dei livelli per connessione, suggerimenti per le celle di World Partition e un rapporto di fedeltà strutturato.
- **Campi 2.5D** — `Zone.elevation`, `elevationRange`, `parallaxLayers`, `skylineRef` vengono preservati e convertiti in coordinate UE in cm / Z-up.
- **Trasformazione delle coordinate** — funzioni pure (`pixelsToUnrealCm`, `elevationToZ`, `worldForgeToUnrealAxis`, `gridToUnrealAxis`). La scala del mondo predefinita è 1 tile = 100 cm.
- **Importazione andata e ritorno** — `importFromUnreal` ricostruisce un WorldProject da un pacchetto Unreal; i dati relativi solo al gameplay (dialoghi, progressione, costruzioni) vengono contrassegnati come eliminati nel rapporto di fedeltà.
- **CLI** — `world-forge-export-unreal` con le opzioni `--out`, `--tile-size-cm`, `--validate-only`, `--verbose`.

### @world-forge/export-godot

Slot di spazio di lavoro riservato per la pianificata esportazione per Godot 4 (Fractured Road). Non ancora implementato.

### @world-forge/export-ai-rpg

Converte un `WorldProject` nel formato `ContentPack` del motore ai-rpg.

- **Esportazione** — zone, distretti, entità, oggetti, dialoghi, modello del giocatore, catalogo delle costruzioni, alberi di progressione, incontri, fazioni, punti caldi, manifest e metadati del pacchetto.
- **Importazione** — 8 convertitori inversi ricostruiscono un WorldProject dai file JSON esportati.
- **Rapporto di fedeltà** — tracciamento strutturato di ciò che è stato preservato senza perdita, approssimato o eliminato durante la conversione.
- **Rilevamento del formato** — rileva automaticamente i formati WorldProject, ExportResult, ContentPack e ProjectBundle.
- **CLI** — comando `world-forge-export` con le opzioni `--out`, `--validate-only` e `--verbose`.

### @world-forge/renderer-2d

Renderer 2D basato su PixiJS: viewport con pan/zoom, sovrapposizioni di zone con colorazione dei distretti, frecce di connessione, icone delle entità per ruolo, livelli di tile e una minimappa.

### @world-forge/editor

React 19 + applicazione web Vite con gestione dello stato tramite Zustand, funzionalità di annullamento/ripetizione con etichette delle azioni, salvataggio automatico (con intervallo di 30 secondi e cronologia di 3 versioni), interruttore tra tema chiaro e scuro e protezione per le modifiche non salvate.

#### Schede di lavoro

| Scheda | Scopo |
|-----|---------|
| Mappa | Modifica di zone/entità/distretti su una tela 2D |
| Oggetti | Albero gerarchico: distretti → zone → entità/punti di riferimento/punti di spawn |
| Giocatore | Modello di giocatore con statistiche, inventario, equipaggiamento, punto di spawn |
| Costruzioni | Archetipi, background, tratti, discipline, combinazioni |
| Alberi | Nodi di progressione con requisiti ed effetti |
| Dialoghi | Modifica dei nodi, collegamento delle scelte, rilevamento di riferimenti interrotti |
| Impostazioni predefinite | Browser di impostazioni predefinite per regioni e incontri con possibilità di unione/sovrascrittura |
| Risorse | Libreria di risorse con ricerca filtrata per tipo, rilevamento di risorse orfane, pacchetti di risorse |
| Problemi | Validazione raggruppata in tempo reale con navigazione tramite clic per mettere a fuoco |
| Dipendenze | Scanner di dipendenze con pulsanti di correzione integrati |
| Revisione | Dashboard dello stato di salute, panoramica dei contenuti, esportazione riassuntiva |
| Guida | Checklist per il primo avvio con riferimento alle scorciatoie |

#### Tela e modifica

- **Strumenti** — selezione, pittura di zone, connessione, posizionamento di entità, punto di riferimento, punto di spawn
- **Selezione multipla** — clic con il tasto Shift, selezione a casella, Ctrl+A; spostamento con trascinamento con annullamento atomico
- **Allineamento** — allineamento a 6 vie (sinistra/destra/alto/basso/centro-orizzontale/centro-verticale) e distribuzione orizzontale/verticale
- **Aggancio** — aggancio durante il trascinamento ai bordi/centri degli oggetti vicini con linee guida visive
- **Ridimensionamento** — 8 maniglie per zona con aggancio ai bordi, limitazione della dimensione minima, anteprima in tempo reale
- **Duplicazione** — Ctrl+D con rimappatura degli ID, delle connessioni e degli assegnamenti ai distretti
- **Copia/Incolla** — Ctrl+C / Ctrl+V con rimappatura degli ID e offset configurabile
- **Ciclo con clic** — clic ripetuti nella stessa posizione alternano gli oggetti sovrapposti
- **Menu contestuale** — clic destro per 7 azioni sensibili al contesto (proprietà, elimina, duplica, ecc.)
- **Anteprima della connessione** — linea tratteggiata ciano durante il posizionamento dello strumento di connessione
- **Mini mappa** — panoramica di 200x150 (in basso a destra), clic per ingrandire
- **Eliminazione della porzione di immagine** — rende visibili solo gli oggetti all'interno dei limiti visibili (margine di 64 pixel)
- **Statistiche sulle prestazioni** — attiva la sovrapposizione FPS/numero di oggetti/tempo di rendering
- **Visibilità per oggetto** — nascondi/mostra singoli oggetti (salvati in localStorage)
- **Livelli** — 7 interruttori di visibilità (griglia, connessioni, entità, punti di riferimento, punti di spawn, sfondi, ambiente)

#### Navigazione e scorciatoie

- **Vista** — panoramica/zoom della telecamera, rotellina del mouse per lo zoom (cursore ancorato), barra spaziatrice/clic centrale del mouse/clic destro per la panoramica con trascinamento, adattamento automatico al contenuto, doppio clic per centrare
- **Ricerca** — Ctrl+K apre una sovrapposizione per trovare qualsiasi oggetto per nome/ID con corrispondenza approssimativa, navigazione tramite tastiera e cronologia delle ricerche recenti (localStorage)
- **Pannello di velocità** — doppio clic destro per una tavolozza di comandi fluttuante con azioni sensibili al contesto, preferiti fissabili, macro e suggerimenti di azioni rapide in base alla modalità
- **Scorciatoie** — 15 scorciatoie da tastiera tra cui Invio (apri i dettagli), P (applica impostazione predefinita), Shift+P (salva impostazione predefinita), Ctrl+C/V (copia/incolla)

#### Importazione ed esportazione

- **ContentPack** — esportazione con un clic in formato ai-rpg-engine con convalida completa
- **Pacchetti di progetto** — file `.wfproject.json` portabili con metadati di provenienza e informazioni sulle dipendenze
- **Pacchetti di kit** — esportazione/importazione di `.wfkit.json` con convalida, gestione delle collisioni e tracciamento della provenienza
- **Importazione** — rileva automaticamente 4 formati con report strutturati sull'integrità
- **Differenza** — tracciamento delle modifiche semantiche dall'importazione
- **Anteprima della scena** — composizione HTML/CSS inline di tutti i binding visivi delle zone

## Modalità di creazione

World Forge separa il **genere** (fantasy, cyberpunk, piratesco) dalla **modalità** (dungeon, oceano, spazio). Il genere definisce l'atmosfera, mentre la modalità definisce la scala. La modalità governa le impostazioni predefinite della griglia, il vocabolario delle connessioni, i suggerimenti di convalida, la formulazione delle guide e i filtri preimpostati.

| Modalità | Griglia | Piastrellato | Connessioni principali |
|------|------|------|-----------------|
| Dungeon | 30×25 | 32 | porta, scale, passaggio, segreto, pericolo |
| Distretto / Città | 50×40 | 32 | strada, porta, passaggio, portale |
| Regione / Mondo | 80×60 | 48 | strada, portale, passaggio |
| Oceano / Mare | 60×50 | 48 | canale, percorso, portale, pericolo |
| Spazio | 100×80 | 64 | attracco, salto, passaggio, portale |
| Interno | 20×15 | 24 | porta, scale, passaggio, segreto |
| Area selvaggia | 60×50 | 48 | sentiero, strada, passaggio, pericolo |

La modalità viene impostata durante la creazione di un progetto e viene memorizzata come `mode?: AuthoringMode` nell'oggetto `WorldProject`. Ogni modalità fornisce **impostazioni predefinite intelligenti**: i tipi di connessione, i ruoli delle entità, i nomi delle zone e i suggerimenti del pannello di controllo si adattano automaticamente.

## Superficie di creazione

### Struttura del mondo

- Zone con layout spaziale, vicini, uscite, illuminazione, rumore, pericoli e elementi interattivi
- 12 tipi di connessione (passaggio, porta, scale, strada, portale, segreto, pericolo, canale, percorso, attracco, salto, sentiero) con stili visivi distinti, routing ancorato ai bordi, frecce direzionali e stile tratteggiato condizionale
- Distretti con controllo delle fazioni, profili economici, slider di metriche, tag ed etichette con il nome del distretto nei centroidi delle zone
- Punti di riferimento (punti di interesse nominati all'interno delle zone)
- Punti di spawn, ancoraggi di incontri (colorazione basata sul tipo), presenza di fazioni e punti critici di pressione

### Contenuti

- Posizionamento di entità con statistiche, risorse, profili di intelligenza artificiale e metadati personalizzati
- Posizionamento di oggetti con slot, rarità, modificatori di statistiche e verbi concessi
- Alberi di dialogo con conversazioni ramificate, condizioni ed effetti
- Ancoraggi di incontri sulla tela: marcatori a diamante rosso con tipi di boss/imboscata/pattuglia

### Sistemi di personaggi

- Modello del giocatore (statistiche iniziali, inventario, equipaggiamento, punto di spawn)
- Catalogo di build (archetipi, background, tratti, discipline, titoli incrociati, legami)
- Alberi di progressione (nodi di abilità con requisiti ed effetti)

### Risorse

- Manifest delle risorse (ritratti, sprite, sfondi, icone, set di piastrelle) con associazioni specifiche per tipo
- Pacchetti di risorse (gruppi denominati e versionati con metadati di compatibilità, tema, licenza)
- Anteprima della scena (composizione inline di tutti i binding visivi delle zone con rilevamento delle risorse mancanti)

### Flusso di lavoro

- Impostazioni predefinite per le regioni (9 integrate, filtrate per modalità) e impostazioni predefinite per gli incontri (10 integrate) con possibilità di unione/sovrascrittura e gestione personalizzata delle impostazioni.
- Kit di avvio (7 integrati, specifici per modalità) con esportazione/importazione del kit (`.wfkit.json`), gestione delle collisioni e tracciamento della provenienza.
- Modelli di layout (6 disposizioni di zone predefinite) e modelli di dialogo (5 punti di partenza per conversazioni).
- Unione di zone e posizionamento batch di entità (schemi a griglia/casuale/cerchio).
- Salvataggio automatico con intervallo di 30 secondi e cronologia di ripristino di 3 versioni.
- Ricerca con Ctrl+K tra tutti i tipi di oggetto con corrispondenza approssimativa e cronologia recente.
- Palette di comandi del pannello di controllo con preferiti fisse, macro, gruppi personalizzati e suggerimenti per la modalità.
- 15 scorciatoie da tastiera centralizzate.
- Editor dei metadati del progetto (autore, licenza, categoria, tag).
- Statistiche di revisione (distribuzione dei ruoli, tipi di connessione, tipi di incontro, zone per distretto).
- Esportazione in formato ContentPack JSON, pacchetti di progetto e riepiloghi di revisione.
- Importazione da 4 formati con report dettagliati sulla fedeltà, suggerimenti di correzione e tracciamento delle differenze semantiche.

Consultare il file [`dogfood/WALKTHROUGH.md`](dogfood/WALKTHROUGH.md) per la procedura di esportazione di Chapel Threshold, che dimostra le funzionalità attuali.

## Directory di test interni

La directory `dogfood/` contiene un framework di test di integrazione che verifica l'intero processo di creazione e esportazione, al di fuori dei test unitari. L'esempio di Chapel Threshold (`chapel-threshold.ts`) crea un progetto di mondo piccolo ma completo, lo elabora tramite esportazione e scrive l'output nella directory `dogfood/output/`. Questo dimostra che i tipi di schema, la validazione e il processo di esportazione funzionano correttamente con dati reali, e non solo con simulazioni isolate.

## Compatibilità del motore

Le esportazioni sono destinate ai tipi di contenuto di [ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine). Il ContentPack esportato può essere caricato direttamente da [claude-rpg](https://github.com/mcp-tool-shop-org/claude-rpg).

## Sicurezza

- **Dati accessibili:** file di progetto sul disco locale (JSON creati dall'utente), nessun archivio dati lato server.
- **Dati NON accessibili:** nessuna telemetria, nessuna analisi, nessuna richiesta di rete al di fuori del server di sviluppo locale.
- **Permessi:** nessuna chiave API, nessun segreto, nessuna credenziale.
- **Nessun segreto, token o credenziali nel codice sorgente.**

## Licenza

MIT

---

Creato da [MCP Tool Shop](https://mcp-tool-shop.github.io/)
