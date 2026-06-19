<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.md">English</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
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
<p align="center"><strong>v4.5.0</strong> — 2360 tests + e2e browser checks, 6 shipping packages, 7 authoring modes, tiles + interiors + town authoring + world modeling (vertical strata, typed hazards, party-gated zones), three export targets (AI RPG Engine, Unreal Engine 5, Godot 4)</p>
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

1. **Choisissez un mode** (donjon, quartier, monde, océan, espace, intérieur ou nature sauvage) afin de définir les paramètres par défaut de la grille et le vocabulaire des connexions.
2. **Commencez à partir d’un kit** : choisissez un kit de démarrage ou un modèle de genre dans le gestionnaire de modèles, ou commencez avec une feuille blanche.
3. **Peignez des zones** : faites glisser votre curseur sur la toile pour créer des zones, connectez-les et attribuez-leur des quartiers.
4. **Placez des entités** : déposez des PNJ, des ennemis, des marchands, des rencontres et des objets dans les zones.
5. **Vérifiez** : ouvrez l’onglet Vérification pour consulter l’état de santé, un aperçu du contenu et exporter un résumé (Markdown/JSON).
6. **Exportez** : ouvrez la fenêtre modale d’exportation pour vérifier la préparation par cible (✓ Prêt / ⚠ avertissements), configurez les options de cible, puis téléchargez les packs AI RPG Engine, UE5 ou Godot 4. Les reçus post-export sont regroupés avec des détails sur la taille, le nombre et la fidélité. Également : paquets de projet (.wfproject.json) et résumés de vérification.

### Exportation en ligne de commande (CLI)

```bash
# AI RPG Engine
npx world-forge-export project.json --out ./my-pack
npx world-forge-export project.json --validate-only

# Unreal Engine 5
npx world-forge-export-unreal project.json --out ./UnrealPack --sign
npx world-forge-export-unreal --summary ./UnrealPack
```

## Packs

### @world-forge/schema

Types TypeScript principaux et validation pour la création de mondes.

- **Types spatiaux** : `WorldMap`, `Zone`, `ZoneConnection`, `District`, `Landmark`, `SpawnPoint`, `EncounterAnchor`, `FactionPresence`, `PressureHotspot`
- **Types de contenu** : `EntityPlacement`, `ItemPlacement`, `DialogueDefinition`, `PlayerTemplate`, `BuildCatalogDefinition`, `ProgressionTreeDefinition`
- **Calques visuels** : `AssetEntry`, `AssetPack`, `Tileset`, `TileLayer`, `PropDefinition`, `PropPlacement`, `AmbientLayer`
- **Ville + structures** : `MarketNode`, `CraftingStation`, `Building`, `Hub`, `Stronghold`
- **Modélisation du monde** : `Stratum` + `StratumLink` (calques verticaux), `HazardDefinition` (union d’effets typés), `ZoneEntryGate` + opérandes d’état de groupe `SpawnCondition` (`party-level`, `party-size`, `item`, `flag`, `member`, `class`)
- **Système de mode** : `AuthoringMode` (7 modes), profils spécifiques au mode pour la grille, les connexions et la validation.
- **Validation** : `validateProject()` (78 vérifications structurelles avec des recherches O(n) basées sur une carte, `warningCount`), `advisoryValidation()` (suggestions spécifiques au mode, exhaustivité des métadonnées, nommage des ressources).
- **Utilitaires** : `assembleSceneData()` (liaisons visuelles avec détection de ressources manquantes), `scanDependencies()` (analyse du graphe des références), `buildReviewSnapshot()` (classification de l’état de santé).

### @world-forge/export-unreal

Convertit un `WorldProject` en un pack de contenu Unreal Engine 5 optimisé pour les jeux 2,5D.

