<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.md">English</a>
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

<!-- versão:início -->
<p align="center"><strong>v4.5.0</strong> — 2360 tests + e2e browser checks, 6 shipping packages, 7 authoring modes, tiles + interiors + town authoring + world modeling (vertical strata, typed hazards, party-gated zones), three export targets (AI RPG Engine, Unreal Engine 5, Godot 4)</p>
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

Abra o endereço `http://localhost:5173` para iniciar o editor.

### Fluxo de trabalho do editor

1. **Escolha um modo** — masmorra, distrito, mundo, oceano, espaço, interior ou região selvagem — para definir as configurações padrão da grade e o vocabulário de conexão.
2. **Comece com um kit** — escolha um kit inicial ou modelo de gênero no Gerenciador de Modelos, ou comece do zero.
3. **Pinte zonas** — arraste na tela para criar zonas, conecte-as e atribua distritos.
4. **Coloque entidades** — adicione NPCs, inimigos, comerciantes, encontros e itens nas zonas.
5. **Revise** — abra a guia de revisão para verificar o estado geral, obter uma visão geral do conteúdo e exportar um resumo (Markdown/JSON).
6. **Exporte** — abra a janela de exportação para ver o status de prontidão por destino (✓ Pronto / ⚠ avisos), configure as opções de destino e, em seguida, baixe os pacotes AI RPG Engine, UE5 ou Godot 4. Após a exportação, os recibos são agrupados com informações sobre tamanho, quantidade e qualidade. Também: pacotes de projeto (.wfproject.json) e resumos da revisão.

### Exportação via linha de comandos (CLI)

```bash
# AI RPG Engine
npx world-forge-export project.json --out ./my-pack
npx world-forge-export project.json --validate-only

# Unreal Engine 5
npx world-forge-export-unreal project.json --out ./UnrealPack --sign
npx world-forge-export-unreal --summary ./UnrealPack
```

## Pacotes

### @world-forge/esquema

Tipos e validações principais do TypeScript para a criação de mundos virtuais.

- **Tipos espaciais** – `WorldMap`, `Zone`, `ZoneConnection`, `District`, `Landmark`, `SpawnPoint`, `EncounterAnchor`, `FactionPresence`, `PressureHotspot`
- **Tipos de conteúdo** – `EntityPlacement`, `ItemPlacement`, `DialogueDefinition`, `PlayerTemplate`, `BuildCatalogDefinition`, `ProgressionTreeDefinition`
- **Camadas visuais** – `AssetEntry`, `AssetPack`, `Tileset`, `TileLayer`, `PropDefinition`, `PropPlacement`, `AmbientLayer`
- **Cidade + estruturas** – `MarketNode`, `CraftingStation`, `Building`, `Hub`, `Stronghold`
- **Modelagem do mundo** – `Stratum` + `StratumLink` (camadas verticais), `HazardDefinition` (união de efeitos tipificados), `ZoneEntryGate` + operandos de estado da equipa em `SpawnCondition` (`party-level`, `party-size`, `item`, `flag`, `member`, `class`)
- **Sistema de modos** – `AuthoringMode` (7 modos), perfis específicos para cada modo relativos a grelhas/conexões/validação
- **Validação** – `validateProject()` (78 verificações estruturais com pesquisas O(n) baseadas em mapas, `warningCount`), `advisoryValidation()` (sugestões específicas para cada modo, integridade dos metadados, nomenclatura de recursos)
- **Utilitários** – `assembleSceneData()` (ligações visuais com deteção de recursos ausentes), `scanDependencies()` (análise do grafo de referências), `buildReviewSnapshot()` (classificação da saúde)

### @world-forge/export-unreal

Converte um projeto do tipo `WorldProject` num pacote de conteúdo para a Unreal Engine 5, otimizado para jogos em 2,5D.

