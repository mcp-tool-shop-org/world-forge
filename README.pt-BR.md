<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.md">English</a>
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

## Arquitetura

```
packages/
  schema/          @world-forge/schema        — spatial types, validation
  export-ai-rpg/   @world-forge/export-ai-rpg — engine export pipeline + CLI
  renderer-2d/     @world-forge/renderer-2d   — PixiJS 2D canvas renderer
  editor/          @world-forge/editor         — React web authoring app
```

## Início Rápido

```bash
npm install
npm run build
npm run dev --workspace=packages/editor
```

Abra `http://localhost:5173` para iniciar o editor.

### Fluxo de Trabalho do Editor

1. **Escolha um modo** — masmorra, distrito, mundo, oceano, espaço, interior ou natureza — para definir as configurações padrão da grade e o vocabulário de conexões.
2. **Comece com um kit** — escolha um kit inicial ou modelo de gênero no Gerenciador de Modelos, ou comece do zero.
3. **Pinte zonas** — arraste na tela para criar zonas, conecte-as e atribua distritos.
4. **Coloque entidades** — arraste NPCs, inimigos, comerciantes, encontros e itens para as zonas.
5. **Revise** — abra a guia "Revisão" para verificar o status, obter uma visão geral do conteúdo e exportar um resumo (Markdown/JSON).
6. **Exporte** — baixe um ContentPack, um pacote de projeto (.wfproject.json) ou um resumo da revisão.

### Exportação via Linha de Comando (CLI)

```bash
npx world-forge-export project.json --out ./my-pack
npx world-forge-export project.json --validate-only
```

## Pacotes

### @world-forge/schema

Tipos e validações Core TypeScript para a criação de mundos.

- **Tipos espaciais** — `WorldMap`, `Zone`, `ZoneConnection`, `District`, `Landmark`, `SpawnPoint`, `EncounterAnchor`, `FactionPresence`, `PressureHotspot`
- **Tipos de conteúdo** — `EntityPlacement`, `ItemPlacement`, `DialogueDefinition`, `PlayerTemplate`, `BuildCatalogDefinition`, `ProgressionTreeDefinition`
- **Camadas visuais** — `AssetEntry`, `AssetPack`, `Tileset`, `TileLayer`, `PropDefinition`, `AmbientLayer`
- **Sistema de modos** — `AuthoringMode` (7 modos), perfis específicos do modo para grade/conexão/validação.
- **Validação** — `validateProject()` (54 verificações estruturais), `advisoryValidation()` (sugestões específicas do modo).
- **Utilitários** — `assembleSceneData()` (vinculações visuais com detecção de ativos ausentes), `scanDependencies()` (análise do grafo de referências), `buildReviewSnapshot()` (classificação de saúde).

### @world-forge/export-ai-rpg

Converte um `WorldProject` para o formato `ContentPack` do ai-rpg-engine.

- **Exporta** — zonas, distritos, entidades, itens, diálogos, modelo de jogador, catálogo de construções, árvores de progressão, encontros, facções, pontos de interesse, manifesto e metadados do pacote.
- **Importa** — 8 conversores inversos reconstroem um WorldProject a partir de arquivos JSON exportados.
- **Relatório de fidelidade** — rastreamento estruturado do que foi convertido sem perdas, aproximado ou descartado durante a conversão.
- **Detecção de formato** — detecta automaticamente os formatos WorldProject, ExportResult, ContentPack e ProjectBundle.
- **CLI** — comando `world-forge-export` com as flags `--out` e `--validate-only`.

### @world-forge/renderer-2d

Renderizador 2D baseado em PixiJS: visor com pan/zoom, sobreposições de zonas com cores de distrito, setas de conexão, ícones de entidades por função, camadas de tiles e um minimapa.

### @world-forge/editor

Aplicativo web React 19 + Vite com gerenciamento de estado Zustand e desfazer/refazer.

#### Abas do Espaço de Trabalho