- **Sortie** : `pack.json`, JSON des données principales par zone et par quartier, manifeste d’apparition des acteurs regroupés, indications de diffusion au niveau par connexion, indications de partition du monde et rapport structuré sur la fidélité.
- **Champs 2,5D** : `Zone.elevation`, `elevationRange`, `parallaxLayers` et `skylineRef` sont conservés et convertis en coordonnées UE cm / Z-up.
- **Transformation des coordonnées** : fonctions pures (`pixelsToUnrealCm`, `elevationToZ`, `worldForgeToUnrealAxis`, `gridToUnrealAxis`). L’échelle par défaut du monde est de 1 tuile = 100 cm.
- **Importation aller-retour** : `importFromUnreal` reconstruit un WorldProject à partir d’un pack Unreal ; les données relatives au gameplay uniquement (dialogues, progression, constructions) sont marquées comme supprimées dans le rapport de fidélité.
- **CLI** : `world-forge-export-unreal` avec `--out`, `--tile-size-cm`, `--validate-only` et `--verbose`.

### @world-forge/export-godot

Convertit un `WorldProject` en un pack de contenu Godot 4 avec du texte de scène `.tscn`.

- **Sortie** : `pack.json`, ressources par zone, manifeste des entités, liens de navigation, tables de butin, marqueurs d’apparition, nœuds de transition, ressources de dialogue, liaisons d’actifs et scène du monde `.tscn`.
- **Scène jouable** : `buildWorldScene()` émet une scène `.tscn` navigable : collision `StaticBody2D` par zone + `NavigationRegion2D`, une caméra encadrée `Camera2D` et un tri vertical / profondeur `z_index`.
- **Tuiles + intérieurs** : `TileMapLayer` + `TileSet` (données de carte de tuiles cuites pour les jeux de tuiles d’images), collision murale `StaticBody2D` par cellule et placements de propriétés `Node2D`.
- **Ville** : marchés + stations d’artisanat, et bâtiments (empreintes `StaticBody2D`) / centres / forteresses en tant que marqueurs de position `Node2D`, le tout contenant leurs données sous forme de métadonnées.
- **Modélisation du monde** : strates verticales (bandes `z_index` par zone + connecteurs `StratumLink`), dangers typés en tant que régions `Area2D` et métadonnées de porte d’entrée de zone.
- **Rapport de fidélité** : suivi structuré des données sans perte, approximées ou supprimées, vérifié par rapport au moteur Godot 4 réel (fumée simulée, 36 assertions).
- **Version du format** : `GODOT_PACK_FORMAT_VERSION` 1.0.0

### @world-forge/export-ai-rpg

Convertit un `WorldProject` au format `ContentPack` d’ai-rpg-engine.

- **Exportation** : zones, quartiers, entités, objets, dialogues, modèle de joueur, catalogue de constructions, arbres de progression, rencontres, factions, points chauds, manifeste et métadonnées du pack.
- **Importation** : 8 convertisseurs inverses reconstruisent un WorldProject à partir d’un JSON exporté.
- **Rapport de fidélité** : suivi structuré des données qui ont été conservées sans perte, approximées ou supprimées pendant la conversion.
- **Détection du format** : détecte automatiquement les formats WorldProject, ExportResult, ContentPack et ProjectBundle.
- **CLI** : commande `world-forge-export` avec les options `--out`, `--validate-only` et `--verbose`.

### @world-forge/renderer-2d

Moteur 2D basé sur PixiJS : vue avec panoramique / zoom, superposition de zones avec coloration des quartiers, flèches de connexion, icônes d’entités par rôle, calques de tuiles et une mini-carte.

### @world-forge/editor

Application web React 19 + Vite avec gestion de l’état Zustand, annulation / restauration avec étiquettes d’action, sauvegarde automatique (limite de 30 secondes, historique de 3 versions, récupération en cas de plantage), protections contre les états non modifiés sur tous les chemins de chargement du projet, bascule entre le thème sombre et clair, pièges de focus modal et commutation d’outils pilotée par le clavier.

#### Onglets de l’espace de travail

