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

<!-- versione:inizio -->
<p align="center"><strong>v4.5.0</strong> — 2360 tests + e2e browser checks, 6 shipping packages, 7 authoring modes, tiles + interiors + town authoring + world modeling (vertical strata, typed hazards, party-gated zones), three export targets (AI RPG Engine, Unreal Engine 5, Godot 4)</p>
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

## Guida rapida all’avvio

```bash
npm install
npm run build
npm run dev --workspace=packages/editor
```

Apri l’indirizzo `http://localhost:5173` per avviare l’editor.

### Flusso di lavoro dell’editor

1. **Scegli una modalità** — dungeon, distretto, mondo, oceano, spazio, interno o ambiente selvaggio — per impostare le impostazioni predefinite della griglia e il lessico delle connessioni.
2. **Inizia da un kit** — seleziona un kit iniziale o un modello di genere dal Gestore dei modelli oppure inizia con una tela vuota.
3. **Definisci le zone** — trascina sulla tela per creare le zone, collegarle e assegnare i distretti.
4. **Posiziona gli elementi** — aggiungi personaggi non giocanti (NPC), nemici, mercanti, incontri e oggetti nelle zone.
5. **Verifica** — apri la scheda di verifica per controllare lo stato di salute, visualizzare una panoramica dei contenuti ed esportare un riepilogo (in formato Markdown/JSON).
6. **Esporta** — apri la finestra modale di esportazione per visualizzare lo stato di preparazione per ciascun elemento (✓ Pronto / ⚠ Avvisi), configura le opzioni per gli elementi e quindi scarica i pacchetti AI RPG Engine, UE5 o Godot 4. Dopo l'esportazione, vengono forniti dettagli relativi alle dimensioni, al numero e alla qualità degli elementi. Sono disponibili anche pacchetti di progetto (.wfproject.json) e riepiloghi della verifica.

### Esportazione tramite interfaccia a riga di comando (CLI)

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

Tipi fondamentali di TypeScript e strumenti di validazione per la creazione di mondi virtuali.

- **Tipi spaziali:** `WorldMap`, `Zone`, `ZoneConnection`, `District`, `Landmark`, `SpawnPoint`, `EncounterAnchor`, `FactionPresence`, `PressureHotspot`
- **Tipi di contenuto:** `EntityPlacement`, `ItemPlacement`, `DialogueDefinition`, `PlayerTemplate`, `BuildCatalogDefinition`, `ProgressionTreeDefinition`
- **Livelli visivi:** `AssetEntry`, `AssetPack`, `Tileset`, `TileLayer`, `PropDefinition`, `PropPlacement`, `AmbientLayer`
- **Città e strutture:** `MarketNode`, `CraftingStation`, `Building`, `Hub`, `Stronghold`
- **Modellazione del mondo:** `Stratum` + `StratumLink` (livelli verticali), `HazardDefinition` (unione di effetti tipizzati), `ZoneEntryGate` + operatori relativi allo stato del gruppo in `SpawnCondition` (`party-level`, `party-size`, `item`, `flag`, `member`, `class`)
- **Sistema delle modalità:** `AuthoringMode` (7 modalità), profili specifici per ogni modalità relativi a griglia, connessioni e validazione
- **Validazione:** `validateProject()` (78 controlli strutturali con ricerche basate su mappe O(n), `warningCount`), `advisoryValidation()` (suggerimenti specifici per ogni modalità, completezza dei metadati, denominazione delle risorse)
- **Funzioni di supporto:** `assembleSceneData()` (collegamenti visivi con rilevamento di risorse mancanti), `scanDependencies()` (analisi del grafico delle dipendenze), `buildReviewSnapshot()` (classificazione dello stato)

### @world-forge/export-unreal

Converte un progetto `WorldProject` in un pacchetto di contenuti per Unreal Engine 5, ottimizzato per giochi 2.5D.

