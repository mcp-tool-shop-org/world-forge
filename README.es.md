<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.md">English</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
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

## Arquitectura

```
packages/
  schema/          @world-forge/schema        — spatial types, validation
  export-ai-rpg/   @world-forge/export-ai-rpg — engine export pipeline + CLI
  renderer-2d/     @world-forge/renderer-2d   — PixiJS 2D canvas renderer
  editor/          @world-forge/editor         — React web authoring app
```

## Guía de inicio rápido

```bash
npm install
npm run build
npm run dev --workspace=packages/editor
```

Abra `http://localhost:5173` para iniciar el editor.

### Flujo de trabajo del editor

1. **Elija un modo** — mazmorra, distrito, mundo, océano, espacio, interior o naturaleza — para establecer los valores predeterminados de la cuadrícula y el vocabulario de conexiones.
2. **Comience con un kit** — seleccione un kit de inicio o una plantilla de género desde el Administrador de plantillas, o comience desde cero.
3. **Pinte zonas** — arrastre sobre el lienzo para crear zonas, conéctelas y asígneles distritos.
4. **Coloque entidades** — arrastre PNJ, enemigos, comerciantes, encuentros y objetos a las zonas.
5. **Revise** — abra la pestaña de Revisión para ver el estado de salud, una descripción general del contenido y exportar un resumen (Markdown/JSON).
6. **Exportar** — descargue un ContentPack, un paquete de proyecto (.wfproject.json) o un resumen de la revisión.

### Exportación por línea de comandos

```bash
npx world-forge-export project.json --out ./my-pack
npx world-forge-export project.json --validate-only
```

## Paquetes

### @world-forge/schema

Tipos y validaciones principales de TypeScript para la creación de mundos.

- **Tipos espaciales** — `WorldMap`, `Zone`, `ZoneConnection`, `District`, `Landmark`, `SpawnPoint`, `EncounterAnchor`, `FactionPresence`, `PressureHotspot`
- **Tipos de contenido** — `EntityPlacement`, `ItemPlacement`, `DialogueDefinition`, `PlayerTemplate`, `BuildCatalogDefinition`, `ProgressionTreeDefinition`
- **Capas visuales** — `AssetEntry`, `AssetPack`, `Tileset`, `TileLayer`, `PropDefinition`, `AmbientLayer`
- **Sistema de modos** — `AuthoringMode` (7 modos), perfiles específicos del modo para la cuadrícula/conexiones/validación.
- **Validación** — `validateProject()` (54 comprobaciones estructurales), `advisoryValidation()` (sugerencias específicas del modo).
- **Utilidades** — `assembleSceneData()` (enlaces visuales con detección de activos faltantes), `scanDependencies()` (análisis del grafo de referencias), `buildReviewSnapshot()` (clasificación de salud).

### @world-forge/export-ai-rpg

Convierte un `WorldProject` al formato `ContentPack` de ai-rpg-engine.

- **Exportar** — zonas, distritos, entidades, objetos, diálogos, plantilla de jugador, catálogo de construcción, árboles de progresión, encuentros, facciones, puntos calientes, manifiesto y metadatos del paquete.
- **Importar** — 8 conversores inversos reconstruyen un WorldProject a partir de JSON exportado.
- **Informes de fidelidad** — seguimiento estructurado de lo que se mantuvo sin pérdidas, se aproximó o se omitió durante la conversión.
- **Detección de formato** — detecta automáticamente los formatos WorldProject, ExportResult, ContentPack y ProjectBundle.
- **Línea de comandos** — comando `world-forge-export` con las banderas `--out` y `--validate-only`.

### @world-forge/renderer-2d

Renderizador 2D basado en PixiJS: vista con desplazamiento/zoom, superposiciones de zonas con coloración de distritos, flechas de conexión, iconos de entidades por rol, capas de mosaicos y un minimapa.

### @world-forge/editor

Aplicación web React 19 + Vite con gestión de estado Zustand y deshacer/rehacer.

#### Pestañas del espacio de trabajo

