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

<p align="center">2D / 2.5D world authoring studio with peer export lanes for <a href="https://github.com/mcp-tool-shop-org/ai-rpg-engine">AI RPG Engine</a>, <a href="https://www.unrealengine.com/">Unreal Engine 5</a>, and <a href="https://godotengine.org/">Godot 4</a>.<br>One editor, many modes — paint zones, place entities, define districts, export a complete content pack for your engine of choice.</p>

<!-- versión:inicio -->
<p align="center"><strong>v4.5.0</strong> — 2360 tests + e2e browser checks, 6 shipping packages, 7 authoring modes, tiles + interiors + town authoring + world modeling (vertical strata, typed hazards, party-gated zones), three export targets (AI RPG Engine, Unreal Engine 5, Godot 4)</p>
<!-- version:end -->

## Arquitectura

```
packages/
  schema/          @world-forge/schema         — spatial types, validation, 2.5D fields
  export-ai-rpg/   @world-forge/export-ai-rpg  — AI RPG Engine export pipeline + CLI
  export-unreal/   @world-forge/export-unreal  — Unreal Engine 5 export pipeline + CLI (2.5D aware)
  export-godot/    @world-forge/export-godot   — Godot 4 export pipeline + .tscn scene generation
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

1.  **Elija un modo:** mazmorra, distrito, mundo, océano, espacio, interior o naturaleza salvaje, para establecer los valores predeterminados de la cuadrícula y el vocabulario de conexión.
2.  **Comience con un kit:** seleccione un kit inicial o una plantilla de género en el Administrador de plantillas, o comience con una hoja en blanco.
3.  **Dibuje zonas:** arrastre sobre el lienzo para crear zonas, conéctelas y asigne distritos.
4.  **Coloque entidades:** agregue personajes no jugables, enemigos, comerciantes, encuentros y objetos a las zonas.
5.  **Revise:** abra la pestaña de revisión para ver el estado general, una descripción del contenido y exporte un resumen (en formato Markdown/JSON).
6.  **Exporte:** abra la ventana emergente de exportación para ver el estado de preparación por objetivo (✓ Listo / ⚠ advertencias), configure las opciones del objetivo y luego descargue los paquetes de AI RPG Engine, UE5 o Godot 4. Después de la exportación, se mostrarán recibos que incluyen información sobre el tamaño, la cantidad y la calidad. También: paquetes de proyecto (.wfproject.json) y resúmenes de revisión.

### Exportación mediante la interfaz de línea de comandos (CLI)

```bash
# AI RPG Engine
npx world-forge-export project.json --out ./my-pack
npx world-forge-export project.json --validate-only