- **Output:** file `pack.json`, file JSON delle risorse dati primarie per zona e per distretto, elenco strutturato degli attori da generare, indicazioni sullo streaming dei livelli per connessione, indicazioni sulle celle della partizione del mondo e un report strutturato sulla fedeltà.
- **Campi 2.5D:** i campi `Zone.elevation`, `elevationRange`, `parallaxLayers` e `skylineRef` vengono preservati e convertiti in coordinate UE cm / Z-up.
- **Trasformazione delle coordinate:** funzioni pure (`pixelsToUnrealCm`, `elevationToZ`, `worldForgeToUnrealAxis`, `gridToUnrealAxis`). La scala predefinita del mondo è 1 tile = 100 cm.
- **Importazione completa:** `importFromUnreal` ricostruisce un WorldProject da un pacchetto Unreal; i dati relativi esclusivamente al gameplay (dialoghi, progressione, configurazioni) vengono contrassegnati come esclusi nel report sulla fedeltà.
- **CLI:** `world-forge-export-unreal` con le opzioni `--out`, `--tile-size-cm`, `--validate-only`, `--verbose`.

### @world-forge/esporta-per-Godot

Converte un progetto `WorldProject` in un pacchetto di contenuti per Godot 4, utilizzando il formato di testo `.tscn` per le scene.

- **Output** – file `pack.json`, risorse specifiche per ogni area, manifesto delle entità, collegamenti di navigazione, tabelle del bottino, marcatori di generazione, nodi di transizione, risorse di dialogo, associazioni degli asset e una scena del mondo in formato `.tscn`
- **Scena giocabile** – la funzione `buildWorldScene()` genera una scena `.tscn` navigabile: collisione `StaticBody2D` specifica per ogni area + `NavigationRegion2D`, una telecamera `Camera2D` incorniciata e ordinamento verticale / profondità `z_index`
- **Tessere e interni** – `TileMapLayer` + `TileSet` (dati delle tessere precalcolati per le immagini), collisione `StaticBody2D` per ogni cella, posizionamento di elementi scenici (`Node2D`)
- **Città** – mercati + stazioni di creazione e edifici (ingombro `StaticBody2D`) / hub / fortezze come segnaposto `Node2D`, tutti contenenti i propri dati come metadati
- **Modellazione del mondo** – strati verticali (suddivisione per area tramite `z_index` + connettori `StratumLink`), pericoli tipizzati come regioni `Area2D` e metadati relativi all’ingresso di ogni area
- **Monitoraggio della fedeltà** – tracciamento strutturato dei dati non compressi, approssimati e persi, verificato rispetto al motore Godot 4 reale (rendering senza interfaccia grafica, 36 asserzioni)
- **Versione del formato** – `GODOT_PACK_FORMAT_VERSION` 1.0.0

### @world-forge/esporta-dati-per-gioco-di-ruolo-con-intelligenza-artificiale

Converte un progetto di tipo «WorldProject» nel formato «ContentPack» utilizzato da ai-rpg-engine.

- **Esportazione:** zone, distretti, entità, elementi, dialoghi, modello del giocatore, catalogo di oggetti, alberi di progressione, incontri, fazioni, punti di interesse, file manifest e metadati del pacchetto.
- **Importazione:** 8 convertitori inversi ricostruiscono un WorldProject a partire dal JSON esportato.
- **Report sulla fedeltà:** tracciamento strutturato degli elementi che sono stati preservati integralmente, approssimati o eliminati durante la conversione.
- **Rilevamento del formato:** rileva automaticamente i formati WorldProject, ExportResult, ContentPack e ProjectBundle.
- **CLI:** comando `world-forge-export` con le opzioni `--out`, `--validate-only` e `--verbose`.

### @world-forge/renderer-2d

Motore di rendering 2D basato su PixiJS: area di visualizzazione con funzioni di scorrimento e zoom, sovrapposizioni di aree con colorazione per distretto, frecce che indicano le connessioni, icone delle entità in base al ruolo, livelli a griglia e una mappa ridotta.

### @world-forge/editor

Applicazione web React 19 con Vite, che utilizza Zustand per la gestione dello stato, funzionalità di annullamento/ripetizione con etichette per le azioni, salvataggio automatico (con intervallo di 30 secondi, cronologia delle ultime 3 versioni e ripristino in caso di errore), protezione contro modifiche non salvate su tutti i percorsi di caricamento del progetto, possibilità di alternare tra tema chiaro e scuro, gestione dello stato attivo nelle finestre modali e passaggio tra gli strumenti tramite tastiera.

#### Schede dell'area di lavoro

