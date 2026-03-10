<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.md">English</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./logo.png" alt="World Forge" width="400">
</p>

# @world-forge/editor

Aplicación web React 19 para [World Forge](https://github.com/mcp-tool-shop-org/world-forge), un estudio de creación de mundos 2D para el motor de juegos de rol con inteligencia artificial.

## Características

- **Lienzo** — dibuje zonas, cree conexiones, coloque entidades, puntos de referencia y encuentros en una cuadrícula 2D con una vista panorámica con zoom.
- **Selección múltiple** — haga clic, haga clic con la tecla Shift o seleccione con un cuadro para seleccionar zonas, entidades, puntos de referencia, puntos de aparición y encuentros; mueva los objetos seleccionados con una función de deshacer integrada.
- **Creación de encuentros** — coloque puntos de anclaje de encuentros en las zonas con marcadores de lienzo basados en el tipo (jefe, emboscada, patrulla), propiedades editables (ID de enemigos, probabilidad, tiempo de reutilización, etiquetas).
- **Edición de distritos** — panel de distrito ampliado con controles deslizantes de métricas, etiquetas, facción controladora, perfil económico, gestión de la presencia de la facción y edición de puntos calientes de presión.
- **Edición por lotes** — asignación de distritos por lotes, adición de etiquetas por lotes y eliminación por lotes cuando se seleccionan varias zonas.
- **Sistema de preajustes** — preajustes de regiones y encuentros con aplicación de combinación/sobrescritura, 4 preajustes de región integrados, 3 preajustes de encuentro integrados, gestión CRUD de preajustes personalizados con persistencia en localStorage.
- **Atajos de teclado** — registro centralizado de atajos con 13 combinaciones: Escape, Ctrl+A, Ctrl+D, Ctrl+K, Suprimir, ajuste con las flechas, Enter (abre los detalles), P (aplica el preajuste), Shift+P (guarda el preajuste).
- **Doble clic** — haga doble clic en cualquier objeto del lienzo para seleccionarlo, cambie a la pestaña "Mapa" y centre la vista.
- **Panel de velocidad** — haga doble clic con el botón derecho en el lienzo para abrir una paleta de comandos flotante con acciones contextuales, favoritos que se pueden fijar (reordenar en modo de edición), acciones recientes, grupos personalizados, macros ligeros con editor de pasos, filtrado de búsqueda y navegación con el teclado.
- **Pestañas del espacio de trabajo** — Mapa, Jugador, Construcciones, Árboles, Diálogo, Objetos, Preajustes, Activos, Problemas, Guía.
- **Biblioteca de activos** — gestione retratos, sprites, fondos, iconos y conjuntos de mosaicos con enlaces específicos para cada tipo.
- **Deshacer/Rehacer** — pila de historial de 10 niveles a través de Zustand.
- **Importar/Exportar** — informes de fidelidad de ida y vuelta, seguimiento semántico de diferencias.
- **Validación** — 54 comprobaciones estructurales con navegación de problemas mediante un clic.
- **Plantillas** — inicios de género y mundos de ejemplo para una incorporación rápida.

## Cómo empezar

```bash
npm install
npm run dev --workspace=packages/editor
```

Abra `http://localhost:5173` para iniciar el editor.

## Licencia

MIT