# Unreal Engine 5
npx world-forge-export-unreal project.json --out ./UnrealPack --sign
npx world-forge-export-unreal --summary ./UnrealPack
```

## Paquetes

### @mundo-forja/esquema

Tipos básicos de TypeScript y validación para la creación de mundos virtuales.

- **Tipos espaciales:** `WorldMap`, `Zone`, `ZoneConnection`, `District`, `Landmark`, `SpawnPoint`, `EncounterAnchor`, `FactionPresence`, `PressureHotspot`
- **Tipos de contenido:** `EntityPlacement`, `ItemPlacement`, `DialogueDefinition`, `PlayerTemplate`, `BuildCatalogDefinition`, `ProgressionTreeDefinition`
- **Capas visuales:** `AssetEntry`, `AssetPack`, `Tileset`, `TileLayer`, `PropDefinition`, `PropPlacement`, `AmbientLayer`
- **Ciudad y estructuras:** `MarketNode`, `CraftingStation`, `Building`, `Hub`, `Stronghold`
- **Modelado del mundo:** `Stratum` + `StratumLink` (capas verticales), `HazardDefinition` (unión de efectos tipificados), `ZoneEntryGate` + operandos de estado de grupo en `SpawnCondition` (`party-level`, `party-size`, `item`, `flag`, `member`, `class`)
- **Sistema de modos:** `AuthoringMode` (7 modos), perfiles específicos para cada modo que definen la cuadrícula, las conexiones y las validaciones.
- **Validación:** `validateProject()` (78 comprobaciones estructurales con búsquedas basadas en mapas O(n), `warningCount`), `advisoryValidation()` (sugerencias específicas para cada modo, integridad de los metadatos, nombres de los recursos)
- **Utilidades:** `assembleSceneData()` (enlaces visuales con detección de recursos faltantes), `scanDependencies()` (análisis del grafo de referencias), `buildReviewSnapshot()` (clasificación del estado)

### @world-forge/export-unreal

Convierte un proyecto de `WorldProject` en un paquete de contenido para Unreal Engine 5, optimizado para juegos en 2.5D.

- **Resultados** — `pack.json`, archivos JSON de datos primarios por zona y por distrito, manifiesto agrupado de generación de actores, indicaciones de transmisión de niveles por conexión, indicaciones de celdas de partición mundial e informe estructurado de fidelidad.
- **Campos 2.5D** — `Zone.elevation`, `elevationRange`, `parallaxLayers` y `skylineRef` se conservan y se convierten a coordenadas UE en cm / Z-up.
- **Transformación de coordenadas** — funciones puras (`pixelsToUnrealCm`, `elevationToZ`, `worldForgeToUnrealAxis`, `gridToUnrealAxis`). La escala mundial predeterminada es 1 casilla = 100 cm.
- **Importación completa** — `importFromUnreal` reconstruye un WorldProject a partir de un paquete de Unreal; los datos exclusivos del juego (diálogos, progresión, configuraciones) se marcan como eliminados en el informe de fidelidad.
- **CLI** — `world-forge-export-unreal` con `--out`, `--tile-size-cm`, `--validate-only`, `--verbose`.

### @world-forge/export-godot

Convierte un proyecto de `WorldProject` en un paquete de contenido para Godot 4 con archivos de escena en formato `.tscn`.

- **Resultados** — `pack.json`, recursos por zona, manifiesto de entidades, enlaces de navegación, tablas de botín, marcadores de aparición, nodos de transición, recursos de diálogo, asignaciones de activos y una escena mundial `.tscn`.
- **Escena jugable** — `buildWorldScene()` genera una escena `.tscn` navegable: colisión `StaticBody2D` por zona + `NavigationRegion2D`, una cámara `Camera2D` enmarcada y ordenación vertical/profundidad `z_index`.
- **Mosaicos e interiores** — `TileMapLayer` + `TileSet` (datos de mosaico `tile_map_data` precalculados para conjuntos de mosaicos de imagen), colisión `StaticBody2D` por celda y colocación de elementos decorativos `Node2D`.
- **Ciudad** — mercados + estaciones de elaboración, y edificios (huellas de `StaticBody2D`) / centros / fortalezas como marcadores de posición `Node2D`, todos los cuales contienen sus datos como metadatos.
- **Modelado del mundo** — estratos verticales (bandas `z_index` por zona + conectores `StratumLink`), peligros tipificados como regiones `Area2D` y metadatos de la entrada a la zona.
- **Informe de fidelidad** — seguimiento estructurado de datos sin pérdidas, aproximados y descartados, verificados con el motor Godot 4 real (humo sin interfaz gráfica, 36 aserciones).
- **Versión del formato** — `GODOT_PACK_FORMAT_VERSION` 1.0.0.

### @world-forge/export-ai-rpg

Convierte un objeto `WorldProject` al formato `ContentPack` del motor ai-rpg.

- **Exportación:** zonas, distritos, entidades, elementos, diálogos, plantilla de jugador, catálogo de objetos, árboles de progresión, encuentros, facciones, puntos críticos, manifiesto y metadatos del paquete.
- **Importación:** 8 convertidores inversos reconstruyen un WorldProject a partir del JSON exportado.
- **Informe de fidelidad:** seguimiento estructurado de qué elementos se conservaron sin pérdidas, se aproximaron o se omitieron durante la conversión.
- **Detección de formato:** detecta automáticamente los formatos WorldProject, ExportResult, ContentPack y ProjectBundle.
- **CLI:** comando `world-forge-export` con las opciones `--out`, `--validate-only` y `--verbose`.

### @world-forge/renderizador-2d

Motor de renderizado 2D basado en PixiJS: área de visualización con funciones de desplazamiento y zoom, superposiciones de zonas con codificación por colores según el distrito, flechas que indican conexiones, iconos de entidades según su función, capas de mosaicos y un mapa pequeño.

### @world-forge/editor

Aplicación web React 19 + Vite con gestión de estado mediante Zustand, función de deshacer/rehacer con etiquetas de acción, guardado automático (con un intervalo de 30 segundos, historial de 3 versiones y recuperación en caso de fallo), protección contra cambios no deseados en todas las rutas de carga del proyecto, alternancia entre el modo oscuro y claro, gestión del enfoque en ventanas modales y cambio de herramientas mediante teclado.

#### Pestañas del espacio de trabajo

| Pestaña | Propósito |
|-----|---------|
| Mapa | Edición de zonas/entidades/distritos en el lienzo 2D |
| Objetos | Árbol jerárquico: distritos → zonas → entidades/puntos de referencia/lugares de aparición |
| Jugador | Plantilla de jugador con estadísticas, inventario, equipo y lugar de aparición |
| Construcciones | Arquetipos, antecedentes, rasgos, disciplinas, combinaciones |
| Árboles | Nodos de progresión con requisitos y efectos |
| Diálogo | Edición de nodos, enlace de opciones, detección de referencias rotas |
| Preajustes | Navegador de preajustes de región y encuentro con fusión/reescritura |
| Activos | Biblioteca de activos con búsqueda filtrada por tipo, detección de elementos huérfanos, paquetes de activos |
| Problemas | Validación agrupada en tiempo real con navegación "hacer clic para enfocar" |
| Dependencias | Escáner de dependencias con botones de reparación integrados |
| Revisión | Panel de control de estado, resumen del contenido, exportación resumida |
| Guía | Lista de verificación para el primer uso con referencia de teclas rápidas |

#### Lienzo y edición

- **Herramientas:** seleccionar, pintar zonas, conectar, colocar entidades, punto de referencia, lugar de aparición
- **Selección múltiple:** hacer clic manteniendo presionada la tecla Mayús, selección por cuadro, Ctrl+A; arrastrar para mover con deshacer atómico
- **Alineación:** alineación en 6 direcciones (izquierda/derecha/arriba/abajo/centro horizontal/centro vertical) y distribución horizontal/vertical
- **Ajuste:** ajuste al arrastrar a los bordes/centros de los objetos cercanos con líneas guía visuales
- **Redimensionar:** 8 controladores por zona con ajuste a los bordes, limitación del tamaño mínimo, vista previa en tiempo real
- **Duplicar:** Ctrl+D con ID, conexiones y asignaciones de distritos reasignados
- **Copiar/Pegar:** Ctrl+C / Ctrl+V con reasignación de ID y desplazamiento configurable
- **Ciclo de clics:** clics repetidos en la misma posición para recorrer los objetos superpuestos
- **Menú contextual:** haga clic derecho para acceder a 7 acciones sensibles al contexto (propiedades, eliminar, duplicar, etc.)
- **Vista previa de conexión:** línea cian discontinua durante la colocación de la herramienta de conexión
- **Minimapa:** vista general de 200×150 (esquina inferior derecha), haga clic para saltar
- **Recorte de la ventana gráfica:** solo se representan los objetos dentro de los límites visibles (margen de 64 píxeles)
- **Estadísticas de rendimiento:** alternar superposición de FPS/recuento de objetos/tiempo de representación
- **Visibilidad por objeto:** ocultar/mostrar objetos individuales (guardado en localStorage)
- **Capas:** 7 controles de visibilidad (cuadrícula, conexiones, entidades, puntos de referencia, lugares de aparición, fondos, ambiente)

#### Navegación y atajos

- **Ventana gráfica:** cámara de panorámica/zoom, zoom con la rueda del ratón (anclado al cursor), arrastrar con la barra espaciadora/botón central del ratón/clic derecho para desplazar, ajuste automático al contenido, doble clic para centrar
- **Búsqueda:** Ctrl+K abre una superposición para encontrar cualquier objeto por nombre/ID con coincidencia aproximada, navegación con el teclado y historial de búsqueda reciente (localStorage)
- **Panel de velocidad:** haga doble clic en la esquina superior derecha para obtener una paleta de comandos flotante con acciones sensibles al contexto, favoritos fijables, macros y acciones rápidas sugeridas según el modo.
- **Teclas rápidas:** 21 atajos de teclado que incluyen cambio de herramienta (V/Z/C/E/L/S), Enter (abrir detalles), P (aplicar preajuste), Mayús+P (guardar preajuste), Ctrl+C/V (copiar/pegar), ajuste con las flechas (Mayús = 5×)
- **Accesibilidad:** trampas de enfoque modal con Escape para cerrar, etiquetas ARIA en todos los botones que solo tienen iconos, árbol de objetos navegable con el teclado, indicador de cambios anunciado por un lector de pantalla. Las operaciones del lienzo espacial (colocación, selección por cuadro, redimensionamiento, dibujo de conexiones, panorámica) siguen siendo basadas en punteros

#### Importar y exportar

- **ContentPack:** exportación orientada al destino a AI RPG Engine, Unreal Engine 5 o Godot 4 con insignias de preparación por destino, opciones configurables (tamaño del mosaico, prefijos de escena, filtrado de paquetes) y recibos posteriores a la descarga
- **Paquetes de proyecto:** archivos `.wfproject.json` portátiles con metadatos de procedencia e información de dependencia
- **Paquetes de kit:** exportación/importación `.wfkit.json` con validación, manejo de colisiones y seguimiento de la procedencia
- **Importar:** detecta automáticamente 4 formatos con informes estructurados de fidelidad
- **Diferencias:** seguimiento semántico de los cambios desde la importación
- **Vista previa de escena:** composición HTML/CSS en línea de todos los enlaces visuales de la zona

## Modos de creación

World Forge separa el **género** (fantasía, cyberpunk, pirata) del **modo** (mazmorra, océano, espacio). El género es un adorno; el modo define la escala. El modo rige los valores predeterminados de la cuadrícula, el vocabulario de conexión, las sugerencias de validación, la redacción de la guía y el filtrado de preajustes.

| Modo | Cuadrícula | Mosaico | Conexiones clave |
|------|------|------|-----------------|
| Mazmorra | 30×25 | 32 | puerta, escaleras, pasaje, secreto, peligro |
| Distrito / Ciudad | 50×40 | 32 | carretera, puerta, pasaje, portal |
| Región / Mundo | 80×60 | 48 | carretera, portal, pasaje |
| Océano / Mar | 60×50 | 48 | canal, ruta, portal, peligro |
| Espacio | 100×80 | 64 | acoplamiento, salto warp, pasaje, portal |
| Interior | 20×15 | 24 | puerta, escaleras, pasaje, secreto |
| Tierra salvaje | 60×50 | 48 | sendero, carretera, pasaje, peligro |

El modo se establece al crear un proyecto y se guarda como `mode?: AuthoringMode` en `WorldProject`. Cada modo proporciona **valores predeterminados inteligentes**: los tipos de conexión, los roles de entidad, los nombres de zona y las sugerencias del panel de velocidad se adaptan automáticamente.

## Superficie de creación

### Estructura mundial

- Zonas con distribución espacial, vecinos, salidas, iluminación, ruido, peligros y elementos interactivos.
- 12 tipos de conexión (pasaje, puerta, escalera, camino, portal, secreto, peligro, canal, ruta, muelle, teletransporte, sendero) con estilos visuales distintos, enrutamiento anclado a los bordes, flechas direccionales y estilo discontinuo condicional.
- Distritos con control de facciones, perfiles económicos, controles deslizantes de métricas, etiquetas y etiquetas de nombre de distrito en los centroides de las zonas.
- Puntos de referencia (puntos de interés nombrados dentro de las zonas).
- Puntos de aparición, anclajes de encuentros (coloreado basado en el tipo), presencia de facciones y puntos críticos de presión.
- **Estratos verticales:** capas discretas (superficie/subterráneo/cielo o pisos de un edificio) con orden definido, rango Z, visibilidad entre capas y conectores (escaleras/escaleras de mano/ascensores); las zonas se asignan a un estrato.
- **Peligros ambientales tipificados:** una biblioteca compartida de peligros (efectos de daño/estado/muerte instantánea/ignición, tiempo de activación, costo de movimiento del terreno, transitabilidad, bloqueo de la visión, condiciones climáticas) referenciados por zona.
- **Puertas de entrada a zonas para grupos:** entrada a través de una puerta basada en el estado del grupo (nivel/tamaño/objetos/indicadores/miembros/clases) como una barrera estricta o un aviso con una razón autorizada para "mostrar la cerradura".

### Contenido

- Ubicación de entidades con estadísticas, recursos, perfiles de IA y metadatos personalizados.
- Ubicación de objetos con ranura, rareza, modificadores de estadísticas y habilidades otorgadas.
- Árboles de diálogo con conversaciones ramificadas, condiciones y efectos.
- Anclajes de encuentros en el lienzo: marcadores de diamante rojo con tipos de jefe/emboscada/patrulla.

### Ciudad e interiores

- Pintura de mosaicos: conjuntos de mosaicos basados en imágenes (división por fila/columna) con una opción de rectángulo coloreado como alternativa, un pincel para arrastrar, capas y "transitabilidad sólida" por mosaico para la colisión con las paredes.
- Ubicación de objetos decorativos para interiores (paleta + renderizado del lienzo), con una herramienta de ubicación.
- Economía de la ciudad: nodos de mercado (categorías de suministro, modificador de precio, contrabando) y estaciones de artesanía (tipo de estación, recetas), editados por zona.
- Estructuras de la ciudad: edificios (huellas transitables con un enlace a una zona interior), centros (nodos de servicio + conectividad) y fortalezas (sedes fortificadas de facciones).

### Sistemas de personajes

- Plantilla de jugador (estadísticas iniciales, inventario, equipo, punto de aparición).
- Catálogo de construcción (arquetipos, antecedentes, rasgos, disciplinas, títulos cruzados, relaciones).
- Árboles de progresión (nodos de habilidad/capacidad con requisitos y efectos).

### Activos

- Manifiesto de activos (retratos, sprites, fondos, iconos, conjuntos de mosaicos) con enlaces específicos del tipo.
- Paquetes de activos (agrupaciones nombradas y versionadas con metadatos de compatibilidad, tema, licencia).
- Vista previa de la escena (composición en línea de todos los enlaces visuales de la zona con detección de activos faltantes).

### Flujo de trabajo

- Presets de región (9 integrados, filtrados por modo) y presets de encuentro (10 integrados) con aplicación de fusión/reemplazo y CRUD de presets personalizados.
- Kits iniciales (7 integrados, específicos del modo) con exportación/importación de kits (`.wfkit.json`), manejo de colisiones y seguimiento de la procedencia.
- Plantillas de diseño (6 disposiciones de zona preconstruidas) y plantillas de diálogo (5 iniciadores de conversación).
- Fusión de zonas y ubicación masiva de entidades (patrones de cuadrícula/aleatorio/círculo).
- Guardado automático con un retraso de 30 segundos y un historial de recuperación de 3 versiones.
- Búsqueda con Ctrl+K en todos los tipos de objetos con coincidencia aproximada e historial reciente.
- Paleta de comandos del panel de velocidad con favoritos anclables, macros, grupos personalizados y sugerencias de modo.
- 21 atajos de teclado centralizados (incluidas 6 teclas para cambiar de herramienta).
- Editor de metadatos del proyecto (autor, licencia, categoría, etiquetas).
- Estadísticas de revisión (distribución de roles, tipos de conexión, tipos de encuentro, zonas por distrito).
- Exportación a ContentPack JSON, paquetes de proyectos y resúmenes de revisión.
- Importación desde 4 formatos con informes estructurados de fidelidad, sugerencias de reparación y seguimiento de diferencias semánticas.

Consulte [`dogfood/WALKTHROUGH.md`](dogfood/WALKTHROUGH.md) para ver el protocolo de exportación de Chapel Threshold que demuestra la configuración actual.

## Directorio Dogfood

El directorio `dogfood/` contiene un conjunto de pruebas de integración que ejercen todo el proceso, desde la creación hasta la exportación, fuera de las pruebas unitarias. El ejemplo de Chapel Threshold (`chapel-threshold.ts`) crea un proyecto mundial pequeño pero completo, lo ejecuta a través de la exportación y escribe la salida en `dogfood/output/`. Esto demuestra que los tipos de esquema, la validación y el proceso de exportación funcionan de extremo a extremo con datos reales, no solo con simulacros aislados.

## Compatibilidad del motor

Las exportaciones se dirigen a tres motores:

- **[ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine)**: formato ContentPack, que puede ser cargado por [claude-rpg](https://github.com/mcp-tool-shop-org/claude-rpg).
- **Unreal Engine 5**: paquete de contenido compatible con 2.5D, con activos de datos primarios, manifiestos de aparición de actores y sugerencias de partición mundial.
- **Godot 4**: generación de escenas `.tscn` con recursos de zona, enlaces de navegación y manifiestos de entidades.

## Seguridad

- **Datos afectados:** archivos del proyecto en el disco local (JSON creado por el usuario), sin almacenamiento en el servidor.
- **Datos NO afectados:** sin telemetría, sin análisis, sin solicitudes de red más allá del servidor de desarrollo local.
- **Permisos:** sin claves API, sin secretos, sin credenciales.
- **No hay secretos, tokens ni credenciales en el código fuente.**

## Licencia

MIT

---

Creado por [MCP Tool Shop](https://mcp-tool-shop.github.io/)