- **Resultados** – `pack.json`, ficheiros JSON de dados primários por zona e por distrito, manifesto agrupado de geração de atores, dicas de transmissão de níveis por conexão, dicas de células da Partição Mundial e um relatório estruturado de qualidade.
- **Campos 2.5D** – `Zone.elevation`, `elevationRange`, `parallaxLayers` e `skylineRef` são preservados e convertidos em coordenadas UE cm / Z-up.
- **Transformação de coordenadas** – funções puras (`pixelsToUnrealCm`, `elevationToZ`, `worldForgeToUnrealAxis`, `gridToUnrealAxis`). A escala mundial padrão é 1 bloco = 100 cm.
- **Importação completa** – `importFromUnreal` reconstrói um WorldProject a partir de um pacote Unreal; os dados exclusivos do jogo (diálogos, progressão, construções) são marcados como eliminados no relatório de qualidade.
- **CLI** – `world-forge-export-unreal` com `--out`, `--tile-size-cm`, `--validate-only`, `--verbose`.

### @world-forge/export-godot

Converte um projeto do tipo `WorldProject` num pacote de conteúdo para o Godot 4, com arquivos de cena no formato `.tscn`.

- **Resultados** – `pack.json`, recursos por zona, manifesto de entidades, links de navegação, tabelas de itens, marcadores de geração, nós de transição, recursos de diálogo, associações de ativos e uma cena mundial `.tscn`
- **Cena jogável** – `buildWorldScene()` gera uma cena `.tscn` navegável: colisão `StaticBody2D` por zona + `NavigationRegion2D`, uma câmera `Camera2D` enquadrada e ordenação vertical/profundidade `z_index`
- **Tiles + interiores** – `TileMapLayer` + `TileSet` (dados de mapa de tiles pré-renderizados para conjuntos de tiles de imagem), colisão `StaticBody2D` por célula e posicionamento de objetos `Node2D`
- **Cidade** – mercados + estações de criação, e edifícios (contornos `StaticBody2D`) / centros / fortalezas como espaços reservados `Node2D`, todos contendo seus dados como metadados
- **Modelagem do mundo** – estratos verticais (bandas `z_index` por zona + conectores `StratumLink`), perigos tipificados como regiões `Area2D` e metadados da entrada da zona
- **Relatório de fidelidade** – rastreamento estruturado de dados sem perdas, aproximados e descartados, verificados em relação ao motor Godot 4 real (fumaça sem renderização, 36 asserções)
- **Versão do formato** – `GODOT_PACK_FORMAT_VERSION` 1.0.0

### @world-forge/export-ai-rpg

Converte um objeto `WorldProject` para o formato `ContentPack` do ai-rpg-engine.

- **Exportação** – zonas, distritos, entidades, itens, diálogos, modelo de jogador, catálogo de construção, árvores de progressão, encontros, facções, pontos críticos, manifesto e metadados do pacote.
- **Importação** – 8 conversores inversos reconstroem um WorldProject a partir do JSON exportado.
- **Relatório de fidelidade** – rastreamento estruturado do que foi preservado sem perdas, aproximado ou descartado durante a conversão.
- **Detecção de formato** – deteta automaticamente os formatos WorldProject, ExportResult, ContentPack e ProjectBundle.
- **CLI** – comando `world-forge-export` com as opções `--out`, `--validate-only` e `--verbose`.

### @world-forge/renderizador-2d

Motor de renderização 2D baseado em PixiJS: área de visualização com funcionalidades de deslocamento e zoom, sobreposições de zonas com cores que indicam os distritos, setas de conexão, ícones de entidades por função, camadas de blocos e um minimapa.

### @world-forge/editor

Aplicação web React 19 com Vite, utilizando Zustand para o gerenciamento de estado, funcionalidades de desfazer/refazer com etiquetas de ação, salvamento automático (com intervalo de 30 segundos, histórico de 3 versões e recuperação em caso de falha), proteção contra perda de dados em todos os caminhos de carregamento do projeto, alternância entre temas claro e escuro, restrição do foco em janelas modais e troca de ferramentas controlada pelo teclado.

#### Guias de Trabalho

