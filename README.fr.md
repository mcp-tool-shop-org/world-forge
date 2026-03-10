<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.md">English</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
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

## Architecture

```
packages/
  schema/          @world-forge/schema        — spatial types, validation
  export-ai-rpg/   @world-forge/export-ai-rpg — engine export pipeline + CLI
  renderer-2d/     @world-forge/renderer-2d   — PixiJS 2D canvas renderer
  editor/          @world-forge/editor         — React web authoring app
```

## Démarrage rapide

```bash
npm install
npm run build
npm run dev --workspace=packages/editor
```

Ouvrez `http://localhost:5173` pour lancer l'éditeur.

### Flux de travail de l'éditeur

1. **Choisissez un mode** — donjon, district, monde, océan, espace, intérieur ou nature — pour définir les paramètres par défaut de la grille et le vocabulaire des connexions.
2. **Commencez avec un kit** — choisissez un kit de démarrage ou un modèle de genre dans le gestionnaire de modèles, ou commencez un projet vide.
3. **Dessinez des zones** — faites glisser sur la zone de dessin pour créer des zones, connectez-les et assignez des districts.
4. **Placez des entités** — déposez des PNJ, des ennemis, des marchands, des rencontres et des objets sur les zones.
5. **Vérifiez** — ouvrez l'onglet "Vérification" pour consulter l'état de santé, l'aperçu du contenu et exporter un résumé (Markdown/JSON).
6. **Exportez** — téléchargez un ContentPack, un bundle de projet (.wfproject.json) ou un résumé de vérification.

### Exportation via la ligne de commande

```bash
npx world-forge-export project.json --out ./my-pack
npx world-forge-export project.json --validate-only
```

## Paquets

### @world-forge/schema

Types et validations TypeScript de base pour la création de mondes.

