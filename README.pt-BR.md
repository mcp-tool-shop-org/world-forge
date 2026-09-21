<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.md">English</a>
</p>

<p align="center">
  <img src="./assets/logo.png" alt="World Forge" width="400">
</p>

<p align="center">
  <img src="./site/public/screenshots/editor-canvas.jpg" alt="World Forge editor canvas with painted zones" width="720">
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop-org/world-forge/actions/workflows/ci.yml"><img src="https://github.com/mcp-tool-shop-org/world-forge/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@world-forge/schema"><img src="https://img.shields.io/npm/v/@world-forge/schema?label=npm" alt="npm"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="MIT License"></a>
  <a href="https://mcp-tool-shop-org.github.io/world-forge/"><img src="https://img.shields.io/badge/Landing_Page-live-blue" alt="Landing Page"></a>
</p>

<p align="center">2D / 2.5D world authoring studio with peer export lanes for <a href="https://github.com/mcp-tool-shop-org/ai-rpg-engine">AI RPG Engine</a>, <a href="https://www.unrealengine.com/">Unreal Engine 5</a>, and <a href="https://godotengine.org/">Godot 4</a>.<br>One editor, many modes — paint zones, place entities, define districts, export a complete content pack for your engine of choice.</p>

<!-- version:start -->
<p align="center"><strong>v4.9.0</strong> — 3473 tests, 6 shipping packages, 7 authoring modes, tiles + interiors + town authoring + world modeling (vertical strata, typed hazards, party-gated zones), three export targets (AI RPG Engine, Unreal Engine 5, Godot 4), a measured Forge→Engine content contract, and an authored drawing contract for 2.5D clients</p>
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

## Primeiros Passos

```bash
npm install
npm run build
npm run dev --workspace=packages/editor
```

Abra `http://localhost:5173` para iniciar o editor.

### Fluxo de Trabalho do Editor

1. **Escolha um modo** — masmorra, distrito, mundo, oceano, espaço, interior ou região selvagem — para definir as configurações padrão da grade e o vocabulário de conexão.
2. **Comece com um kit** — escolha um kit inicial ou um modelo de gênero no Gerenciador de Modelos, ou comece com um projeto em branco.
3. **Pinte as zonas** — arraste no canvas para criar zonas, conecte-as e atribua distritos.
4. **Coloque entidades** — adicione NPCs, inimigos, comerciantes, encontros e itens nas zonas.
5. **Revise** — abra a guia de revisão para verificar o status de saúde, a visão geral do conteúdo e exportar um resumo (Markdown/JSON).
6. **Exporte** — abra o modal de exportação para ver o status de prontidão por destino (✓ Pronto / ⚠ avisos), configure as opções de destino e, em seguida, baixe os pacotes AI RPG Engine, UE5 ou Godot 4. Os recibos pós-exportação são agrupados por tamanho, contagem e detalhes de fidelidade. Também: pacotes de projeto (.wfproject.json) e resumos de revisão.

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

Tipos e validação principais do TypeScript para a criação de mundos.

- **Tipos espaciais** — `WorldMap`, `Zone`, `ZoneConnection`, `District`, `Landmark`, `SpawnPoint`, `EncounterAnchor`, `FactionPresence`, `PressureHotspot`
- **Tipos de conteúdo** — `EntityPlacement`, `ItemPlacement`, `DialogueDefinition`, `PlayerTemplate`, `BuildCatalogDefinition`, `ProgressionTreeDefinition`
- **Camadas visuais** — `AssetEntry`, `AssetPack`, `Tileset`, `TileLayer`, `PropDefinition`, `PropPlacement`, `AmbientLayer`
- **Cidade + estruturas** — `MarketNode`, `CraftingStation`, `Building`, `Hub`, `Stronghold`
- **Modelagem do mundo** — `Stratum` + `StratumLink` (camadas verticais), `HazardDefinition` (união de efeitos tipados), `ZoneEntryGate` + operandos de estado de grupo `SpawnCondition` (`party-level`, `party-size`, `item`, `flag`, `member`, `class`)
- **Sistema de modo** — `AuthoringMode` (7 modos), perfis de grade/conexão/validação específicos do modo
- **Apresentação** — opcional `WorldPresentation` em `WorldProject`: visualização dimétrica, área de cobertura do tile, células de âncora de zona, placas de piso e uma linha de ocupação por ator. `presentationAdvisories()` executa oito regras de aviso sobre ele, incluindo a que importa: uma pessoa desenhada em uma sala, a simulação a coloca fora dela.
- **Validação** — `validateProject()` (89 verificações estruturais com pesquisas O(n) baseadas em mapa, `warningCount`), `advisoryValidation()` (sugestões específicas do modo, integridade dos metadados, nomenclatura dos recursos). A versão 4.0 em JSON que omite os arrays necessários posteriormente é aceita após `normalizeProjectShape()` / `stampProjectSchemaVersion()`.
- **Uniões fechadas no conjunto** — `VALID_CONNECTION_KINDS`, `VALID_ASSET_KINDS`, `VALID_ENTITY_ROLES`, `VALID_ITEM_SLOTS` e o restante dos conjuntos `VALID_*` são exportados de `@world-forge/schema`.
- **Utilitários** — `assembleSceneData()` (vinculações visuais com detecção de recursos ausentes), `scanDependencies()` (análise do gráfico de referência), `buildReviewSnapshot()` (classificação de saúde)