| Onglet | Objectif |
|-----|---------|
| Carte | Édition des zones/entités/districts sur la toile 2D |
| Objets | Arbre hiérarchique : districts → zones → entités/points de repère/zones d’apparition |
| Joueur | Modèle de joueur avec statistiques, inventaire, équipement, zone d’apparition |
| Configurations | Archétypes, antécédents, traits, disciplines, combinaisons |
| Arbres | Nœuds de progression avec exigences et effets |
| Dialogue | Édition des nœuds, liaison des choix, détection des références rompues |
| Préréglages | Navigateur de préréglages de région et de rencontre avec fusion/remplacement |
| Ressources | Bibliothèque de ressources avec recherche filtrée par type, détection des éléments orphelins, packs de ressources |
| Problèmes | Validation groupée en temps réel avec navigation par clic pour la mise au point |
| Dépendances | Analyseur de dépendances avec boutons de correction intégrés |
| Examen | Tableau de bord d’état, aperçu du contenu, exportation du résumé |
| Guide | Liste de contrôle pour la première utilisation avec référence aux raccourcis clavier |

#### Toile et édition

- **Outils** : sélection, peinture de zone, connexion, placement d’entité, point de repère, zone d’apparition
- **Sélection multiple** : clic avec touche Maj enfoncée, sélection par rectangle, Ctrl+A ; déplacement par glisser-déposer avec annulation atomique
- **Alignement** : alignement à 6 voies (gauche/droite/haut/bas/centre horizontal/centre vertical) et distribution horizontale/verticale
- **Aimantation** : aimantation pendant le déplacement aux bords/centres des objets voisins avec lignes de guidage visuelles
- **Redimensionnement** : 8 poignées par zone avec aimantation au bord, limitation de la taille minimale, aperçu en temps réel
- **Duplication** : Ctrl+D avec réaffectation des ID, connexions et affectations de district
- **Copier/Coller** : Ctrl+C / Ctrl+V avec réaffectation des ID et décalage configurable
- **Cycle par clic** : clics répétés à la même position pour parcourir les objets qui se chevauchent
- **Menu contextuel** : clic droit pour 7 actions sensibles au contexte (propriétés, suppression, duplication, etc.)
- **Aperçu de la connexion** : ligne cyan en pointillés pendant le placement de l’outil de connexion
- **Mini-carte** : aperçu 200×150 (en bas à droite), clic pour effectuer un saut
- **Suppression du contenu de la zone d’affichage** : seuls les objets situés dans les limites visibles sont rendus (marge de 64 pixels)
- **Statistiques de performance** : activation/désactivation de l’affichage des FPS/nombre d’objets/temps de rendu
- **Visibilité par objet** : masquage/affichage des objets individuels (conservé dans localStorage)
- **Calques** : 7 bascules de visibilité (grille, connexions, entités, points de repère, zones d’apparition, arrière-plans, ambiance)

#### Navigation et raccourcis

- **Zone d’affichage** : panoramique/zoom de la caméra, zoom avec la molette de la souris (curseur ancré), déplacement par glisser-déposer avec la barre d’espace/bouton central de la souris/clic droit, ajustement automatique au contenu, double-clic pour centrer
- **Recherche** : Ctrl+K ouvre une superposition pour trouver n’importe quel objet par nom/ID avec correspondance approximative, navigation au clavier et historique des recherches récentes (localStorage)
- **Panneau de vitesse** : double clic droit pour afficher une palette de commandes flottante avec des actions sensibles au contexte, des favoris épinglés, des macros et des actions rapides suggérées en fonction du mode
- **Raccourcis clavier** : 21 raccourcis clavier, notamment la commutation d’outils (V/Z/C/E/L/S), Entrée (ouvrir les détails), P (appliquer un préréglage), Maj+P (enregistrer un préréglage), Ctrl+C/V (copier/coller), déplacement par flèche (Maj = 5×)
- **Accessibilité** : pièges de focus modaux avec Échap pour fermer, étiquettes ARIA sur tous les boutons ne contenant que des icônes, arbre d’objets navigable au clavier, indicateur de modification annoncé par un lecteur d’écran. Les opérations spatiales sur la toile (placement, sélection par rectangle, redimensionnement, dessin de connexion, panoramique) restent basées sur le pointeur

#### Importation et exportation

