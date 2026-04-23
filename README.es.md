<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.md">English</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
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

## Arquitectura

```
packages/
  schema/          @world-forge/schema         — spatial types, validation, 2.5D fields
  export-ai-rpg/   @world-forge/export-ai-rpg  — AI RPG Engine export pipeline + CLI
  export-unreal/   @world-forge/export-unreal  — Unreal Engine 5 export pipeline + CLI (2.5D aware)
  export-godot/    @world-forge/export-godot   — (planned) Godot 4 export lane, stub only
  renderer-2d/     @world-forge/renderer-2d    — PixiJS 2D canvas renderer
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
5. **Revise** — abra la pestaña de revisión para ver el estado de salud, una descripción general del contenido y exportar un resumen (Markdown/JSON).
6. **Exporte** — descargue un ContentPack, un paquete de proyecto (.wfproject.json) o un resumen de la revisión.

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
- **Sistema de modos** — `AuthoringMode` (7 modos), perfiles específicos del modo para la cuadrícula/conexiones/validaciones.
- **Validación** — `validateProject()` (54 comprobaciones estructurales con búsquedas basadas en mapas O(n), `warningCount`), `advisoryValidation()` (sugerencias específicas del modo, integridad de los metadatos, nomenclatura de activos)
- **Utilidades** — `assembleSceneData()` (enlaces visuales con detección de activos faltantes), `scanDependencies()` (análisis del grafo de referencias), `buildReviewSnapshot()` (clasificación de la salud)

### @world-forge/export-unreal

Convierte un `WorldProject` en un paquete de contenido para Unreal Engine 5, optimizado para juegos en 2.5D.

- **Salida** — `pack.json`, datos primarios JSON por zona y distrito, manifiesto de aparición de actores agrupados, sugerencias de transmisión de niveles por conexión, sugerencias de celdas de World Partition e informe de fidelidad estructurado.
- **Campos 2.5D** — `Zone.elevation`, `elevationRange`, `parallaxLayers`, `skylineRef` se conservan y se convierten en coordenadas UE en cm / eje Z positivo.
- **Transformación de coordenadas** — funciones puras (`pixelsToUnrealCm`, `elevationToZ`, `worldForgeToUnrealAxis`, `gridToUnrealAxis`). La escala mundial predeterminada es 1 baldosa = 100 cm.
- **Importación de ida y vuelta** — `importFromUnreal` reconstruye un WorldProject a partir de un paquete de Unreal; los datos solo de juego (diálogos, progreso, construcciones) se marcan como omitidos en el informe de fidelidad.
- **Línea de comandos** — `world-forge-export-unreal` con `--out`, `--tile-size-cm`, `--validate-only`, `--verbose`.

### @world-forge/export-godot

Espacio de trabajo reservado para la futura exportación a Godot 4 (Fractured Road). Aún no implementado.

### @world-forge/export-ai-rpg

Convierte un `WorldProject` en el formato `ContentPack` de ai-rpg-engine.

- **Exportación** — zonas, distritos, entidades, objetos, diálogos, plantilla de jugador, catálogo de construcciones, árboles de progreso, encuentros, facciones, puntos calientes, manifiesto y metadatos del paquete.
- **Importación** — 8 conversores inversos reconstruyen un WorldProject a partir de JSON exportado.
- **Informe de fidelidad** — seguimiento estructurado de lo que se conservó sin pérdidas, se aproximó o se omitió durante la conversión.
- **Detección de formato** — detecta automáticamente los formatos WorldProject, ExportResult, ContentPack y ProjectBundle.
- **Línea de comandos** — comando `world-forge-export` con las banderas `--out`, `--validate-only` y `--verbose`.

### @world-forge/renderer-2d

Renderizador 2D basado en PixiJS: vista con desplazamiento/zoom, superposiciones de zonas con coloración de distritos, flechas de conexión, iconos de entidades por rol, capas de baldosas y un minimapa.

### @world-forge/editor

Aplicación web React 19 + Vite con gestión de estado Zustand, deshacer/rehacer con etiquetas de acción, autoguardado (con una frecuencia de 30 segundos y un historial de 3 versiones), cambio de tema entre claro y oscuro, y protección contra cambios no guardados.

#### Pestañas del espacio de trabajo

| Pestaña | Propósito |
|-----|---------|
| Mapa | Edición de zonas/entidades/distritos en el lienzo 2D. |
| Objetos | Árbol jerárquico: distritos → zonas → entidades/puntos de referencia/puntos de aparición. |
| Jugador | Plantilla de jugador con estadísticas, inventario, equipo y punto de aparición. |
| Construcciones | Arquetipos, trasfondos, rasgos, disciplinas, combinaciones. |
| Árboles | Nodos de progresión con requisitos y efectos. |
| Diálogo | Edición de nodos, enlace de opciones, detección de referencias rotas. |
| Preajustes | Explorador de preajustes de regiones y encuentros con opciones de fusión/sobrescritura. |
| Recursos | Biblioteca de recursos con búsqueda filtrada por tipo, detección de recursos huérfanos y paquetes de recursos. |
| Problemas | Validación en vivo y agrupada con navegación enfocada al hacer clic. |
| Dependencias | Escáner de dependencias con botones de reparación integrados. |
| Revisión | Panel de estado, resumen del contenido, exportación de resumen. |
| Guía | Lista de verificación para la primera ejecución con referencia de atajos de teclado. |

#### Lienzo y edición

- **Herramientas** — seleccionar, pintar zonas, conectar, colocar entidades, punto de referencia, punto de aparición.
- **Selección múltiple** — clic con Shift, selección por cuadro, Ctrl+A; mover arrastrando con deshacer atómico.
- **Alineación** — alineación de 6 formas (izquierda/derecha/arriba/abajo/centro horizontal/centro vertical) y distribución horizontal/vertical.
- **Ajuste** — ajuste al arrastrar a los bordes/centros de objetos cercanos con líneas guía visuales.
- **Redimensionar** — 8 manejadores por zona con ajuste a los bordes, limitación del tamaño mínimo, vista previa en tiempo real.
- **Duplicar** — Ctrl+D con remapeo de ID, conexiones y asignaciones de distrito.
- **Copiar/Pegar** — Ctrl+C / Ctrl+V con remapeo de ID y desplazamiento configurable.
- **Ciclo al hacer clic** — clics repetidos en la misma posición alternan entre objetos superpuestos.
- **Menú contextual** — clic derecho para 7 acciones sensibles al contexto (propiedades, eliminar, duplicar, etc.).
- **Vista previa de conexión** — línea discontinua de color cian durante la colocación de la herramienta de conexión.
- **Mini mapa** — vista general de 200x150 (esquina inferior derecha), hacer clic para ir a esa ubicación.
- **Recorte de la vista** — solo renderiza objetos dentro de los límites visibles (margen de 64 píxeles).
- **Estadísticas de rendimiento** — alternar FPS/conteo de objetos/tiempo de renderizado.
- **Visibilidad por objeto** — ocultar/mostrar objetos individuales (guardado en localStorage).
- **Capas** — 7 opciones de visibilidad (cuadrícula, conexiones, entidades, puntos de referencia, puntos de aparición, fondos, ambiente).

#### Navegación y atajos

- **Vista** — mover/acercar la cámara, rueda del ratón para acercar (anclado al cursor), barra espaciadora/botón central del ratón para mover arrastrando, ajuste automático al contenido, doble clic para centrar.
- **Búsqueda** — Ctrl+K abre una ventana emergente para encontrar cualquier objeto por nombre/ID con coincidencia aproximada, navegación con el teclado y historial de búsqueda reciente (localStorage).
- **Panel de velocidad** — doble clic derecho para abrir una paleta de comandos flotante con acciones sensibles al contexto, favoritos anclables, macros y sugerencias de acciones rápidas según el modo.
- **Atajos de teclado** — 15 atajos de teclado, incluyendo Enter (abrir detalles), P (aplicar preajuste), Shift+P (guardar preajuste), Ctrl+C/V (copiar/pegar).

#### Importación y exportación

- **ContentPack** — exportación con un solo clic al formato ai-rpg-engine con validación completa.
- **Paquetes de proyectos** — archivos portátiles `.wfproject.json` con metadatos de origen y información de dependencias.
- **Paquetes de kits** — exportación/importación de `.wfkit.json` con validación, manejo de colisiones y seguimiento del origen.
- **Importación** — detecta automáticamente 4 formatos con informes estructurados de fidelidad.
- **Diferencias** — seguimiento semántico de los cambios desde la importación.
- **Vista previa de la escena** — composición HTML/CSS en línea de todas las vinculaciones visuales de la zona.

## Modos de creación

World Forge separa el **género** (fantasía, cyberpunk, pirata) del **modo** (mazmorra, océano, espacio). El género es el estilo — el modo es la escala. El modo controla los valores predeterminados de la cuadrícula, el vocabulario de conexiones, las sugerencias de validación, la redacción de las guías y los filtros preestablecidos.

| Modo | Cuadrícula | Baldosa | Conexiones clave |
|------|------|------|-----------------|
| Mazmorra | 30x25 | 32 | puerta, escaleras, pasaje, secreto, peligro |
| Distrito / Ciudad | 50x40 | 32 | carretera, puerta, pasaje, portal |
| Región / Mundo | 80x60 | 48 | carretera, portal, pasaje |
| Océano / Mar | 60x50 | 48 | canal, ruta, portal, peligro |
| Espacio | 100x80 | 64 | amarre, salto, pasaje, portal |
| Interior | 20x15 | 24 | puerta, escaleras, pasaje, secreto |
| Tierra salvaje | 60x50 | 48 | sendero, carretera, pasaje, peligro |

El modo se establece al crear un proyecto y se guarda como `mode?: AuthoringMode` en `WorldProject`. Cada modo proporciona **valores predeterminados inteligentes**: los tipos de conexión, los roles de las entidades, los nombres de las zonas y las sugerencias del panel de velocidad se adaptan automáticamente.

## Superficie de creación

### Estructura del mundo

- Zonas con distribución espacial, vecinos, salidas, luz, ruido, peligros e interactivos.
- 12 tipos de conexión (pasaje, puerta, escaleras, carretera, portal, secreto, peligro, canal, ruta, amarre, salto, sendero) con estilos visuales distintos, enrutamiento anclado al borde, flechas direccionales y estilo punteado condicional.
- Distritos con control de facciones, perfiles económicos, controles deslizantes de métricas, etiquetas y etiquetas de nombres de distrito en los centros de las zonas.
- Puntos de referencia (puntos de interés nombrados dentro de las zonas).
- Puntos de aparición, anclajes de encuentros (coloreados según el tipo), presencia de facciones y puntos críticos de presión.

### Contenido

- Colocación de entidades con estadísticas, recursos, perfiles de IA y metadatos personalizados.
- Colocación de objetos con ranura, rareza, modificadores de estadísticas y verbos asignados.
- Árboles de diálogo con conversaciones ramificadas, condiciones y efectos.
- Anclajes de encuentros en el lienzo: marcadores de diamantes rojos con tipos de jefe/emboscada/patrulla.

### Sistemas de personajes

- Plantilla de jugador (estadísticas iniciales, inventario, equipo, punto de aparición).
- Catálogo de construcción (arquetipos, antecedentes, rasgos, disciplinas, títulos cruzados, entrelazamientos).
- Árboles de progresión (nodos de habilidades/habilidades con requisitos y efectos).

### Recursos

- Manifiesto de activos (retratos, sprites, fondos, iconos, conjuntos de mosaicos) con enlaces específicos del tipo.
- Paquetes de activos (agrupaciones nombradas y versionadas con metadatos de compatibilidad, tema, licencia).
- Vista previa de la escena (composición en línea de todas las vinculaciones visuales de la zona con detección de activos faltantes).

### Flujo de trabajo

- Presets de región (9 integrados, filtrados por modo) y presets de encuentros (10 integrados) con aplicación de fusión/sobrescritura y gestión CRUD de presets personalizados.
- Kits de inicio (7 integrados, específicos para cada modo) con exportación/importación de kits (`.wfkit.json`), manejo de colisiones y seguimiento de origen.
- Plantillas de diseño (6 diseños de zonas predefinidos) y plantillas de diálogo (5 inicios de conversación).
- Fusión de zonas y colocación masiva de entidades (patrones de cuadrícula/aleatorio/círculo).
- Autoguardado con un intervalo de 30 segundos y un historial de recuperación de 3 versiones.
- Búsqueda con Ctrl+K en todos los tipos de objetos con coincidencia aproximada y historial reciente.
- Paleta de comandos del panel de velocidad con favoritos anclables, macros, grupos personalizados y sugerencias de modo.
- 15 atajos de teclado centralizados.
- Editor de metadatos del proyecto (autor, licencia, categoría, etiquetas).
- Estadísticas de revisión (distribución de roles, tipos de conexión, tipos de encuentro, zonas por distrito).
- Exportación a ContentPack JSON, paquetes de proyectos y resúmenes de revisión.
- Importación desde 4 formatos con informes de fidelidad estructurados, sugerencias de reparación y seguimiento de diferencias semánticas.

Consulte [`dogfood/WALKTHROUGH.md`](dogfood/WALKTHROUGH.md) para ver la prueba de la secuencia de exportación de Chapel Threshold, que demuestra el funcionamiento actual.

## Directorio de Pruebas Internas

El directorio `dogfood/` contiene un entorno de pruebas de integración que simula todo el proceso de creación a exportación, fuera de las pruebas unitarias. El ejemplo de Chapel Threshold (`chapel-threshold.ts`) crea un proyecto de mundo pequeño pero completo, lo ejecuta a través del proceso de exportación y escribe la salida en `dogfood/output/`. Esto demuestra que los tipos de esquema, la validación y el proceso de exportación funcionan de extremo a extremo con datos reales, no solo con simulaciones aisladas.

## Compatibilidad con el Motor

Las exportaciones están dirigidas a los tipos de contenido de [ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine). El ContentPack exportado se puede cargar directamente en [claude-rpg](https://github.com/mcp-tool-shop-org/claude-rpg).

## Seguridad

- **Datos accedidos:** archivos del proyecto en el disco local (JSON creado por el usuario), sin almacenamiento en el servidor.
- **Datos NO accedidos:** sin telemetría, sin análisis, sin solicitudes de red más allá del servidor de desarrollo local.
- **Permisos:** sin claves de API, sin secretos, sin credenciales.
- **No hay secretos, tokens ni credenciales en el código fuente.**

## Licencia

MIT

---

Desarrollado por [MCP Tool Shop](https://mcp-tool-shop.github.io/)
