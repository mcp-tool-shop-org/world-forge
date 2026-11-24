<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.md">English</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
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

## Architecture

```
packages/
  schema/          @world-forge/schema         — spatial types, validation, 2.5D fields
  export-ai-rpg/   @world-forge/export-ai-rpg  — AI RPG Engine export pipeline + CLI
  export-unreal/   @world-forge/export-unreal  — Unreal Engine 5 export pipeline + CLI (2.5D aware)
  export-godot/    @world-forge/export-godot   — Godot 4 export pipeline + .tscn scene generation
  renderer-2d/     @world-forge/renderer-2d    — PixiJS 2D canvas renderer
  editor/          @world-forge/editor         — React web authoring app
```

## Démarrage rapide

```bash
npm install
npm run build
npm run dev --workspace=packages/editor
```

Ouvrez `http://localhost:5173` pour lancer l’éditeur.

### Flux de travail de l’éditeur

1. **Choisissez un mode** (donjon, quartier, monde, océan, espace, intérieur ou nature) pour définir les paramètres par défaut de la grille et le vocabulaire des connexions.
2. **Commencez à partir d’un kit** : choisissez un kit de démarrage ou un modèle de genre dans le gestionnaire de modèles, ou commencez avec une feuille blanche.
3. **Définissez des zones** : faites glisser le curseur sur la zone de travail pour créer des zones, connectez-les et attribuez-leur des quartiers.
4. **Placez des entités** : déposez des PNJ, des ennemis, des marchands, des rencontres et des objets dans les zones.
5. **Vérifiez** : ouvrez l’onglet Vérification pour consulter l’état de santé, l’aperçu du contenu et exporter un résumé (Markdown/JSON).
6. **Exportez** : ouvrez la fenêtre d’exportation pour vérifier la préparation de chaque cible (la case indique l’état le plus critique parmi les trois cibles : rouge si bloqué, orange avec les avertissements répertoriés, y compris les traductions/éléments de type de rencontre, ainsi que les entités manquantes, l’absence de connexions dans les projets multi-zones, l’absence de modèle de joueur ou l’absence de paramètres d’élévation ou de parallaxe UE5, et vert si prêt, sans rien à signaler), configurez les options de cible, puis téléchargez AI RPG Engine, UE5 ou les packs Godot 4. Les reçus post-exportation sont regroupés par taille, nombre et détails de fidélité. Également : les ensembles de projets (.wfproject.json) et les résumés de vérification.

### Exportation en ligne de commande

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

## Packs

### @world-forge/schema

Types TypeScript principaux et validation pour la création de mondes.

- **Types spatiaux** : `WorldMap`, `Zone`, `ZoneConnection`, `District`, `Landmark`, `SpawnPoint`, `EncounterAnchor`, `FactionPresence`, `PressureHotspot`
- **Types de contenu** : `EntityPlacement`, `ItemPlacement`, `DialogueDefinition`, `PlayerTemplate`, `BuildCatalogDefinition`, `ProgressionTreeDefinition`
- **Calques visuels** : `AssetEntry`, `AssetPack`, `Tileset`, `TileLayer`, `PropDefinition`, `PropPlacement`, `AmbientLayer`
- **Ville + structures** : `MarketNode`, `CraftingStation`, `Building`, `Hub`, `Stronghold`
- **Modélisation du monde** : `Stratum` + `StratumLink` (calques verticaux), `HazardDefinition` (union d’effets typés), `ZoneEntryGate` + opérandes d’état de groupe `SpawnCondition` (`party-level`, `party-size`, `item`, `flag`, `member`, `class`)
- **Système de mode** : `AuthoringMode` (7 modes), profils de grille/connexion/validation spécifiques au mode
- **Présentation** : `WorldPresentation` facultatif sur `WorldProject` : vue dimétrique, empreinte de tuile, cellules d’ancrage de zone, plans de sol et une ligne d’occupation par acteur. `presentationAdvisories()` exécute huit règles de vérification, dont la plus importante : une personne dessinée dans une pièce est placée à l’extérieur de cette pièce dans la simulation.
- **Validation** : `validateProject()` (89 vérifications structurelles avec recherches O(n) basées sur une carte, `warningCount`), `advisoryValidation()` (suggestions spécifiques au mode, exhaustivité des métadonnées, nommage des ressources). v4.0 JSON qui omet les tableaux requis ultérieurement est accepté après `normalizeProjectShape()` / `stampProjectSchemaVersion()`.
- **Unions fermées sur le tas** : `VALID_CONNECTION_KINDS`, `VALID_ASSET_KINDS`, `VALID_ENTITY_ROLES`, `VALID_ITEM_SLOTS` et le reste des ensembles `VALID_*` sont exportés à partir de `@world-forge/schema`.
- **Utilitaires** : `assembleSceneData()` (liaisons visuelles avec détection des ressources manquantes), `scanDependencies()` (analyse du graphe de référence), `buildReviewSnapshot()` (classification de l’état de santé)