| Aba | Propósito |
|-----|---------|
| Mapa | Edição de zonas/entidades/distritos na tela 2D. |
| Objetos | Árvore hierárquica: distritos → zonas → entidades/pontos de referência/pontos de spawn. |
| Jogador | Modelo de jogador com estatísticas, inventário, equipamentos e ponto de spawn. |
| Construções | Arquétipos, históricos, características, disciplinas, combinações. |
| Árvores | Nós de progressão com requisitos e efeitos. |
| Diálogo | Edição de nós, vinculação de escolhas, detecção de referências quebradas. |
| Predefinições | Navegador de predefinições de região e encontro com opções de mesclar/substituir. |
| Ativos | Biblioteca de ativos com pesquisa filtrada por tipo, detecção de órfãos e pacotes de ativos. |
| Problemas | Validação em tempo real agrupada com navegação por clique para focar. |
| Dependências | Scanner de dependências com botões de reparo inline. |
| Revisão | Painel de saúde, visão geral do conteúdo, exportação de resumo |
| Guia | Lista de verificação para a primeira execução com referência de atalhos |

#### Tela e Edição

- **Ferramentas** — seleção, pintura de áreas, conexão, posicionamento de entidades, ponto de referência, geração
- **Seleção múltipla** — clique com Shift, seleção por caixa, Ctrl+A; arrastar para mover com desfazer individual
- **Alinhamento** — alinhamento em 6 direções (esquerda/direita/cima/baixo/centro-horizontal/centro-vertical) e distribuição horizontal/vertical
- **Ajuste** — ajuste ao arrastar para as bordas/centros de objetos próximos, com linhas de guia visuais
- **Redimensionamento** — 8 alças por área, com ajuste às bordas, limite de tamanho mínimo, visualização em tempo real
- **Duplicar** — Ctrl+D com IDs, conexões e atribuições de distrito remapeados
- **Ciclo de cliques** — cliques repetidos na mesma posição percorrem objetos sobrepostos
- **Camadas** — 7 opções de visibilidade (grade, conexões, entidades, pontos de referência, geração, fundos, ambiente)

#### Navegação e Atalhos

- **Visor** — panorâmica/zoom da câmera, zoom com a roda do mouse (ancorado ao cursor), barra de espaço/botão do meio do mouse/clique direito para arrastar e panorâmica, ajuste automático ao conteúdo, clique duplo para centralizar
- **Pesquisa** — Ctrl+K abre uma janela para encontrar qualquer objeto por nome/ID, com navegação por teclado
- **Painel de Velocidade** — clique duplo com o botão direito para abrir uma paleta de comandos flutuante com ações contextuais, favoritos que podem ser fixados, macros e sugestões rápidas de ações com base no modo
- **Atalhos** — 13 atalhos de teclado, incluindo Enter (abrir detalhes), P (aplicar predefinição), Shift+P (salvar predefinição)

#### Importação e Exportação

- **Pacote de conteúdo** — exportação com um clique para o formato ai-rpg-engine, com validação completa
- **Pacotes de projeto** — arquivos `.wfproject.json` portáteis com metadados de origem e informações de dependência
- **Pacotes de kit** — exportação/importação de `.wfkit.json` com validação, tratamento de colisões e rastreamento de origem
- **Importação** — detecta automaticamente 4 formatos com relatórios estruturados de fidelidade
- **Diferenças** — rastreamento de alterações semânticas desde a importação
- **Visualização da cena** — composição HTML/CSS inline de todas as associações visuais da área

## Modos de Criação

O World Forge separa o **gênero** (fantasia, cyberpunk, pirata) do **modo** (masmorra, oceano, espaço). O gênero é o estilo — o modo é a escala. O modo define as configurações padrão da grade, o vocabulário de conexões, as sugestões de validação, a redação dos guias e a filtragem de predefinições.

| Modo | Grade | Tile | Conexões Chave |
|------|------|------|-----------------|
| Masmorra | 30x25 | 32 | porta, escada, passagem, segredo, perigo |
| Distrito / Cidade | 50x40 | 32 | rua, porta, passagem, portal |
| Região / Mundo | 80x60 | 48 | rua, portal, passagem |
| Oceano / Mar | 60x50 | 48 | canal, rota, portal, perigo |
| Espaço | 100x80 | 64 | doca, teletransporte, passagem, portal |
| Interior | 20x15 | 24 | porta, escada, passagem, segredo |
| Selva | 60x50 | 48 | trilha, rua, passagem, perigo |

