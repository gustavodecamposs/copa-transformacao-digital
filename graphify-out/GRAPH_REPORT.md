# Graph Report - copa-transformacao-digital  (2026-10-22)

## Corpus Check
- 3 files · ~15,289 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 103 nodes · 302 edges · 14 communities (12 shown, 2 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 37 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `089c01bb`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- nome
- app.js
- logic.js
- salvar
- render
- derivar
- viewCampeoes
- aplicarEvento
- criarCampeonato
- carregar
- descreverFormato
- resolverEmpate
- confirmar
- README.md

## God Nodes (most connected - your core abstractions)
1. `nome()` - 22 edges
2. `esc()` - 21 edges
3. `render()` - 17 edges
4. `viewAoVivo()` - 14 edges
5. `salvar()` - 13 edges
6. `viewChaveVivo()` - 12 edges
7. `ligarAoVivo()` - 12 edges
8. `toast()` - 11 edges
9. `ligarParticipantes()` - 11 edges
10. `chaveamento()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `sortearChave()` --indirect_call--> `nome()`  [INFERRED]
  app.js → app.js  _Bridges community 0 → community 3_
- `sortearDesempate()` --indirect_call--> `nome()`  [INFERRED]
  app.js → app.js  _Bridges community 0 → community 1_
- `ligarAoVivo()` --indirect_call--> `desfazer()`  [INFERRED]
  app.js → app.js  _Bridges community 1 → community 3_
- `ligarAoVivo()` --indirect_call--> `novoCampeonato()`  [INFERRED]
  app.js → app.js  _Bridges community 1 → community 12_
- `ligarParticipantes()` --calls--> `salvar()`  [EXTRACTED]
  app.js → app.js  _Bridges community 3 → community 4_

## Import Cycles
- None detected.

## Communities (14 total, 2 thin omitted)

### Community 0 - "nome"
Cohesion: 0.26
Nodes (23): artePalco(), blocoPlacar(), cartaoFase1(), cartaoFinal(), cartaoSemi(), chaveamento(), esc(), formResultado() (+15 more)

### Community 1 - "app.js"
Cohesion: 0.26
Nodes (13): acharPartida(), atualizarVeredito(), bolaSVG(), confirmarResultado(), contarAte(), diferenca(), festa(), lerPlacar() (+5 more)

### Community 2 - "logic.js"
Cohesion: 0.25
Nodes (6): ehTexto(), partidaAtual(), permiteEmpate(), registrarResultado(), validarDados(), validarPlacar()

### Community 3 - "salvar"
Cohesion: 0.47
Nodes (9): adicionarCampeaoManual(), desfazer(), ligarCampeoes(), ligarCampeonato(), salvar(), salvarHistorico(), sortearChave(), quadro() (+1 more)

### Community 4 - "render"
Cohesion: 0.32
Nodes (8): animarFlip(), aplicarTema(), atualizarCabecalho(), irPara(), ligarParticipantes(), medirFlip(), posicionarIndicador(), render()

### Community 5 - "derivar"
Cohesion: 0.38
Nodes (7): avancar(), classificar(), derivar(), desfazer(), estadoSerie(), novaPartida(), vagasDecisivas()

### Community 6 - "viewCampeoes"
Cohesion: 0.40
Nodes (6): dataBR(), formCampeaoManual(), hojeISO(), nomeRotulado(), pessoa(), viewCampeoes()

### Community 7 - "aplicarEvento"
Cohesion: 0.33
Nodes (6): aplicarEvento(), compartilham(), embaralhar(), ordenarSemRepeticao(), buscar(), registrarDesempate()

### Community 8 - "criarCampeonato"
Cohesion: 0.40
Nodes (6): criarCampeonato(), gerarFase1(), gerarId(), registroHistorico(), sortearLado(), validarQuantidade()

### Community 9 - "carregar"
Cohesion: 1.00
Nodes (3): carregar(), estadoInicial(), semearEdicoes()

### Community 10 - "descreverFormato"
Cohesion: 0.67
Nodes (3): descreverFormato(), iniciais(), viewParticipantes()

### Community 11 - "resolverEmpate"
Cohesion: 0.67
Nodes (3): mesmoConjunto(), resolverEmpate(), vencedorConfronto()

## Knowledge Gaps
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `nome()` connect `nome` to `app.js`, `salvar`, `render`, `viewCampeoes`, `confirmar`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `nome()` (e.g. with `sortearChave()` and `sortearDesempate()`) actually correct?**
  _`nome()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Why does `esc()` connect `nome` to `app.js`, `salvar`, `viewCampeoes`, `descreverFormato`, `confirmar`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `render()` connect `render` to `app.js`, `salvar`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._