### @world-forge/export-unreal

Convertit un `WorldProject` en un pack de contenu Unreal Engine 5 optimisé pour les jeux 2,5D.

- **Sortie** : `pack.json`, JSON des actifs de données principaux par zone et par quartier, manifeste groupé des acteurs à faire apparaître, indications de diffusion de niveau par connexion, indications de cellules de partition mondiale et un rapport de fidélité structuré.
- **Champs 2,5D** : `Zone.elevation`, `elevationRange`, `parallaxLayers`, `skylineRef` sont conservés et convertis en coordonnées UE cm / Z-up.
- **Transformation des coordonnées** : fonctions pures (`pixelsToUnrealCm`, `elevationToZ`, `worldForgeToUnrealAxis`, `gridToUnrealAxis`). L’échelle par défaut du monde est de 1 tuile = 100 cm.
- **Importation en aller-retour** : `importFromUnreal` reconstruit un WorldProject à partir d’un pack Unreal ; les données de jeu uniquement (dialogues, progression, constructions) sont marquées comme supprimées dans le rapport de fidélité.
- **CLI** : `world-forge-export-unreal` avec `--out`, `--tile-size-cm`, `--validate-only`, `--verbose`.

### @world-forge/export-godot

Convertit un `WorldProject` en un pack de contenu Godot 4 avec du texte de scène `.tscn`.

- **Sortie** : un répertoire racine de projet Godot 4 : `project.godot`, `world.tscn` (ExtResource `.tres`), textures copiées sous `assets/`, `scripts/player.gd`, plus `pack.json` et `fidelity.json`
- **CLI** : `world-forge-export-godot` avec `--out`, `--validate-only`, `--include-world-tscn` / `--no-world-tscn`
- **Scène jouable** : `buildWorldScene()` émet une `.tscn` navigable : collision `StaticBody2D` par zone + `NavigationRegion2D`, un `Camera2D` encadré, un pion joueur `CharacterBody2D` et un tri Y / profondeur `z_index`.
- **Tuiles + intérieurs** : `TileMapLayer` + `TileSet` (`tile_map_data` cuits pour les ensembles de tuiles d’image), collision de mur par cellule `StaticBody2D` et placements d’accessoires `Node2D`.
- **Ville** : marchés + stations d’artisanat et bâtiments (empreintes `StaticBody2D`) / centres / forteresses en tant que marqueurs d’espace `Node2D`, tous transportant leurs données sous forme de métadonnées.
- **Modélisation du monde** : strates verticales (bandes `z_index` par zone + connecteurs `StratumLink`), dangers typés en tant que régions `Area2D` et métadonnées de porte d’entrée de zone.
- **Rapport de fidélité** : suivi structuré des données sans perte, approximées et supprimées, vérifié par rapport au moteur Godot 4 réel (fumée sans affichage, 36 assertions).
- **Avertissements de présentation** : un bloc `presentation` créé est conservé tel quel et ses avertissements sont associés à `warnings[]`, de sorte qu’une divergence entre le dessin et la simulation est une découverte lors de l’exportation plutôt qu’une surprise à l’écran.
- **Version du format** : `GODOT_PACK_FORMAT_VERSION` 1.1.0 (`files`, `zoneGates`, `migrateGodotPack`).

### @world-forge/export-ai-rpg

Convertit un `WorldProject` au format `ContentPack` d’ai-rpg-engine.

- **Exportation** : zones, quartiers, entités, objets, dialogues, modèle de joueur, catalogue de constructions, arbres de progression, rencontres (traduction des types de rencontre World Forge aux quatre types du moteur), factions, points chauds, manifeste et métadonnées du pack.
- **Importation** : 8 convertisseurs inverses reconstruisent un WorldProject à partir du JSON exporté ; la commande CLI `--import` / `--from-pack` écrit `world-project.json` (ou stdout).
- **Rapport de fidélité** : suivi structuré de ce qui a été sans perte, approximé ou supprimé pendant la conversion ; `--out` écrit `fidelity.json` à côté du pack.
- **Détection du format** : détecte automatiquement les formats WorldProject, ExportResult, ContentPack et ProjectBundle.
- **CLI** : `world-forge-export` avec `--out`, `--import`, `--from-pack`, `--validate-only`, `--dry-run` et `--verbose`.