| Scheda | Scopo |
|-----|---------|
| Mappa | Modifica di zone/entità/distretti sulla tela 2D |
| Oggetti | Albero gerarchico: distretti → zone → entità/punti di riferimento/aree di generazione |
| Giocatore | Modello giocatore con statistiche, inventario, equipaggiamento, area di generazione |
| Configurazioni | Archetipi, background, tratti, discipline, combinazioni |
| Alberi | Nodi di progressione con requisiti ed effetti |
| Dialogo | Modifica dei nodi, collegamento delle scelte, rilevamento di riferimenti interrotti |
| Predefiniti | Browser di predefiniti per regioni e incontri con possibilità di unire/sovrascrivere |
| Risorse | Libreria di risorse con ricerca filtrata per tipo, rilevamento di elementi orfani, pacchetti di risorse |
| Problemi | Validazione raggruppata in tempo reale con navigazione tramite clic per la messa a fuoco |
| Dipendenze | Scanner delle dipendenze con pulsanti di correzione integrati |
| Revisione | Dashboard sullo stato, panoramica dei contenuti, esportazione del riepilogo |
| Guida | Lista di controllo per il primo utilizzo con riferimento alle scorciatoie da tastiera |

#### Tela e modifica

- **Strumenti** — selezione, pittura delle zone, connessione, posizionamento entità, punto di riferimento, area di generazione
- **Selezione multipla** — clic con Shift, selezione tramite rettangolo, Ctrl+A; spostamento con annullamento atomico
- **Allineamento** — allineamento a 6 vie (sinistra/destra/alto/basso/centro orizzontale/centro verticale) e distribuzione orizzontale/verticale
- **Aggancio** — aggancio dinamico ai bordi/centri degli oggetti vicini durante il trascinamento, con linee guida visive
- **Ridimensionamento** — 8 punti di manipolazione per zona con aggancio al bordo, limitazione delle dimensioni minime, anteprima in tempo reale
- **Duplicazione** — Ctrl+D con ID, connessioni e assegnazioni di distretto rimappati
- **Copia/Incolla** — Ctrl+C / Ctrl+V con rimappatura degli ID e offset configurabile
- **Ciclo di clic** — ripetuti clic nella stessa posizione per scorrere gli oggetti sovrapposti
- **Menu contestuale** — clic destro per 7 azioni sensibili al contesto (proprietà, elimina, duplica, ecc.)
- **Anteprima della connessione** — linea tratteggiata ciano durante il posizionamento dello strumento di connessione
- **Minimappa** — panoramica 200×150 (in basso a destra), clic per passare alla posizione
- **Culling della viewport** — vengono renderizzati solo gli oggetti all'interno dei limiti visibili (margine di 64 pixel)
- **Statistiche sulle prestazioni** — attiva/disattiva la sovrapposizione di FPS/numero di oggetti/tempo di rendering
- **Visibilità per oggetto** — nasconde/mostra singoli oggetti (memorizzato in localStorage)
- **Livelli** — 7 interruttori di visibilità (griglia, connessioni, entità, punti di riferimento, aree di generazione, background, ambiente)

#### Navigazione e scorciatoie

- **Viewport** — panoramica/zoom della telecamera, zoom con la rotellina del mouse (ancorato al cursore), trascinamento con la barra spaziatrice/tasto centrale/clic destro, adattamento automatico ai contenuti, doppio clic per centrare
- **Ricerca** — Ctrl+K apre una sovrapposizione per trovare qualsiasi oggetto per nome/ID con corrispondenza approssimativa, navigazione da tastiera e cronologia delle ricerche recenti (localStorage)
- **Pannello velocità** — doppio clic destro per una tavolozza di comandi fluttuante con azioni sensibili al contesto, preferiti fissabili, macro e azioni rapide suggerite in base alla modalità
- **Scorciatoie da tastiera** — 21 scorciatoie da tastiera tra cui la selezione degli strumenti (V/Z/C/E/L/S), Invio (apre i dettagli), P (applica il predefinito), Shift+P (salva il predefinito), Ctrl+C/V (copia/incolla), spostamento con le frecce (Shift = 5×)
- **Accessibilità** — trappole di focus modali con Escape per chiudere, etichette ARIA su tutti i pulsanti con solo icone, albero degli oggetti navigabile da tastiera, indicatore di modifiche annunciato dallo screen reader. Le operazioni sulla tela spaziale (posizionamento, selezione tramite rettangolo, ridimensionamento, disegno delle connessioni, panoramica) rimangono basate sul puntatore

#### Importazione ed esportazione