| Pestaña | Propósito |
|-----|---------|
| Mapa | Edición de zonas/entidades/distritos en el lienzo 2D. |
| Objetos | Árbol jerárquico: distritos → zonas → entidades/puntos de referencia/puntos de aparición. |
| Jugador | Plantilla de jugador con estadísticas, inventario, equipo y punto de aparición. |
| Construcciones | Arquetipos, antecedentes, rasgos, disciplinas, combinaciones. |
| Árboles | Nodos de progresión con requisitos y efectos. |
| Diálogo | Edición de nodos, enlace de opciones, detección de referencias rotas. |
| Preajustes | Explorador de preajustes de región y encuentro con opciones de combinación/reemplazo. |
| Activos | Biblioteca de activos con búsqueda filtrada por tipo, detección de elementos huérfanos y paquetes de activos. |
| Problemas | Validación en vivo agrupada con navegación enfocada al hacer clic. |
| Dependencias | Escáner de dependencias con botones de reparación integrados. |
| Revisión | Panel de control de salud, resumen del contenido, exportación de resumen. |
| Guía | Lista de verificación para la primera ejecución con referencia de atajos de teclado. |

#### Lienzo y edición

- **Herramientas** — seleccionar, pintar áreas, conectar, colocar entidades, marcador, generar.
- **Selección múltiple** — clic con Shift, selección con caja, Ctrl+A; mover arrastrando con deshacer individual.
- **Alineación** — alineación en 6 direcciones (izquierda/derecha/arriba/abajo/centro horizontal/centro vertical) y distribución horizontal/vertical.
- **Ajuste** — ajuste al arrastrar a los bordes/centros de objetos cercanos con líneas guía visuales.
- **Redimensionar** — 8 manejas por área con ajuste a los bordes, limitación del tamaño mínimo, vista previa en tiempo real.
- **Duplicar** — Ctrl+D con IDs, conexiones y asignaciones de distrito remapeados.
- **Ciclo de clics** — clics repetidos en la misma posición alternan entre objetos superpuestos.
- **Capas** — 7 opciones de visibilidad (cuadrícula, conexiones, entidades, marcadores, generación, fondos, ambiente).

#### Navegación y atajos

- **Visor** — mover/acercar la cámara, zoom con la rueda del ratón (con el cursor anclado), barra espaciadora/clic central/arrastrar con el botón derecho para mover, ajuste automático al contenido, doble clic para centrar.
- **Búsqueda** — Ctrl+K abre una ventana emergente para encontrar cualquier objeto por nombre/ID con navegación por teclado.
- **Panel de velocidad** — doble clic con el botón derecho para abrir una paleta de comandos flotante con acciones contextuales, favoritos que se pueden fijar, macros y sugerencias de acciones rápidas según el modo.
- **Atajos de teclado** — 13 atajos de teclado, incluyendo Enter (abrir detalles), P (aplicar preajuste), Shift+P (guardar preajuste).

#### Importación y exportación

- **Paquete de contenido** — exportación con un clic al formato ai-rpg-engine con validación completa.
- **Paquetes de proyecto** — archivos `.wfproject.json` portátiles con metadatos de origen e información de dependencias.
- **Paquetes de kit** — exportación/importación de `.wfkit.json` con validación, manejo de colisiones y seguimiento del origen.
- **Importación** — detecta automáticamente 4 formatos con informes estructurados de fidelidad.
- **Diferencias** — seguimiento de cambios semánticos desde la importación.
- **Vista previa de la escena** — composición HTML/CSS en línea de todas las vinculaciones visuales de las áreas.

## Modos de creación

World Forge separa el **género** (fantasía, cyberpunk, pirata) del **modo** (mazmorra, océano, espacio). El género es el estilo — el modo es la escala. El modo controla los valores predeterminados de la cuadrícula, el vocabulario de las conexiones, las sugerencias de validación, la redacción de las guías y el filtrado de los preajustes.

| Modo | Cuadrícula | Mosaico | Conexiones clave |
|------|------|------|-----------------|
| Mazmorra | 30×25 | 32 | puerta, escaleras, pasaje, secreto, peligro |
| Distrito / Ciudad | 50×40 | 32 | carretera, puerta, pasaje, portal |
| Región / Mundo | 80×60 | 48 | carretera, portal, pasaje |
| Océano / Mar | 60×50 | 48 | canal, ruta, portal, peligro |
| Espacio | 100×80 | 64 | amarre, salto, pasaje, portal |
| Interior | 20×15 | 24 | puerta, escaleras, pasaje, secreto |
| Tierra salvaje | 60×50 | 48 | sendero, carretera, pasaje, peligro |