### @world-forge/renderer-2d

Rendu 2D basé sur PixiJS : zone d’affichage avec panoramique/zoom, superposition de zones avec coloration des quartiers, flèches de connexion, icônes d’entités par rôle, calques de tuiles et une mini-carte.

Un moteur de rendu autonome publié pour les utilisateurs externes, permettant d’intégrer les données de World Forge dans leur propre application PixiJS. **L’éditeur ne l’utilise pas** ; la zone de travail de l’éditeur est une implémentation Canvas2D directe. Par conséquent, les fonctionnalités de la carte miniature et de la vue d’ensemble répertoriées ci-dessous pour l’éditeur lui sont propres et ne font pas partie de ce paquet.

### @world-forge/editor

Application web React 19 + Vite avec gestion de l’état par Zustand, annulation/rétablissement avec étiquettes d’action, sauvegarde automatique (limite de 30 secondes, historique de 3 versions, récupération en cas de plantage), protections contre les états non enregistrés sur tous les chemins de chargement du projet, basculement entre les thèmes clair et sombre, pièges de focus modal et commutation des outils contrôlée par le clavier.

#### Onglets de l’espace de travail

| Onglet | Objectif |
|-----|---------|
| Carte | Édition des zones/entités/districts sur la zone de travail 2D |
| Joueur | Modèle de joueur avec statistiques, inventaire, équipement, point d’apparition |
| Configurations | Archétypes, antécédents, traits, disciplines, combinaisons |
| Arbres | Nœuds de progression avec exigences et effets |
| Dialogue | Édition des nœuds, liaison des choix, détection des références rompues |
| Objets | Arbre hiérarchique : districts → zones → entités/points de repère/points d’apparition |
| Préréglages | Navigateur de préréglages de région et de rencontre avec fusion/remplacement |
| Ressources | Bibliothèque de ressources avec recherche filtrée par type, détection des éléments orphelins, paquets de ressources |
| Problèmes | Validation groupée en temps réel avec navigation par clic pour la mise au point |
| Dépendances | Analyseur de dépendances avec boutons de correction intégrés |
| Examen | Tableau de bord de l’état, aperçu du contenu, exportation du résumé |
| Guide | Liste de contrôle pour la première utilisation avec référence aux raccourcis (affichée jusqu’à ce qu’elle soit fermée) |
| Importation | Rapport de fidélité pour la dernière importation (affiché après une importation) |
| Différentiel | Différentiel sémantique par rapport à la capture importée (affiché après une importation) |

#### Zone de travail et édition

- **Outils** — 10 outils : sélection, peinture de zone, connexion, placement d’entité, point de repère, point d’apparition, peinture de tuile, placement d’objet, placement de rencontre, placement d’objet
- **Sélection multiple** — clic avec touche Maj, sélection par zone, Ctrl+A ; déplacement par glisser-déposer avec annulation atomique
- **Alignement** — alignement à 6 voies (gauche/droite/haut/bas/centre horizontal/centre vertical) et distribution horizontale/verticale
- **Alignement** — alignement pendant le glissement aux bords/centres des objets voisins avec lignes de guide visuelles
- **Redimensionnement** — 8 poignées par zone avec alignement aux bords, limitation de la taille minimale, aperçu en direct
- **Duplication** — Ctrl+D avec réattribution des ID, des connexions et des affectations de district
- **Copier/Coller** — Ctrl+C / Ctrl+V avec réattribution des ID et décalage configurable
- **Cycle de clics** — clics répétés à la même position pour parcourir les objets qui se chevauchent
- **Menu contextuel** — clic droit pour 7 actions sensibles au contexte (Modifier les propriétés permet de passer à l’onglet Carte et d’étendre la barre latérale droite pour l’objet sélectionné, y compris les entités, ainsi que la suppression, la duplication, etc.)
- **Aperçu de la connexion** — ligne cyan en pointillés pendant le placement de l’outil de connexion
- **Carte miniature** — aperçu de 200 × 150 (en bas à droite), clic pour effectuer un saut
- **Suppression de la vue** — ne rend que les objets situés dans les limites visibles (marge de 64 pixels)
- **Statistiques de performance** — basculement de l’affichage des FPS/nombre d’objets/temps de rendu
- **Visibilité par objet** — masquer/afficher les objets individuels (conservé dans localStorage)
- **Calques** — basculement de la visibilité (grille, connexions, entités, points de repère, points d’apparition, arrière-plans, tuiles, objets, ambiance, élévation ; les objets interagissent avec le calque des objets), ainsi que des basculements pour la carte miniature, l’alignement aux objets, les statistiques de performance et les diagnostics du moteur de rendu