- **ContentPack** — esportazione consapevole dell'obiettivo per AI RPG Engine, Unreal Engine 5 o Godot 4 con badge di prontezza per ogni obiettivo, opzioni configurabili (dimensione delle tessere, prefissi della scena, filtro dei bundle) e ricevute post-download
- **Bundle di progetto** — file `.wfproject.json` portatili con metadati di provenienza e informazioni sulle dipendenze
- **Bundle di kit** — esportazione/importazione `.wfkit.json` con validazione, gestione delle collisioni e tracciamento della provenienza
- **Importazione** — rileva automaticamente 4 formati con report strutturati sulla fedeltà
- **Diff** — tracciamento semantico delle modifiche dall'importazione
- **Anteprima scena** — composizione HTML/CSS in linea di tutti i collegamenti visivi della zona

## Modalità di creazione

World Forge separa il **genere** (fantasy, cyberpunk, pirata) dalla **modalità** (dungeon, oceano, spazio). Il genere è un elemento stilistico; la modalità definisce la scala. La modalità regola le impostazioni predefinite della griglia, il vocabolario delle connessioni, i suggerimenti di validazione, la formulazione della guida e il filtro dei predefiniti.

| Modalità | Griglia | Tessera | Connessioni chiave |
|------|------|------|-----------------|
| Dungeon | 30×25 | 32 | porta, scala, passaggio, segreto, pericolo |
| Distretto / Città | 50×40 | 32 | strada, porta, passaggio, portale |
| Regione / Mondo | 80×60 | 48 | strada, portale, passaggio |
| Oceano / Mare | 60×50 | 48 | canale, percorso, portale, pericolo |
| Spazio | 100×80 | 64 | attracco, salto iperdimensionale, passaggio, portale |
| Interno | 20×15 | 24 | porta, scala, passaggio, segreto |
| Natura selvaggia | 60×50 | 48 | sentiero, strada, passaggio, pericolo |

La modalità viene impostata durante la creazione di un progetto e memorizzata come `mode?: AuthoringMode` in `WorldProject`. Ogni modalità fornisce **impostazioni predefinite intelligenti**: i tipi di connessione, i ruoli delle entità, i nomi delle zone e i suggerimenti del pannello velocità si adattano automaticamente.

## Superficie di creazione

### Struttura del mondo

