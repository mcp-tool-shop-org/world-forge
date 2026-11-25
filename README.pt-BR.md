<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.md">English</a>
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
<p align="center"><strong>v4.11.0</strong> — 3719 tests, 6 shipping packages, 7 authoring modes, tiles + interiors + town authoring + world modeling (vertical strata, typed hazards, party-gated zones), three export targets (AI RPG Engine, Unreal Engine 5, Godot 4), a measured Forge→Engine content contract, and an authored drawing contract for 2.5D clients</p>
<!-- version:end -->

## Arquitetura

```
packages/
  schema/          @world-forge/schema         — spatial types, validation, 2.5D fields
  export-ai-rpg/   @world-forge/export-ai-rpg  — AI RPG Engine export pipeline + CLI
  export-unreal/   @world-forge/export-unreal  — Unreal Engine 5 export pipeline + CLI (2.5D aware)
  export-godot/    @world-forge/export-godot   — Godot 4 export pipeline + .tscn scene generation
  renderer-2d/     @world-forge/renderer-2d    — PixiJS 2D canvas renderer
  editor/          @world-forge/editor         — React web authoring app
```

## Guia de Início Rápido

```bash
npm install
npm run build
npm run dev --workspace=packages/editor
```

Abra `http://localhost:5173` para iniciar o editor.

### Fluxo de Trabalho do Editor

1. **Escolha um modo** — masmorra, distrito, mundo, oceano, espaço, interior ou região selvagem — para definir as configurações padrão da grade e o vocabulário de conexão.
2. **Comece com um kit** — escolha um kit inicial ou um modelo de gênero no Gerenciador de Modelos, ou comece com um projeto em branco.
3. **Pinte as zonas** — arraste o cursor na tela para criar zonas, conecte-as e atribua distritos.
4. **Coloque entidades** — adicione NPCs, inimigos, comerciantes, encontros e itens nas zonas.
5. **Revise** — abra a guia de revisão para verificar o status de saúde, a visão geral do conteúdo e exportar um resumo (Markdown/JSON).
6. **Exporte** — abra o modal de exportação para verificar o status de cada destino (a caixa mostra o pior estado entre todos os três destinos: vermelho quando bloqueado, amarelo com avisos listados — incluindo traduções e descartes de tipos de encontro, bem como posicionamentos de entidades ausentes, sem conexões em projetos de várias zonas, modelo de jogador ausente ou configurações de elevação ou paralaxe ausentes em UE5 — e verde quando estiver pronto, sem nada para relatar), configure as opções de destino e, em seguida, baixe o AI RPG Engine, UE5 ou os pacotes do Godot 4. Os recibos pós-exportação são agrupados por tamanho, contagem e detalhes de fidelidade. Também: pacotes de projeto (.wfproject.json) e resumos de revisão.

### Exportação via CLI

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

## Pacotes

### @world-forge/schema

Tipos e validação principais de TypeScript para a criação de mundos.

- **Tipos espaciais** — `WorldMap`, `Zone`, `ZoneConnection`, `District`, `Landmark`, `SpawnPoint`, `EncounterAnchor`, `FactionPresence`, `PressureHotspot`
- **Tipos de conteúdo** — `EntityPlacement`, `ItemPlacement`, `DialogueDefinition`, `PlayerTemplate`, `BuildCatalogDefinition`, `ProgressionTreeDefinition`
- **Camadas visuais** — `AssetEntry`, `AssetPack`, `Tileset`, `TileLayer`, `PropDefinition`, `PropPlacement`, `AmbientLayer`
- **Cidade + estruturas** — `MarketNode`, `CraftingStation`, `Building`, `Hub`, `Stronghold`
- **Modelagem do mundo** — `Stratum` + `StratumLink` (camadas verticais), `HazardDefinition` (união de efeitos tipados), `ZoneEntryGate` + operandos de estado de grupo `SpawnCondition` (`party-level`, `party-size`, `item`, `flag`, `member`, `class`)
- **Sistema de modo** — `AuthoringMode` (7 modos), perfis de grade/conexão/validação específicos do modo
- **Apresentação** — opcional `WorldPresentation` em `WorldProject`: visualização dimétrica, área de cobertura do tile, células de âncora de zona, placas de piso e uma linha de ocupação por ator. `presentationAdvisories()` executa oito regras de aviso sobre ele, incluindo a que importa — uma pessoa desenhada em uma sala, a simulação a coloca fora dela.
- **Validação** — `validateProject()` (89 verificações estruturais com pesquisas O(n) baseadas em mapa, `warningCount`), `advisoryValidation()` (sugestões específicas do modo, integridade dos metadados, nomenclatura dos recursos). v4.0 JSON que omite matrizes que serão necessárias posteriormente é aceito após `normalizeProjectShape()` / `stampProjectSchemaVersion()`.
- **Uniões fechadas** — `VALID_CONNECTION_KINDS`, `VALID_ASSET_KINDS`, `VALID_ENTITY_ROLES`, `VALID_ITEM_SLOTS` e o restante dos conjuntos `VALID_*` são exportados de `@world-forge/schema`.
- **Utilitários** — `assembleSceneData()` (vinculações visuais com detecção de recursos ausentes), `scanDependencies()` (análise de gráfico de referência), `buildReviewSnapshot()` (classificação de saúde)