- **ContentPack** : exportation adaptée à la cible vers AI RPG Engine, Unreal Engine 5 ou Godot 4 avec badges d’état par cible, options configurables (taille des tuiles, préfixes de scène, filtrage des ensembles), et reçus après le téléchargement
- **Ensembles de projets** : fichiers `.wfproject.json` portables avec métadonnées de provenance et informations sur les dépendances
- **Ensembles d’éléments** : exportation/importation `.wfkit.json` avec validation, gestion des collisions et suivi de la provenance
- **Importation** : détection automatique de 4 formats avec rapport structuré sur la fidélité
- **Différentiel** : suivi des modifications sémantiques depuis l’importation
- **Aperçu de la scène** : composition HTML/CSS en ligne de tous les éléments visuels de la zone

## Modes d’édition

World Forge sépare le **genre** (fantaisie, cyberpunk, pirate) du **mode** (donjon, océan, espace). Le genre est une question d’ambiance ; le mode définit l’échelle. Le mode régit les valeurs par défaut de la grille, le vocabulaire des connexions, les suggestions de validation, la formulation du guide et le filtrage des préréglages.

| Mode | Grille | Tuile | Connexions clés |
|------|------|------|-----------------|
| Donjon | 30×25 | 32 | porte, escalier, passage, secret, danger |
| District / Ville | 50×40 | 32 | route, porte, passage, portail |
| Région / Monde | 80×60 | 48 | route, portail, passage |
| Océan / Mer | 60×50 | 48 | canal, route, portail, danger |
| Espace | 100×80 | 64 | amarrage, saut quantique, passage, portail |
| Intérieur | 20×15 | 24 | porte, escalier, passage, secret |
| Nature sauvage | 60×50 | 48 | sentier, route, passage, danger |

Le mode est défini lors de la création d’un projet et stocké sous forme de `mode?: AuthoringMode` dans `WorldProject`. Chaque mode fournit des **valeurs par défaut intelligentes** : les types de connexion, les rôles des entités, les noms des zones et les suggestions du panneau de vitesse s’adaptent automatiquement.

## Surface d’édition

### Structure du monde

- Zones dotées d’une disposition spatiale, de voisins, d’issues, de lumière, de bruit, de dangers et d’éléments interactifs.
- 12 types de connexion (passage, porte, escalier, route, portail, secret, danger, canal, itinéraire, zone d’amarrage, téléportation, sentier) avec des styles visuels distincts, un routage ancré aux bords, des flèches directionnelles et une mise en forme conditionnelle en pointillés.
- Districts dotés d’un contrôle de faction, de profils économiques, de curseurs de métriques, d’étiquettes et d’étiquettes de nom de district au niveau des centroïdes des zones.
- Points de repère (points d’intérêt nommés à l’intérieur des zones).
- Points d’apparition, points d’ancrage pour les rencontres (coloration basée sur le type), présence de factions et zones critiques.
- **Strates verticales** : couches discrètes (surface / souterrain / ciel, ou étages d’un bâtiment) avec un ordre défini, une plage Z, une visibilité intercouches et des connecteurs (escaliers / échelles / ascenseurs) ; les zones sont assignées à une strate.
- **Dangers environnementaux typés** : bibliothèque de dangers partagée (effets de dégâts / statut / mort instantanée / incendie, temporisation du déclenchement, coût de déplacement sur le terrain, possibilité de passage, blocage de la vision, conditions météorologiques) référencée par zone.
- **Portes d’entrée de zone pour les groupes** : entrée de porte basée sur l’état du groupe (niveau / taille / objets / indicateurs / membres / classes), en tant que barrière stricte ou indicative avec une raison « afficher la serrure » définie.

### Contenu

- Placement d’entités avec statistiques, ressources, profils IA et métadonnées personnalisées.
- Placement d’objets avec emplacement, rareté, modificateurs de statistiques et compétences accordées.
- Arbres de dialogue avec conversations ramifiées, conditions et effets.
- Points d’ancrage pour les rencontres sur la toile : marqueurs en losange rouge avec types boss/embuscade/patrouille.

### Ville et intérieurs

- Peinture de tuiles : ensembles de tuiles basés sur des images (découpe par ligne/colonne) avec une option de repli en rectangle coloré, un pinceau à glisser, des calques et une « solidité » de chaque tuile pour la collision avec les murs.
- Placement d’éléments décoratifs pour les intérieurs (palette + rendu sur la toile), avec un outil de placement.
- Économie de la ville : nœuds du marché (catégories d’approvisionnement, modificateur de prix, contrebande) et postes de fabrication (type de poste, recettes), édités par zone.
- Structures de la ville : bâtiments (empreintes accessibles avec un lien vers une zone intérieure), centres (nœuds de service + connectivité) et forteresses (sièges de faction fortifiés).

