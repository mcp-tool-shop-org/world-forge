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

The company is committed to providing high-quality products and services.
La società si impegna a fornire prodotti e servizi di alta qualità.
<!-- version:end -->
<p align="center"><strong>v4.4.0</strong> — 2067 tests, 5 shipping packages + 1 planned Godot stub (6 total), 7 authoring modes, 2.5D authoring, Unreal pack versioning + signing + diff</p>
<!-- version:end -->

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

## Avvio rapido

```bash
npm install
npm run build
npm run dev --workspace=packages/editor
```

Per avviare l'editor, aprire l'indirizzo `http://localhost:5173`.

### Flusso di lavoro per gli editor

1. **Scegli una modalità** – dungeon, distretto, mondo, oceano, spazio, interno o natura selvaggia – per impostare le opzioni predefinite della griglia e il vocabolario delle connessioni.
2. **Inizia con un kit** – scegli un kit di partenza o un modello di genere dal gestore dei modelli, oppure inizia da zero.
3. **Definisci le aree** – trascina sulla tela per creare aree, collegale e assegna i distretti.
4. **Posiziona gli elementi** – trascina personaggi non giocanti, nemici, mercanti, incontri e oggetti all'interno delle aree.
5. **Controlla** – apri la scheda "Controlla" per visualizzare lo stato di salute, una panoramica dei contenuti e per esportare un riepilogo (in formato Markdown/JSON).
6. **Esporta** – scarica un ContentPack, un pacchetto di progetto (.wfproject.json) o un riepilogo.

### Esportazione tramite interfaccia a riga di comando

```bash
npx world-forge-export project.json --out ./my-pack
npx world-forge-export project.json --validate-only
```

## Pacchetti

### @world-forge/schema

Tipi TypeScript fondamentali e validazione per la creazione di contenuti.