### @world-forge/export-unreal

Converte um `WorldProject` em um pacote de conteúdo do Unreal Engine 5, otimizado para jogos 2.5D.

- **Saída** — `pack.json`, JSON de Ativos de Dados Primários por zona e por distrito, manifesto agrupado de geração de atores, dicas de streaming de nível por conexão, dicas de célula de Partição Mundial e um relatório de fidelidade estruturado.
- **Campos 2.5D** — `Zone.elevation`, `elevationRange`, `parallaxLayers`, `skylineRef` são preservados e convertidos em coordenadas UE cm / Z-up.
- **Transformação de coordenadas** — funções puras (`pixelsToUnrealCm`, `elevationToZ`, `worldForgeToUnrealAxis`, `gridToUnrealAxis`). A escala mundial padrão é 1 tile = 100 cm.
- **Importação de ciclo completo** — `importFromUnreal` reconstrói um WorldProject a partir de um pacote Unreal; dados apenas de jogabilidade (diálogos, progressão, construções) são marcados como descartados no relatório de fidelidade.
- **CLI** — `world-forge-export-unreal` com `--out`, `--tile-size-cm`, `--validate-only`, `--verbose`.

### @world-forge/export-godot

Converte um `WorldProject` em um pacote de conteúdo do Godot 4 com texto de cena `.tscn`.

- **Saída** — uma raiz de projeto Godot 4: `project.godot`, `world.tscn` (ExtResource `.tres`), texturas copiadas em `assets/`, `scripts/player.gd`, mais `pack.json` e `fidelity.json`
- **CLI** — `world-forge-export-godot` com `--out`, `--validate-only`, `--include-world-tscn` / `--no-world-tscn`
- **Cena jogável** — `buildWorldScene()` emite uma `.tscn` navegável: colisão `StaticBody2D` por zona + `NavigationRegion2D`, uma `Camera2D` emoldurada, um `CharacterBody2D` de jogador e classificação y / profundidade `z_index`
- **Tiles + interiores** — `TileMapLayer` + `TileSet` (`tile_map_data` assado para conjuntos de tiles de imagem), colisão de parede por célula `StaticBody2D` e posicionamentos de adereços `Node2D`
- **Cidade** — mercados + estações de criação e edifícios (áreas de cobertura `StaticBody2D`) / centros / fortalezas como espaços reservados `Node2D`, todos carregando seus dados como metadados
- **Modelagem do mundo** — estratos verticais (bandeamento `z_index` por zona + conectores `StratumLink`), perigos tipados como regiões `Area2D` e metadados de entrada de zona
- **Relatório de fidelidade** — rastreamento estruturado de dados sem perdas, aproximados e descartados, verificado em relação ao motor Godot 4 real (fumaça sem cabeça, 36 asserções)
- **Avisos de apresentação** — um bloco `presentation` criado é transmitido inalterado e seus avisos são exibidos em `warnings[]`, portanto, uma divergência entre o desenho e a simulação é uma descoberta de exportação, e não uma surpresa na tela.
- **Versão do formato** — `GODOT_PACK_FORMAT_VERSION` 1.1.0 (`files`, `zoneGates`, `migrateGodotPack`)

### @world-forge/export-ai-rpg

Converte um `WorldProject` para o formato `ContentPack` do ai-rpg-engine.