### Systèmes de personnages

- Modèle de joueur (statistiques de départ, inventaire, équipement, point d’apparition).
- Catalogue de construction (archétypes, antécédents, traits, disciplines, titres croisés, liens).
- Arbres de progression (nœuds de compétences/capacités avec exigences et effets).

### Ressources

- Manifeste des ressources (portraits, sprites, arrière-plans, icônes, ensembles de tuiles) avec liaisons spécifiques au type.
- Packs de ressources (groupements nommés et versionnés avec métadonnées de compatibilité, thème, licence).
- Aperçu de la scène (composition en ligne de toutes les liaisons visuelles des zones avec détection des ressources manquantes).

### Flux de travail

- Préréglages de région (9 intégrés, filtrés par mode) et préréglages de rencontre (10 intégrés) avec application de fusion/remplacement et création/modification personnalisée des préréglages.
- Kits de démarrage (7 intégrés, spécifiques au mode) avec exportation/importation du kit (`.wfkit.json`), gestion des collisions et suivi de la provenance.
- Modèles de disposition (6 arrangements de zones préconstruits) et modèles de dialogue (5 amorces de conversation).
- Fusion de zone et placement d’entités en lot (motifs quadrille/aléatoire/cercle).
- Sauvegarde automatique avec délai de 30 secondes et historique de récupération sur 3 versions.
- Recherche Ctrl+K dans tous les types d’objets avec correspondance approximative et historique récent.
- Palette de commandes du panneau rapide avec favoris épinglés, macros, groupes personnalisés et suggestions de mode.
- 21 raccourcis clavier centralisés (dont 6 touches pour changer d’outil).
- Éditeur de métadonnées de projet (auteur, licence, catégorie, étiquettes).
- Statistiques de révision (distribution des rôles, types de connexion, types de rencontre, zones par district).
- Exportation vers ContentPack JSON, ensembles de projets et résumés de révision.
- Importation à partir de 4 formats avec rapport structuré sur la fidélité, suggestions de correction et suivi sémantique des différences.

Voir [`dogfood/WALKTHROUGH.md`](dogfood/WALKTHROUGH.md) pour l’exemple d’exportation Chapel Threshold qui prouve le fonctionnement actuel.

## Répertoire Dogfood

Le répertoire `dogfood/` contient un ensemble de tests d’intégration qui mettent à l’épreuve l’ensemble du pipeline d’édition à exportation en dehors des tests unitaires. L’exemple Chapel Threshold (`chapel-threshold.ts`) crée un petit projet mondial complet, l’exécute via l’exportation et écrit la sortie dans `dogfood/output/`. Cela prouve que les types de schéma, la validation et le pipeline d’exportation fonctionnent de bout en bout avec des données réelles, et pas seulement avec des simulations isolées.

## Compatibilité du moteur

Les exportations ciblent trois moteurs :

- **[ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine)** : format ContentPack, chargeable par [claude-rpg](https://github.com/mcp-tool-shop-org/claude-rpg).
- **Unreal Engine 5** : ensemble de contenus compatible 2,5D avec des actifs de données principaux, des manifestes d’apparition d’acteurs et des indications de partitionnement du monde.
- **Godot 4** : génération de scène `.tscn` avec ressources de zone, liens de navigation et manifestes d’entités.

## Sécurité

- **Données concernées :** fichiers de projet sur le disque local (JSON créé par l’utilisateur), aucun stockage côté serveur.
- **Données NON concernées :** aucune télémétrie, aucune analyse, aucune requête réseau au-delà du serveur de développement local.
- **Autorisations :** aucune clé API, aucun secret, aucune information d’identification.
- **Aucun secret, jeton ou identifiant dans le code source.**

## Licence

MIT

---

Créé par [MCP Tool Shop](https://mcp-tool-shop.github.io/)