#### Navigation et raccourcis

- **Zone d’affichage** — panoramique/zoom de la caméra, zoom avec la molette de la souris (curseur ancré), panoramique par glissement avec la barre d’espace/le bouton du milieu de la souris/le clic droit, ajustement au contenu lors de l’ouverture d’un projet avec des zones (et à la demande à partir du panneau « Ajuster au contenu »), double-clic pour centrer
- **Recherche** — Ctrl+K ouvre une superposition pour trouver n’importe quel objet par nom/ID avec une correspondance approximative, navigation au clavier et historique des recherches récentes (localStorage)
- **Panneau de vitesse** — appuyez sur `Q` (configurable dans les options) avec le pointeur sur la zone de travail (ou avec la zone de travail sélectionnée, ancrée à la sélection ou au centre) ou double-cliquez avec le bouton droit pour développer le menu compact instantané en un panneau de commandes flottant, avec des indicateurs de portée superposés lorsque deux objets ou plus sont visibles sous le pointeur (`Tab`/`Shift+Tab` lors d’une recherche vide, `ArrowLeft`/`ArrowRight`, ou un clic, avec `Canvas` en dernier, un contour de mise en surbrillance de la zone de travail non modifiant qui disparaît à la fermeture/`Esc`, et des annonces conviviales dans la zone active), une disposition fixe à quatre bandes lors de l’ouverture (une ligne facultative « Correction rapide » par objet affichée visuellement au-dessus de la bande 1 lorsque des problèmes existent sur l’objet cible — la mise en surbrillance commence toujours sur la case 1 de la bande 1, de sorte que `Enter` lors de l’ouverture exécute la case 1, l’ordre `ArrowDown` reste inchangé et `Alt+1`–`Alt+5` ne se déplace jamais ; accédez à « Correction rapide » via `ArrowUp` à partir de la case 1 ou en cliquant — au-dessus d’un ensemble de contexte fixe par type de clic, des épingles et des macros réorganisables, des fréquences récentes basculables, et des groupes de catalogue fixes), une recherche à plusieurs niveaux avec des synonymes RPG, des initiales, une tolérance aux fautes de frappe, une mise en surbrillance des caractères, des actions expliquées `"Unavailable here"`, des badges de raccourci ou d’emplacement de l’éditeur en direct, des sélecteurs à plusieurs étapes en ligne (`Quick Fix` réparations et navigation « Afficher dans les problèmes/dépendances/révisions » mises en cache par état du projet, `Assign District` avec un filtre de texte en ligne `+ Create District`, `Apply Preset` avec `Merge`/`Overwrite`, et `Place Encounter Here` avec des badges de compatibilité d’exportation RPG IA en direct ; `Backspace` sur un filtre ou des étapes d’entrée vides, retour en arrière), une édition de valeurs scalaires en ligne activée par `Tab` pour `Set Elevation`, une sélection spatiale déléguée à la zone de travail (`Connect From Here`, connexions typées avec `Tab` pour changer de type et `Shift+Click` pour enchaîner les cibles, `Merge Zones` pour une seule zone avec `Shift+Click` pour une sélection multiple et une recherche du nom de la zone hors écran, et `Esc` pour annuler tout en préservant la sélection précédente), une annulation atomique à une seule entrée avec des étiquettes descriptives, « Créer une macro à partir des actions récentes… » à partir d’un maximum de 8 étapes rejouables en session avec une exécution de macro atomique à une seule annulation et des invites de remplacement de référence manquante en ligne, et « Répéter la dernière action ici »
- **Raccourcis** — 29 raccourcis clavier, notamment le changement d’outil (V/Z/C/E/L/S/T/O/N/I), Entrée (ouvre les propriétés dans l’onglet « Carte » et développe la barre latérale droite), P (applique un préréglage), Maj+P (enregistre un préréglage), Ctrl+C/V (copier/coller), flèches pour ajuster (Maj = 5×)
- **Accessibilité** — pièges de focus modal avec Échap pour fermer, étiquettes ARIA sur tous les boutons avec uniquement une icône, arbre d’objets navigable au clavier, indicateur d’état signalé par un lecteur d’écran. Les opérations spatiales sur la zone de travail (placement, sélection par boîte, redimensionnement, dessin de connexion, panoramique) restent basées sur le pointeur

#### Importation et exportation