| Guia | Objetivo |
|-----|---------|
| Mapa | Edição de zonas/entidades/distritos na tela 2D |
| Objetos | Árvore hierárquica: distritos → zonas → entidades/pontos de referência/locais de surgimento |
| Jogador | Modelo de jogador com estatísticas, inventário, equipamento, local de surgimento |
| Construções | Arquétipos, históricos, características, disciplinas, combinações |
| Árvores | Nós de progressão com requisitos e efeitos |
| Diálogo | Edição de nós, ligação de escolhas, detecção de referências quebradas |
| Predefinições | Navegador de predefinições de região e encontros com mesclagem/substituição |
| Ativos | Biblioteca de ativos com pesquisa filtrada por tipo, detecção de itens órfãos, pacotes de ativos |
| Problemas | Validação agrupada em tempo real com navegação "clique para focar" |
| Dependências | Scanner de dependências com botões de correção integrados |
| Revisão | Painel de saúde, visão geral do conteúdo, exportação de resumo |
| Guia | Lista de verificação para o primeiro uso com referência de atalhos |

#### Tela e Edição

- **Ferramentas** — selecionar, pintar zona, conectar, posicionar entidade, ponto de referência, local de surgimento
- **Seleção múltipla** — clique com Shift, seleção por caixa, Ctrl+A; mover arrastando com desfazer atômico
- **Alinhamento** — alinhamento em 6 direções (esquerda/direita/superior/inferior/centro horizontal/centro vertical) e distribuição horizontal/vertical
- **Ajuste** — ajuste ao arrastar para as bordas/centros de objetos próximos com linhas guia visuais
- **Redimensionar** — 8 pontos por zona com ajuste à borda, limitação do tamanho mínimo, visualização em tempo real
- **Duplicar** — Ctrl+D com IDs, conexões e atribuições de distrito remapeados
- **Copiar/Colar** — Ctrl+C / Ctrl+V com remapeamento de ID e deslocamento configurável
- **Ciclo de clique** — cliques repetidos na mesma posição alternam entre objetos sobrepostos
- **Menu de contexto** — clique com o botão direito para 7 ações sensíveis ao contexto (propriedades, excluir, duplicar, etc.)
- **Visualização da conexão** — linha tracejada ciano durante o posicionamento da ferramenta de conexão
- **Minimapa** — visão geral de 200×150 (canto inferior direito), clique para ir até lá
- **Culling da viewport** — renderiza apenas objetos dentro dos limites visíveis (margem de 64 pixels)
- **Estatísticas de desempenho** — alternar sobreposição de FPS/contagem de objetos/tempo de renderização
- **Visibilidade por objeto** — ocultar/exibir objetos individuais (armazenado em localStorage)
- **Camadas** — 7 controles de visibilidade (grade, conexões, entidades, pontos de referência, locais de surgimento, históricos, ambiente)

#### Navegação e Atalhos

- **Viewport** — mover/ampliar a câmera, zoom com a roda do mouse (cursor ancorado), arrastar com a barra de espaço/botão do meio/clique com o botão direito, ajustar automaticamente ao conteúdo, clique duplo para centralizar
- **Pesquisa** — Ctrl+K abre uma sobreposição para encontrar qualquer objeto por nome/ID com correspondência aproximada, navegação pelo teclado e histórico de pesquisa recente (localStorage)
- **Painel de velocidade** — clique duplo com o botão direito para uma paleta de comandos flutuante com ações sensíveis ao contexto, favoritos fixáveis, macros e ações rápidas sugeridas pelo modo
- **Atalhos** — 21 atalhos de teclado, incluindo alternância de ferramentas (V/Z/C/E/L/S), Enter (abrir detalhes), P (aplicar predefinição), Shift+P (salvar predefinição), Ctrl+C/V (copiar/colar), ajuste com as setas (Shift = 5×)
- **Acessibilidade** — armadilhas de foco modal com Escape para fechar, rótulos ARIA em todos os botões apenas com ícones, árvore de objetos navegável por teclado, indicador "sujo" anunciado pelo leitor de tela. As operações da tela (posicionamento, seleção por caixa, redimensionamento, desenho de conexão, movimentação) permanecem baseadas no ponteiro

#### Importar e Exportar