O modo é definido ao criar um projeto e armazenado como `mode?: AuthoringMode` em `WorldProject`. Cada modo fornece **configurações padrão inteligentes** — tipos de conexão, papéis de entidade, nomes de área e sugestões do Painel de Velocidade se adaptam automaticamente.

## Superfície de Criação

### Estrutura do Mundo

- Zonas com layout espacial, vizinhanças, saídas, iluminação, ruído, perigos e elementos interativos.
- 12 tipos de conexões (passagem, porta, escadas, estrada, portal, segredo, perigo, canal, rota, atracação, teletransporte, trilha) com estilos visuais distintos, roteamento ancorado nas bordas, setas direcionais e estilos tracejados condicionais.
- Distritos com controle de facção, perfis econômicos, controles deslizantes de métricas, tags e rótulos de nomes de distritos nos centros das zonas.
- Pontos de referência (pontos de interesse nomeados dentro das zonas).
- Pontos de spawn, pontos de encontro (coloração baseada no tipo), presença de facções e pontos de alta pressão.

### Conteúdo

- Posicionamento de entidades com estatísticas, recursos, perfis de IA e metadados personalizados.
- Posicionamento de itens com slot, raridade, modificadores de estatísticas e ações disponíveis.
- Árvores de diálogo com conversas ramificadas, condições e efeitos.
- Pontos de encontro na tela — marcadores de diamante vermelho com tipos de chefe/emboscada/patrulha.

### Sistemas de Personagens

- Modelo de jogador (estatísticas iniciais, inventário, equipamentos, ponto de spawn).
- Catálogo de construção (arquétipos, históricos, características, disciplinas, títulos cruzados, relações).
- Árvores de progressão (nós de habilidades/capacidades com requisitos e efeitos).

### Ativos

- Manifestos de recursos (retratos, sprites, fundos, ícones, conjuntos de tiles) com associações específicas para cada tipo.
- Pacotes de recursos (grupos nomeados e versionados com metadados de compatibilidade, tema e licença).
- Visualização da cena (composição inline de todas as associações visuais das zonas com detecção de recursos ausentes).

### Fluxo de Trabalho

- Predefinições de região (9 integradas, filtradas por modo) e predefinições de encontro (10 integradas) com aplicação de mesclagem/substituição e CRUD personalizado de predefinições.
- Kits de inicialização (7 integrados, específicos para cada modo) com exportação/importação de kits (`.wfkit.json`), tratamento de colisões e rastreamento de origem.
- Pesquisa Ctrl+K em todos os tipos de objetos, incluindo conexões e encontros.
- Paleta de comandos do Painel de Velocidade com favoritos fixáveis, macros, grupos personalizados e sugestões de modo.
- 13 atalhos de teclado centralizados.
- Exportação para JSON de ContentPack, pacotes de projeto e resumos de revisão.
- Importação de 4 formatos com relatórios estruturados de fidelidade e rastreamento semântico de diferenças.

Consulte [`dogfood/WALKTHROUGH.md`](dogfood/WALKTHROUGH.md) para ver a sequência de exportação do Chapel Threshold, que comprova a versão atual.

## Compatibilidade com o Motor

As exportações são direcionadas para os tipos de conteúdo do [ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine). O ContentPack exportado pode ser carregado diretamente pelo [claude-rpg](https://github.com/mcp-tool-shop-org/claude-rpg).

## Segurança

- **Dados acessados:** arquivos do projeto no disco local (JSON criado pelo usuário), sem armazenamento no servidor.
- **Dados NÃO acessados:** sem telemetria, sem análise, sem solicitações de rede além do servidor de desenvolvimento local.
- **Permissões:** sem chaves de API, sem segredos, sem credenciais.
- **Sem segredos, tokens ou credenciais no código-fonte.**

## Licença

MIT

---

Desenvolvido por [MCP Tool Shop](https://mcp-tool-shop.github.io/)