- **ContentPack** — exportation prenant en compte la cible vers le moteur AI RPG, Unreal Engine 5 ou Godot 4 avec des badges d’état par cible, des options configurables (taille des tuiles, préfixes de scène, filtrage des ensembles) et des reçus après le téléchargement
- **Ensembles de projet** — fichiers `.wfproject.json` portables avec des métadonnées de provenance et des informations sur les dépendances
- **Ensembles de kits** — `.wfkit.json` exportation/importation avec validation, gestion des collisions et suivi de la provenance
- **Importation** — détecte automatiquement 4 formats avec un rapport de fidélité structuré
- **Diff** — suivi des modifications sémantiques depuis l’importation
- **Aperçu de la scène** — composition HTML/CSS en ligne de toutes les liaisons visuelles des zones

## Modes d’édition

World Forge sépare le **genre** (fantaisie, cyberpunk, pirate) du **mode** (donjon, océan, espace). Le genre est une question de style, le mode est une question d’échelle. Le mode régit les valeurs par défaut de la grille, le vocabulaire des connexions, les suggestions de validation, la formulation des guides et le filtrage des préréglages.

| Mode | Grille | Tuile | Connexions clés |
|------|------|------|-----------------|
| Donjon | 30×25 | 32 | porte, escalier, passage, secret, danger |
| District / Ville | 50×40 | 32 | route, porte, passage, portail |
| Région / Monde | 80×60 | 48 | route, portail, passage |
| Océan / Mer | 60×50 | 48 | canal, route, portail, danger |
| Espace | 100×80 | 64 | amarrage, saut, passage, portail |
| Intérieur | 20×15 | 24 | porte, escalier, passage, secret |
| Nature sauvage | 60×50 | 48 | sentier, route, passage, danger |

Le mode est défini lors de la création d’un projet et stocké sous forme de `mode?: AuthoringMode` dans `WorldProject`. Chaque mode fournit des **valeurs par défaut intelligentes** : les types de connexion, les rôles des entités, les noms des zones et les suggestions du panneau de vitesse s’adaptent automatiquement.

## Surface d’édition

### Structure du monde

- Zones dotées d’une disposition spatiale, de voisins, d’issues, de lumière, de bruit, de dangers et d’éléments interactifs.
- 12 types de connexion (passage, porte, escalier, route, portail, secret, danger, canal, itinéraire, zone d’amarrage, téléportation, sentier) avec des styles visuels distincts, un routage ancré aux bords, des flèches directionnelles et un style en pointillés conditionnel.
- Districts dotés d’un contrôle de faction, de profils économiques, de curseurs de métriques, d’étiquettes et d’étiquettes de nom de district au niveau des centroïdes des zones.
- Points de repère (points d’intérêt nommés à l’intérieur des zones).
- Points d’apparition, points d’ancrage des rencontres (coloration basée sur le type), présence de factions et points chauds de pression.
- **Strates verticales** — couches discrètes (surface/souterrain/ciel, ou étages d’un bâtiment) avec un ordre défini, une plage Z, une visibilité inter-couches et des connecteurs (escaliers/échelles/ascenseurs) ; les zones sont assignées à une strate.
- **Dangers environnementaux typés** — une bibliothèque de dangers partagée (effets de dégâts/statut/mort instantanée/incendie, temporisation du déclenchement, coût de déplacement sur le terrain, possibilité de passage, blocage de la vision, conditions météorologiques) référencée par zone.
- **Portes d’entrée de zone pour les groupes** — entrée de porte basée sur l’état du groupe (niveau/taille/objets/indicateurs/membres/classes) en tant que porte stricte ou indicative, avec une raison d’affichage du verrouillage définie.
- **Présentation de l’occupation** — pour les clients 2,5D : une vue dimétrique avec une empreinte et une portée de tuile, une cellule d’ancrage et une plaque de sol facultative par zone, et une ligne d’occupation (ensemble de personnages, zone, cellule, orientation) par acteur, y compris le joueur.

### Contenu

- Placements d’entités avec des statistiques, des ressources, des profils d’IA et des métadonnées personnalisées.
- Placements d’objets avec emplacement, rareté, modificateurs de statistiques et verbes accordés.
- Arbres de dialogue avec des conversations ramifiées, des conditions et des effets.
- Points d’ancrage des rencontres sur la toile — marqueurs en losange rouge avec des types de boss/embuscade/patrouille.

### Ville et intérieurs

- Peinture de tuiles — ensembles de tuiles basés sur des images (découpe par ligne/colonne) avec une option de repli de rectangle coloré, un pinceau de glissement, des calques et une option de « Solid » pour la possibilité de déplacement par tuile pour la collision avec les murs.
- Placement d’éléments pour les intérieurs (palette + rendu sur la toile), avec un outil de placement.
- Économie de la ville — nœuds de marché (catégories d’approvisionnement, modificateur de prix, contrebande) et stations d’artisanat (type de station, recettes), modifiés par zone.
- Structures de la ville — bâtiments (empreintes accessibles avec un lien vers une zone intérieure), centres (nœuds de service et de connectivité) et forteresses (sièges de faction fortifiés).