### @world-forge/export-unreal

Converte um `WorldProject` em um pacote de conteúdo do Unreal Engine 5, otimizado para jogos 2.5D.

- **Saída** — `pack.json`, JSON de Ativos de Dados Primários por zona e por distrito, manifesto agrupado de geração de atores, dicas de streaming de nível por conexão, dicas de célula de Partição Mundial e um relatório de fidelidade estruturado.
- **Campos 2.5D** — `Zone.elevation`, `elevationRange`, `parallaxLayers`, `skylineRef` são preservados e convertidos em coordenadas UE cm / Z-up.
- **Transformação de coordenadas** — funções puras (`pixelsToUnrealCm`, `elevationToZ`, `worldForgeToUnrealAxis`, `gridToUnrealAxis`). A escala padrão do mundo é 1 tile = 100 cm.
- **Importação de ciclo completo** — `importFromUnreal` reconstrói um WorldProject a partir de um pacote Unreal; os dados de jogo (diálogos, progressão, construções) são marcados como descartados no relatório de fidelidade.
- **CLI** — `world-forge-export-unreal` com `--out`, `--tile-size-cm`, `--validate-only`, `--verbose`.

### @world-forge/export-godot

Converte um `WorldProject` em um pacote de conteúdo do Godot 4 com texto de cena `.tscn`.

- **Saída** — uma raiz de projeto Godot 4: `project.godot`, `world.tscn` (ExtResource `.tres`), texturas copiadas em `assets/`, `scripts/player.gd`, mais `pack.json` e `fidelity.json`
- **CLI** — `world-forge-export-godot` com `--out`, `--validate-only`, `--include-world-tscn` / `--no-world-tscn`
- **Cena jogável** — `buildWorldScene()` emite uma `.tscn` navegável: colisão `StaticBody2D` por zona + `NavigationRegion2D`, um `Camera2D` emoldurado, um ator jogador `CharacterBody2D` e classificação y / profundidade `z_index`
- **Tiles + interiores** — `TileMapLayer` + `TileSet` (`tile_map_data` assado para conjuntos de tiles de imagem), colisão de parede por célula `StaticBody2D` e posicionamento de adereços `Node2D`
- **Cidade** — mercados + estações de criação e edifícios (áreas de cobertura `StaticBody2D`) / centros / fortalezas como espaços reservados `Node2D`, todos carregando seus dados como metadados
- **Modelagem do mundo** — estratos verticais (bandeamento por zona `z_index` + conectores `StratumLink`), perigos tipados como regiões `Area2D` e metadados de entrada de zona
- **Relatório de fidelidade** — rastreamento estruturado de dados sem perdas, aproximados e descartados, verificados em relação ao motor real do Godot 4 (fumaça sem cabeça, 36 asserções)
- **Avisos de apresentação** — um bloco `presentation` criado é transmitido inalterado e seus avisos são exibidos em `warnings[]`, portanto, uma divergência entre o desenho e a simulação é uma descoberta de exportação, e não uma surpresa na tela.
- **Versão do formato** — `GODOT_PACK_FORMAT_VERSION` 1.1.0 (`files`, `zoneGates`, `migrateGodotPack`)

### @world-forge/export-ai-rpg

Converte um `WorldProject` para o formato `ContentPack` do ai-rpg-engine.