- **Tipi di elementi spaziali** — `WorldMap` (mappa del mondo), `Zone` (zona), `ZoneConnection` (connessione tra zone), `District` (distretto), `Landmark` (punto di riferimento), `SpawnPoint` (punto di generazione), `EncounterAnchor` (ancora di incontro), `FactionPresence` (presenza di una fazione), `PressureHotspot` (punto di pressione).
- **Tipi di contenuti** — `EntityPlacement` (posizionamento di entità), `ItemPlacement` (posizionamento di oggetti), `DialogueDefinition` (definizione del dialogo), `PlayerTemplate` (modello del giocatore), `BuildCatalogDefinition` (definizione del catalogo delle costruzioni), `ProgressionTreeDefinition` (definizione dell'albero di progressione).
- **Livelli visivi** — `AssetEntry` (voce di risorsa), `AssetPack` (pacchetto di risorse), `Tileset` (set di tessere), `TileLayer` (livello di tessere), `PropDefinition` (definizione di un oggetto), `AmbientLayer` (livello ambientale).
- **Sistema di modalità** — `AuthoringMode` (7 modalità), profili di griglia/connessione/validazione specifici per ogni modalità.
- **Validazione** — `validateProject()` (54 controlli strutturali con ricerche basate sulla mappa O(n), `warningCount`), `advisoryValidation()` (suggerimenti specifici per ogni modalità, completezza dei metadati, denominazione delle risorse).
- **Utilità** — `assembleSceneData()` (associazione visiva con rilevamento di risorse mancanti), `scanDependencies()` (analisi del grafo delle dipendenze), `buildReviewSnapshot()` (classificazione dello stato di salute).

### @world-forge/export-unreal

Converte un progetto "WorldProject" in un pacchetto di contenuti ottimizzato per Unreal Engine 5, pensato specificamente per giochi in 2.5D.

- **Output:** `pack.json`, file JSON contenenti i dati primari per zona e per distretto, un file manifest che raggruppa le istanze degli attori, suggerimenti per lo streaming dei livelli per ogni connessione, suggerimenti per le celle della partizione del mondo e un rapporto di accuratezza strutturato.
- **Campi 2.5D:** `Zone.elevation`, `elevationRange`, `parallaxLayers`, `skylineRef` vengono preservati e convertiti in coordinate UE in centimetri / asse Z verso l'alto.
- **Trasformazione delle coordinate:** funzioni pure (`pixelsToUnrealCm`, `elevationToZ`, `worldForgeToUnrealAxis`, `gridToUnrealAxis`). La scala del mondo predefinita è 1 tile = 100 cm.
- **Importazione e esportazione:** `importFromUnreal` ricostruisce un progetto di mondo da un pacchetto Unreal; i dati relativi esclusivamente al gameplay (dialoghi, progressione, costruzioni) vengono contrassegnati come non inclusi nel rapporto di accuratezza.
- **Interfaccia a riga di comando (CLI):** `world-forge-export-unreal` con le opzioni `--out`, `--tile-size-cm`, `--validate-only`, `--verbose`.

### @world-forge/export-godot

Spazio di lavoro riservato per la futura funzionalità di esportazione di Godot 4 (progetto "Fractured Road"). Funzionalità non ancora implementata.

### @world-forge/esportazione-ai-rpg

Converte un oggetto di tipo `WorldProject` nel formato `ContentPack` utilizzato da ai-rpg-engine.

- **Esportazione** — zone, distretti, entità, elementi, dialoghi, modello del giocatore, catalogo delle costruzioni, alberi di progressione, incontri, fazioni, punti di interesse, file manifest e metadati dei pacchetti.
- **Importazione** — 8 convertitori inversi ricostruiscono un progetto WorldProject a partire da file JSON esportati.
- **Reportistica di accuratezza** — tracciamento strutturato di ciò che è stato preservato integralmente, approssimato o eliminato durante la conversione.
- **Rilevamento del formato** — rileva automaticamente i formati WorldProject, ExportResult, ContentPack e ProjectBundle.
- **Interfaccia a riga di comando (CLI)** — comando `world-forge-export` con le opzioni `--out`, `--validate-only` e `--verbose`.

### @world-forge/renderer-2d

Motore di rendering 2D basato su PixiJS: visualizzazione con possibilità di panoramica e zoom, sovrapposizioni di aree con colorazione dei distretti, frecce che indicano le connessioni, icone degli elementi in base al loro ruolo, livelli di tiles e una mappa in miniatura.

### @world-forge/editor

Applicazione web React 19 + Vite con gestione dello stato tramite Zustand, funzionalità di annullamento/ripetizione con etichette delle azioni, salvataggio automatico (con intervallo di 30 secondi e cronologia di 3 versioni), commutazione tra tema chiaro e scuro e protezione per evitare modifiche non salvate.

#### Schede di lavoro

| Scheda | Scopo |
|-----|---------|
| Mappa | Modifica di zone/entità/distretti sulla tela 2D. |
| Oggetti | Albero gerarchico: distretti → zone → entità/punti di riferimento/punti di spawn. |
| Giocatore | Modello di giocatore con statistiche, inventario, equipaggiamento, punto di spawn. |
| Costruzioni | Archetipi, background, tratti, discipline, combinazioni. |
| Alberi | Nodi di progressione con requisiti ed effetti. |
| Dialoghi | Modifica dei nodi, collegamento delle scelte, rilevamento di riferimenti interrotti. |
| Impostazioni predefinite | Browser di impostazioni predefinite per regioni e incontri con possibilità di unione/sovrascrittura. |
| Risorse | Libreria di risorse con ricerca filtrata per tipo, rilevamento di risorse orfane, pacchetti di risorse. |
| Problemi | Validazione raggruppata in tempo reale con navigazione tramite clic per mettere a fuoco. |
| Dipendenze | Scanner di dipendenze con pulsanti di correzione integrati. |
| Revisione | Cruscotto dello stato di salute, panoramica dei contenuti, esportazione riassuntiva. |
| Guida | Checklist per la prima esecuzione con riferimento alle scorciatoie. |

#### Tela e Modifica

- **Strumenti** — selezione, pittura di zone, connessione, posizionamento di entità, punto di riferimento, punto di spawn.
- **Selezione multipla** — clic con il tasto Shift, selezione a casella, Ctrl+A; spostamento con trascinamento con annullamento atomico.
- **Allineamento** — allineamento a 6 vie (sinistra/destra/alto/basso/centro-orizzontale/centro-verticale) e distribuzione orizzontale/verticale.
- **Aggancio** — aggancio durante il trascinamento ai bordi/centri degli oggetti vicini con linee guida visive.
- **Ridimensionamento** — 8 maniglie per zona con aggancio ai bordi, limitazione della dimensione minima, anteprima in tempo reale.
- **Duplicazione** — Ctrl+D con rimappatura degli ID, delle connessioni e degli assegnamenti ai distretti.
- **Copia/Incolla** — Ctrl+C / Ctrl+V con rimappatura degli ID e offset configurabile.
- **Ciclo con clic** — clic ripetuti nella stessa posizione alternano gli oggetti sovrapposti.
- **Menu contestuale** — clic destro per 7 azioni sensibili al contesto (proprietà, elimina, duplica, ecc.).
- **Anteprima della connessione** — linea tratteggiata ciano durante il posizionamento dello strumento di connessione.
- **Mini mappa** — panoramica di 200x150 (in basso a destra), clic per spostarsi.
- **Eliminazione della visualizzazione** — rende visibili solo gli oggetti all'interno dei limiti visibili (margine di 64 pixel).
- **Statistiche sulle prestazioni** — attiva la sovrapposizione FPS/numero di oggetti/tempo di rendering.
- **Visibilità per oggetto** — nascondi/mostra singoli oggetti (salvati in localStorage).
- **Livelli** — 7 interruttori di visibilità (griglia, connessioni, entità, punti di riferimento, punti di spawn, sfondi, ambiente).

#### Navigazione e Scorciatoie

- **Visualizzazione** — panoramica/zoom della telecamera, zoom con la rotellina del mouse (cursore ancorato), spazio/tasto centrale del mouse/clic destro per trascinare e panoramare, adattamento automatico al contenuto, doppio clic per centrare.
- **Ricerca** — Ctrl+K apre una sovrapposizione per trovare qualsiasi oggetto per nome/ID con corrispondenza approssimativa, navigazione tramite tastiera e cronologia delle ricerche recenti (localStorage).
- **Pannello di velocità** — doppio clic destro per una tavolozza di comandi fluttuante con azioni sensibili al contesto, preferiti fissabili, macro e suggerimenti di azioni rapide in base alla modalità.
- **Scorciatoie** — 15 scorciatoie da tastiera, tra cui Invio (apri i dettagli), P (applica impostazione predefinita), Shift+P (salva impostazione predefinita), Ctrl+C/V (copia/incolla).

#### Importazione ed Esportazione

- **ContentPack**: esportazione con un solo clic nel formato ai-rpg-engine, con validazione completa.
- **Pacchetti di progetto**: file `.wfproject.json` portabili, con metadati di provenienza e informazioni sulle dipendenze.
- **Pacchetti di kit**: esportazione/importazione di file `.wfkit.json` con validazione, gestione delle collisioni e tracciamento della provenienza.
- **Importazione**: rilevamento automatico di 4 formati, con report dettagliati sulla fedeltà.
- **Differenza (Diff)**: tracciamento delle modifiche semantiche a partire dall'importazione.
- **Anteprima della scena**: composizione inline di tutti i binding visivi delle zone tramite HTML/CSS.

## Modalità di creazione

World Forge separa il **genere** (fantasy, cyberpunk, piratesco) dalla **modalità** (dungeon, oceano, spazio). Il genere definisce l'atmosfera, mentre la modalità definisce la scala. La modalità governa le impostazioni predefinite della griglia, il vocabolario delle connessioni, i suggerimenti di validazione, la formulazione delle guide e i filtri predefiniti.

| Modalità | Griglia | Tile (piastrella) | Connessioni principali |
|------|------|------|-----------------|
| Dungeon (labirinto) | 30x25 | 32 | porta, scale, passaggio, segreto, pericolo |
| Distretto / Città | 50x40 | 32 | strada, porta, passaggio, portale |
| Regione / Mondo | 80x60 | 48 | strada, portale, passaggio |
| Oceano / Mare | 60x50 | 48 | canale, percorso, portale, pericolo |
| Spazio | 100x80 | 64 | attracco, salto iperspaziale, passaggio, portale |
| Interno | 20x15 | 24 | porta, scale, passaggio, segreto |
| Area selvaggia | 60x50 | 48 | sentiero, strada, passaggio, pericolo |

La modalità viene impostata durante la creazione del progetto e memorizzata come `mode?: AuthoringMode` in `WorldProject`. Ogni modalità fornisce **impostazioni predefinite intelligenti**: i tipi di connessione, i ruoli delle entità, i nomi delle zone e i suggerimenti del pannello di controllo si adattano automaticamente.

## Superficie di creazione

### Struttura del mondo

- Zone con layout spaziale, vicini, uscite, luce, rumore, pericoli e elementi interattivi.
- 12 tipi di connessione (passaggio, porta, scale, strada, portale, segreto, pericolo, canale, percorso, attracco, salto iperspaziale, sentiero) con stili visivi distinti, routing ancorato ai bordi, frecce direzionali e stile tratteggiato condizionale.
- Distretti con controllo delle fazioni, profili economici, slider di metriche, tag e etichette del nome del distretto nei centroidi delle zone.
- Punti di riferimento (punti di interesse nominati all'interno delle zone).
- Punti di spawn, ancoraggi di incontri (colorazione basata sul tipo), presenze di fazioni e punti caldi di pressione.

### Contenuti

- Posizionamenti di entità con statistiche, risorse, profili di intelligenza artificiale e metadati personalizzati.
- Posizionamenti di oggetti con slot, rarità, modificatori di statistiche e verbi concessi.
- Alberi di dialogo con conversazioni ramificate, condizioni ed effetti.
- Ancoraggi di incontri sulla tela: marcatori a forma di diamante rosso con tipi di boss/imboscata/pattuglia.

### Sistemi di personaggi

- Modello del giocatore (statistiche iniziali, inventario, equipaggiamento, punto di spawn).
- Catalogo delle build (archetipi, background, tratti, discipline, titoli incrociati, legami).
- Alberi di progressione (nodi di abilità con requisiti ed effetti).

### Risorse

- Manifest delle risorse (ritratti, sprite, sfondi, icone, set di piastrelle) con binding specifici per tipo.
- Pacchetti di risorse (raggruppamenti denominati e versionati con metadati di compatibilità, tema, licenza).
- Anteprima della scena (composizione inline di tutti i binding visivi delle zone con rilevamento delle risorse mancanti).

### Flusso di lavoro

- Impostazioni predefinite per le regioni (9 integrate, filtrate per modalità) e impostazioni predefinite per gli incontri (10 integrate) con possibilità di unione/sovrascrittura e gestione personalizzata delle impostazioni.
- Kit di partenza (7 integrati, specifici per modalità) con esportazione/importazione del kit (`.wfkit.json`), gestione delle collisioni e tracciamento della provenienza.
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

Consultare il file [`dogfood/WALKTHROUGH.md`](dogfood/WALKTHROUGH.md) per la dimostrazione della procedura di esportazione di Chapel Threshold, che verifica le funzionalità attuali.

## Directory di Test Interni

La directory `dogfood/` contiene un ambiente di test di integrazione che verifica l'intero processo di creazione e esportazione, al di fuori dei test unitari. L'esempio di Chapel Threshold (`chapel-threshold.ts`) crea un progetto di mondo piccolo ma completo, lo elabora tramite esportazione e scrive l'output nella directory `dogfood/output/`. Questo dimostra che i tipi di schema, la convalida e il processo di esportazione funzionano correttamente con dati reali, e non solo con simulazioni isolate.

## Compatibilità con il Motore

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
