<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.md">English</a>
</p>

<p align="center">
  <img src="./logo.png" alt="World Forge" width="400">
</p>

# @world-forge/editor

Aplicativo web React 19 para [World Forge](https://github.com/mcp-tool-shop-org/world-forge) — um estúdio de criação de mundos 2D para o motor de RPG com IA.

## Funcionalidades

- **Tela de Desenho (Canvas)** — pinte áreas, desenhe conexões, coloque entidades, marcos e encontros em uma grade 2D com visualização panorâmica com zoom.
- **Multi-seleção** — clique, clique com a tecla Shift, e selecione áreas, entidades, marcos, pontos de spawn e encontros; arraste e mova objetos selecionados com desfazer/refazer.
- **Criação de Encontros** — coloque pontos de ancoragem de encontros em áreas com marcadores de tela de desenho baseados em tipo (chefe, emboscada, patrulha), propriedades editáveis (IDs de inimigos, probabilidade, tempo de recarga, tags).
- **Edição de Distritos** — painel de distritos expandido com controles deslizantes de métricas, tags, facção controladora, perfil econômico, gerenciamento da presença da facção e edição de pontos de pressão.
- **Edição em Lote** — atribuição em lote de distritos, adição em lote de tags e exclusão em lote quando várias áreas são selecionadas.
- **Sistema de Presets** — presets de regiões e encontros com aplicação de mesclagem/substituição, 4 presets de região integrados, 3 presets de encontro integrados, CRUD de presets personalizados com persistência localStorage.
- **Atalhos de Teclado** — registro centralizado de atalhos com 13 combinações: Escape, Ctrl+A, Ctrl+D, Ctrl+K, Delete, ajuste com as setas, Enter (abre detalhes), P (aplica preset), Shift+P (salva preset).
- **Clique Duplo** — clique duplo em qualquer objeto na tela de desenho para selecioná-lo, mude para a aba "Mapa" e centralize a visualização.
- **Painel de Velocidade** — clique duplo com o botão direito na tela de desenho para abrir uma paleta de comandos flutuante com ações contextuais, favoritos que podem ser fixados (reorganize no modo de edição), ações recentes, grupos personalizados, macros leves com editor de etapas, filtragem de pesquisa e navegação por teclado.
- **Abas de Área de Trabalho** — Mapa, Jogador, Construções, Árvores, Diálogo, Objetos, Presets, Recursos, Problemas, Guia.
- **Biblioteca de Recursos** — gerencie retratos, sprites, fundos, ícones e conjuntos de tiles com associações específicas para cada tipo.
- **Desfazer/Refazer** — pilha de histórico com 10 níveis via Zustand.
- **Importar/Exportar** — relatório de fidelidade de ida e volta, rastreamento de diferenças semânticas.
- **Validação** — 54 verificações estruturais com navegação de problemas por clique.
- **Modelos** — iniciadores de gênero e mundos de exemplo para uma integração rápida.

## Como Começar

```bash
npm install
npm run dev --workspace=packages/editor
```

Abra `http://localhost:5173` para iniciar o editor.

## Licença

MIT
