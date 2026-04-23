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

<p align="center">2D / 2.5D world authoring studio with peer export lanes for <a href="https://github.com/mcp-tool-shop-org/ai-rpg-engine">AI RPG Engine</a>, <a href="https://www.unrealengine.com/">Unreal Engine 5</a>, and (planned) Godot 4.<br>One editor, many modes — paint zones, place entities, define districts, export a complete content pack for your engine of choice.</p>

<p align="center"><strong>v4.3.0</strong> — 1959 tests, 5 shipping packages + 1 planned Godot stub (6 total), 7 authoring modes, 2.5D authoring end-to-end</p>

## Architecture

```
packages/
  schema/          @world-forge/schema         — spatial types, validation, 2.5D fields
  export-ai-rpg/   @world-forge/export-ai-rpg  — AI RPG Engine export pipeline + CLI
  export-unreal/   @world-forge/export-unreal  — Unreal Engine 5 export pipeline + CLI (2.5D aware)
  export-godot/    @world-forge/export-godot   — (planned) Godot 4 export lane, stub only
  renderer-2d/     @world-forge/renderer-2d    — PixiJS 2D canvas renderer
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
2. **Commencez avec un kit** — sélectionnez un kit de démarrage ou un modèle de genre dans le gestionnaire de modèles, ou commencez à partir de rien.
3. **Dessinez des zones** — faites glisser sur la zone de dessin pour créer des zones, connectez-les et attribuez-leur des districts.
4. **Placez des entités** — déposez des PNJ, des ennemis, des marchands, des rencontres et des objets sur les zones.
5. **Vérifiez** — ouvrez l'onglet "Vérification" pour afficher l'état de santé, un aperçu du contenu et un résumé exportable (Markdown/JSON).
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
- **Système de modes** — `AuthoringMode` (7 modes), profils de grille/de connexion/de validation spécifiques à chaque mode.
- **Validation** — `validateProject()` (54 vérifications structurelles avec des recherches basées sur la carte, O(n), et un nombre d'avertissements), `advisoryValidation()` (suggestions spécifiques à chaque mode, complétude des métadonnées, nommage des ressources).
- **Utilitaires** — `assembleSceneData()` (liaisons visuelles avec détection des ressources manquantes), `scanDependencies()` (analyse du graphe de références), `buildReviewSnapshot()` (classification de l'état de santé).

### @world-forge/export-unreal

Convertit un `WorldProject` en un pack de contenu pour Unreal Engine 5, optimisé pour les jeux en 2,5D.

- **Sortie** — `pack.json`, données primaires JSON par zone et par district, manifeste de spawn des acteurs regroupés, indications de streaming de niveau par connexion, indications de cellule de World Partition, et un rapport de fidélité structuré.
- **Champs 2,5D** — `Zone.elevation`, `elevationRange`, `parallaxLayers`, `skylineRef` sont préservés et convertis en coordonnées UE en centimètres / axe Z vers le haut.
- **Transformation de coordonnées** — fonctions pures (`pixelsToUnrealCm`, `elevationToZ`, `worldForgeToUnrealAxis`, `gridToUnrealAxis`). L'échelle du monde par défaut est de 1 tuile = 100 cm.
- **Importation aller-retour** — `importFromUnreal` reconstruit un WorldProject à partir d'un pack Unreal ; les données relatives uniquement au gameplay (dialogues, progression, constructions) sont marquées comme supprimées dans le rapport de fidélité.
- **Ligne de commande** — `world-forge-export-unreal` avec les options `--out`, `--tile-size-cm`, `--validate-only`, `--verbose`.

### @world-forge/export-godot

Espace de travail réservé pour l'exportation planifiée vers Godot 4 (Fractured Road). Pas encore implémenté.

### @world-forge/export-ai-rpg

Convertit un `WorldProject` au format `ContentPack` du moteur ai-rpg.

- **Exportation** — zones, districts, entités, objets, dialogues, modèle de joueur, catalogue de constructions, arbres de progression, rencontres, factions, points chauds, manifeste et métadonnées du pack.
- **Importation** — 8 convertisseurs inverses reconstruisent un WorldProject à partir de fichiers JSON exportés.
- **Rapport de fidélité** — suivi structuré de ce qui a été exporté sans perte, approximé ou supprimé pendant la conversion.
- **Détection de format** — détecte automatiquement les formats WorldProject, ExportResult, ContentPack et ProjectBundle.
- **Ligne de commande** — commande `world-forge-export` avec les options `--out`, `--validate-only` et `--verbose`.

### @world-forge/renderer-2d

Rendu 2D basé sur PixiJS : vue avec panoramique/zoom, superpositions de zones avec coloration des districts, flèches de connexion, icônes d'entités par rôle, calques de tuiles et une mini-carte.

### @world-forge/editor

React 19 + application web Vite avec gestion d'état Zustand, annuler/refaire avec étiquettes d'actions, sauvegarde automatique (décalage de 30 secondes, historique de 3 versions), bascule entre thème clair et sombre, et protection contre les modifications non enregistrées.

#### Onglets de l'espace de travail

| Onglet | Objectif |
|-----|---------|
| Carte | Modification des zones/entités/districts sur la zone de dessin 2D |
| Objets | Arbre hiérarchique : districts → zones → entités/points d'intérêt/points de réapparition |
| Personnage | Modèle de personnage avec statistiques, inventaire, équipement, point de réapparition |
| Constructions | Archétypes, antécédents, traits, disciplines, combinaisons |
| Arbres de compétences | Nœuds de progression avec exigences et effets |
| Dialogue | Modification des nœuds, liaison des choix, détection des références cassées |
| Préconfigurations | Navigateur de préconfigurations de région et de rencontre avec fusion/remplacement |
| Ressources | Bibliothèque de ressources avec recherche filtrée par type, détection des ressources orphelines, packs de ressources |
| Problèmes | Validation en direct, regroupée, avec navigation par clic pour la mise en évidence |
| Dépendances | Analyseur de dépendances avec boutons de correction intégrés |
| Examen | Tableau de bord de l'état de santé, aperçu du contenu, exportation récapitulative |
| Guide | Liste de contrôle pour le premier lancement avec référence des raccourcis clavier |

#### Zone de dessin et édition

- **Outils** — sélection, peinture de zone, connexion, placement d'entité, point d'intérêt, point de réapparition
- **Sélection multiple** — clic avec la touche Shift, sélection par zone, Ctrl+A ; déplacement par glissement avec annulation atomique
- **Alignement** — alignement sur 6 axes (gauche/droite/haut/bas/centre-horizontal/centre-vertical) et distribution horizontale/verticale
- **Alignement automatique** — alignement par glissement sur les bords/centres des objets proches, avec lignes de guidage visuelles
- **Redimensionnement** — 8 poignées par zone, alignement sur les bords, limitation de la taille minimale, aperçu en direct
- **Duplication** — Ctrl+D avec réaffectation des ID, des connexions et des attributions de district
- **Copier/Coller** — Ctrl+C / Ctrl+V avec réaffectation des ID et décalage configurable
- **Cycle par clic** — les clics répétés au même endroit font défiler les objets superposés
- **Menu contextuel** — clic droit pour 7 actions contextuelles (propriétés, supprimer, dupliquer, etc.)
- **Aperçu de la connexion** — ligne cyan en pointillés pendant le placement de l'outil de connexion
- **Mini-carte** — aperçu 200x150 (en bas à droite), cliquez pour accéder
- **Suppression des objets hors champ** — ne rend que les objets situés dans les limites visibles (marge de 64 pixels)
- **Statistiques de performance** — bascule pour afficher les FPS/nombre d'objets/temps de rendu
- **Visibilité par objet** — masquer/afficher les objets individuels (enregistré dans le localStorage)
- **Calques** — 7 bascules de visibilité (grille, connexions, entités, points d'intérêt, points de réapparition, arrière-plans, éléments d'ambiance)

#### Navigation et raccourcis

- **Zone de visualisation** — panoramique/zoom de la caméra, zoom avec la molette de la souris (curseur ancré), barre d'espace/bouton central de la souris/clic droit pour le panoramique, ajustement automatique au contenu, double-clic pour centrer
- **Recherche** — Ctrl+K ouvre une fenêtre contextuelle pour trouver n'importe quel objet par nom/ID avec correspondance floue, navigation au clavier et historique de recherche récent (localStorage)
- **Panneau de vitesse** — double-clic droit pour un menu de commandes flottant avec actions contextuelles, favoris épinglables, macros et suggestions de raccourcis rapides en fonction du mode
- **Raccourcis clavier** — 15 raccourcis clavier, dont Entrée (ouvrir les détails), P (appliquer une préconfiguration), Shift+P (sauvegarder une préconfiguration), Ctrl+C/V (copier/coller)

#### Importation et exportation

- **ContentPack** — exportation en un clic au format ai-rpg-engine avec validation complète
- **Fichiers de projet** — fichiers portables `.wfproject.json` avec métadonnées de provenance et informations sur les dépendances
- **Packs de kits** — exportation/importation de fichiers `.wfkit.json` avec validation, gestion des collisions et suivi de la provenance
- **Importation** — détecte automatiquement 4 formats avec rapport structuré de fidélité
- **Différences** — suivi des modifications sémantiques depuis l'importation
- **Aperçu de la scène** — composition HTML/CSS intégrée de toutes les liaisons visuelles de la zone

## Modes de création

World Forge sépare le **genre** (fantaisie, cyberpunk, pirate) du **mode** (donjon, océan, espace). Le genre est une question de style, tandis que le mode détermine l'échelle. Le mode contrôle les paramètres par défaut de la grille, le vocabulaire des connexions, les suggestions de validation, la formulation des guides et les filtres prédéfinis.

| Mode | Grille | Tuile | Connexions principales |
|------|------|------|-----------------|
| Donjon | 30×25 | 32 | porte, escalier, passage, secret, danger |
| Quartier / Ville | 50×40 | 32 | route, porte, passage, portail |
| Région / Monde | 80×60 | 48 | route, portail, passage |
| Océan / Mer | 60×50 | 48 | canal, itinéraire, portail, danger |
| Espace | 100×80 | 64 | amarrage, saut, passage, portail |
| Intérieur | 20×15 | 24 | porte, escalier, passage, secret |
| Nature sauvage | 60×50 | 48 | sentier, route, passage, danger |

Le mode est défini lors de la création d'un projet et est stocké sous la forme `mode?: AuthoringMode` dans `WorldProject`. Chaque mode fournit des **paramètres par défaut intelligents** : les types de connexions, les rôles des entités, les noms des zones et les suggestions du panneau de vitesse s'adaptent automatiquement.

## Surface de création

### Structure du monde

- Zones avec disposition spatiale, voisins, sorties, lumière, bruit, dangers et éléments interactifs.
- 12 types de connexions (passage, porte, escalier, route, portail, secret, danger, canal, itinéraire, amarrage, saut, sentier) avec des styles visuels distincts, routage ancré aux bords, flèches directionnelles et styles pointillés conditionnels.
- Quartiers avec contrôle des factions, profils économiques, curseurs de statistiques, étiquettes et noms de quartier affichés aux centres des zones.
- Points d'intérêt nommés (dans les zones).
- Points de départ, points d'ancrage d'événements (coloration basée sur le type), présence de factions et points chauds de pression.

### Contenu

- Placements d'entités avec statistiques, ressources, profils d'IA et métadonnées personnalisées.
- Placements d'objets avec emplacement, rareté, modificateurs de statistiques et verbes accordés.
- Arbres de dialogue avec conversations ramifiées, conditions et effets.
- Points d'ancrage d'événements sur la toile : marqueurs en losange rouge avec types de boss/embuscade/patrouille.

### Systèmes de personnages

- Modèle de joueur (statistiques de départ, inventaire, équipement, point de départ).
- Catalogue de construction (archétypes, antécédents, traits, disciplines, titres croisés, liens).
- Arbres de progression (nœuds de compétences/capacités avec exigences et effets).

### Ressources

- Manifeste des ressources (portraits, sprites, arrière-plans, icônes, ensembles de tuiles) avec liaisons spécifiques au type.
- Packs de ressources (groupes nommés et versionnés avec métadonnées de compatibilité, thème, licence).
- Prévisualisation de la scène (composition en ligne de toutes les liaisons visuelles des zones avec détection des ressources manquantes).

### Flux de travail

- Préconfigurations régionales (9 intégrées, filtrées par mode) et préconfigurations d'événements (10 intégrées) avec application de fusion/remplacement et gestion (CRUD) des préconfigurations personnalisées.
- Kits de démarrage (7 intégrés, spécifiques à chaque mode) avec exportation/importation de kits (`.wfkit.json`), gestion des collisions et suivi de la provenance.
- Modèles de mise en page (6 arrangements de zones prédéfinis) et modèles de dialogues (5 amorces de conversation).
- Fusion de zones et placement en masse d'entités (motifs en grille, aléatoires ou circulaires).
- Sauvegarde automatique avec un intervalle de 30 secondes et un historique de 3 versions.
- Recherche (Ctrl+K) dans tous les types d'objets avec correspondance floue et historique récent.
- Palette de commandes du panneau de vitesse avec favoris épinglables, macros, groupes personnalisés et suggestions de mode.
- 15 raccourcis clavier centralisés.
- Éditeur de métadonnées du projet (auteur, licence, catégorie, balises).
- Statistiques de révision (répartition des rôles, types de connexions, types d'événements, zones par district).
- Exportation au format ContentPack JSON, bundles de projet et résumés de révision.
- Importation à partir de 4 formats avec rapport structuré de fidélité, suggestions de correction et suivi des différences sémantiques.

Consultez le fichier [`dogfood/WALKTHROUGH.md`](dogfood/WALKTHROUGH.md) pour la démonstration de la séquence d'exportation de Chapel Threshold, qui valide la fonctionnalité actuelle.

## Répertoire de test interne

Le répertoire `dogfood/` contient un système de tests d'intégration qui simule l'ensemble du processus de création à l'exportation, en dehors des tests unitaires. L'exemple Chapel Threshold (`chapel-threshold.ts`) crée un projet de monde petit mais complet, le soumet à l'exportation et écrit le résultat dans `dogfood/output/`. Cela prouve que les types de schéma, la validation et le pipeline d'exportation fonctionnent de bout en bout avec des données réelles, et non pas seulement avec des simulations isolées.

## Compatibilité du moteur

Les exports sont destinés aux types de contenu de [ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine). Le ContentPack exporté peut être chargé directement par [claude-rpg](https://github.com/mcp-tool-shop-org/claude-rpg).

## Sécurité

- **Données manipulées :** fichiers de projet sur le disque local (JSON créés par l'utilisateur), aucun stockage côté serveur.
- **Données NON manipulées :** aucune télémétrie, aucune analyse, aucune requête réseau en dehors du serveur de développement local.
- **Permissions :** aucune clé API, aucun secret, aucune identifiant.
- **Aucun secret, jeton ou identifiant dans le code source.**

## Licence

MIT

---

Développé par [MCP Tool Shop](https://mcp-tool-shop.github.io/)