### Systèmes de personnages

- Modèle de joueur (statistiques de départ, inventaire, équipement, point d’apparition).
- Catalogue de construction (archétypes, antécédents, traits, disciplines, titres croisés, relations).
- Arbres de progression (nœuds de compétences/capacités avec exigences et effets).

### Ressources

- Manifeste d’actifs (portraits, sprites, arrière-plans, icônes, ensembles de tuiles) avec des liaisons spécifiques au type.
- Packs d’actifs (groupements nommés et versionnés avec des métadonnées de compatibilité, un thème et une licence).
- Aperçu de la scène (composition en ligne de toutes les liaisons visuelles de la zone avec détection des actifs manquants).

### Flux de travail

- Préréglages de région (9 intégrés, filtrés par mode) et préréglages de rencontre (10 intégrés) avec application de fusion/remplacement et création/lecture/mise à jour/suppression de préréglages personnalisés.
- Kits de démarrage (7 intégrés, spécifiques au mode) avec exportation/importation de kit (`.wfkit.json`), option d’épinglage et de préréglages de macro dans le panneau rapide (`speedPanelPresets`) fusionnés sans écraser les préréglages utilisateur existants, gestion des collisions et suivi de la provenance.
- Fusion de zones à partir du panneau rapide (y compris la sélection interactive de la zone sur la toile lorsque moins de 2 zones sont sélectionnées).
- Les modèles de disposition, les modèles de dialogue et le placement d’entités par lots (grille/aléatoire/cercle) existent dans le code, mais ne sont pas encore accessibles à partir de l’interface utilisateur de l’éditeur.
- Sauvegarde automatique avec un délai de 30 secondes et un historique de récupération de 3 versions.
- Ctrl+K pour rechercher dans tous les types d’objets avec une correspondance approximative et un historique récent.
- Palette de commandes du panneau rapide avec des puces de portée de cible superposées (`Tab`/`Shift+Tab` lors d’une recherche vide, surlignement non modifiant de la toile et annonces polies dans la région en direct), des jeux de contexte fixes et une ligne de « correction rapide » contextuelle lorsque des problèmes existent sur l’objet ciblé, des favoris réorganisables copiés, une fréquence récente exponentielle désactivable, des groupes de catalogue fixes, une recherche RPG à plusieurs niveaux de synonymes/fautes de frappe, des badges de liaison de clé en direct, des macros paramétrées et des actions récentes (`Create Macro from Recent Actions…` avec une seule annulation atomique et des invites de remplacement d’ID manquants), des groupes personnalisés, des suggestions de mode, des entrées en ligne à plusieurs étapes et des entrées `Tab`, une sélection spatiale de la toile avec un filtre de zone hors écran et une rotation de `Tab` des types de connexion, des conseils d’exportation d’IA RPG, une annulation atomique descriptive et une fonction « Répéter la dernière action ici » (`wf.speedPanel.v2`).
- 29 raccourcis clavier centralisés (dont 10 touches de commutation d’outils).
- Éditeur de métadonnées de projet (auteur, licence, catégorie, étiquettes).
- Statistiques de révision (distribution des rôles, types de connexion, types de rencontres, zones par district).
- Exportation vers ContentPack JSON, ensembles de projets et résumés de révision.
- Importation à partir de 4 formats avec un rapport de fidélité structuré, des suggestions de réparation et un suivi des différences sémantiques.

Voir [`dogfood/WALKTHROUGH.md`](dogfood/WALKTHROUGH.md) pour le protocole d’échange d’exportation Chapel Threshold qui prouve la surface actuelle.

## Répertoire de tests internes

Le répertoire `dogfood/` contient un ensemble de tests d’intégration qui mettent à l’épreuve l’ensemble du pipeline d’édition à l’exportation en dehors des tests unitaires. L’exemple Chapel Threshold (`chapel-threshold.ts`) crée un petit projet de monde complet, l’exécute à travers l’exportation et écrit la sortie dans `dogfood/output/`. Cela prouve que les types de schéma, la validation et le pipeline d’exportation fonctionnent de bout en bout avec des données réelles, et pas seulement avec des simulations isolées.

## Compatibilité du moteur

Les exportations ciblent trois moteurs :