- **Exportação** — zonas, distritos, entidades, itens, diálogos, modelo de jogador, catálogo de construção, árvores de progressão, encontros (traduzindo os tipos de encontro do World Forge para os quatro do motor), facções, pontos de interesse, manifesto e metadados do pacote.
- **Importação** — 8 conversores reversos reconstroem um WorldProject a partir do JSON exportado; CLI `--import` / `--from-pack` grava `world-project.json` (ou stdout).
- **Relatório de fidelidade** — rastreamento estruturado do que foi preservado, aproximado ou descartado durante a conversão; `--out` grava `fidelity.json` ao lado do pacote.
- **Detecção de formato** — detecta automaticamente os formatos WorldProject, ExportResult, ContentPack e ProjectBundle.
- **CLI** — `world-forge-export` com `--out`, `--import`, `--from-pack`, `--validate-only`, `--dry-run` e `--verbose`.

### @world-forge/renderer-2d

Renderizador 2D baseado em PixiJS: viewport com panorâmica/zoom, sobreposições de zona com cores de distrito, setas de conexão, ícones de entidade por função, camadas de tile e um minimapa.

Um renderizador independente publicado para consumidores externos, que incorpora dados do World Forge em seus próprios aplicativos PixiJS. **O editor não o utiliza** — a tela do editor é uma implementação Canvas2D direta, portanto, os recursos de minimapa e viewport listados abaixo, na seção do editor, são próprios, e não deste pacote.

### @world-forge/editor

Aplicativo web React 19 + Vite com gerenciamento de estado Zustand, desfazer/refazer com rótulos de ação, salvamento automático (intervalo de 30 segundos, histórico de 3 versões, recuperação em caso de falha), proteções de estado "sujo" em todos os caminhos de carregamento do projeto, alternância de tema claro/escuro, armadilhas de foco modal e alternância de ferramentas controlada pelo teclado.

#### Guias da Área de Trabalho

| Guia | Finalidade |
|-----|---------|
| Mapa | Edição de zonas/entidades/distritos na tela 2D |
| Jogador | Modelo de jogador com estatísticas, inventário, equipamento, ponto de surgimento |
| Construções | Arquétipos, históricos, características, disciplinas, combinações |
| Árvores | Nós de progressão com requisitos e efeitos |
| Diálogo | Edição de nós, vinculação de escolhas, detecção de referências quebradas |
| Objetos | Árvore hierárquica: distritos → zonas → entidades/pontos de referência/pontos de surgimento |
| Predefinições | Navegador de predefinições de região e encontros com mesclagem/substituição |
| Ativos | Biblioteca de ativos com pesquisa filtrada por tipo, detecção de ativos órfãos, pacotes de ativos |
| Problemas | Validação agrupada em tempo real com navegação de clique para foco |
| Dependências | Scanner de dependências com botões de correção embutidos |
| Revisão | Painel de saúde, visão geral do conteúdo, exportação de resumo |
| Guia | Lista de verificação para o primeiro uso com referência de atalhos (exibida até ser descartada) |
| Importar | Relatório de fidelidade para a última importação (exibido após uma importação) |
| Diferença | Diferença semântica em relação ao instantâneo importado (exibida após uma importação) |

#### Tela e Edição

- **Ferramentas** — 10 ferramentas: seleção, pintura de zona, conexão, posicionamento de entidade, ponto de referência, ponto de surgimento, pintura de tile, posicionamento de objeto, posicionamento de encontro, posicionamento de item
- **Seleção múltipla** — clique com Shift, seleção por caixa, Ctrl+A; movimento por arrasto com desfazer atômico
- **Alinhamento** — alinhamento em 6 direções (esquerda/direita/superior/inferior/centro horizontal/centro vertical) e distribuição horizontal/vertical
- **Ajuste** — ajuste durante o arrasto às bordas/centros de objetos próximos com linhas de guia visuais
- **Redimensionamento** — 8 pontos de ajuste por zona com ajuste de borda, limitação de tamanho mínimo, visualização em tempo real
- **Duplicação** — Ctrl+D com IDs, conexões e atribuições de distrito remapeados
- **Copiar/Colar** — Ctrl+C / Ctrl+V com remapeamento de ID e deslocamento configurável
- **Ciclo de clique** — cliques repetidos na mesma posição alternam entre objetos sobrepostos
- **Menu de contexto** — clique com o botão direito para 7 ações sensíveis ao contexto (Editar Propriedades muda para a guia Mapa e expande a barra lateral direita para o objeto selecionado, incluindo entidades, mais excluir, duplicar, etc.)
- **Visualização de conexão** — linha tracejada ciano durante o posicionamento da ferramenta de conexão
- **Minimapa** — visão geral de 200×150 (canto inferior direito), clique para ir para o local
- **Culling da viewport** — renderiza apenas objetos dentro dos limites visíveis (margem de 64 pixels)
- **Estatísticas de desempenho** — alternar sobreposição de FPS/contagem de objetos/tempo de renderização
- **Visibilidade por objeto** — ocultar/exibir objetos individuais (armazenado em localStorage)
- **Camadas** — alternância de visibilidade (grade, conexões, entidades, pontos de referência, pontos de surgimento, planos de fundo, tiles, objetos, ambiente, elevação; os itens fazem teste de colisão com a camada de itens), mais alternância para o minimapa, ajuste para objetos, estatísticas de desempenho e diagnósticos do renderizador

