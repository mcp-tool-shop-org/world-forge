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

<p align="center">2D / 2.5D world authoring studio with peer export lanes for <a href="https://github.com/mcp-tool-shop-org/ai-rpg-engine">AI RPG Engine</a>, <a href="https://www.unrealengine.com/">Unreal Engine 5</a>, and (planned) Godot 4.<br>One editor, many modes — paint zones, place entities, define districts, export a complete content pack for your engine of choice.</p>

<!-- version:start -->
<p align="center"><strong>v4.4.0</strong> — 2067 tests, 5 shipping packages + 1 planned Godot stub (6 total), 7 authoring modes, 2.5D authoring, Unreal pack versioning + signing + diff</p>
<!-- version:end -->

## Arquitetura

```
packages/
  schema/          @world-forge/schema         — spatial types, validation, 2.5D fields
  export-ai-rpg/   @world-forge/export-ai-rpg  — AI RPG Engine export pipeline + CLI
  export-unreal/   @world-forge/export-unreal  — Unreal Engine 5 export pipeline + CLI (2.5D aware)
  export-godot/    @world-forge/export-godot   — (planned) Godot 4 export lane, stub only
  renderer-2d/     @world-forge/renderer-2d    — PixiJS 2D canvas renderer
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
2. **Comece com um kit** — escolha um kit inicial ou um modelo de gênero no Gerenciador de Modelos, ou comece do zero.
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

- **Tipos espaciais** — `WorldMap`, `Zone`, `ZoneConnection`, `District`, `Landmark`, `SpawnPoint`, `EncounterAnchor`, `FactionPresence`, `PressureHotspot`.
- **Tipos de conteúdo** — `EntityPlacement`, `ItemPlacement`, `DialogueDefinition`, `PlayerTemplate`, `BuildCatalogDefinition`, `ProgressionTreeDefinition`.
- **Camadas visuais** — `AssetEntry`, `AssetPack`, `Tileset`, `TileLayer`, `PropDefinition`, `AmbientLayer`.
- **Sistema de modos** — `AuthoringMode` (7 modos), perfis específicos para cada modo (grade, conexões, validação).
- **Validação** — `validateProject()` (54 verificações estruturais com pesquisas baseadas em mapas, O(n), e contagem de avisos), `advisoryValidation()` (sugestões específicas para cada modo, completude de metadados, nomenclatura de ativos).
- **Utilitários** — `assembleSceneData()` (vinculações visuais com detecção de ativos ausentes), `scanDependencies()` (análise de grafo de referências), `buildReviewSnapshot()` (classificação de saúde).

### @world-forge/export-unreal

Converte um `WorldProject` em um pacote de conteúdo para o Unreal Engine 5, otimizado para jogos 2.5D.

- **Saída** — `pack.json`, JSON de dados primários por zona e distrito, manifesto de spawn de atores agrupados, dicas de streaming de níveis por conexão, dicas de células de World Partition e um relatório de fidelidade estruturado.
- **Campos 2.5D** — `Zone.elevation`, `elevationRange`, `parallaxLayers`, `skylineRef` são preservados e convertidos em coordenadas UE (cm / Z-up).
- **Transformação de coordenadas** — funções puras (`pixelsToUnrealCm`, `elevationToZ`, `worldForgeToUnrealAxis`, `gridToUnrealAxis`). A escala padrão do mundo é 1 tile = 100 cm.
- **Importação de ida e volta** — `importFromUnreal` reconstrói um WorldProject a partir de um pacote Unreal; dados apenas de jogabilidade (diálogos, progressão, construções) são marcados como removidos no relatório de fidelidade.
- **Linha de comando (CLI)** — `world-forge-export-unreal` com as opções `--out`, `--tile-size-cm`, `--validate-only` e `--verbose`.

### @world-forge/export-godot

Espaço de trabalho reservado para a futura exportação para o Godot 4 (Fractured Road). Ainda não implementado.

### @world-forge/export-ai-rpg

Converte um `WorldProject` para o formato `ContentPack` do ai-rpg-engine.

- **Exportação** — zonas, distritos, entidades, itens, diálogos, modelo de jogador, catálogo de construções, árvores de progressão, encontros, facções, hotspots, manifesto e metadados do pacote.
- **Importação** — 8 conversores inversos reconstroem um WorldProject a partir de JSON exportado.
- **Relatório de fidelidade** — rastreamento estruturado do que foi convertido sem perdas, aproximado ou removido durante a conversão.
- **Detecção de formato** — detecta automaticamente os formatos WorldProject, ExportResult, ContentPack e ProjectBundle.
- **Linha de comando (CLI)** — comando `world-forge-export` com as opções `--out`, `--validate-only` e `--verbose`.

### @world-forge/renderer-2d

Renderizador 2D baseado em PixiJS: viewport com pan/zoom, sobreposições de zonas com cores de distritos, setas de conexão, ícones de entidades por função, camadas de tiles e um minimapa.

### @world-forge/editor

Aplicação web React 19 + Vite com gerenciamento de estado Zustand, desfazer/refazer com rótulos de ação, salvamento automático (limite de 30 segundos, histórico de 3 versões), alternância entre tema claro/escuro e proteção contra alterações não salvas.

#### Abas de Trabalho

| Aba | Propósito |
|-----|---------|
| Mapa | Edição de zonas/entidades/distritos na tela 2D. |
| Objetos | Árvore hierárquica: distritos → zonas → entidades/pontos de referência/geradores. |
| Jogador | Modelo de jogador com estatísticas, inventário, equipamentos, ponto de spawn. |
| Construções | Arquétipos, históricos, características, disciplinas, combinações. |
| Árvores | Nós de progressão com requisitos e efeitos. |
| Diálogo | Edição de nós, vinculação de escolhas, detecção de referências quebradas. |
| Predefinições | Navegador de predefinições de região e encontros com opções de mesclar/substituir. |
| Recursos | Biblioteca de recursos com pesquisa filtrada por tipo, detecção de recursos órfãos, pacotes de recursos. |
| Problemas | Validação em tempo real, agrupada, com navegação por clique para foco. |
| Dependências | Scanner de dependências com botões de correção inline. |
| Revisão | Painel de saúde, visão geral do conteúdo, exportação de resumo. |
| Guia | Lista de verificação para a primeira execução com referência de atalhos. |

#### Tela e Edição

- **Ferramentas** — seleção, pintura de zona, conexão, colocação de entidade, ponto de referência, gerador.
- **Multi-seleção** — clique com Shift, seleção por caixa, Ctrl+A; mover arrastando com desfazer atômico.
- **Alinhamento** — alinhamento em 6 direções (esquerda/direita/cima/baixo/centro-horizontal/centro-vertical) e distribuição horizontal/vertical.
- **Ajuste** — ajuste durante o arrasto para as bordas/centros de objetos próximos, com linhas de guia visuais.
- **Redimensionamento** — 8 alças por zona, com ajuste de borda, limite de tamanho mínimo, visualização em tempo real.
- **Duplicar** — Ctrl+D com IDs remapeados, conexões e atribuições de distrito.
- **Copiar/Colar** — Ctrl+C / Ctrl+V com remapeamento de ID e deslocamento configurável.
- **Ciclo por clique** — cliques repetidos na mesma posição percorrem objetos sobrepostos.
- **Menu de contexto** — clique com o botão direito para 7 ações sensíveis ao contexto (propriedades, excluir, duplicar, etc.).
- **Visualização de conexão** — linha tracejada em ciano durante a colocação da ferramenta de conexão.
- **Mini mapa** — visão geral de 200x150 (canto inferior direito), clique para ir para lá.
- **Eliminação de objetos fora da tela** — renderiza apenas objetos dentro dos limites visíveis (margem de 64px).
- **Estatísticas de desempenho** — alterna a sobreposição de FPS/contagem de objetos/tempo de renderização.
- **Visibilidade por objeto** — ocultar/exibir objetos individuais (armazenado no localStorage).
- **Camadas** — 7 alternâncias de visibilidade (grade, conexões, entidades, pontos de referência, geradores, fundos, ambiente).

#### Navegação e Atalhos

- **Tela** — panorâmica/zoom da câmera, roda do mouse para zoom (ancorado ao cursor), barra de espaço/botão do meio do mouse/clique com o botão direito para panorâmica, ajuste automático ao conteúdo, clique duplo para centralizar.
- **Pesquisa** — Ctrl+K abre uma sobreposição para encontrar qualquer objeto por nome/ID com correspondência aproximada, navegação por teclado e histórico de pesquisa recente (localStorage).
- **Painel de Velocidade** — clique duplo com o botão direito para uma paleta de comandos flutuante com ações contextuais, favoritos fixáveis, macros e ações rápidas sugeridas pelo modo.
- **Atalhos** — 15 atalhos de teclado, incluindo Enter (abrir detalhes), P (aplicar predefinição), Shift+P (salvar predefinição), Ctrl+C/V (copiar/colar).

#### Importação e Exportação

- **Pacotes de conteúdo:** Exportação com um clique para o formato ai-rpg-engine, com validação completa.
- **Pacotes de projetos:** Arquivos `.wfproject.json` portáteis, com metadados de origem e informações de dependências.
- **Pacotes de kits:** Exportação/importação de arquivos `.wfkit.json` com validação, tratamento de colisões e rastreamento de origem.
- **Importação:** Detecção automática de 4 formatos, com relatórios estruturados de fidelidade.
- **Diferenças (Diff):** Rastreamento de alterações semânticas desde a importação.
- **Visualização da cena:** Composição HTML/CSS integrada de todas as ligações visuais das áreas.

## Modos de Criação

O World Forge separa o **gênero** (fantasia, cyberpunk, pirata) do **modo** (masmorra, oceano, espaço). O gênero define o estilo, enquanto o modo define a escala. O modo controla as configurações padrão da grade, o vocabulário de conexões, as sugestões de validação, a redação dos guias e a filtragem de predefinições.

| Modo | Grade | Tile (Peça) | Conexões Principais |
|------|------|------|-----------------|
| Masmorra | 30x25 | 32 | porta, escadas, passagem, segredo, perigo |
| Distrito / Cidade | 50x40 | 32 | estrada, porta, passagem, portal |
| Região / Mundo | 80x60 | 48 | estrada, portal, passagem |
| Oceano / Mar | 60x50 | 48 | canal, rota, portal, perigo |
| Espaço | 100x80 | 64 | doca, salto, passagem, portal |
| Interior | 20x15 | 24 | porta, escadas, passagem, segredo |
| Selva | 60x50 | 48 | trilha, estrada, passagem, perigo |

O modo é definido ao criar um projeto e armazenado como `mode?: AuthoringMode` em `WorldProject`. Cada modo oferece **configurações padrão inteligentes** — tipos de conexão, papéis de entidade, nomes de áreas e sugestões do Painel de Velocidade se adaptam automaticamente.

## Superfície de Criação

### Estrutura do Mundo

- Áreas com layout espacial, vizinhos, saídas, luz, som, perigos e elementos interativos.
- 12 tipos de conexão (passagem, porta, escadas, estrada, portal, segredo, perigo, canal, rota, doca, salto, trilha) com estilos visuais distintos, roteamento ancorado nas bordas, setas direcionais e estilos tracejados condicionais.
- Distritos com controle de facção, perfis econômicos, controles deslizantes de métricas, tags e rótulos de nome de distrito nos centros das áreas.
- Pontos de referência (pontos de interesse nomeados dentro das áreas).
- Pontos de surgimento, âncoras de encontro (coloração baseada em tipo), presença de facções e pontos de pressão.

### Conteúdo

- Posicionamento de entidades com estatísticas, recursos, perfis de IA e metadados personalizados.
- Posicionamento de itens com slot, raridade, modificadores de estatísticas e verbos concedidos.
- Árvores de diálogo com conversas ramificadas, condições e efeitos.
- Âncoras de encontro na tela — marcadores de diamante vermelho com tipos de chefe/emboscada/patrulha.

### Sistemas de Personagens

- Modelo de jogador (estatísticas iniciais, inventário, equipamento, ponto de surgimento).
- Catálogo de construção (arquétipos, históricos, traços, disciplinas, títulos cruzados, entrelaçamentos).
- Árvores de progressão (nós de habilidades/capacidades com requisitos e efeitos).

### Recursos

- Manifesto de recursos (retratos, sprites, fundos, ícones, conjuntos de peças) com associações específicas para cada tipo.
- Pacotes de recursos (grupos nomeados e versionados com metadados de compatibilidade, tema, licença).
- Visualização da cena (composição integrada de todas as ligações visuais das áreas, com detecção de recursos ausentes).

### Fluxo de Trabalho

- Presets de região (9 pré-definidos, filtrados por modo) e presets de encontros (10 pré-definidos) com aplicação de mesclagem/substituição e gerenciamento (CRUD) de presets personalizados.
- Kits de início (7 pré-definidos, específicos para cada modo) com exportação/importação de kits (`.wfkit.json`), tratamento de colisões e rastreamento de origem.
- Modelos de layout (6 arranjos de zonas pré-definidos) e modelos de diálogo (5 inícios de conversa).
- Mesclagem de zonas e posicionamento em lote de entidades (padrões de grade, aleatório e círculo).
- Salvamento automático com intervalo de 30 segundos e histórico de recuperação de 3 versões.
- Pesquisa com Ctrl+K em todos os tipos de objetos, com correspondência aproximada e histórico recente.
- Paleta de comandos do Painel de Velocidade com favoritos fixáveis, macros, grupos personalizados e sugestões de modo.
- 15 atalhos de teclado centralizados.
- Editor de metadados do projeto (autor, licença, categoria, tags).
- Estatísticas de revisão (distribuição de papéis, tipos de conexão, tipos de encontro, zonas por distrito).
- Exportação para JSON de ContentPack, pacotes de projeto e resumos de revisão.
- Importação de 4 formatos com relatórios de fidelidade estruturados, sugestões de correção e rastreamento de diferenças semânticas.

Consulte [`dogfood/WALKTHROUGH.md`](dogfood/WALKTHROUGH.md) para ver a sequência de exportação do Chapel Threshold, que demonstra a funcionalidade atual.

## Diretório de Testes Internos

O diretório `dogfood/` contém um conjunto de testes de integração que exercitam todo o fluxo de criação à exportação, fora dos testes unitários. O exemplo Chapel Threshold (`chapel-threshold.ts`) cria um projeto de mundo pequeno, mas completo, executa a exportação e grava a saída em `dogfood/output/`. Isso demonstra que os tipos de esquema, a validação e o pipeline de exportação funcionam de ponta a ponta com dados reais, e não apenas com simulações isoladas.

## Compatibilidade com o Motor

As exportações são direcionadas para os tipos de conteúdo do [ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine). O ContentPack exportado pode ser carregado diretamente pelo [claude-rpg](https://github.com/mcp-tool-shop-org/claude-rpg).

## Segurança

- **Dados acessados:** arquivos do projeto no disco local (JSON criado pelo usuário), sem armazenamento no servidor.
- **Dados NÃO acessados:** sem telemetria, sem análise, sem requisições de rede além do servidor de desenvolvimento local.
- **Permissões:** sem chaves de API, sem segredos, sem credenciais.
- **Sem segredos, tokens ou credenciais no código fonte.**

## Licença

MIT

---

Desenvolvido por [MCP Tool Shop](https://mcp-tool-shop.github.io/)