- **[ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine)** — ContentPack format : l’environnement d’exécution de simulation déterministe qui charge un ensemble exporté et exécute le monde.
- **Unreal Engine 5** — ensemble de contenu compatible 2,5D avec des actifs de données principaux, des manifestes d’apparition d’acteurs et des indications de partitionnement du monde.
- **Godot 4** — `.tscn` génération de scène avec des ressources de zone, des liens de navigation et des manifestes d’entités.

### Le contrat de contenu Forge→Engine

Un exporteur en fonctionnement n’est pas la même chose qu’un monde qui démarre. v4.6.0 comble cet écart pour la ligne de développement du moteur de RPG en IA, et — de manière plus utile — transforme l’écart restant en un nombre plutôt qu’en une supposition.

- **Une table d’exportation mesurée** (`docs/c0-alignment/`) : un parcours de différences parcourt chaque champ créé et enregistre ceux qui atteignent réellement l’environnement d’exécution. Elle est générée, enregistrée et vérifiée à chaque test, de sorte que « ce qui survit à l’exportation » peut être vérifié plutôt que simplement affirmé.
- **Un manifeste honnête** : le paquet émis contient une plage de versions de moteur réelle, des identifiants de modules réels, un hachage de contenu et des conditions de sortie compilées. Les identifiants de modules sont basés sur un contenu réel : un paquet sans stations d’artisanat ne prétend plus posséder le module d’artisanat.
- **Le vocabulaire spatial est mis en correspondance** : les emplacements par entité avec des conditions de génération compilées, des dangers typés, des portes d’entrée et des descripteurs de scène atteignent le paquet de contenu du moteur, et pas seulement le schéma.
- **Le rapport de fidélité respecte le contrat.** Chaque ligne de développement indique ce qui a été conservé sans perte, approximé ou supprimé. Lorsqu’un champ ne peut pas être transféré, l’exportation l’indique ; elle ne réussit pas silencieusement.
- **Validation d’échantillon de registre** (`packages/editor/src/__tests__/sample-gate.test.ts`) : charge dynamiquement chaque entrée à partir de `SAMPLE_WORLDS`, `BUILTIN_KITS`, `GENRE_TEMPLATES` et `MODE_STARTERS`, en vérifiant le chargement du stockage, `validateProject()`, la réussite de l’exportation du RPG en IA avec zéro blocage d’événements (`exportToEngine` + `listAiRpgEncounterBlockers`), une validation complète (`@ai-rpg-engine/content-schema`) (`validateGameContent` et `loadContent`), et les exportations pour Unreal Engine 5 (`exportToUnreal`) et Godot 4 (`exportToGodot`).
- **Traduction du type d’événement lors de l’exportation du RPG en IA** : seul l’exporteur du RPG en IA traduit les types d’événements créés dans World Forge vers les quatre types de `@ai-rpg-engine/content-schema` (`ambush`, `patrol`, `horde`, `duel`), en préservant `worldforge-type:<original>` sur `tags[]` et en enregistrant une entrée de fidélité `approximated` (`encounter-type-translated`), en excluant les ancres `hazard` et `discovery` du paquet avec une entrée de fidélité `dropped` (`encounter-type-dropped`), et en refusant toujours les chaînes personnalisées non mappées par leur nom :

| World Forge `encounterType` | Sortie du RPG en IA `ContentPack` | Fidélité et balise |
|---|---|---|
| `boss` | `duel` | `approximated`, `worldforge-type:boss` |
| `beast`, `haunt`, `caravan-raid` | `ambush` | `approximated`, `worldforge-type:<original>` |
| `pirate` | `patrol` | `approximated`, `worldforge-type:pirate` |
| `boarding`, `brawl` | `horde` | `approximated`, `worldforge-type:<original>` |
| `hazard`, `discovery` | omise de `ContentPack.encounterAnchors` | `dropped` |
| `ambush`, `patrol`, `horde`, `duel` | inchangée | inchangée, aucune entrée de fidélité |
| toute autre chaîne personnalisée | refusée (`exportToEngine` renvoie `success: false` avec `listAiRpgEncounterBlockers`, sortie CLI 1) | bloquée |