#### Navegação e Atalhos

- **Viewport** — Navegação/zoom da câmera, zoom com a roda do mouse (ancorado ao cursor), arrastar com a barra de espaço/botão do meio do mouse/clique com o botão direito, ajuste ao conteúdo quando o canvas abre um projeto com zonas (e sob demanda a partir do painel "Ajustar ao conteúdo"), clique duplo para centralizar.
- **Search** — Ctrl+K abre uma sobreposição para encontrar qualquer objeto por nome/ID com correspondência aproximada, navegação por teclado e histórico de pesquisa recente (localStorage).
- **Speed Panel** — pressione `Q` (configurável em Opções) com o ponteiro sobre o canvas (ou com o canvas em foco, ancorado na seleção ou no centro) ou clique duplo com o botão direito para expandir o menu compacto de clique único instantâneo no local para a paleta de comandos flutuante, apresentando chips de escopo de alvo sobreposto quando dois ou mais objetos visíveis estão sob o ponteiro (`Tab`/`Shift+Tab` em pesquisa vazia, `ArrowLeft`/`ArrowRight` ou clique, com `Canvas` por último, um contorno de destaque do canvas não modificador que é apagado ao fechar/`Esc` e avisos amigáveis da região ativa), um layout fixo de quatro bandas ao abrir (uma linha opcional de **Correção Rápida** por objeto exibida visualmente acima da Banda 1 quando existem problemas no alvo — o destaque ainda começa no slot 1 da Banda 1, então `Enter` ao abrir executa o slot 1, a ordem `ArrowDown` permanece inalterada e `Alt+1`–`Alt+5` nunca se movem; acesse a Correção Rápida via `ArrowUp` a partir do slot 1 ou clicando — acima de um painel de contexto fixo por tipo de toque, pinos e macros copiáveis e reordenáveis, frequência recente alternável, e grupos de catálogo fixos), pesquisa em camadas com sinônimos de RPG, iniciais, tolerância a erros de digitação, destaque de caracteres, ações explicadas `"Unavailable here"`, indicadores de atalho ou localização do editor em tempo real, seletores de várias etapas embutidos (`Quick Fix` reparações e navegação **Mostrar em Problemas/Dependências/Revisão** armazenadas em cache por estado do projeto, `Assign District` com filtro de texto embutido `+ Create District`, `Apply Preset` com `Merge`/`Overwrite` e `Place Encounter Here` com indicadores de compatibilidade de exportação de RPG de IA em tempo real; `Backspace` em filtro ou etapas de entrada vazias, volta), edição de valores escalares embutidos ativada por `Tab` para `Set Elevation`, seleção espacial delegada ao canvas (`Connect From Here`, conexões tipadas com `Tab` alternando o tipo e `Shift+Click` encadeamento de alvo, `Merge Zones` de zona única com `Shift+Click` seleção múltipla e pesquisa de nome de zona fora da tela e `Esc` cancela preservando a seleção anterior inalterada), desfazer atômico de entrada única com rótulos descritivos, **Criar Macro a partir de Ações Recentes…** de até 8 etapas reproduzíveis na sessão com execução de macro de desfazer único atômico e prompts de substituição de referência ausente embutidos, e **Repetir Última Ação Aqui**.
- **Hotkeys** — 29 atalhos de teclado, incluindo alternância de ferramentas (V/Z/C/E/L/S/T/O/N/I), Enter (abre as propriedades na guia Mapa e expande a barra lateral direita), P (aplica predefinição), Shift+P (salva predefinição), Ctrl+C/V (copiar/colar), ajuste com as setas (Shift = 5×).
- **Acessibilidade** — armadilhas de foco modal com Escape para fechar, rótulos ARIA em todos os botões com apenas ícones, árvore de objetos navegável por teclado, indicador de alterações anunciado pelo leitor de tela. As operações de canvas espacial (colocação, seleção de caixa, redimensionamento, desenho de conexão, panorâmica) permanecem baseadas no ponteiro.