El modo se establece al crear un proyecto y se guarda como `mode?: AuthoringMode` en `WorldProject`. Cada modo proporciona **valores predeterminados inteligentes** — los tipos de conexión, los roles de las entidades, los nombres de las áreas y las sugerencias del Panel de velocidad se adaptan automáticamente.

## Superficie de creación

### Estructura del mundo

- Zonas con distribución espacial, vecinos, salidas, iluminación, ruido, peligros y elementos interactivos.
- 12 tipos de conexiones (pasaje, puerta, escaleras, camino, portal, secreto, peligro, conducto, ruta, amarre, teletransporte, sendero) con estilos visuales distintos, enrutamiento anclado a los bordes, indicadores direccionales y estilos de línea discontinua condicionales.
- Distritos con control de facciones, perfiles económicos, controles deslizantes de métricas, etiquetas y etiquetas de nombre de distrito en los centros de las zonas.
- Puntos de referencia (puntos de interés con nombre dentro de las zonas).
- Puntos de aparición, anclajes de encuentros (codificación basada en el tipo), presencia de facciones y puntos críticos de presión.

### Contenido

- Colocación de entidades con estadísticas, recursos, perfiles de IA y metadatos personalizados.
- Colocación de objetos con ranura, rareza, modificadores de estadísticas y acciones disponibles.
- Árboles de diálogo con conversaciones ramificadas, condiciones y efectos.
- Anclajes de encuentros en el lienzo: marcadores de diamantes rojos con tipos de jefe/emboscada/patrulla.

### Sistemas de Personajes

- Plantilla de jugador (estadísticas iniciales, inventario, equipo, punto de aparición).
- Catálogo de construcción (arquetipos, antecedentes, rasgos, disciplinas, títulos cruzados, vínculos).
- Árboles de progresión (nodos de habilidades/capacidades con requisitos y efectos).

### Activos

- Manifiesto de activos (retratos, sprites, fondos, iconos, conjuntos de mosaicos) con enlaces específicos para cada tipo.
- Paquetes de activos (agrupaciones con nombre y versión, con metadatos de compatibilidad, tema y licencia).
- Vista previa de la escena (composición en línea de todas las vinculaciones visuales de la zona con detección de activos faltantes).

### Flujo de Trabajo

- Presets de región (9 integrados, filtrados por modo) y presets de encuentro (10 integrados) con aplicación de fusión/sobrescritura y gestión CRUD de presets personalizados.
- Kits de inicio (7 integrados, específicos para cada modo) con exportación/importación de kits (`.wfkit.json`), manejo de colisiones y seguimiento de origen.
- Búsqueda con Ctrl+K en todos los tipos de objetos, incluidas las conexiones y los encuentros.
- Paleta de comandos del panel de velocidad con favoritos anclables, macros, grupos personalizados y sugerencias de modo.
- 13 atajos de teclado centralizados.
- Exportación a JSON de ContentPack, paquetes de proyectos y resúmenes de revisión.
- Importación desde 4 formatos con informes estructurados de fidelidad y seguimiento semántico de diferencias.

Consulte [`dogfood/WALKTHROUGH.md`](dogfood/WALKTHROUGH.md) para ver la secuencia de exportación de Chapel Threshold que demuestra la superficie actual.

## Compatibilidad con el motor

Las exportaciones están dirigidas a los tipos de contenido de [ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine). El ContentPack exportado se puede cargar directamente en [claude-rpg](https://github.com/mcp-tool-shop-org/claude-rpg).

## Seguridad

- **Datos accedidos:** archivos del proyecto en el disco local (JSON creado por el usuario), sin almacenamiento en el servidor.
- **Datos NO accedidos:** sin telemetría, sin análisis, sin solicitudes de red más allá del servidor de desarrollo local.
- **Permisos:** sin claves de API, sin secretos, sin credenciales.
- **Sin secretos, tokens ni credenciales en el código fuente.**

## Licencia

MIT

---

Creado por [MCP Tool Shop](https://mcp-tool-shop.github.io/)
