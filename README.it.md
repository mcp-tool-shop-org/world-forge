<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.md">English</a> | <a href="README.pt-BR.md">Português (BR)</a>
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

## Architettura

```
packages/
  schema/          @world-forge/schema        — spatial types, validation
  export-ai-rpg/   @world-forge/export-ai-rpg — engine export pipeline + CLI
  renderer-2d/     @world-forge/renderer-2d   — PixiJS 2D canvas renderer
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

### Esportazione da Riga di Comando

```bash
npx world-forge-export project.json --out ./my-pack
npx world-forge-export project.json --validate-only
```

## Pacchetti

### @world-forge/schema

Tipi e validazione TypeScript fondamentali per la creazione di mondi.

- **Tipi spaziali** — `WorldMap`, `Zone`, `ZoneConnection`, `District`, `Landmark`, `SpawnPoint`, `EncounterAnchor`, `FactionPresence`, `PressureHotspot`
- **Tipi di contenuto** — `EntityPlacement`, `ItemPlacement`, `DialogueDefinition`, `PlayerTemplate`, `BuildCatalogDefinition`, `ProgressionTreeDefinition`
- **Livelli visivi** — `AssetEntry`, `AssetPack`, `Tileset`, `TileLayer`, `PropDefinition`, `AmbientLayer`
- **Sistema di modalità** — `AuthoringMode` (7 modalità), profili specifici per la modalità per la griglia/connessioni/validazione.
- **Validazione** — `validateProject()` (54 controlli strutturali), `advisoryValidation()` (suggerimenti specifici per la modalità)
- **Utilità** — `assembleSceneData()` (associazione visiva con rilevamento di risorse mancanti), `scanDependencies()` (analisi del grafo delle dipendenze), `buildReviewSnapshot()` (classificazione dello stato di salute)

### @world-forge/export-ai-rpg

Converte un `WorldProject` nel formato `ContentPack` di ai-rpg-engine.

- **Esportazione** — zone, distretti, entità, oggetti, dialoghi, modello del giocatore, catalogo delle costruzioni, alberi di progressione, incontri, fazioni, punti caldi, manifest e metadati del pacchetto.
- **Importazione** — 8 convertitori inversi ricostruiscono un WorldProject dai file JSON esportati.
- **Reportistica sulla fedeltà** — tracciamento strutturato di ciò che è stato mantenuto inalterato, approssimato o eliminato durante la conversione.
- **Rilevamento del formato** — rileva automaticamente i formati WorldProject, ExportResult, ContentPack e ProjectBundle.
- **Riga di comando** — comando `world-forge-export` con i flag `--out` e `--validate-only`.

### @world-forge/renderer-2d

Renderer 2D basato su PixiJS: viewport con pan/zoom, sovrapposizioni di zone con colorazione dei distretti, frecce di connessione, icone delle entità per ruolo, livelli di tile e una minimappa.

### @world-forge/editor

Applicazione web React 19 + Vite con gestione dello stato Zustand e funzionalità di annullamento/ripetizione.

#### Schede dell'Area di Lavoro

| Scheda | Scopo |
|-----|---------|
| Mappa | Modifica di zone/entità/distretti sulla tela 2D. |
| Oggetti | Albero gerarchico: distretti → zone → entità/monumenti/punti di spawn. |
| Giocatore | Modello del giocatore con statistiche, inventario, equipaggiamento e punto di spawn. |
| Costruzioni | Archetipi, background, tratti, discipline, combinazioni. |
| Alberi | Nodi di progressione con requisiti ed effetti. |
| Dialogo | Modifica dei nodi, collegamento delle scelte, rilevamento di riferimenti interrotti. |
| Impostazioni predefinite | Browser di impostazioni predefinite per regioni e incontri con funzionalità di unione/sovrascrittura. |
| Risorse | Libreria di risorse con ricerca filtrata per tipo, rilevamento di risorse orfane e pacchetti di risorse. |
| Problemi | Validazione raggruppata in tempo reale con navigazione tramite clic per mettere a fuoco. |
| Dipendenze | Scanner di dipendenze con pulsanti di correzione integrati. |
| Revisione | Pannello di controllo della salute, panoramica dei contenuti, esportazione riassuntiva. |
| Guida | Checklist per la prima esecuzione con riferimento alle scorciatoie. |

#### Area di disegno e modifica

- **Strumenti** — selezione, disegno di aree, connessione, posizionamento di entità, punto di riferimento, generazione.
- **Selezione multipla** — clic con il tasto Shift, selezione a casella, Ctrl+A; trascinamento con annullamento atomico.
- **Allineamento** — allineamento a 6 vie (sinistra/destra/alto/basso/centro orizzontale/centro verticale) e distribuzione orizzontale/verticale.
- **Aggancio** — aggancio al trascinamento ai bordi/centri degli oggetti vicini con linee guida visive.
- **Ridimensionamento** — 8 maniglie per area con aggancio ai bordi, limitazione della dimensione minima, anteprima in tempo reale.
- **Duplicazione** — Ctrl+D con reindirizzamento degli ID, delle connessioni e degli assegnamenti di area.
- **Ciclo con il clic** — clic ripetuti nella stessa posizione alternano gli oggetti sovrapposti.
- **Livelli** — 7 interruttori di visibilità (griglia, connessioni, entità, punti di riferimento, generazioni, sfondi, elementi ambientali).

#### Navigazione e scorciatoie

- **Area di visualizzazione** — panoramica/zoom della telecamera, zoom con rotellina del mouse (cursore ancorato), barra spaziatrice/tasto centrale del mouse/clic destro per trascinare e panoramare, adattamento automatico al contenuto, doppio clic per centrare.
- **Ricerca** — Ctrl+K apre una sovrapposizione per trovare qualsiasi oggetto per nome/ID con navigazione tramite tastiera.
- **Pannello di velocità** — doppio clic destro per una tavolozza di comandi fluttuante con azioni contestuali, preferiti fissabili, macro e suggerimenti di azioni rapide in base alla modalità.
- **Scorciatoie** — 13 scorciatoie da tastiera, tra cui Invio (apri dettagli), P (applica preset), Shift+P (salva preset).

#### Importazione ed esportazione

- **Pacchetto di contenuti** — esportazione con un clic in formato ai-rpg-engine con convalida completa.
- **Pacchetti di progetto** — file `.wfproject.json` portabili con metadati di provenienza e informazioni sulle dipendenze.
- **Pacchetti di kit** — esportazione/importazione di `.wfkit.json` con convalida, gestione delle collisioni e tracciamento della provenienza.
- **Importazione** — rileva automaticamente 4 formati con report strutturati sulla fedeltà.
- **Differenza** — tracciamento delle modifiche semantiche dall'importazione.
- **Anteprima della scena** — composizione HTML/CSS inline di tutti i binding visivi delle aree.

## Modalità di creazione

World Forge separa il **genere** (fantasy, cyberpunk, piratesco) dalla **modalità** (dungeon, oceano, spazio). Il genere è un elemento di stile, mentre la modalità definisce la scala. La modalità governa le impostazioni predefinite della griglia, il vocabolario delle connessioni, i suggerimenti di convalida, la formulazione delle guide e il filtraggio dei preset.

| Modalità | Griglia | Piastrellato | Connessioni chiave |
|------|------|------|-----------------|
| Dungeon | 30×25 | 32 | porta, scale, passaggio, segreto, pericolo |
| Distretto / Città | 50×40 | 32 | strada, porta, passaggio, portale |
| Regione / Mondo | 80×60 | 48 | strada, portale, passaggio |
| Oceano / Mare | 60×50 | 48 | canale, percorso, portale, pericolo |
| Spazio | 100×80 | 64 | attracco, salto, passaggio, portale |
| Interno | 20×15 | 24 | porta, scale, passaggio, segreto |
| Selvaggio | 60×50 | 48 | sentiero, strada, passaggio, pericolo |

La modalità viene impostata durante la creazione di un progetto e memorizzata come `mode?: AuthoringMode` in `WorldProject`. Ogni modalità fornisce **impostazioni predefinite intelligenti** — tipi di connessione, ruoli delle entità, nomi delle aree e suggerimenti del pannello di velocità si adattano automaticamente.

## Superficie di creazione

### Struttura del mondo

- Aree con disposizione spaziale, vicini, uscite, illuminazione, rumore, pericoli e elementi interattivi.
- 12 tipi di connessioni (passaggio, porta, scale, strada, portale, segreto, pericolo, canale, percorso, attracco, teletrasporto, traccia) con stili visivi distinti, ancoraggio ai bordi, frecce direzionali e stile tratteggiato condizionale.
- Distretti con controllo delle fazioni, profili economici, slider di metriche, tag e etichette con il nome del distretto posizionate nei centroidi delle aree.
- Punti di riferimento (punti di interesse nominati all'interno delle aree).
- Punti di spawn, punti di incontro (colorazione basata sul tipo), presenza delle fazioni e punti critici di pressione.

### Contenuti

- Posizionamento di entità con statistiche, risorse, profili di intelligenza artificiale e metadati personalizzati.
- Posizionamento di oggetti con slot, rarità, modificatori di statistiche e verbi associati.
- Alberi di dialogo con conversazioni ramificate, condizioni ed effetti.
- Punti di incontro sulla tela: marcatori a forma di diamante rosso con tipi di boss/imboscata/pattuglia.

### Sistemi dei Personaggi

- Modello del giocatore (statistiche iniziali, inventario, equipaggiamento, punto di spawn).
- Catalogo delle classi (archetipi, background, tratti, discipline, titoli multipli, relazioni).
- Alberi di progressione (nodi di abilità con requisiti ed effetti).

### Risorse

- Manifest dei file (ritratti, sprite, sfondi, icone, set di tile) con associazioni specifiche per tipo.
- Pacchetti di risorse (gruppi nominati e versionati con metadati di compatibilità, tema e licenza).
- Anteprima della scena (composizione inline di tutti i binding visivi delle aree con rilevamento di risorse mancanti).

### Flusso di Lavoro

- Impostazioni predefinite delle regioni (9 integrate, filtrate per modalità) e impostazioni predefinite degli incontri (10 integrate) con applicazione di unione/sovrascrittura e gestione CRUD delle impostazioni predefinite personalizzate.
- Kit di avvio (7 integrati, specifici per modalità) con esportazione/importazione del kit (`.wfkit.json`), gestione delle collisioni e tracciamento della provenienza.
- Ricerca con Ctrl+K tra tutti i tipi di oggetti, incluse le connessioni e gli incontri.
- Palette di comandi del pannello di velocità con preferiti fissabili, macro, gruppi personalizzati e suggerimenti per la modalità.
- 13 scorciatoie da tastiera centralizzate.
- Esportazione in formato ContentPack JSON, bundle di progetto e riepiloghi di revisione.
- Importazione da 4 formati con report dettagliati e tracciamento delle differenze semantiche.

Consultare [`dogfood/WALKTHROUGH.md`](dogfood/WALKTHROUGH.md) per la procedura di esportazione di Chapel Threshold che dimostra la versione corrente.

## Compatibilità con il Motore

Le esportazioni sono destinate ai tipi di contenuto di [ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine). Il ContentPack esportato può essere caricato direttamente da [claude-rpg](https://github.com/mcp-tool-shop-org/claude-rpg).

## Sicurezza

- **Dati accessibili:** file di progetto sul disco locale (JSON creati dall'utente), nessuna memorizzazione lato server.
- **Dati NON accessibili:** nessuna telemetria, nessuna analisi, nessuna richiesta di rete al di là del server di sviluppo locale.
- **Permessi:** nessuna chiave API, nessun segreto, nessuna credenziale.
- **Nessun segreto, token o credenziali nel codice sorgente.**

## Licenza

MIT

---

Creato da [MCP Tool Shop](https://mcp-tool-shop.github.io/)
