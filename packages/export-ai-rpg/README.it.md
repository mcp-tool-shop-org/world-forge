<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.md">English</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./logo.png" alt="World Forge" width="400">
</p>

# @world-forge/export-ai-rpg

Pipeline di esportazione per [World Forge](https://github.com/mcp-tool-shop-org/world-forge) — converte un `WorldProject` in un `ContentPack` per [ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine).

## Installazione

```bash
npm install @world-forge/export-ai-rpg
```

## API

```typescript
import { exportToEngine } from '@world-forge/export-ai-rpg';

const result = exportToEngine(myProject);
if (!result.success) {
  console.error(result.errors);
} else {
  const { contentPack, manifest, packMeta, warnings } = result;
}
```

## CLI (Interfaccia a riga di comando)

```bash
npx world-forge-export project.json --out ./my-pack
npx world-forge-export project.json --validate-only
```

## Quale esportatore scegliere?

World Forge include diversi esportatori per vari motori di gioco. Scegli quello che corrisponde al tuo
ambiente di esecuzione:

| Esportatore | Destinazione | Utilizzare quando... |
|----------|--------|-----------|
| `@world-forge/export-ai-rpg` (questo pacchetto) | `ContentPack` per [ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine) | Si desidera un RPG basato sull'intelligenza artificiale, con un approccio incentrato sul testo e sui sistemi: personaggi non giocanti, distretti, fazioni, grafi di dialogo, alberi di progressione. |
| `@world-forge/export-unreal` | Progetti Unreal Engine 5 in 2.5D | Si sta sviluppando un gioco Unreal in 2.5D e si necessita di un trasferimento di livelli, attori e tabelle dati. |
| `@world-forge/export-godot` | Progetti Godot 4 | Si sta sviluppando un RPG con Godot 4 e si desiderano scene e risorse. |

In caso di dubbi, iniziate qui (`export-ai-rpg`) — è l'esportatore di riferimento e
produce il livello di sistemi più completo.

## Cosa converte

| World Forge | Motore di gioco |
|-------------|--------|
| Zone | `ZoneDefinition[]` |
| Distretti | `DistrictDefinition[]` |
| Posizioni di entità | `EntityBlueprint[]` (con statistiche, risorse, intelligenza artificiale) |
| Posizioni di oggetti | `ItemDefinition[]` (con slot, rarità, modificatori) |
| Metadati del progetto | `GameManifest` + `PackMetadata` |

## Licenza

MIT
