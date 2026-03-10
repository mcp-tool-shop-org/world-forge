<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.md">English</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./logo.png" alt="World Forge" width="400">
</p>

# @world-forge/editor

Application web React 19 pour [World Forge](https://github.com/mcp-tool-shop-org/world-forge) — un studio de création de mondes 2D pour le moteur de jeux de rôle (RPG) basé sur l'IA.

## Fonctionnalités

- **Tableau de dessin** — dessinez des zones, créez des connexions, placez des entités, des points de repère et des événements sur une grille 2D avec une vue panoramique et zoom.
- **Sélection multiple** — cliquez, maintenez la touche Shift et cliquez, ou sélectionnez une zone avec une boîte pour sélectionner des zones, des entités, des points de repère, des points de spawn et des événements ; déplacez les objets sélectionnés avec une fonctionnalité d'annulation atomique.
- **Création d'événements** — placez des points d'ancrage d'événements sur les zones avec des marqueurs de tableau de dessin basés sur le type (boss, embuscade, patrouille), propriétés modifiables (ID des ennemis, probabilité, délai de récupération, balises).
- **Édition des districts** — panneau de district étendu avec des curseurs de métriques, des balises, la faction contrôlante, le profil économique, la gestion de la présence de la faction et l'édition des points chauds de pression.
- **Édition par lots** — affectation de districts par lots, ajout de balises par lots et suppression par lots lorsque plusieurs zones sont sélectionnées.
- **Système de préréglages** — préréglages de région et d'événement avec application de fusion/remplacement, 4 préréglages de région intégrés, 3 préréglages d'événement intégrés, CRUD de préréglages personnalisés avec persistance localStorage.
- **Raccourcis clavier** — registre centralisé de raccourcis avec 13 combinaisons : Échap, Ctrl+A, Ctrl+D, Ctrl+K, Suppr, déplacement avec les flèches, Entrée (affiche les détails), P (applique le préréglage), Shift+P (enregistre le préréglage).
- **Double-clic** — double-cliquez sur n'importe quel objet du tableau de dessin pour le sélectionner, passez à l'onglet "Carte" et centrez la vue.
- **Panneau de vitesse** — double-clic à droite sur le tableau de dessin pour ouvrir une palette de commandes flottante avec des actions contextuelles, des favoris épinglables (réorganisables en mode édition), actions récentes, groupes personnalisés, macros légères avec éditeur d'étapes, filtrage de recherche et navigation au clavier.
- **Onglets de l'espace de travail** — Carte, Joueur, Constructions, Arbres, Dialogue, Objets, Préréglages, Ressources, Problèmes, Guide.
- **Bibliothèque de ressources** — gérez les portraits, les sprites, les arrière-plans, les icônes et les ensembles de tuiles avec des liaisons spécifiques à chaque type.
- **Annuler/Refaire** — pile d'historique de 10 niveaux via Zustand.
- **Importation/Exportation** — rapport de fidélité aller-retour, suivi des différences sémantiques.
- **Validation** — 54 vérifications structurelles avec navigation vers les problèmes en cliquant.
- **Modèles** — points de départ par genre et mondes d'exemple pour une prise en main rapide.

## Démarrage rapide

```bash
npm install
npm run dev --workspace=packages/editor
```

Ouvrez `http://localhost:5173` pour lancer l'éditeur.

## Licence

MIT