- **Types spatiaux** — `WorldMap`, `Zone`, `ZoneConnection`, `District`, `Landmark`, `SpawnPoint`, `EncounterAnchor`, `FactionPresence`, `PressureHotspot`
- **Types de contenu** — `EntityPlacement`, `ItemPlacement`, `DialogueDefinition`, `PlayerTemplate`, `BuildCatalogDefinition`, `ProgressionTreeDefinition`
- **Couches visuelles** — `AssetEntry`, `AssetPack`, `Tileset`, `TileLayer`, `PropDefinition`, `AmbientLayer`
- **Système de modes** — `AuthoringMode` (7 modes), profils de grille/connexion/validation spécifiques à chaque mode.
- **Validation** — `validateProject()` (54 vérifications structurelles), `advisoryValidation()` (suggestions spécifiques à chaque mode).
- **Utilitaires** — `assembleSceneData()` (liaisons visuelles avec détection des ressources manquantes), `scanDependencies()` (analyse du graphe de références), `buildReviewSnapshot()` (classification de l'état de santé).

### @world-forge/export-ai-rpg

Convertit un `WorldProject` au format `ContentPack` de ai-rpg-engine.

- **Exportation** — zones, districts, entités, objets, dialogues, modèle de joueur, catalogue de construction, arbres de progression, rencontres, factions, points chauds, manifeste et métadonnées du paquet.
- **Importation** — 8 convertisseurs inverses reconstruisent un WorldProject à partir de fichiers JSON exportés.
- **Rapport de fidélité** — suivi structuré de ce qui a été conservé sans perte, approximé ou supprimé lors de la conversion.
- **Détection de format** — détecte automatiquement les formats WorldProject, ExportResult, ContentPack et ProjectBundle.
- **Ligne de commande** — commande `world-forge-export` avec les drapeaux `--out` et `--validate-only`.

### @world-forge/renderer-2d

Rendu 2D basé sur PixiJS : vue avec panoramique/zoom, superpositions de zones avec coloration des districts, flèches de connexion, icônes d'entités par rôle, calques de tuiles et une mini-carte.

### @world-forge/editor

Application web React 19 + Vite avec gestion d'état Zustand et undo/redo.

#### Onglets de l'espace de travail

| Onglet | Fonction |
|-----|---------|
| Carte | Modification des zones/entités/districts sur la zone de dessin 2D. |
| Objets | Arbre hiérarchique : districts → zones → entités/points de repère/points de spawn. |
| Joueur | Modèle de joueur avec statistiques, inventaire, équipement et point de spawn. |
| Constructions | Archétypes, antécédents, traits, disciplines, combinaisons. |
| Arbres | Nœuds de progression avec exigences et effets. |
| Dialogue | Modification des nœuds, liens de choix, détection des références cassées. |
| Préconfigurations | Navigateur de préconfigurations de région et de rencontre avec fusion/remplacement. |
| Ressources | Bibliothèque de ressources avec recherche filtrée par type, détection des ressources orphelines et paquets de ressources. |
| Problèmes | Validation en direct regroupée avec navigation par clic pour la mise au point. |
| Dépendances | Analyseur de dépendances avec boutons de réparation intégrés. |
| Vérification | Tableau de bord de santé, aperçu du contenu, exportation récapitulative. |
| Guide | Liste de contrôle pour la première utilisation avec référence des raccourcis clavier. |

#### Zone de dessin et édition

- **Outils** — sélection, zone de peinture, connexion, placement d'entité, point de repère, apparition.
- **Sélection multiple** — clic avec la touche Shift, sélection par zone, Ctrl+A ; déplacement par glisser-déposer avec annulation atomique.
- **Alignement** — alignement sur 6 axes (gauche/droite/haut/bas/centre horizontal/centre vertical) et distribution horizontale/verticale.
- **Alignement automatique** — alignement automatique lors du déplacement par glisser-déposer aux bords/centres des objets proches, avec lignes de guidage visuelles.
- **Redimensionnement** — 8 poignées par zone avec alignement automatique aux bords, limitation de la taille minimale, aperçu en direct.
- **Duplication** — Ctrl+D avec réinitialisation des ID, des connexions et des attributions de district.
- **Cycle par clic** — les clics répétés au même endroit font défiler les objets superposés.
- **Calques** — 7 options de visibilité (grille, connexions, entités, points de repère, apparitions, arrière-plans, éléments d'ambiance).

#### Navigation et raccourcis

- **Zone d'affichage** — panoramique/zoom de la caméra, zoom avec la molette de la souris (avec ancrage du curseur), barre d'espace/clic central de la souris/clic droit pour le panoramique, ajustement automatique à la taille du contenu, double-clic pour centrer.
- **Recherche** — Ctrl+K ouvre une fenêtre superposée pour rechercher n'importe quel objet par nom/ID, avec navigation au clavier.
- **Panneau de vitesse** — double-clic droit pour un volet de commandes flottant avec actions contextuelles, favoris épinglables, macros et suggestions d'actions rapides en fonction du mode.
- **Raccourcis clavier** — 13 raccourcis clavier, dont Entrée (ouvrir les détails), P (appliquer un préréglage), Shift+P (sauvegarder un préréglage).

#### Importation et exportation

- **Paquet de contenu** — exportation en un clic au format ai-rpg-engine avec validation complète.
- **Fichiers de projet** — fichiers `.wfproject.json` portables avec métadonnées d'origine et informations sur les dépendances.
- **Kits** — exportation/importation de fichiers `.wfkit.json` avec validation, gestion des collisions et suivi de l'origine.
- **Importation** — détection automatique de 4 formats avec rapport structuré de fidélité.
- **Différences** — suivi des modifications sémantiques depuis l'importation.
- **Aperçu de la scène** — composition HTML/CSS intégrée de toutes les liaisons visuelles des zones.

## Modes de création

World Forge sépare le **genre** (fantaisie, cyberpunk, pirate) du **mode** (donjon, océan, espace). Le genre est une question de style — le mode est une question d'échelle. Le mode détermine les paramètres par défaut de la grille, le vocabulaire des connexions, les suggestions de validation, la formulation des guides et le filtrage des préréglages.

| Mode | Grille | Tuile | Connexions clés |
|------|------|------|-----------------|
| Donjon | 30×25 | 32 | porte, escalier, passage, secret, danger |
| District / Ville | 50×40 | 32 | route, porte, passage, portail |
| Région / Monde | 80×60 | 48 | route, portail, passage |
| Océan / Mer | 60×50 | 48 | canal, route, portail, danger |
| Espace | 100×80 | 64 | amarrage, saut warp, passage, portail |
| Intérieur | 20×15 | 24 | porte, escalier, passage, secret |
| Nature | 60×50 | 48 | sentier, route, passage, danger |

Le mode est défini lors de la création d'un projet et stocké sous la forme `mode?: AuthoringMode` dans `WorldProject`. Chaque mode fournit des **paramètres par défaut intelligents** — les types de connexions, les rôles des entités, les noms des zones et les suggestions du panneau de vitesse s'adaptent automatiquement.

## Surface de création

### Structure du monde

- Zones avec disposition spatiale, voisins, sorties, éclairage, bruit, dangers et éléments interactifs.
- 12 types de connexions (passage, porte, escalier, route, portail, secret, danger, canal, itinéraire, amarrage, téléportation, sentier) avec des styles visuels distincts, routage ancré aux bords, flèches directionnelles et styles pointillés conditionnels.
- Districts avec contrôle des factions, profils économiques, curseurs de métriques, étiquettes et noms de districts affichés aux centres des zones.
- Points d'intérêt (lieux nommés situés dans les zones).
- Points de départ, points d'ancrage d'événements (coloration basée sur le type), présence des factions et points chauds de pression.

### Contenu

- Placements d'entités avec statistiques, ressources, profils d'IA et métadonnées personnalisées.
- Placements d'objets avec emplacement, rareté, modificateurs de statistiques et verbes associés.
- Arbres de dialogue avec conversations ramifiées, conditions et effets.
- Points d'ancrage d'événements sur la scène : marqueurs en losange rouge avec les types "boss", "embuscade" et "patrouille".

### Systèmes de personnages

- Modèle de personnage (statistiques de départ, inventaire, équipement, point de départ).
- Catalogue de construction (archétypes, antécédents, traits, disciplines, titres croisés, liens).
- Arbres de progression (nœuds de compétences/capacités avec exigences et effets).

### Ressources

- Manifeste des ressources (portraits, sprites, arrière-plans, icônes, ensembles de tuiles) avec liaisons spécifiques à chaque type.
- Packs de ressources (groupes nommés et versionnés avec métadonnées de compatibilité, thème et licence).
- Prévisualisation de la scène (composition en ligne de toutes les liaisons visuelles des zones avec détection des ressources manquantes).

### Flux de travail

- Préconfigurations de régions (9 intégrées, filtrées par mode) et préconfigurations d'événements (10 intégrées) avec application de fusion/remplacement et gestion CRUD des préconfigurations personnalisées.
- Kits de démarrage (7 intégrés, spécifiques à chaque mode) avec exportation/importation du kit (`.wfkit.json`), gestion des collisions et suivi de la provenance.
- Recherche avec Ctrl+K dans tous les types d'objets, y compris les connexions et les événements.
- Palette de commandes du panneau de vitesse avec favoris épinglables, macros, groupes personnalisés et suggestions de mode.
- 13 raccourcis clavier centralisés.
- Exportation au format ContentPack JSON, bundles de projet et résumés de révision.
- Importation à partir de 4 formats avec rapports structurés de fidélité et suivi sémantique des différences.

Consultez [`dogfood/WALKTHROUGH.md`](dogfood/WALKTHROUGH.md) pour la séquence de test d'exportation vers Chapel Threshold, qui prouve la compatibilité avec la version actuelle.

## Compatibilité avec le moteur

Les exports ciblent les types de contenu de [ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine). Le ContentPack exporté peut être chargé directement par [claude-rpg](https://github.com/mcp-tool-shop-org/claude-rpg).

## Sécurité

- **Données consultées :** fichiers de projet sur le disque local (JSON créés par l'utilisateur), aucun stockage côté serveur.
- **Données NON consultées :** aucune télémétrie, aucune analyse, aucune requête réseau au-delà du serveur de développement local.
- **Permissions :** aucune clé API, aucun secret, aucune identifiant.
- **Aucun secret, jeton ou identifiant dans le code source.**

## Licence

MIT

---

Développé par [MCP Tool Shop](https://mcp-tool-shop.github.io/)