- **Identifiants des locuteurs de dialogue lors de l’exportation du RPG en IA** : `@world-forge/export-ai-rpg` refuse les entrées `dialogues[].speakers` non résolues par leur nom (`exportToEngine` renvoie `success: false` avec `speakerBlockers` et `listAiRpgDialogueSpeakerBlockers`, exportation modale bloquée, sortie CLI `1`), en nommant à la fois l’identifiant du dialogue et le locuteur non résolu. Un nœud avec `speaker: ''` est rempli à partir du seul locuteur répertorié du dialogue uniquement lorsque chaque entité portant ce dialogue (`dialogueId`) est ce locuteur répertorié ou qu’aucune entité ne le porte ; il est refusé par l’identifiant du dialogue, l’identifiant du nœud et l’identifiant de l’entité porteuse lorsqu’une entité porteuse est une entité différente, et refusé par l’identifiant du dialogue et l’identifiant du nœud lorsque `dialogues[].speakers` a zéro ou plusieurs entrées. Les locuteurs de nœuds non vides sont exportés sans modification.

Nécessite `ai-rpg-engine` `^3.12.2`.

**Lacunes connues par rapport au moteur RPG en IA 3.12.2** (à partir d’un test de démarrage le 2026-11-24). L’exportation de cet exemple, Chapel Threshold, se charge dans le moteur publié, et le déplacement entre ses zones fonctionne. Les parties suivantes ne sont pas encore disponibles :

- **Sorties contrôlées.** Le moteur se déplace uniquement le long de `zones[].neighbors`. Il supprime `zones[].exits` et le `connections` du paquet lorsqu’il charge le paquet, de sorte qu’une zone que vous ne pouvez atteindre qu’en passant par une sortie contrôlée ne peut pas y être entrée. Dans l’exemple, il s’agit de la crypte et de l’événement qui s’y déroule.
- **Comportement des PNJ.** Le moteur résout le `aiProfile` d’une entité uniquement à partir des profils que son hôte transmet, ou à partir du `entityAi` d’un paquet, ce que cet exportateur n’écrit pas encore. Jusqu’à ce qu’il le fasse, les PNJ exportés restent immobiles.
- **Dialogues via le fichier annexe.** Les dialogues se jouent lorsqu’un hôte charge le paquet en cours d’exécution, comme dans la recette de démarrage JSON du moteur. Le fichier annexe du moteur les supprime lorsqu’il charge le paquet.
- **Autres données du paquet.** Le moteur les supprime lorsqu’il charge le paquet, et nomme chacune d’elles avec sa raison : descriptions et dangers des zones, présence des factions, points chauds de pression, points de génération, modèle du joueur, tables de butin, points de repère, strates et liens de strates, transitions, stations d’artisanat, nœuds de marché, bâtiments, centres, bastions, catalogue de construction et arbres de progression.

### Le contrat de rendu

Un monde peut également indiquer comment un client doit le **rendre**. `WorldProject.presentation` est facultatif et additif ; la plupart des mondes n’en ont pas et ne sont jamais pénalisés pour cela ; il contient la vue dimétrique, l’empreinte de tuile, une cellule d’ancrage de zone et une plaque de sol par zone, et une ligne d’occupation par acteur.

Il existe parce qu’un monde 2,5D est décrit par trois grilles à la fois, et l’exportation effectue une conversion entre **aucune** d’entre elles :

| Grille | Unité | Propriétaire | Hachée |
|---|---|---|---|
| Occupation simulée | ID de zone | le `WorldState` du moteur | oui, c’est l’autorité |
| Cellule dimétrique | Diamant de 256x128, portée de 3 | la vue du client, via `presentation` | jamais |
| Cartésien de Forge | `gridX` / `gridY` | l’éditeur et le `.tscn` de Godot | jamais |

Une cellule dimétrique n’est jamais dérivée de `gridX`/`gridY`, et l’échelle du bac à sable saute le bloc par son nom, de sorte qu’une cellule de diamant absolue ne peut pas être multipliée accidentellement. La simulation gagne toujours un différend sur la pièce dans laquelle se trouve une personne ; `presentationAdvisories()` l’indique à voix haute, `exportToGodot` le signale sur `warnings[]`, et la ligne d’accessoires de scène peut le rendre fatal avec `--strict`.

Le bloc se déplace sur le `pack.json` de l’accessoire de scène de Godot. Il ne se déplace **pas** sur la ligne `export-ai-rpg` ; le `ContentPack` du moteur n’a pas de plage additive et son chargeur est strict ; la table d’exportation mesurée l’indique comme supprimé, plutôt que de le laisser entendre.

## Sécurité

- **Données concernées :** fichiers de projet sur le disque local (JSON créé par l’utilisateur), aucun stockage côté serveur
- **Données NON concernées :** aucune télémétrie, aucune analyse, aucune requête réseau au-delà du serveur de développement local
- **Autorisations :** aucune clé API, aucun secret, aucune information d’identification
- **Aucun secret, jeton ou information d’identification dans le code source**

## Licence

MIT

---

Créé par [MCP Tool Shop](https://mcp-tool-shop.github.io/)
