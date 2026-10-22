(function (root) {
  'use strict';

  const MIN_JOGADORES = 2;
  const MAX_JOGADORES = 8;
  const DESTAQUES = ['#C6F432', '#FFD23F', '#5EE6C0'];

  function gerarId(prefixo) {
    return prefixo + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function embaralhar(lista, rnd) {
    const arr = lista.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function sortearLado(rnd) {
    return rnd() < 0.5 ? 'a' : 'b';
  }

  function validarQuantidade(n) {
    if (n < MIN_JOGADORES) return 'Selecione pelo menos 2 jogadores.';
    if (n > MAX_JOGADORES) return 'O máximo é 8 jogadores por campeonato.';
    return null;
  }

  /* ---------- resultado da partida ---------- */

  function estadoSerie(resultado) {
    if (!resultado) {
      return { golsA: 0, golsB: 0, terminou: false, vencedor: null };
    }
    const golsA = resultado.golsA, golsB = resultado.golsB;
    const vencedor = golsA === golsB ? null : (golsA > golsB ? 'a' : 'b');
    return { golsA, golsB, terminou: vencedor !== null, vencedor };
  }

  /* ---------- sorteio da fase 1 ---------- */

  function compartilham(p, q) {
    return p.includes(q[0]) || p.includes(q[1]);
  }

  // Branch-and-bound pela ordem com menos jogadores repetidos em partidas seguidas.
  // N=3 e N=4 não admitem zero: cada partida tem no máximo uma partida disjunta.
  function ordenarSemRepeticao(pares, rnd) {
    const itens = embaralhar(pares, rnd);
    const usado = new Array(itens.length).fill(false);
    const ordem = [];
    let melhor = null, melhorCusto = Infinity, orcamento = 60000;

    function buscar(custo) {
      if (custo >= melhorCusto || --orcamento < 0) return;
      if (ordem.length === itens.length) {
        melhor = ordem.slice(); melhorCusto = custo;
        return;
      }
      const ult = ordem[ordem.length - 1];
      const candidatos = [];
      for (let i = 0; i < itens.length; i++) {
        if (!usado[i]) candidatos.push([i, ult && compartilham(ult, itens[i]) ? 1 : 0]);
      }
      candidatos.sort((x, y) => x[1] - y[1]);
      for (const [i, extra] of candidatos) {
        usado[i] = true; ordem.push(itens[i]);
        buscar(custo + extra);
        usado[i] = false; ordem.pop();
        if (melhorCusto === 0) return;
      }
    }
    buscar(0);
    return melhor;
  }

  function gerarFase1(ids, rnd) {
    const pares = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) pares.push([ids[i], ids[j]]);
    }
    return ordenarSemRepeticao(pares, rnd).map(([x, y], i) => {
      const [a, b] = rnd() < 0.5 ? [x, y] : [y, x];
      return { id: 'm' + (i + 1), a, b, primeiro: sortearLado(rnd) };
    });
  }

  /* ---------- classificação ---------- */

  function vencedorConfronto(partidas, x, y) {
    const m = partidas.find(p => p.vencedor &&
      ((p.a === x && p.b === y) || (p.a === y && p.b === x)));
    return m ? m.vencedor : null;
  }

  function mesmoConjunto(a, b) {
    return a.length === b.length && a.every(x => b.includes(x));
  }

  // Ordena um grupo empatado em pontos, SG e GP: confronto direto entre eles, depois sorteio registrado.
  function resolverEmpate(grupo, partidas, desempates, pendentes) {
    if (grupo.length === 1) return grupo;

    const ptsConfronto = {};
    grupo.forEach(id => { ptsConfronto[id] = 0; });
    for (let i = 0; i < grupo.length; i++) {
      for (let j = i + 1; j < grupo.length; j++) {
        const v = vencedorConfronto(partidas, grupo[i], grupo[j]);
        if (v) ptsConfronto[v] += 3;
      }
    }
    const ordenado = grupo.slice().sort((x, y) => ptsConfronto[y] - ptsConfronto[x]);

    const subgrupos = [];
    for (const id of ordenado) {
      const ult = subgrupos[subgrupos.length - 1];
      if (ult && ptsConfronto[ult[0]] === ptsConfronto[id]) ult.push(id);
      else subgrupos.push([id]);
    }

    if (subgrupos.length === 1) {
      const sorteio = desempates.find(d => mesmoConjunto(d, grupo));
      if (sorteio) return sorteio.slice();
      pendentes.push(grupo.slice());
      return grupo.slice();
    }
    return subgrupos.flatMap(s => resolverEmpate(s, partidas, desempates, pendentes));
  }

  function classificar(participantes, partidas, desempates) {
    desempates = desempates || [];
    const st = {};
    participantes.forEach(id => {
      st[id] = { id, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0, pts: 0 };
    });
    for (const m of partidas) {
      if (!m.encerrada) continue;
      const s = estadoSerie(m.resultado);
      const A = st[m.a], B = st[m.b];
      A.j++; B.j++;
      A.gp += s.golsA; A.gc += s.golsB;
      B.gp += s.golsB; B.gc += s.golsA;
      if (!m.vencedor) {
        A.e++; B.e++; A.pts++; B.pts++;
      } else {
        const venc = m.vencedor === m.a ? A : B;
        const perd = m.vencedor === m.a ? B : A;
        venc.v++; venc.pts += 3; perd.d++;
      }
    }
    const linhas = Object.values(st);
    linhas.forEach(l => { l.sg = l.gp - l.gc; });
    linhas.sort((x, y) => (y.pts - x.pts) || (y.sg - x.sg) || (y.gp - x.gp));

    const grupos = [];
    for (const l of linhas) {
      const ult = grupos[grupos.length - 1];
      const ref = ult && ult[0];
      if (ref && ref.pts === l.pts && ref.sg === l.sg && ref.gp === l.gp) ult.push(l);
      else grupos.push([l]);
    }

    const pendentes = [];
    const ordemIds = grupos.flatMap(g =>
      resolverEmpate(g.map(l => l.id), partidas, desempates, pendentes));
    const tabela = ordemIds.map((id, i) => Object.assign({ pos: i + 1 }, st[id]));
    return { tabela, pendentes };
  }

  /* ---------- campeonato: base + eventos ---------- */

  // Formato só vale com 3 jogadores: 'b' = fase 1 + final entre os 2 melhores; 'c' = turno e returno, líder campeão.
  function criarCampeonato(participantes, rnd, formato) {
    rnd = rnd || Math.random;
    const erro = validarQuantidade(participantes.length);
    if (erro) throw new Error(erro);

    const ordem = embaralhar(participantes, rnd);
    const numeros = {};
    ordem.forEach((id, i) => { numeros[id] = i + 1; });

    formato = participantes.length === 3 && formato === 'c' ? 'c' : 'b';
    let fase1Base = participantes.length === 2 ? [] : gerarFase1(ordem, rnd);
    if (formato === 'c') {
      const returno = fase1Base.map((m, i) =>
        ({ id: 'm' + (fase1Base.length + i + 1), a: m.b, b: m.a, primeiro: sortearLado(rnd) }));
      fase1Base = fase1Base.concat(returno);
    }

    const base = {
      id: gerarId('c'),
      formato,
      participantes: participantes.slice(),
      numeros,
      fase1Base,
      finalDireta: participantes.length === 2
        ? { a: ordem[0], b: ordem[1] }
        : null,
      primeiros: {
        semis: [sortearLado(rnd), sortearLado(rnd)],
        final: sortearLado(rnd)
      },
      eventos: [],
      salvo: false
    };
    return derivar(base);
  }

  function novaPartida(id, a, b, primeiro, extra) {
    return Object.assign({ id, a, b, primeiro, resultado: null, vencedor: null, encerrada: false }, extra || {});
  }

  function partidaAtual(c) {
    if (c.estado === 'fase1') return c.fase1.find(m => !m.encerrada) || null;
    if (c.estado === 'semis') return c.semis.find(m => !m.vencedor) || null;
    if (c.estado === 'final') return c.final && !c.final.vencedor ? c.final : null;
    return null;
  }

  function permiteEmpate(c, m) {
    return c.fase1.indexOf(m) >= 0;
  }

  function vagasDecisivas(n) {
    return n === 3 ? 2 : 4;
  }

  function avancar(c) {
    const n = c.participantes.length;

    if (c.estado === 'fase1' && c.fase1.every(m => m.encerrada)) {
      const { tabela, pendentes } = classificar(c.participantes, c.fase1, c.desempates);
      const limite = vagasDecisivas(n);
      const relevante = pendentes.find(g =>
        g.some(id => tabela.find(l => l.id === id).pos <= limite));
      if (relevante) {
        c.empatePendente = relevante;
        return;
      }
      c.empatePendente = null;
      const t = tabela.map(l => l.id);
      if (c.formato === 'c') {
        c.estado = 'encerrado';
        c.campeao = t[0];
        c.vice = t[1];
        return;
      }
      if (n === 3) {
        c.final = novaPartida('f', t[0], t[1], c.primeiros.final);
        c.estado = 'final';
      } else {
        c.semis = [
          novaPartida('s1', t[0], t[3], c.primeiros.semis[0]),
          novaPartida('s2', t[1], t[2], c.primeiros.semis[1])
        ];
        c.final = novaPartida('f', null, null, c.primeiros.final);
        c.estado = 'semis';
      }
    }

    if (c.estado === 'semis' && c.semis.every(m => m.vencedor)) {
      c.final.a = c.semis[0].vencedor; c.final.b = c.semis[1].vencedor;
      c.estado = 'final';
    }

    if (c.estado === 'final' && c.final.vencedor) {
      c.estado = 'encerrado';
      c.campeao = c.final.vencedor;
      c.vice = c.final.vencedor === c.final.a ? c.final.b : c.final.a;
    }
  }

  function derivar(base) {
    const c = {
      id: base.id,
      formato: base.formato === 'c' ? 'c' : 'b',
      participantes: base.participantes.slice(),
      numeros: Object.assign({}, base.numeros),
      fase1Base: base.fase1Base.map(m => Object.assign({}, m)),
      finalDireta: base.finalDireta ? Object.assign({}, base.finalDireta) : null,
      primeiros: { semis: base.primeiros.semis.slice(), final: base.primeiros.final },
      eventos: base.eventos.map(e => JSON.parse(JSON.stringify(e))),
      salvo: !!base.salvo,
      fase1: base.fase1Base.map(m => novaPartida(m.id, m.a, m.b, m.primeiro)),
      semis: [],
      final: null,
      desempates: [],
      empatePendente: null,
      campeao: null,
      vice: null,
      estado: 'fase1'
    };
    if (c.finalDireta) {
      c.final = novaPartida('f', c.finalDireta.a, c.finalDireta.b, c.primeiros.final);
      c.estado = 'final';
    }

    for (const ev of c.eventos) {
      if (ev.tipo === 'resultado') {
        const m = partidaAtual(c);
        if (!m || !m.a || !m.b) throw new Error('Evento de resultado sem partida em andamento.');
        const erro = validarPlacar(ev.golsA, ev.golsB, permiteEmpate(c, m));
        if (erro) throw new Error(erro);
        const resultado = { golsA: ev.golsA, golsB: ev.golsB };
        const s = estadoSerie(resultado);
        m.resultado = resultado;
        m.vencedor = s.vencedor === 'a' ? m.a : s.vencedor === 'b' ? m.b : null;
        m.encerrada = true;
      } else if (ev.tipo === 'desempate') {
        c.desempates.push(ev.ordem.slice());
      } else {
        throw new Error('Evento desconhecido: ' + ev.tipo + '.');
      }
      avancar(c);
    }
    return c;
  }

  function aplicarEvento(c, evento) {
    return derivar(Object.assign({}, c, { eventos: c.eventos.concat([evento]) }));
  }

  function validarPlacar(golsA, golsB, podeEmpatar) {
    if (!Number.isInteger(golsA) || !Number.isInteger(golsB)) return 'Informe o placar dos dois lados.';
    if (golsA < 0 || golsB < 0) return 'O placar não pode ser negativo.';
    if (golsA > 99 || golsB > 99) return 'Placar inválido.';
    if (golsA === golsB && !podeEmpatar) return 'Esta fase não permite empate. Informe um vencedor.';
    return null;
  }

  function registrarResultado(c, golsA, golsB) {
    const m = partidaAtual(c);
    if (!m || !m.a || !m.b || c.empatePendente) return c;
    const erro = validarPlacar(golsA, golsB, permiteEmpate(c, m));
    if (erro) return c;
    return aplicarEvento(c, { tipo: 'resultado', golsA, golsB });
  }

  function registrarDesempate(c, rnd) {
    if (!c.empatePendente) return c;
    const ordem = embaralhar(c.empatePendente, rnd || Math.random);
    return aplicarEvento(c, { tipo: 'desempate', ordem });
  }

  // Remove eventos do fim até tirar um resultado; sorteios de desempate posteriores caem junto.
  function desfazer(c) {
    const eventos = c.eventos.slice();
    while (eventos.length) {
      const ev = eventos.pop();
      if (ev.tipo === 'resultado') {
        return derivar(Object.assign({}, c, { eventos }));
      }
    }
    return c;
  }

  function podeDesfazer(c) {
    return !!c && !c.salvo && c.eventos.some(e => e.tipo === 'resultado');
  }

  function comecou(c) {
    return !!c && c.eventos.length > 0;
  }

  /* ---------- ranking histórico ---------- */

  function calcularRanking(pessoas, historico) {
    const st = {};
    const garantir = id => {
      if (!st[id]) {
        const p = pessoas.find(x => x.id === id);
        st[id] = {
          id,
          nome: p ? p.nome : 'Desconhecido',
          removida: p ? !!p.removida : true,
          titulos: 0, vices: 0, disputados: 0
        };
      }
      return st[id];
    };
    for (const h of historico) {
      h.participantes.forEach(id => { garantir(id).disputados++; });
      garantir(h.campeao).titulos++;
      garantir(h.vice).vices++;
    }
    return Object.values(st)
      .map(s => Object.assign(s, {
        aproveitamento: s.disputados ? Math.round((s.titulos / s.disputados) * 100) : 0
      }))
      .sort((x, y) =>
        (y.titulos - x.titulos) ||
        (y.vices - x.vices) ||
        (x.disputados - y.disputados) ||
        x.nome.localeCompare(y.nome, 'pt-BR'));
  }

  function registroHistorico(c, data) {
    return {
      id: gerarId('h'),
      campeonatoId: c.id,
      data,
      participantes: c.participantes.slice(),
      campeao: c.campeao,
      vice: c.vice
    };
  }

  /* ---------- validação de dados importados ---------- */

  function ehTexto(v) { return typeof v === 'string' && v.length > 0; }

  function validarDados(d) {
    if (!d || typeof d !== 'object') return 'O arquivo não contém um objeto JSON.';
    if (!Array.isArray(d.pessoas)) return 'Campo "pessoas" ausente ou inválido.';
    const ids = new Set();
    for (const p of d.pessoas) {
      if (!p || !ehTexto(p.id) || !ehTexto(p.nome)) return 'Há uma pessoa sem id ou nome.';
      if (p.nome.length > 20) return 'O nome "' + p.nome.slice(0, 20) + '..." passa de 20 caracteres.';
      if (ids.has(p.id)) return 'Id de pessoa repetido: ' + p.id + '.';
      ids.add(p.id);
    }
    if (!Array.isArray(d.historico)) return 'Campo "historico" ausente ou inválido.';
    for (const h of d.historico) {
      if (!h || !ehTexto(h.id) || !ehTexto(h.data) || !Array.isArray(h.participantes)) {
        return 'Há um registro de histórico incompleto.';
      }
      const refs = h.participantes.concat([h.campeao, h.vice]);
      const faltando = refs.find(id => !ids.has(id));
      if (faltando) return 'O histórico cita uma pessoa que não existe: ' + faltando + '.';
    }
    if (d.campeonatoAtual) {
      const c = d.campeonatoAtual;
      if (!Array.isArray(c.participantes) || !Array.isArray(c.eventos) || !Array.isArray(c.fase1Base)) {
        return 'Campeonato em andamento com formato inválido.';
      }
      if (c.participantes.some(id => !ids.has(id))) return 'O campeonato em andamento cita uma pessoa que não existe.';
      try { derivar(c); } catch (e) { return 'Campeonato em andamento inconsistente: ' + e.message; }
    }
    if (d.tema && !DESTAQUES.includes(d.tema.destaque)) return 'Cor de tema não permitida.';
    return null;
  }

  const Copa = {
    MIN_JOGADORES, MAX_JOGADORES, DESTAQUES,
    gerarId, embaralhar, validarQuantidade,
    estadoSerie, gerarFase1, validarPlacar, permiteEmpate,
    classificar, criarCampeonato, derivar, partidaAtual,
    registrarResultado, registrarDesempate, desfazer, podeDesfazer, comecou,
    calcularRanking, registroHistorico, validarDados
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Copa;
  else root.Copa = Copa;
})(this);