- **ContentPack** — exportação com reconhecimento do destino para AI RPG Engine, Unreal Engine 5 ou Godot 4 com indicadores de prontidão por destino, opções configuráveis (tamanho do tile, prefixos de cena, filtragem de pacotes) e recibos pós-download
- **Pacotes de projeto** — arquivos `.wfproject.json` portáteis com metadados de proveniência e informações de dependência
- **Pacotes de kit** — exportação/importação `.wfkit.json` com validação, tratamento de colisões e rastreamento de proveniência
- **Importar** — detecta automaticamente 4 formatos com relatório estruturado de fidelidade
- **Diferença** — rastreamento semântico de alterações desde a importação
- **Visualização da cena** — composição HTML/CSS embutida de todos os elementos visuais da zona

## Modos de Criação

World Forge separa o **gênero** (fantasia, cyberpunk, pirata) do **modo** (masmorra, oceano, espaço). O gênero é um detalhe — o modo define a escala. O modo governa os padrões da grade, o vocabulário de conexão, as sugestões de validação, a redação do guia e a filtragem das predefinições.

| Modo | Grade | Tile | Conexões-chave |
|------|------|------|-----------------|
| Masmorra | 30×25 | 32 | porta, escada, passagem, segredo, perigo |
| Distrito / Cidade | 50×40 | 32 | estrada, porta, passagem, portal |
| Região / Mundo | 80×60 | 48 | estrada, portal, passagem |
| Oceano / Mar | 60×50 | 48 | canal, rota, portal, perigo |
| Espaço | 100×80 | 64 | acoplamento, dobra espacial, passagem, portal |
| Interior | 20×15 | 24 | porta, escada, passagem, segredo |
| Natureza Selvagem | 60×50 | 48 | trilha, estrada, passagem, perigo |

O modo é definido ao criar um projeto e armazenado como `mode?: AuthoringMode` em `WorldProject`. Cada modo fornece **padrões inteligentes** — os tipos de conexão, as funções das entidades, os nomes das zonas e as sugestões do Painel de Velocidade se adaptam automaticamente.

## Superfície de Criação

### Estrutura do Mundo

- Zonas com disposição espacial, vizinhos, saídas, iluminação, ruído, perigos e elementos interativos
- 12 tipos de conexão (passagem, porta, escadas, estrada, portal, segredo, perigo, canal, rota, atracação, teletransporte, trilha) com estilos visuais distintos, roteamento ancorado nas bordas, setas direcionais e estilo tracejado condicional
- Distritos com controle de facção, perfis econômicos, controles deslizantes de métricas, etiquetas e rótulos de nome do distrito nos pontos centrais da zona
- Pontos de referência (pontos de interesse nomeados dentro das zonas)
- Pontos de geração, âncoras de encontro (coloração baseada no tipo), presenças de facção e áreas críticas
- **Estratos verticais** — camadas discretas (superfície / subterrâneo / céu ou andares de um edifício) com ordem definida, intervalo Z, visibilidade entre as camadas e conectores (escadas / escadas de mão / elevadores); zonas atribuídas a um estrato
- **Perigos ambientais tipificados** — uma biblioteca compartilhada de perigos (danos / status / morte instantânea / efeitos de ignição, tempo de ativação, custo de movimento no terreno, possibilidade de passagem, bloqueio da visão, condições climáticas) referenciados por zona
- **Portões de entrada de zona para grupos** — entrada do portão com base no estado do grupo (nível / tamanho / itens / sinalizadores / membros / classes) como um portão rígido ou apenas uma sugestão, com uma razão "mostrar a fechadura" definida pelo autor

### Conteúdo

- Posicionamento de entidades com atributos, recursos, perfis de IA e metadados personalizados
- Posicionamento de itens com slot, raridade, modificadores de atributos e habilidades concedidas
- Árvores de diálogo com conversas ramificadas, condições e efeitos
- Âncoras de encontro na tela — marcadores de diamante vermelho com tipos de chefe / emboscada / patrulha

### Cidade e Interiores

- Pintura de tiles — conjuntos de tiles baseados em imagens (divisão por linha/coluna) com uma alternativa de retângulo colorido, pincel de arrastar, camadas e “Sólido” para a possibilidade de caminhada por tile para colisão com paredes
- Posicionamento de objetos para interiores (paleta + renderização na tela), com uma ferramenta de posicionamento
- Economia da cidade — nós de mercado (categorias de fornecimento, modificador de preço, contrabando) e estações de criação (tipo de estação, receitas), editados por zona
- Estruturas da cidade — edifícios (áreas acessíveis com um link para a zona interior), centros (nós de serviço + conectividade) e fortalezas (postos fortificados de facção)