#### Importar e Exportar

- **ContentPack** — exportação com reconhecimento de alvo para o AI RPG Engine, Unreal Engine 5 ou Godot 4, com indicadores de prontidão por alvo, opções configuráveis (tamanho do tile, prefixos de cena, filtragem de pacotes) e recibos pós-download.
- **Pacotes de projeto** — arquivos `.wfproject.json` portáteis com metadados de proveniência e informações de dependência.
- **Pacotes de kit** — `.wfkit.json` exportação/importação com validação, tratamento de colisão e rastreamento de proveniência.
- **Importar** — detecta automaticamente 4 formatos com relatórios de fidelidade estruturados.
- **Diff** — rastreamento de alterações semânticas desde a importação.
- **Visualização de cena** — composição HTML/CSS embutida de todos os elementos visuais da zona.

## Modos de Criação

World Forge separa o **gênero** (fantasia, cyberpunk, pirata) do **modo** (masmorra, oceano, espaço). O gênero é o sabor — o modo é a escala. O modo governa as configurações padrão da grade, o vocabulário de conexão, as sugestões de validação, a redação do guia e a filtragem de predefinições.

| Modo | Grade | Tile | Conexões-chave |
|------|------|------|-----------------|
| Masmorra | 30×25 | 32 | porta, escada, passagem, segredo, perigo |
| Distrito / Cidade | 50×40 | 32 | estrada, porta, passagem, portal |
| Região / Mundo | 80×60 | 48 | estrada, portal, passagem |
| Oceano / Mar | 60×50 | 48 | canal, rota, portal, perigo |
| Espaço | 100×80 | 64 | acoplamento, dobra, passagem, portal |
| Interior | 20×15 | 24 | porta, escada, passagem, segredo |
| Natureza Selvagem | 60×50 | 48 | trilha, estrada, passagem, perigo |

O modo é definido ao criar um projeto e armazenado como `mode?: AuthoringMode` em `WorldProject`. Cada modo fornece **configurações inteligentes** — os tipos de conexão, os papéis da entidade, os nomes das zonas e as sugestões do Painel de Velocidade se adaptam automaticamente.

## Superfície de Criação

### Estrutura do Mundo

- Zonas com disposição espacial, vizinhos, saídas, iluminação, ruído, perigos e elementos interativos
- 12 tipos de conexão (passagem, porta, escada, estrada, portal, segredo, perigo, canal, rota, atracação, teletransporte, trilha) com estilos visuais distintos, roteamento ancorado nas bordas, setas direcionais e estilo tracejado condicional
- Distritos com controle de facção, perfis econômicos, controles deslizantes de métricas, etiquetas e rótulos de nome de distrito nos pontos centrais das zonas
- Pontos de referência (pontos de interesse nomeados dentro das zonas)
- Pontos de geração, âncoras de encontro (coloração baseada no tipo), presenças de facção e pontos críticos de pressão
- **Estratos verticais** — camadas discretas (superfície/subterrâneo/céu ou andares de um edifício) com ordem definida, intervalo Z, visibilidade entre camadas e conectores (escadas/escadas de mão/elevadores); as zonas são atribuídas a um estrato
- **Perigos ambientais tipados** — uma biblioteca compartilhada de perigos (danos/status/morte instantânea/efeitos de ignição, tempo de ativação, custo de movimento no terreno, possibilidade de passagem, bloqueio da visão, condições climáticas) referenciados por zona
- **Portões de entrada de zona para grupos** — entrada do portão com base no estado do grupo (nível/tamanho/itens/sinalizadores/membros/classes) como um portão rígido ou um portão de aviso com uma razão "mostrar a fechadura" definida pelo autor
- **Ocupação de apresentação** — para clientes 2.5D: uma visualização dimétrica com uma área e extensão de mosaico, uma célula âncora e uma placa de piso opcional por zona e uma linha de ocupação (pacote de personagens, zona, célula, direção) por ator, incluindo o jogador

### Conteúdo

- Posicionamento de entidades com estatísticas, recursos, perfis de IA e metadados personalizados
- Posicionamento de itens com slot, raridade, modificadores de estatísticas e habilidades concedidas
- Árvores de diálogo com conversas ramificadas, condições e efeitos
- Âncoras de encontro na tela — marcadores de diamante vermelho com tipos de chefe/emboscada/patrulha

### Cidade e Interiores

