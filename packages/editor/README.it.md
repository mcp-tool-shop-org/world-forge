<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.md">English</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./logo.png" alt="World Forge" width="400">
</p>

# @world-forge/editor

Applicazione web React 19 per [World Forge](https://github.com/mcp-tool-shop-org/world-forge) — uno studio di creazione di mondi 2D per il motore di giochi di ruolo AI.

## Funzionalità

- **Canvas** — Disegnare aree, creare collegamenti, posizionare entità, punti di riferimento e incontri su una griglia 2D con visualizzazione zoomabile.
- **Selezione multipla** — Cliccare, fare clic con il tasto Shift e selezionare aree, entità, punti di riferimento, spawn e incontri; spostare gli oggetti selezionati con operazioni di annullamento.
- **Creazione di incontri** — Posizionare punti di ancoraggio per gli incontri nelle aree, con marcatori sul canvas basati sul tipo (boss, imboscata, pattuglia), proprietà modificabili (ID dei nemici, probabilità, tempo di ricarica, tag).
- **Modifica dei distretti** — Pannello dei distretti ampliato con slider di metriche, tag, fazione controllante, profilo economico, gestione della presenza della fazione e modifica dei punti di pressione.
- **Modifica in blocco** — Assegnazione in blocco dei distretti, aggiunta in blocco di tag e cancellazione in blocco quando sono selezionate più aree.
- **Sistema di preset** — Preset per regioni e incontri con possibilità di unione/sovrascrittura, 4 preset di regione predefiniti, 3 preset di incontro predefiniti, gestione CRUD dei preset personalizzati con persistenza in localStorage.
- **Scorciatoie da tastiera** — Registro centralizzato delle scorciatoie con 13 combinazioni: Escape, Ctrl+A, Ctrl+D, Ctrl+K, Canc, spostamento con le frecce, Invio (apre i dettagli), P (applica preset), Shift+P (salva preset).
- **Doppio clic** — Doppio clic su qualsiasi oggetto del canvas per selezionarlo, passare alla scheda "Mappa" e centrare la visualizzazione.
- **Pannello rapido** — Doppio clic con il tasto destro del mouse sul canvas per aprire una palette di comandi fluttuante con azioni contestuali, preferiti che possono essere fissati (riordinabili in modalità di modifica), azioni recenti, gruppi personalizzati, macro leggere con editor di passaggi, filtro di ricerca e navigazione da tastiera.
- **Schede di area di lavoro** — Mappa, Giocatore, Costruzioni, Alberi, Dialoghi, Oggetti, Preset, Risorse, Problemi, Guida.
- **Libreria di risorse** — Gestire ritratti, sprite, sfondi, icone e set di tile con associazioni specifiche per tipo.
- **Annulla/Ripeti** — Stack di cronologia fino a 10 livelli tramite Zustand.
- **Importazione/Esportazione** — Reportistica di fedeltà bidirezionale, tracciamento delle differenze semantiche.
- **Validazione** — 54 controlli strutturali con navigazione dei problemi tramite clic.
- **Modelli** — Punti di partenza per generi e mondi di esempio per una rapida introduzione.

## Guida rapida

```bash
npm install
npm run dev --workspace=packages/editor
```

Aprire `http://localhost:5173` per avviare l'editor.

## Licenza

MIT