- **Exportação** — zonas, distritos, entidades, itens, diálogos, modelo de jogador, catálogo de construção, árvores de progressão, encontros, facções, pontos de interesse, manifesto e metadados do pacote
- **Importação** — 8 conversores reversos reconstroem um WorldProject a partir do JSON exportado; CLI `--import` / `--from-pack` escreve `world-project.json` (ou stdout)
- **Relatório de fidelidade** — rastreamento estruturado do que foi sem perda, aproximado ou descartado durante a conversão; `--out` escreve `fidelity.json` ao lado do pacote
- **Detecção de formato** — detecta automaticamente os formatos WorldProject, ExportResult, ContentPack e ProjectBundle
- **CLI** — `world-forge-export` com `--out`, `--import`, `--from-pack`, `--validate-only`, `--dry-run` e `--verbose`

### @world-forge/renderer-2d

Renderizador 2D baseado em PixiJS: viewport com panorâmica/zoom, sobreposições de zona com cores de distrito, setas de conexão, ícones de entidade por função, camadas de tile e um minimapa.

Um renderizador independente publicado para consumidores externos que incorporam dados do World Forge em seu próprio aplicativo PixiJS. **O editor não o usa** — o canvas do editor é uma implementação direta do Canvas2D, portanto, o minimapa e os recursos de viewport listados abaixo do editor são seus próprios, e não deste pacote.

### @world-forge/editor

Aplicativo web React 19 + Vite com gerenciamento de estado do Zustand, desfazer/refazer com rótulos de ação, salvamento automático (intervalo de 30 segundos, histórico de 3 versões, recuperação de falhas), proteções de estado "sujo" em todos os caminhos de carregamento do projeto, alternância de tema claro/escuro, armadilhas de foco modal e troca de ferramentas acionada pelo teclado.

#### Guias da Área de Trabalho

| Guia | Finalidade |
|-----|---------|
| Mapa | Edição de zona/entidade/distrito no canvas 2D |
| Objetos | Árvore hierárquica: distritos → zonas → entidades/pontos de referência/gerações |
| Jogador | Modelo de jogador com estatísticas, inventário, equipamento, geração |
| Construções | Arquétipos, históricos, traços, disciplinas, combos |
| Árvores | Nós de progressão com requisitos e efeitos |
| Diálogo | Edição de nós, ligação de escolhas, detecção de referências quebradas |
| Predefinições | Navegador de predefinições de região e encontros com opções de mesclagem/substituição |
| Ativos | Biblioteca de ativos com pesquisa filtrada por tipo, detecção de ativos órfãos, pacotes de ativos |
| Problemas | Validação agrupada em tempo real com navegação de clique para foco |
| Dependências | Scanner de dependências com botões de correção embutidos |
| Revisão | Painel de controle de saúde, visão geral do conteúdo, exportação de resumo |
| Guia | Lista de verificação para o primeiro uso com referência de atalhos |

#### Tela e Edição

- **Ferramentas** — selecionar, pintar área, conectar, posicionar entidade, ponto de referência, gerar, posicionar item, posicionar encontro
- **Seleção múltipla** — clique com Shift, seleção por caixa, Ctrl+A; mover com arrastar e desfazer atômico
- **Alinhamento** — alinhamento em 6 direções (esquerda/direita/superior/inferior/centro horizontal/centro vertical) e distribuição horizontal/vertical
- **Ajuste** — ajuste ao arrastar para as bordas/centros de objetos próximos com linhas de guia visuais
- **Redimensionamento** — 8 pontos de ajuste por área com ajuste de borda, tamanho mínimo limitado, visualização em tempo real
- **Duplicar** — Ctrl+D com IDs, conexões e atribuições de distrito remapeados
- **Copiar/Colar** — Ctrl+C / Ctrl+V com remapeamento de ID e deslocamento configurável
- **Ciclo de clique** — cliques repetidos na mesma posição alternam entre objetos sobrepostos
- **Menu de contexto** — clique com o botão direito para 7 ações sensíveis ao contexto (propriedades, excluir, duplicar, etc.)
- **Visualização de conexão** — linha tracejada ciano durante o posicionamento da ferramenta de conexão
- **Minimapa** — visão geral de 200×150 (canto inferior direito), clique para ir para o local
- **Culling da viewport** — renderiza apenas objetos dentro dos limites visíveis (margem de 64 pixels)
- **Estatísticas de desempenho** — alternar sobreposição de FPS/contagem de objetos/tempo de renderização
- **Visibilidade por objeto** — ocultar/exibir objetos individuais (armazenado em localStorage)
- **Camadas** — alternar visibilidade (grade, conexões, entidades, pontos de referência, geração, cidade, blocos, adereços, ambiente; os itens fazem teste de colisão com a camada de itens)