- Pintura de mosaicos — conjuntos de mosaicos baseados em imagens (fatiados por linha/coluna) com uma alternativa de retângulo colorido, um pincel de arrastar, camadas e "Sólido" de capacidade de caminhada por mosaico para colisão de parede
- Posicionamento de objetos de cena para interiores (paleta + renderização na tela), com uma ferramenta de posicionamento
- Economia da cidade — nós de mercado (categorias de fornecimento, modificador de preço, contrabando) e estações de criação (tipo de estação, receitas), editados por zona
- Estruturas da cidade — edifícios (áreas acessíveis com um link para a zona interior), centros (nós de serviço + conectividade) e fortalezas (postos fortificados de facção)

### Sistemas de Personagens

- Modelo de jogador (estatísticas iniciais, inventário, equipamento, ponto de geração)
- Catálogo de construção (arquétipos, históricos, traços, disciplinas, títulos cruzados, relacionamentos)
- Árvores de progressão (nós de habilidade/capacidade com requisitos e efeitos)

### Ativos

- Manifesto de ativos (retratos, sprites, fundos, ícones, conjuntos de mosaicos) com vinculações específicas do tipo
- Pacotes de ativos (nomeados, agrupamentos com versão com metadados de compatibilidade, tema, licença)
- Visualização de cena (composição embutida de todas as vinculações visuais da zona com detecção de ativos ausentes)

### Fluxo de Trabalho

- Predefinições de região (9 integradas, filtradas por modo) e predefinições de encontro (10 integradas) com aplicação de mesclagem/substituição e predefinições personalizadas de criação, leitura, atualização e exclusão
- Kits iniciais (7 integrados, específicos do modo) com exportação/importação de kit (`.wfkit.json`), pinos opcionais do Painel de Velocidade e predefinições de macro (`speedPanelPresets`) mesclados sem substituir as predefinições existentes do usuário, tratamento de colisão e rastreamento de origem
- Mesclagem de zonas a partir do Painel de Velocidade (incluindo seleção interativa de zona na tela quando menos de 2 zonas são selecionadas)
- Modelos de layout, modelos de diálogo e posicionamento em lote de entidades (grade/aleatório/círculo) existem no código, mas ainda não são acessíveis a partir da interface do usuário do editor
- Salvamento automático com intervalo de 30 segundos e histórico de recuperação de 3 versões
- Pesquisa Ctrl+K em todos os tipos de objetos com correspondência aproximada e histórico recente
- Paleta de comandos do Painel de Velocidade com chips de escopo de destino sobreposto (`Tab`/`Shift+Tab` em pesquisa vazia, destaque não mutante da tela e anúncios educados da região ativa), decks de contexto fixos (e linha de **Correção Rápida** contextual quando existem problemas no objeto atingido), favoritos reordenáveis copiados, frequência recente de decaimento exponencial alternável, grupos de catálogo fixos, pesquisa RPG em camadas de sinônimos/erros de digitação, emblemas de vinculação de chave ao vivo, macros parametrizadas e recentes (`Create Macro from Recent Actions…` com anulação única atômica e prompts de substituição de ID ausente), grupos personalizados, sugestões de modo, entradas embutidas de várias etapas e `Tab`, seleção espacial da tela com filtro de zona fora da tela e ciclagem de tipo de conexão `Tab`, avisos de exportação de IA RPG, anulação atômica descritiva e **Repetir Última Ação Aqui** (`wf.speedPanel.v2`)
- 29 atalhos de teclado centralizados (incluindo 10 teclas de troca de ferramenta)
- Editor de metadados do projeto (autor, licença, categoria, etiquetas)
- Estatísticas de revisão (distribuição de funções, tipos de conexão, tipos de encontro, zonas por distrito)
- Exportação para ContentPack JSON, pacotes de projeto e resumos de revisão
- Importação de 4 formatos com relatório de fidelidade estruturada, sugestões de reparo e rastreamento de diferenças semânticas

Consulte [`dogfood/WALKTHROUGH.md`](dogfood/WALKTHROUGH.md) para o handshake de exportação do Chapel Threshold, que comprova o estado atual da superfície.

## Diretório de Testes Internos

O diretório `dogfood/` contém um conjunto de testes de integração que exercita todo o pipeline de criação para exportação fora dos testes unitários. O exemplo do Chapel Threshold (`chapel-threshold.ts`) cria um pequeno, mas completo, projeto de mundo, executa-o através da exportação e grava a saída em `dogfood/output/`. Isso comprova que os tipos de esquema, a validação e o pipeline de exportação funcionam de ponta a ponta com dados reais — e não apenas simulações isoladas.