### Sistemas de Personagem

- Modelo de jogador (atributos iniciais, inventário, equipamento, ponto de geração)
- Catálogo de construção (arquétipos, históricos, traços, disciplinas, títulos cruzados, relacionamentos)
- Árvores de progressão (nós de habilidade/capacidade com requisitos e efeitos)

### Ativos

- Manifesto de ativos (retratos, sprites, fundos, ícones, conjuntos de tiles) com associações específicas para cada tipo
- Pacotes de ativos (nomeados, agrupamentos versionados com metadados de compatibilidade, tema, licença)
- Visualização da cena (composição embutida de todas as associações visuais da zona com detecção de ativos ausentes)

### Fluxo de Trabalho

- Predefinições de região (9 integradas, filtradas por modo) e predefinições de encontro (10 integradas) com aplicação de mesclagem/substituição e criação/leitura/atualização/exclusão (CRUD) de predefinições personalizadas
- Kits iniciais (7 integrados, específicos para cada modo) com exportação/importação de kit (`.wfkit.json`), tratamento de colisão e rastreamento da origem
- Modelos de layout (6 arranjos de zona pré-construídos) e modelos de diálogo (5 iniciadores de conversa)
- Mesclagem de zonas e posicionamento em lote de entidades (padrões de grade/aleatório/círculo)
- Salvamento automático com intervalo de 30 segundos e histórico de recuperação de 3 versões
- Pesquisa Ctrl+K em todos os tipos de objetos com correspondência aproximada e histórico recente
- Paleta de comandos do Painel de Velocidade com favoritos fixáveis, macros, grupos personalizados e sugestões de modo
- 21 atalhos de teclado centralizados (incluindo 6 teclas para alternar ferramentas)
- Editor de metadados do projeto (autor, licença, categoria, etiquetas)
- Estatísticas de revisão (distribuição de funções, tipos de conexão, tipos de encontro, zonas por distrito)
- Exportação para ContentPack JSON, pacotes de projeto e resumos de revisão
- Importação de 4 formatos com relatórios estruturados sobre a fidelidade, sugestões de correção e rastreamento semântico das diferenças

Consulte [`dogfood/WALKTHROUGH.md`](dogfood/WALKTHROUGH.md) para obter o exemplo do handshake de exportação do Chapel Threshold, que demonstra a configuração atual.

## Diretório Dogfood

O diretório `dogfood/` contém um conjunto de testes de integração que exercita todo o pipeline de criação para exportação fora dos testes unitários. O exemplo do Chapel Threshold (`chapel-threshold.ts`) cria um pequeno, mas completo projeto de mundo, executa-o através da exportação e grava a saída em `dogfood/output/`. Isso demonstra que os tipos de esquema, a validação e o pipeline de exportação funcionam de ponta a ponta com dados reais — não apenas simulações isoladas.

## Compatibilidade do Mecanismo

As exportações têm como alvo três mecanismos:

- **[ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine)** — Formato ContentPack, carregável por [claude-rpg](https://github.com/mcp-tool-shop-org/claude-rpg)
- **Unreal Engine 5** — Pacote de conteúdo com reconhecimento de 2,5D com Ativos de Dados Primários, manifestos de geração de atores e dicas de Partição Mundial
- **Godot 4** — Geração de cena `.tscn` com recursos de zona, links de navegação e manifestos de entidade

## Segurança

- **Dados acessados:** arquivos do projeto no disco local (JSON criado pelo usuário), sem armazenamento no servidor
- **Dados NÃO acessados:** sem telemetria, sem análise, sem solicitações de rede além do servidor de desenvolvimento local
- **Permissões:** sem chaves de API, sem segredos, sem credenciais
- **Sem segredos, tokens ou credenciais no código fonte**

## Licença

MIT

---

Criado por [MCP Tool Shop](https://mcp-tool-shop.github.io/)