- Zone con disposizione spaziale, elementi adiacenti, uscite, illuminazione, rumore, pericoli ed elementi interattivi.
- 12 tipi di connessione (passaggio, porta, scala, strada, portale, segreto, pericolo, canale, percorso, punto di attracco, salto dimensionale, sentiero) con stili visivi distinti, ancoraggio dei bordi per il routing, frecce direzionali e stile tratteggiato condizionale.
- Distretti con controllo delle fazioni, profili economici, cursori di metriche, tag ed etichette con il nome del distretto nei centroidi delle zone.
- Punti di riferimento (punti di interesse nominati all'interno delle zone).
- Punti di generazione, ancoraggi per incontri (colorazione basata sul tipo), presenza di fazioni e punti caldi di pressione.
- **Strati verticali:** livelli discreti (superficie/sotterraneo/cielo o piani dell'edificio) con ordine definito, intervallo Z, visibilità tra i livelli e connettori (scale/scalette/ascensori); le zone vengono assegnate a uno strato.
- **Pericoli ambientali tipizzati:** una libreria condivisa di pericoli (effetti di danno/stato/uccisione istantanea/incendio, tempistica dell'attivazione, costo di movimento del terreno, transitabilità, blocco della visuale, condizioni meteorologiche) a cui si fa riferimento per ogni zona.
- **Portali di ingresso alle zone:** accesso tramite portale in base allo stato del gruppo (livello/dimensione/oggetti/flag/membri/classi), come porta rigida o indicativa con una motivazione "mostra la serratura" definita dall'autore.

### Contenuti

- Posizionamento di entità con statistiche, risorse, profili IA e metadati personalizzati.
- Posizionamento di oggetti con slot, rarità, modificatori delle statistiche e abilità concesse.
- Alberi di dialogo con conversazioni ramificate, condizioni ed effetti.
- Ancoraggi per incontri sulla tela: marcatori a forma di diamante rosso con tipi di boss/imboscata/pattuglia.

### Città e interni

- Pittura delle tessere: set di tessere basati su immagini (suddivisione per riga/colonna) con fallback a rettangoli colorati, pennello trascinabile, livelli e "transitabilità" per ogni tessera per la collisione con i muri.
- Posizionamento di oggetti d'arredo per gli interni (palette + rendering sulla tela), con uno strumento di posizionamento.
- Economia della città: nodi del mercato (categorie di approvvigionamento, modificatore dei prezzi, merce di contrabbando) e stazioni di creazione (tipo di stazione, ricette), modificati per ogni zona.
- Strutture cittadine: edifici (impronte percorribili con collegamento alla zona interna), hub (nodi di servizio + connettività) e fortezze (sedi fortificate delle fazioni).

### Sistemi dei personaggi

- Modello del giocatore (statistiche iniziali, inventario, equipaggiamento, punto di generazione).
- Catalogo di build (archetipi, background, tratti, discipline, titoli trasversali, relazioni).
- Alberi di progressione (nodi di abilità con requisiti ed effetti).

### Risorse

- Manifest degli asset (ritratti, sprite, sfondi, icone, set di tessere) con associazioni specifiche per tipo.
- Pacchetti di asset (gruppi nominati e versionati con metadati di compatibilità, tema, licenza).
- Anteprima della scena (composizione in linea di tutti gli elementi visivi della zona con rilevamento degli asset mancanti).

### Flusso di lavoro

- Preset di regione (9 predefiniti, filtrati per modalità) e preset di incontro (10 predefiniti) con applicazione di fusione/sovrascrittura e CRUD personalizzato dei preset.
- Kit iniziali (7 predefiniti, specifici per la modalità) con esportazione/importazione del kit (`.wfkit.json`), gestione delle collisioni e tracciamento della provenienza.
- Modelli di layout (6 disposizioni di zona predefinite) e modelli di dialogo (5 frasi di apertura).
- Fusione di zone e posizionamento in batch di entità (modelli a griglia/casuale/circolare).
- Salvataggio automatico con intervallo di 30 secondi e cronologia di ripristino di 3 versioni.
- Ricerca Ctrl+K su tutti i tipi di oggetti con corrispondenza approssimativa e cronologia recente.
- Pannello della velocità: tavolozza dei comandi con preferiti fissabili, macro, gruppi personalizzati e suggerimenti per la modalità.
- 21 scorciatoie da tastiera centralizzate (incluse 6 chiavi per il cambio strumento).
- Editor dei metadati del progetto (autore, licenza, categoria, tag).
- Statistiche di revisione (distribuzione dei ruoli, tipi di connessione, tipi di incontro, zone per distretto).
- Esportazione in ContentPack JSON, pacchetti di progetto e riepiloghi di revisione.
- Importazione da 4 formati con segnalazione strutturata della fedeltà, suggerimenti di correzione e tracciamento delle differenze semantiche.

Consultare [`dogfood/WALKTHROUGH.md`](dogfood/WALKTHROUGH.md) per l'esempio dell'handshake di esportazione Chapel Threshold che dimostra la configurazione attuale.

## Directory Dogfood

La directory `dogfood/` contiene un insieme di test di integrazione che esegue l'intero flusso di lavoro dall'autore all'esportazione al di fuori dei test unitari. L'esempio Chapel Threshold (`chapel-threshold.ts`) crea un piccolo ma completo progetto del mondo, lo elabora tramite l'esportazione e scrive l'output in `dogfood/output/`. Ciò dimostra che i tipi di schema, la convalida e il flusso di lavoro di esportazione funzionano end-to-end con dati reali, non solo con simulacri isolati.

## Compatibilità del motore

L'esportazione è destinata a tre motori:

- **[ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine)**: formato ContentPack, caricabile da [claude-rpg](https://github.com/mcp-tool-shop-org/claude-rpg).
- **Unreal Engine 5:** pacchetto di contenuti consapevole del 2.5D con Asset dati primari, manifesti di generazione degli attori e suggerimenti per la partizione del mondo.
- **Godot 4:** generazione di scene `.tscn` con risorse di zona, collegamenti di navigazione e manifesti di entità.

## Sicurezza

- **Dati interessati:** file di progetto sul disco locale (JSON creato dall'utente), nessun archivio lato server.
- **Dati NON interessati:** nessuna telemetria, nessuna analisi, nessuna richiesta di rete oltre al server di sviluppo locale.
- **Autorizzazioni:** nessuna chiave API, nessun segreto, nessuna credenziale.
- **Nessun segreto, token o credenziale nel codice sorgente.**

## Licenza

MIT

---

Creato da [MCP Tool Shop](https://mcp-tool-shop.github.io/)