## Compatibilidade com o Motor de Jogo

As exportações têm como alvo três motores de jogo:

- **[ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine)** — ContentPack formato: o ambiente de execução de simulação determinística que carrega um pacote exportado e executa o mundo
- **Unreal Engine 5** — pacote de conteúdo compatível com 2.5D com Ativos de Dados Primários, manifestos de geração de atores e dicas de Partição de Mundo
- **Godot 4** — `.tscn` geração de cena com recursos de zona, links de navegação e manifestos de entidade

### O contrato de conteúdo Forge→Engine

Um exportador em execução não é a mesma coisa que um mundo que é carregado. v4.6.0 fecha essa lacuna para a linha do AI RPG Engine, e — de forma mais útil — transforma a lacuna restante em um número, em vez de uma suposição.

- **Uma tabela de exportação medida** (`docs/c0-alignment/`) — um percurso de diferença percorre cada campo criado e registra quais deles realmente chegam ao tempo de execução. É gerada, registrada e verificada em cada execução de teste, para que "o que sobrevive à exportação" possa ser auditado, em vez de apenas afirmado.
- **Um manifesto honesto** — o pacote emitido contém um intervalo de versão de motor real, IDs de módulo reais, um hash de conteúdo e condições de saída compiladas. Os IDs de módulo são restritos ao conteúdo real: um pacote sem estações de criação não reivindica mais o módulo de criação.
- **O vocabulário espacial se cruza** — posicionamentos por entidade com condições de geração compiladas, perigos tipados, portões de entrada e descritores de cena chegam ao pacote de conteúdo do motor, e não apenas ao esquema.
- **O relatório de fidelidade mantém o contrato.** Cada linha relata o que foi preservado, aproximado ou descartado. Quando um campo não pode ser transferido, a exportação informa isso — não tem sucesso silenciosamente.
- **Porta de amostra do registro** (`packages/editor/src/__tests__/sample-gate.test.ts`) — carrega dinamicamente cada entrada de `SAMPLE_WORLDS`, `BUILTIN_KITS`, `GENRE_TEMPLATES` e `MODE_STARTERS`, afirmando o carregamento do armazenamento, `validateProject()`, a exportação do RPG de IA com sucesso com zero bloqueadores de encontro (`exportToEngine` + `listAiRpgEncounterBlockers`), validação completa `@ai-rpg-engine/content-schema` (`validateGameContent` e `loadContent`) e exportações do Unreal Engine 5 (`exportToUnreal`) e Godot 4 (`exportToGodot`).
- **Tradução do tipo de encontro na exportação do RPG de IA** — apenas o exportador do RPG de IA traduz os tipos de encontro criados do World Forge para os quatro tipos de `@ai-rpg-engine/content-schema` (`ambush`, `patrol`, `horde`, `duel`), preservando `worldforge-type:<original>` em `tags[]` e registrando uma entrada de fidelidade `approximated` (`encounter-type-translated`), deixando os pontos de ancoragem `hazard` e `discovery` fora do pacote com uma entrada de fidelidade `dropped` (`encounter-type-dropped`) e ainda assim recusando strings personalizadas não mapeadas pelo nome:

| World Forge `encounterType` | Saída do AI RPG `ContentPack` | Fidelidade e tag |
|---|---|---|
| `boss` | `duel` | `approximated`, `worldforge-type:boss` |
| `beast`, `haunt`, `caravan-raid` | `ambush` | `approximated`, `worldforge-type:<original>` |
| `pirate` | `patrol` | `approximated`, `worldforge-type:pirate` |
| `boarding`, `brawl` | `horde` | `approximated`, `worldforge-type:<original>` |
| `hazard`, `discovery` | omitido de `ContentPack.encounterAnchors` | `dropped` |
| `ambush`, `patrol`, `horde`, `duel` | inalterado | inalterado, sem entrada de fidelidade |
| qualquer outra string personalizada | recusado (`exportToEngine` retorna `success: false` juntamente com `listAiRpgEncounterBlockers`, saída da CLI 1) | bloqueado |