#### Navegação e Atalhos

- **Viewport** — mover/ampliar a câmera, ampliar com a roda do mouse (cursor ancorado), mover com a barra de espaço/botão do meio do mouse/clique com o botão direito, ajustar automaticamente ao conteúdo, clique duplo para centralizar
- **Pesquisa** — Ctrl+K abre a sobreposição para encontrar qualquer objeto por nome/ID com correspondência aproximada, navegação por teclado e histórico de pesquisa recente (localStorage)
- **Painel de velocidade** — clique duplo com o botão direito para uma paleta de comandos flutuante com ações sensíveis ao contexto, favoritos fixáveis, macros e ações rápidas sugeridas pelo modo
- **Atalhos** — 21 atalhos de teclado, incluindo alternância de ferramentas (V/Z/C/E/L/S), Enter (abrir detalhes), P (aplicar predefinição), Shift+P (salvar predefinição), Ctrl+C/V (copiar/colar), ajuste com as setas (Shift = 5×)
- **Acessibilidade** — armadilhas de foco modal com Escape para fechar, rótulos ARIA em todos os botões com apenas ícones, árvore de objetos navegável por teclado, indicador de alterações anunciado por leitores de tela. As operações de tela espacial (posicionamento, seleção por caixa, redimensionamento, desenho de conexão, movimentação) permanecem baseadas em ponteiro

#### Importar e Exportar

- **ContentPack** — exportação com reconhecimento do destino para AI RPG Engine, Unreal Engine 5 ou Godot 4 com indicadores de prontidão por destino, opções configuráveis (tamanho do bloco, prefixos de cena, filtragem de pacotes) e recibos pós-download
- **Pacotes de projeto** — arquivos `.wfproject.json` portáteis com metadados de procedência e informações de dependência
- **Pacotes de kit** — exportação/importação `.wfkit.json` com validação, tratamento de colisão e rastreamento de procedência
- **Importar** — detecta automaticamente 4 formatos com relatório de fidelidade estruturado
- **Diferença** — rastreamento de alterações semânticas desde a importação
- **Visualização da cena** — composição HTML/CSS embutida de todas as vinculações visuais da área

## Modos de Criação

World Forge separa o **gênero** (fantasia, cyberpunk, pirata) do **modo** (masmorra, oceano, espaço). O gênero é o sabor — o modo é a escala. O modo governa as configurações padrão da grade, o vocabulário de conexão, as sugestões de validação, a redação do guia e a filtragem de predefinições.

| Modo | Grade | Bloco | Conexões-chave |
|------|------|------|-----------------|
| Masmorra | 30×25 | 32 | porta, escada, passagem, segredo, perigo |
| Distrito / Cidade | 50×40 | 32 | estrada, porta, passagem, portal |
| Região / Mundo | 80×60 | 48 | estrada, portal, passagem |
| Oceano / Mar | 60×50 | 48 | canal, rota, portal, perigo |
| Espaço | 100×80 | 64 | acoplamento, dobra, passagem, portal |
| Interior | 20×15 | 24 | porta, escada, passagem, segredo |
| Natureza Selvagem | 60×50 | 48 | trilha, estrada, passagem, perigo |

O modo é definido ao criar um projeto e armazenado como `mode?: AuthoringMode` em `WorldProject`. Cada modo fornece **configurações inteligentes** — os tipos de conexão, os papéis das entidades, os nomes das áreas e as sugestões do Painel de velocidade se adaptam automaticamente.

## Superfície de Criação

### Estrutura do Mundo