- **IDs do falante do diálogo na exportação do RPG de IA** — `@world-forge/export-ai-rpg` recusa entradas `dialogues[].speakers` não resolvidas pelo nome (`exportToEngine` retorna `success: false` com `speakerBlockers` juntamente com `listAiRpgDialogueSpeakerBlockers`, modal de exportação bloqueado, saída da CLI `1`), nomeando tanto o ID do diálogo quanto o falante não resolvido. Um nó com `speaker: ''` é preenchido apenas a partir do único falante listado do diálogo quando cada entidade que carrega esse diálogo (`dialogueId`) é esse falante listado ou nenhuma entidade o carrega; é recusado pelo ID do diálogo, ID do nó e ID da entidade portadora quando qualquer portador é uma entidade diferente, e recusado pelo ID do diálogo e ID do nó quando `dialogues[].speakers` tem zero ou várias entradas. Falantes de nós não vazios são exportados inalterados.

Requer `ai-rpg-engine` `^4.0.0`.

**Lacunas conhecidas em relação ao AI RPG Engine 4.0.0** (de um teste de carregamento em 25 de novembro de 2026). A exportação desta versão da amostra Chapel Threshold é carregada no motor publicado, e a movimentação entre suas zonas funciona. As seguintes partes ainda não chegam ao jogo:

- **Saídas restritas.** O motor se move apenas ao longo de `zones[].neighbors`. Ele descarta `zones[].exits` e o `connections` do pacote quando carrega o pacote, portanto, uma zona que você só pode alcançar por meio de uma saída restrita não pode ser acessada lá. Na amostra, essa é a cripta e o encontro dentro dela.
- **Perfis de comportamento personalizados.** O motor agora recusa, por padrão, um `aiProfile` que não conhece (`--unresolved-ai-profile fail` em `validate` e `sidecar`). Este exportador escreve os perfis integrados do motor para cada papel, então suas exportações carregam. Uma entidade à qual você der um `ai.profileId` personalizado precisa de um host que registre esse perfil, ou de `--unresolved-ai-profile warn`.
- **Diálogos por meio do sidecar.** Os diálogos são reproduzidos quando um host inicia o pacote no mesmo processo (in-process), como na receita de inicialização JSON do motor. O processo sidecar do motor os descarta ao carregar o pacote.
- **Outros dados do pacote.** O motor os descarta quando carrega o pacote e nomeia cada um com sua razão: descrições e perigos de zona, presenças de facção, pontos críticos de pressão, pontos de geração, o modelo do jogador, tabelas de saque, pontos de referência, estratos e links de estratos, transições, estações de criação, nós de mercado, edifícios, centros, fortalezas, o catálogo de construção e as árvores de progressão.

### O contrato de desenho

Um mundo também pode dizer como um cliente deve **desenhá-lo**. `WorldProject.presentation` é opcional e aditivo — a maioria dos mundos não tem nenhum e nunca é penalizada por isso — e contém a visão dimétrica, a área do bloco, uma célula de âncora de zona e uma placa de piso por zona e uma linha de ocupação por ator.

Ele existe porque um mundo 2.5D é descrito por três grades ao mesmo tempo, e a exportação converte entre **nenhuma** delas:

| Grade | Unidade | Proprietário | Hash |
|---|---|---|---|
| Ocupação simulada | ID da zona | o `WorldState` do motor | sim — autoritário |
| Célula dimétrica | diamante 256x128, intervalo 3 | a visão do cliente, por meio de `presentation` | nunca |
| Cartesiano do Forge | `gridX` / `gridY` | o editor e o Godot `.tscn` | nunca |

Uma célula dimétrica nunca é derivada de `gridX`/`gridY`, e a escala do sandbox ignora o bloco pelo nome para que uma célula de diamante absoluta não possa ser multiplicada acidentalmente. A simulação sempre vence uma disputa sobre em qual sala uma pessoa está; `presentationAdvisories()` diz isso em voz alta, `exportToGodot` relata isso em `warnings[]`, e a linha de fixação de palco pode torná-lo fatal com `--strict`.

O bloco se move no `pack.json` da fixação de palco do Godot. Ele **não** se move na linha `export-ai-rpg` — o `ContentPack` do motor não tem um slot aditivo e seu carregador é estrito — e a tabela de exportação medida relata que ele foi descartado lá, em vez de implicar o contrário.

## Segurança

- **Dados acessados:** arquivos de projeto no disco local (JSON criado pelo usuário), sem armazenamento no lado do servidor
- **Dados NÃO acessados:** sem telemetria, sem análises, sem solicitações de rede além do servidor de desenvolvimento local
- **Permissões:** sem chaves de API, sem segredos, sem credenciais
- **Sem segredos, tokens ou credenciais no código-fonte**

## Licença

MIT

---

Criado por [MCP Tool Shop](https://mcp-tool-shop.github.io/)