- Zonas com disposição espacial, vizinhos, saídas, iluminação, ruído, perigos e elementos interativos
- 12 tipos de conexão (passagem, porta, escadas, estrada, portal, segredo, perigo, canal, rota, atracação, teletransporte, trilha) com estilos visuais distintos, roteamento ancorado nas bordas, setas direcionais e estilo tracejado condicional
- Distritos com controle de facção, perfis econômicos, controles deslizantes de métricas, etiquetas e rótulos de nome de distrito nos centroides da zona
- Pontos de referência (pontos de interesse nomeados dentro das zonas)
- Pontos de geração, âncoras de encontro (coloração baseada no tipo), presenças de facção e pontos críticos de pressão
- **Estratos verticais** — camadas discretas (superfície / subterrâneo / céu, ou andares de um edifício) com ordem definida, intervalo Z, visibilidade entre camadas e conectores (escadas / escadas de mão / elevadores); as zonas são atribuídas a um estrato
- **Perigos ambientais tipificados** — uma biblioteca compartilhada de perigos (danos / status / morte instantânea / efeitos de ignição, tempo de ativação, custo de movimento do terreno, transitabilidade, bloqueio da visão, condições climáticas) referenciados por zona
- **Portões de entrada de zona para grupos** — entrada do portão com base no estado do grupo (nível / tamanho / itens / sinalizadores / membros / classes) como um portão rígido ou um portão de aviso com uma razão de "mostrar a fechadura" definida
- **Ocupação de apresentação** — para clientes 2.5D: uma vista dimétrica com uma área e extensão de tile, uma célula âncora e uma placa de piso opcional por zona, e uma linha de ocupação (pacote de personagens, zona, célula, direção) por ator, incluindo o jogador

### Conteúdo

- Posicionamento de entidades com estatísticas, recursos, perfis de IA e metadados personalizados
- Posicionamento de itens com slot, raridade, modificadores de estatísticas e habilidades concedidas
- Árvores de diálogo com conversas ramificadas, condições e efeitos
- Âncoras de encontro na tela — marcadores de diamante vermelho com tipos de chefe / emboscada / patrulha

### Cidade e Interiores

- Pintura de tiles — conjuntos de tiles baseados em imagem (fatia por linha / coluna) com um fallback de retângulo colorido, um pincel de arrastar, camadas e "Sólido" de transitabilidade por tile para colisão de parede
- Posicionamento de objetos de cena para interiores (paleta + renderização na tela), com uma ferramenta de posicionamento
- Economia da cidade — nós de mercado (categorias de fornecimento, modificador de preço, contrabando) e estações de criação (tipo de estação, receitas), editados por zona
- Estruturas da cidade — edifícios (áreas transitáveis com um link para a zona interior), hubs (nós de serviço + conectividade) e fortalezas (postos fortificados de facção)

### Sistemas de Personagens

- Modelo de jogador (estatísticas iniciais, inventário, equipamento, ponto de geração)
- Catálogo de construção (arquétipos, históricos, traços, disciplinas, títulos cruzados, relacionamentos)
- Árvores de progressão (nós de habilidade / capacidade com requisitos e efeitos)

### Ativos

- Manifesto de ativos (retratos, sprites, fundos, ícones, conjuntos de tiles) com vinculações específicas do tipo
- Pacotes de ativos (nomeados, agrupamentos com versão com metadados de compatibilidade, tema, licença)
- Visualização de cena (composição embutida de todas as vinculações visuais da zona com detecção de ativos ausentes)

### Fluxo de Trabalho

- Predefinições de região (9 integradas, filtradas por modo) e predefinições de encontro (10 integradas) com aplicação de mesclagem / substituição e predefinições personalizadas de criação, leitura, atualização e exclusão
- Kits iniciais (7 integrados, específicos do modo) com exportação / importação de kit (`.wfkit.json`), tratamento de colisão e rastreamento de proveniência
- Modelos de layout (6 arranjos de zona pré-construídos) e modelos de diálogo (5 iniciadores de conversa)
- Mesclagem de zonas e posicionamento em lote de entidades (padrões de grade / aleatório / círculo)
- Salvamento automático com intervalo de 30 segundos e histórico de recuperação de 3 versões
- Pesquisa Ctrl+K em todos os tipos de objetos com correspondência aproximada e histórico recente
- Paleta de comandos do Painel de Velocidade com favoritos fixáveis, macros, grupos personalizados e sugestões de modo
- 21 atalhos de teclado centralizados (incluindo 6 teclas de troca de ferramenta)
- Editor de metadados do projeto (autor, licença, categoria, etiquetas)
- Estatísticas de revisão (distribuição de funções, tipos de conexão, tipos de encontro, zonas por distrito)
- Exportação para ContentPack JSON, pacotes de projeto e resumos de revisão
- Importação de 4 formatos com relatórios de fidelidade estruturada, sugestões de correção e rastreamento de diferenças semânticas

Consulte [`dogfood/WALKTHROUGH.md`](dogfood/WALKTHROUGH.md) para obter o handshake de exportação do Chapel Threshold, que comprova a superfície atual.

## Diretório Dogfood

O diretório `dogfood/` contém um conjunto de testes de integração que exercita todo o pipeline de autorização para exportação fora dos testes unitários. O exemplo do Chapel Threshold (`chapel-threshold.ts`) cria um pequeno, mas completo, projeto de mundo, executa-o através da exportação e grava a saída em `dogfood/output/`. Isso comprova que os tipos de esquema, a validação e o pipeline de exportação funcionam de ponta a ponta com dados reais — e não apenas com simulações isoladas.

## Compatibilidade do Mecanismo

As exportações têm como alvo três mecanismos:

- **[ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine)** — Formato ContentPack: o tempo de execução de simulação determinística que carrega um pacote exportado e executa o mundo
- **Unreal Engine 5** — pacote de conteúdo compatível com 2.5D com Ativos de Dados Primários, manifestos de geração de atores e dicas de Partição Mundial
- **Godot 4** — geração de cena `.tscn` com recursos de zona, links de navegação e manifestos de entidade

### O contrato de conteúdo Forge→Engine

Um exportador que é executado não é a mesma coisa que um mundo que é inicializado. A versão 4.6.0 fecha essa lacuna para o caminho do AI RPG Engine e — mais útilmente — torna a lacuna restante um número em vez de uma suposição.

- **Uma tabela de exportação controlada** (`docs/c0-alignment/`) — um percurso de diferenciação percorre
cada campo definido e registra quais deles realmente chegam ao tempo de execução. É
gerada, verificada e validada em cada execução de teste, portanto, "o que sobrevive à exportação"
pode ser auditado, em vez de apenas afirmado.
- **Um manifesto honesto** — o pacote emitido contém uma faixa de versão semântica real do motor,
IDs de módulo reais, um hash de conteúdo e condições de saída compiladas. Os IDs de módulo são
restritos ao conteúdo real: um pacote sem estações de criação não reivindica mais o
módulo de criação.
- **O vocabulário espacial se cruza** — posicionamentos por entidade com condições de geração compiladas,
perigos tipificados, portões de entrada e descritores de cena chegam ao pacote de conteúdo do motor,
não apenas ao esquema.
- **O relatório de fidelidade mantém o contrato.** Cada faixa relata o que foi sem perdas,
aproximado ou descartado. Onde um campo não pode ser transferido, a exportação informa isso — não
tem sucesso silenciosamente.

Requer `ai-rpg-engine` `^3.8.0`.

### O contrato de desenho

Um mundo também pode indicar como um cliente deve **desenhá-lo**. `WorldProject.presentation`
é opcional e aditivo — a maioria dos mundos não o tem e nunca é penalizada por isso —
e contém a visão dimétrica, a área da célula, uma célula âncora de zona e um piso por zona, e uma linha de ocupação por ator.

Ele existe porque um mundo 2.5D é descrito por três grades ao mesmo tempo, e a
exportação converte entre **nenhuma** delas:

| Grade | Unidade | Proprietário | Com hash |
|---|---|---|---|
| Ocupação simulada | ID da zona | o `WorldState` do motor | sim — autoritário |
| Célula dimétrica | Diamante 256x128, abrangência 3 | a visão do cliente, via `presentation` | nunca |
| Cartesiano da forja | `gridX` / `gridY` | o editor e o Godot `.tscn` | nunca |

Uma célula dimétrica nunca é derivada de `gridX`/`gridY`, e a escala do sandbox
ignora o bloco pelo nome, para que uma célula de diamante absoluta não possa ser multiplicada
acidentalmente. A simulação sempre vence uma disputa sobre em qual sala uma pessoa está;
`presentationAdvisories()` diz isso em voz alta, `exportToGodot` relata isso em
`warnings[]`, e a faixa de fixação de palco pode torná-lo fatal com `--strict`.

O bloco se move na faixa de fixação de palco do Godot `pack.json`. Ele **não**
se move na faixa `export-ai-rpg` — o `ContentPack` do motor não tem um slot aditivo
e seu carregador é rigoroso — e a tabela de exportação controlada relata que ele foi descartado lá, em vez de implicar o contrário.

## Segurança

- **Dados acessados:** arquivos de projeto no disco local (JSON criado pelo usuário), sem armazenamento no lado do servidor
- **Dados NÃO acessados:** sem telemetria, sem análises, sem solicitações de rede além do servidor de desenvolvimento local
- **Permissões:** sem chaves de API, sem segredos, sem credenciais
- **Sem segredos, tokens ou credenciais no código-fonte**

## Licença

MIT

---

Criado por [MCP Tool Shop](https://mcp-tool-shop.github.io/)
