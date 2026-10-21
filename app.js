(function () {
  'use strict';

  const CHAVE = 'copa-transformacao-digital';
  const NOMES_INICIAIS = ['Pedro', 'Isaque', 'Gustavo'];
  const reduzMovimento = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ================= estado ================= */

  const EDICOES_ANTERIORES = [
    { id: 'h-ed1', campeonatoId: 'c-ed1', data: '2026-10-20', campeao: 'Gustavo', vice: 'Pedro' },
    { id: 'h-ed2', campeonatoId: 'c-ed2', data: '2026-10-19', campeao: 'Isaque', vice: 'Pedro' }
  ];
  const DATAS_PROVISORIAS = { 'h-ed1': '2026-10-06', 'h-ed2': '2026-10-13' };

  // Entra uma vez só: se o usuário excluir depois, não volta.
  function semearEdicoes(dados) {
    let corrigiu = false;
    for (const h of dados.historico) {
      if (DATAS_PROVISORIAS[h.id] === h.data) {
        h.data = EDICOES_ANTERIORES.find(e => e.id === h.id).data;
        corrigiu = true;
      }
    }
    if (corrigiu) dados.historico.sort((x, y) => y.data.localeCompare(x.data));
    if (dados.edicoesSemeadas) return;
    dados.edicoesSemeadas = true;
    const idDe = n => {
      const p = dados.pessoas.find(x => x.nome.toLocaleLowerCase('pt-BR') === n.toLocaleLowerCase('pt-BR'));
      return p ? p.id : null;
    };
    const participantes = ['Pedro', 'Isaque', 'Gustavo'].map(idDe);
    if (participantes.some(id => !id)) return;
    for (const e of EDICOES_ANTERIORES) {
      if (dados.historico.some(h => h.id === e.id)) continue;
      dados.historico.push({
        id: e.id, campeonatoId: e.campeonatoId, data: e.data,
        participantes: participantes.slice(),
        campeao: idDe(e.campeao), vice: idDe(e.vice)
      });
    }
    dados.historico.sort((x, y) => y.data.localeCompare(x.data));
  }

  function estadoInicial() {
    const e = {
      pessoas: NOMES_INICIAIS.map((nome, i) => ({ id: 'p' + (i + 1), nome, removida: false })),
      historico: [],
      edicoesSemeadas: false,
      campeonatoAtual: null,
      tema: { destaque: Copa.DESTAQUES[0] },
      selecao: ['p1', 'p2', 'p3'],
      modoVivo: 'placar'
    };
    semearEdicoes(e);
    return e;
  }

  function carregar() {
    let dados;
    try { dados = JSON.parse(localStorage.getItem(CHAVE)); } catch (e) { dados = null; }
    if (!dados) return estadoInicial();

    const camp = dados.campeonatoAtual;
    const semCamp = Object.assign({}, dados, { campeonatoAtual: null });
    if (Copa.validarDados(semCamp)) return estadoInicial();

    let campeonato = null;
    if (camp && !Copa.validarDados(dados)) {
      try { campeonato = Copa.derivar(camp); } catch (e) { campeonato = null; }
    }
    const ativos = dados.pessoas.filter(p => !p.removida).map(p => p.id);
    semearEdicoes(dados);
    return {
      pessoas: dados.pessoas,
      historico: dados.historico,
      edicoesSemeadas: dados.edicoesSemeadas,
      campeonatoAtual: campeonato,
      tema: dados.tema && Copa.DESTAQUES.includes(dados.tema.destaque) ? dados.tema : { destaque: Copa.DESTAQUES[0] },
      selecao: Array.isArray(dados.selecao) ? dados.selecao.filter(id => ativos.includes(id)) : ativos.slice(0, Copa.MAX_JOGADORES),
      modoVivo: dados.modoVivo === 'chave' ? 'chave' : 'placar'
    };
  }

  let estado = carregar();

  function salvar() {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(estado));
    } catch (e) {
      toast('Não foi possível salvar no navegador. Exporte os dados para não perder.', 'erro');
    }
  }

  const ui = {
    aba: 'campeonato',
    sorteando: false,
    erroNome: '',
    resultadoVisivel: null,
    erroResultado: '',
    editandoData: null,
    comemorar: false,
    vt: false,
    placarAnterior: null,
    desempateRevelado: null,
    sorteandoDesempate: false,
    celebrou: null,
    diff: null
  };

  /* ================= utilidades ================= */

  const $ = sel => document.querySelector(sel);

  function esc(s) {
    return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function pessoa(id) { return estado.pessoas.find(p => p.id === id); }

  function nome(id) {
    const p = pessoa(id);
    return p ? p.nome : 'Desconhecido';
  }

  function nomeRotulado(id) {
    const p = pessoa(id);
    if (!p) return esc('Desconhecido');
    return esc(p.nome) + (p.removida ? ' <span class="removido">(removido)</span>' : '');
  }

  function iniciais(n) {
    return n.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  }

  function hojeISO() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function dataBR(iso) {
    const [a, m, d] = iso.split('-');
    return d && m && a ? d + '/' + m + '/' + a : iso;
  }

  function vibrar(padrao) {
    if (navigator.vibrate && !reduzMovimento.matches) navigator.vibrate(padrao);
  }

  const ICONE = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    desfazer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
    sorteio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
    seta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    cadeado: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    editar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>',
    lixo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    baixar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
    subir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M7 9l5-5 5 5M5 20h14"/></svg>',
    reiniciar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 3.5v5h5"/></svg>',
    mais: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    placar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14M7.5 10v4M15 10h2.5v4H15z"/></svg>',
    chave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h6v5H3zM3 14h6v5H3z"/><path d="M9 7.5h3v9H9M12 12h3"/><rect x="15" y="9.5" width="6" height="5"/></svg>',
    alerta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/></svg>'
  };

  /* ================= mesa-gol ================= */

  const BOLA_X = 470, BOLA_Y = 174;
  const TRAJETOS = {
    gol: 'M0,0 Q-40,-120 -152,-92',
    fora: 'M0,0 Q-6,-100 -36,-168',
    trave: 'M0,0 Q-30,-80 -64,-58 L-20,8 L18,20'
  };

  function bolaSVG() {
    const pts = [], raios = [];
    for (let k = 0; k < 5; k++) {
      const ang = (-90 + k * 72) * Math.PI / 180;
      const x = Math.cos(ang) * 8.5, y = Math.sin(ang) * 8.5;
      pts.push(x.toFixed(1) + ',' + y.toFixed(1));
      raios.push('<line class="mg-tinta-tr" x1="' + x.toFixed(1) + '" y1="' + y.toFixed(1) + '" x2="' + (Math.cos(ang) * 21).toFixed(1) + '" y2="' + (Math.sin(ang) * 21).toFixed(1) + '"/>');
    }
    return '<circle class="mg-claro" r="22"/><polygon class="mg-tinta" points="' + pts.join(' ') + '"/>' + raios.join('');
  }

  function mesaGol(opcoes) {
    const chute = opcoes && opcoes.chute;
    const heroi = opcoes && opcoes.heroi;
    const rede = [];
    for (let x = 66 + 37; x < 362; x += 37) rede.push('<line x1="' + x + '" y1="50" x2="' + x + '" y2="196"/>');
    for (let y = 50 + 29; y < 196; y += 29) rede.push('<line x1="66" y1="' + y + '" x2="362" y2="' + y + '"/>');

    let bola;
    if (chute) {
      const escala = chute === 'gol' ? '0.72' : chute === 'fora' ? '0.6' : '0.85';
      bola =
        '<g transform="translate(' + BOLA_X + ',' + BOLA_Y + ')">' +
          '<g>' +
            '<animateMotion dur="0.62s" fill="freeze" path="' + TRAJETOS[chute] + '" calcMode="spline" keyTimes="0;1" keySplines="0.2 0.7 0.3 1"/>' +
            '<g>' +
              '<animateTransform attributeName="transform" type="scale" from="1" to="' + escala + '" dur="0.62s" fill="freeze"/>' +
              '<animateTransform attributeName="transform" type="rotate" additive="sum" from="0" to="-320" dur="0.62s" fill="freeze"/>' +
              bolaSVG() +
            '</g>' +
          '</g>' +
        '</g>';
    } else {
      bola = '<g transform="translate(' + BOLA_X + ',' + BOLA_Y + ')">' + bolaSVG() + '</g>';
    }

    const trajetoria = chute ? '' :
      '<path class="mg-traj" d="M452,156 Q400,92 332,84"/>';

    return '' +
      '<svg viewBox="0 0 540 220" role="img" aria-label="Mesa-gol: tampo de mesa como travessão, pernas como traves, bola na marca do pênalti">' +
        '<line class="mg-chao" x1="0" y1="196" x2="540" y2="196"/>' +
        '<g class="mg-rede' + (chute === 'gol' ? ' balanca' : '') + '">' + rede.join('') + '</g>' +
        '<rect class="mg-claro" x="24" y="12" width="380" height="32" rx="7"/>' +
        '<rect class="mg-faixa" x="24" y="38" width="380" height="12"/>' +
        '<rect class="mg-claro mg-perna" x="46" y="50" width="20" height="146"/>' +
        '<rect class="mg-claro mg-perna' + (chute === 'trave' ? ' treme' : '') + '" x="362" y="50" width="20" height="146"/>' +
        '<ellipse class="mg-acc-tr" cx="470" cy="202" rx="34" ry="8"/>' +
        '<circle class="mg-acc" cx="470" cy="202" r="4"/>' +
        trajetoria +
        '<circle class="mg-acc-tr" cx="318" cy="82" r="12"/>' +
        (heroi ? '<circle class="mg-acc-tr mg-alvo-pulso" cx="318" cy="82" r="12" stroke-width="2"/>' : '') +
        '<circle class="mg-acc" cx="318" cy="82" r="4"/>' +
        bola +
      '</svg>';
  }

  /* ================= toast e modal ================= */

  function toast(msg, tipo) {
    const el = document.createElement('div');
    el.className = 'toast' + (tipo === 'erro' ? ' erro' : '');
    el.innerHTML = (tipo === 'erro' ? ICONE.alerta : ICONE.check) + '<span>' + esc(msg) + '</span>';
    $('#toasts').appendChild(el);
    setTimeout(() => {
      el.classList.add('sai');
      el.addEventListener('animationend', () => el.remove(), { once: true });
      setTimeout(() => el.remove(), 400);
    }, tipo === 'erro' ? 4200 : 2600);
  }

  function confirmar(opcoes) {
    const raiz = $('#modalRaiz');
    const focoAnterior = document.activeElement;
    raiz.innerHTML =
      '<div class="modal-fundo">' +
        '<div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="modalTitulo" aria-describedby="modalTexto">' +
          '<h2 id="modalTitulo">' + esc(opcoes.titulo) + '</h2>' +
          '<p id="modalTexto">' + esc(opcoes.texto) + '</p>' +
          '<div class="acoes">' +
            '<button class="btn btn-linha btn-mini" data-m="nao">Cancelar</button>' +
            '<button class="btn ' + (opcoes.perigo ? 'btn-perigo' : 'btn-acc') + ' btn-mini" data-m="sim">' + esc(opcoes.ok || 'Confirmar') + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    const fechar = () => {
      raiz.innerHTML = '';
      document.removeEventListener('keydown', teclas);
      if (focoAnterior && document.contains(focoAnterior)) focoAnterior.focus();
    };
    const teclas = e => {
      if (e.key === 'Escape') fechar();
      if (e.key === 'Tab') {
        const bts = raiz.querySelectorAll('button');
        const ult = bts[bts.length - 1];
        if (e.shiftKey && document.activeElement === bts[0]) { e.preventDefault(); ult.focus(); }
        else if (!e.shiftKey && document.activeElement === ult) { e.preventDefault(); bts[0].focus(); }
      }
    };
    document.addEventListener('keydown', teclas);
    raiz.querySelector('[data-m="nao"]').onclick = fechar;
    raiz.querySelector('[data-m="sim"]').onclick = () => { fechar(); opcoes.aoConfirmar(); };
    raiz.querySelector('.modal-fundo').addEventListener('click', e => { if (e.target.classList.contains('modal-fundo')) fechar(); });
    raiz.querySelector('[data-m="nao"]').focus();
  }

  /* ================= navegação ================= */

  const ORDEM_ABAS = ['campeonato', 'aovivo', 'campeoes', 'participantes'];

  function posicionarIndicador(instantaneo) {
    const nav = $('.abas'), ind = $('.aba-indicador');
    const alvo = nav && nav.querySelector('.aba[aria-selected="true"]');
    if (!ind || !alvo) return;
    const rn = nav.getBoundingClientRect(), ra = alvo.getBoundingClientRect();
    ind.classList.toggle('sem-transicao', !!instantaneo);
    ind.style.setProperty('--x', (ra.left - rn.left) + 'px');
    ind.style.setProperty('--y', (ra.top - rn.top) + 'px');
    ind.style.setProperty('--w', ra.width + 'px');
    ind.style.setProperty('--h', ra.height + 'px');
    ind.classList.add('pronto');
    if (instantaneo) requestAnimationFrame(() => ind.classList.remove('sem-transicao'));
  }

  function irPara(aba) {
    if (ui.sorteando) return;
    const anterior = ui.aba;
    ui.aba = aba;
    document.body.dataset.aba = aba;
    document.querySelectorAll('.aba').forEach(b => {
      const ativa = b.dataset.aba === aba;
      b.setAttribute('aria-selected', String(ativa));
      b.tabIndex = ativa ? 0 : -1;
    });
    $('#vista').setAttribute('aria-labelledby', 'tab-' + aba);
    const trocou = abaRenderizada !== null && anterior !== aba;
    if (trocou && document.startViewTransition && !reduzMovimento.matches) {
      document.documentElement.style.setProperty('--vt-dir', ORDEM_ABAS.indexOf(aba) >= ORDEM_ABAS.indexOf(anterior) ? '1' : '-1');
      ui.vt = true;
      document.startViewTransition(render);
    } else {
      render();
    }
    if (window.scrollY > 260 && window.innerWidth < 900) window.scrollTo({ top: 0, behavior: reduzMovimento.matches ? 'auto' : 'smooth' });
  }

  window.addEventListener('resize', () => posicionarIndicador(true));
  if (document.fonts) document.fonts.ready.then(() => posicionarIndicador(true));

  document.querySelectorAll('.aba').forEach(b => {
    b.addEventListener('click', () => irPara(b.dataset.aba));
    b.addEventListener('keydown', e => {
      const abas = [...document.querySelectorAll('.aba')];
      const i = abas.indexOf(b);
      let alvo = null;
      if (e.key === 'ArrowRight') alvo = abas[(i + 1) % abas.length];
      if (e.key === 'ArrowLeft') alvo = abas[(i - 1 + abas.length) % abas.length];
      if (alvo) { e.preventDefault(); alvo.focus(); irPara(alvo.dataset.aba); }
    });
  });

  /* ================= cabeçalho ================= */

  function atualizarCabecalho() {
    const c = estado.campeonatoAtual;
    const n = c ? c.participantes.length : estado.selecao.length;
    const tag = $('#tagN');
    if (tag.textContent !== String(n)) {
      tag.textContent = n;
      tag.classList.remove('troca'); void tag.offsetWidth; tag.classList.add('troca');
    }
    const vivo = c && c.estado !== 'encerrado' && Copa.comecou(c);
    const abaVivo = $('#tab-aovivo');
    const bol = abaVivo.querySelector('.bolinha');
    if (vivo && !bol) abaVivo.insertAdjacentHTML('beforeend', '<span class="bolinha" aria-hidden="true"></span>');
    if (!vivo && bol) bol.remove();
  }

  function aplicarTema() {
    document.documentElement.style.setProperty('--accent', estado.tema.destaque);
  }

  /* ================= aba participantes ================= */

  function descreverFormato(n) {
    const erro = Copa.validarQuantidade(n);
    if (erro) return { ok: false, texto: '<strong>' + esc(erro) + '</strong>' };
    if (n === 2) return { ok: true, texto: '<strong>2 jogadores:</strong> partida única, direto na final.' };
    if (n === 3) return { ok: true, texto: '<strong>3 jogadores:</strong> Fase 1 com 3 jogos. 2º × 3º na semi. O 1º espera na final.' };
    const jogos = n * (n - 1) / 2;
    return { ok: true, texto: '<strong>' + n + ' jogadores:</strong> Fase 1 com ' + jogos + ' jogos. Semis 1º × 4º e 2º × 3º. Vencedores na final.' };
  }

  function viewParticipantes() {
    const c = estado.campeonatoAtual;
    const bloqueado = !!c;
    const ativos = estado.pessoas.filter(p => !p.removida);
    const formato = descreverFormato(estado.selecao.length);

    return '' +
      '<div class="grade-2">' +
        '<section class="painel" aria-labelledby="t-cadastro">' +
          '<h2 class="painel-titulo" id="t-cadastro">Cadastro geral <span class="contador">' + ativos.length + ' pessoas</span></h2>' +
          (bloqueado ? '<div class="bloqueio">' + ICONE.cadeado + '<span>Reinicie o campeonato para alterar os participantes.</span></div>' : '') +
          '<form class="add" id="formNome" autocomplete="off" novalidate>' +
            '<label class="sr" for="campoNome">Nome da pessoa</label>' +
            '<input class="campo" id="campoNome" maxlength="20" placeholder="Nome" ' + (bloqueado ? 'disabled' : '') + ' aria-describedby="dicaNome erroNome">' +
            '<button class="btn btn-acc" type="submit" ' + (bloqueado ? 'disabled' : '') + '>' + ICONE.mais + 'Adicionar</button>' +
          '</form>' +
          '<p class="dica" id="dicaNome"><span>Enter também adiciona.</span><span id="contaNome">0/20</span></p>' +
          '<p class="erro-msg" id="erroNome" role="alert">' + esc(ui.erroNome) + '</p>' +
          '<ul class="pessoas">' +
            ativos.map(p =>
              '<li class="pessoa" data-id="' + esc(p.id) + '">' +
                '<span class="avatar" aria-hidden="true">' + esc(iniciais(p.nome)) + '</span>' +
                '<span class="pessoa-nome">' + esc(p.nome) + '</span>' +
                '<button class="btn btn-perigo btn-mini" data-remover="' + esc(p.id) + '" ' + (bloqueado ? 'disabled' : '') + ' aria-label="Remover ' + esc(p.nome) + '">' + ICONE.lixo + '<span>Remover</span></button>' +
              '</li>').join('') +
          '</ul>' +
          (ativos.length === 0 ? '<p class="texto">Ninguém cadastrado. Adicione pelo menos 2 pessoas.</p>' : '') +
        '</section>' +

        '<div>' +
          '<section class="painel" aria-labelledby="t-selecao">' +
            '<h2 class="painel-titulo" id="t-selecao">Quem joga este campeonato <span class="contador">' + estado.selecao.length + ' de ' + Copa.MAX_JOGADORES + '</span></h2>' +
            '<div class="selecao" role="group" aria-labelledby="t-selecao">' +
              ativos.map(p => {
                const marcado = estado.selecao.includes(p.id);
                return '<div class="escolha">' +
                  '<input type="checkbox" id="sel-' + esc(p.id) + '" data-sel="' + esc(p.id) + '" ' + (marcado ? 'checked' : '') + ' ' + (bloqueado ? 'disabled' : '') + '>' +
                  '<label for="sel-' + esc(p.id) + '"><span class="marca">' + ICONE.check + '</span><span class="nome">' + esc(p.nome) + '</span></label>' +
                '</div>';
              }).join('') +
            '</div>' +
            '<div class="formato' + (formato.ok ? '' : ' invalido') + '" id="formato" aria-live="polite">' + formato.texto + '</div>' +
            (!bloqueado ? '<div class="acoes" style="margin-top:16px"><button class="btn btn-acc" id="irSorteio" ' + (formato.ok ? '' : 'disabled') + '>Ir para o sorteio' + ICONE.seta + '</button></div>' : '') +
          '</section>' +

          '<section class="painel" aria-labelledby="t-tema" style="margin-top:20px">' +
            '<h2 class="painel-titulo" id="t-tema">Cor de destaque</h2>' +
            '<div class="temas">' +
              Copa.DESTAQUES.map((cor, i) =>
                '<button class="tema" data-tema="' + cor + '" aria-pressed="' + (estado.tema.destaque === cor) + '">' +
                  '<span class="cor" style="background:' + cor + '"></span>' + ['Lima', 'Ouro', 'Menta'][i] +
                '</button>').join('') +
            '</div>' +
          '</section>' +
        '</div>' +
      '</div>';
  }

  function ligarParticipantes() {
    const form = $('#formNome');
    const campo = $('#campoNome');
    const conta = $('#contaNome');
    if (campo) campo.addEventListener('input', () => { conta.textContent = campo.value.length + '/20'; });

    form.addEventListener('submit', e => {
      e.preventDefault();
      if (estado.campeonatoAtual) return;
      const valor = campo.value.trim().replace(/\s+/g, ' ');
      let erro = '';
      if (!valor) erro = 'Digite um nome.';
      else if (valor.length > 20) erro = 'Use no máximo 20 caracteres.';
      else if (estado.pessoas.some(p => !p.removida && p.nome.toLocaleLowerCase('pt-BR') === valor.toLocaleLowerCase('pt-BR'))) erro = 'Já existe alguém com esse nome.';

      if (erro) {
        ui.erroNome = erro;
        $('#erroNome').textContent = erro;
        campo.classList.remove('shake'); void campo.offsetWidth; campo.classList.add('shake');
        campo.focus();
        return;
      }

      const antiga = estado.pessoas.find(p => p.removida && p.nome.toLocaleLowerCase('pt-BR') === valor.toLocaleLowerCase('pt-BR'));
      let id;
      if (antiga) {
        antiga.removida = false;
        antiga.nome = valor;
        id = antiga.id;
        toast(valor + ' voltou ao cadastro, com o histórico de títulos.');
      } else {
        id = Copa.gerarId('p');
        estado.pessoas.push({ id, nome: valor, removida: false });
        toast(valor + ' cadastrado.');
      }
      if (estado.selecao.length < Copa.MAX_JOGADORES) estado.selecao.push(id);
      ui.erroNome = '';
      salvar();
      render();
      const novo = $('#campoNome');
      if (novo) novo.focus();
    });

    document.querySelectorAll('[data-remover]').forEach(b => {
      b.addEventListener('click', () => {
        const id = b.dataset.remover;
        confirmar({
          titulo: 'Remover ' + nome(id) + '?',
          texto: 'Sai do cadastro, mas os títulos e vices continuam no ranking com o rótulo "(removido)".',
          ok: 'Remover',
          perigo: true,
          aoConfirmar: () => {
            const li = b.closest('.pessoa');
            const concluir = () => {
              pessoa(id).removida = true;
              estado.selecao = estado.selecao.filter(x => x !== id);
              salvar();
              render();
            };
            if (li && !reduzMovimento.matches) {
              li.classList.add('saindo');
              setTimeout(concluir, 280);
            } else concluir();
          }
        });
      });
    });

    document.querySelectorAll('[data-sel]').forEach(chk => {
      chk.addEventListener('change', () => {
        const id = chk.dataset.sel;
        if (chk.checked) {
          if (estado.selecao.length >= Copa.MAX_JOGADORES) {
            chk.checked = false;
            toast('O máximo é 8 jogadores por campeonato.', 'erro');
            return;
          }
          estado.selecao.push(id);
        } else {
          estado.selecao = estado.selecao.filter(x => x !== id);
        }
        salvar();
        const f = descreverFormato(estado.selecao.length);
        const caixa = $('#formato');
        caixa.className = 'formato' + (f.ok ? '' : ' invalido');
        caixa.innerHTML = f.texto;
        const ir = $('#irSorteio');
        if (ir) ir.disabled = !f.ok;
        document.querySelector('#t-selecao .contador').textContent = estado.selecao.length + ' de ' + Copa.MAX_JOGADORES;
        atualizarCabecalho();
      });
    });

    const ir = $('#irSorteio');
    if (ir) ir.addEventListener('click', () => irPara('campeonato'));

    document.querySelectorAll('[data-tema]').forEach(b => {
      b.addEventListener('click', () => {
        estado.tema = { destaque: b.dataset.tema };
        aplicarTema();
        salvar();
        document.querySelectorAll('[data-tema]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      });
    });
  }

  /* ================= chaveamento ================= */

  function placarDe(m) {
    if (!m || !m.resultado) return '';
    const s = Copa.estadoSerie(m.resultado);
    return s.golsA + '–' + s.golsB;
  }

  function slot(id, rolar, chega) {
    const txt = id ? esc(nome(id)) : '';
    const cls = 'slot' + (rolar ? ' rolando' : '') + (chega ? ' chega' : '');
    return '<span class="' + cls + '"' + (rolar ? ' data-final="' + txt + '"' : '') + '>' + txt + '</span>';
  }

  const chegou = (vivo, m, lado) => !!(vivo && m && vivo.chegou.has(m.id + ':' + lado));
  const clsAcabou = (vivo, m) => vivo && m && vivo.acabou === m.id ? ' acabou' : '';
  const clsBump = (vivo, m) => vivo && m && vivo.mudou === m.id ? ' bump' : '';

  function cartaoFase1(c, m, atualId, rolar, idx, vivo) {
    const estadoCls = (m.encerrada ? 'encerrada' : (m.id === atualId ? 'jogando' : '')) + clsAcabou(vivo, m);
    const num = id => c.participantes.length >= 4 ? '<span class="num">#' + c.numeros[id] + '</span>' : '';
    const cls = id => m.vencedor && m.vencedor !== id ? ' class="perdeu"' : '';
    let meta;
    if (m.vencedor) meta = 'Venceu ' + esc(nome(m.vencedor));
    else if (m.encerrada) meta = 'Empate';
    else meta = m.id === atualId ? 'Próximo' : 'Jogo ' + (idx + 1);
    return '' +
      '<article class="cartao ' + estadoCls + '" data-lock="' + idx + '">' +
        '<div class="cartao-linha">' +
          '<div class="confronto"><span' + cls(m.a) + '>' + num(m.a) + slot(m.a, rolar) + '</span><span class="x">×</span><span' + cls(m.b) + '>' + num(m.b) + slot(m.b, rolar) + '</span></div>' +
          '<span class="placar-mini' + clsBump(vivo, m) + '">' + placarDe(m) + '</span>' +
        '</div>' +
        '<div class="meta">' + meta + '</div>' +
      '</article>';
  }

  function cartaoSemi(c, m, idx, atualId, vivo) {
    const n = c.participantes.length;
    let a, b;
    if (m) {
      a = slot(m.a, false, chegou(vivo, m, 'a')); b = slot(m.b, false, chegou(vivo, m, 'b'));
    } else if (n === 3) {
      a = '2º'; b = '3º';
    } else {
      a = idx === 0 ? '1º' : '2º'; b = idx === 0 ? '4º' : '3º';
    }
    const emJogo = m && m.id === atualId;
    const titulo = n === 3 ? 'Semi' : 'Semi ' + (idx + 1);
    return '' +
      '<article class="cartao cartao-semi' + (emJogo ? ' jogando' : '') + (m ? '' : ' pendente') + clsAcabou(vivo, m) + '">' +
        '<div class="titulo-semi">' + titulo + (emJogo ? ' · em jogo' : '') + '</div>' +
        '<div class="cartao-linha" style="justify-content:center">' +
          '<div class="confronto" style="justify-content:center;font-size:' + (m ? '17px' : '22px') + '">' +
            '<span' + (m && m.vencedor && m.vencedor !== m.a ? ' class="perdeu"' : '') + '>' + a + '</span><span class="x">×</span>' +
            '<span' + (m && m.vencedor && m.vencedor !== m.b ? ' class="perdeu"' : '') + '>' + b + '</span>' +
          '</div>' +
        '</div>' +
        (m && m.resultado ? '<div style="text-align:center;margin-top:4px"><span class="placar-mini' + clsBump(vivo, m) + '">' + placarDe(m) + '</span></div>' : '') +
      '</article>';
  }

  function cartaoFinal(c, atualId, rolar, vivo) {
    const n = c.participantes.length;
    const f = c.final;
    const vagaA = f && f.a ? slot(f.a, rolar, chegou(vivo, f, 'a')) : (n === 3 ? '1º da Fase 1' : 'Vencedor da semi 1');
    const vagaB = f && f.b ? slot(f.b, rolar, chegou(vivo, f, 'b')) : (n === 3 ? 'Vencedor da semi' : 'Vencedor da semi 2');
    const emJogo = f && f.id === atualId;
    return '' +
      '<article class="cartao cartao-final' + (emJogo ? ' jogando' : '') + clsAcabou(vivo, f) + '">' +
        '<div class="titulo-final">Final' + (emJogo ? ' · em jogo' : '') + '</div>' +
        '<div class="vaga' + (f && f.a ? '' : ' vazia') + (f && f.vencedor && f.vencedor !== f.a ? ' perdeu' : '') + '">' + vagaA + '</div>' +
        '<div class="vaga' + (f && f.b ? '' : ' vazia') + (f && f.vencedor && f.vencedor !== f.b ? ' perdeu' : '') + '">' + vagaB + '</div>' +
        (f && f.resultado ? '<div style="margin-top:8px"><span class="placar-mini' + clsBump(vivo, f) + '">' + placarDe(f) + '</span></div>' : '') +
      '</article>';
  }

  function chaveamento(c, rolar, vivo) {
    const n = c.participantes.length;
    const atual = Copa.partidaAtual(c);
    const atualId = atual && atual.a && atual.b ? atual.id : null;

    const final = cartaoFinal(c, atualId, rolar, vivo);
    const selo = '<div class="haste"></div>' +
      '<div class="selo' + (c.campeao ? ' carimba' : '') + '">' + (c.campeao ? '<small>Campeão</small>' + esc(nome(c.campeao)) : 'Campeão') + '</div>';

    if (n === 2) {
      return '<div class="chave so-final"><div class="col">' + final + selo + '</div></div>';
    }

    const fase1 = '<div class="col"><p class="col-rotulo">Fase 1 · todos contra todos</p>' +
      c.fase1.map((m, i) => cartaoFase1(c, m, atualId, rolar, i, vivo)).join('') + '</div>';

    let semis;
    if (n === 3) {
      semis = '<div class="col"><div class="direto">1º direto</div>' + cartaoSemi(c, c.semis[0], 0, atualId, vivo) + '</div>';
    } else {
      semis = '<div class="col"><p class="col-rotulo">Semifinais</p>' + cartaoSemi(c, c.semis[0], 0, atualId, vivo) + cartaoSemi(c, c.semis[1], 1, atualId, vivo) + '</div>';
    }

    return '<div class="chave">' + fase1 + '<div class="liga" aria-hidden="true"></div>' + semis +
      '<div class="liga' + (n === 3 ? ' reta' : '') + '" aria-hidden="true"></div><div class="col">' + final + selo + '</div></div>';
  }

  function tabelaClassificacao(c, titulo) {
    if (c.participantes.length < 3) return '';
    const { tabela } = Copa.classificar(c.participantes, c.fase1, c.desempates);
    const n = c.participantes.length;
    const classe = pos => {
      if (n === 3) return pos === 1 ? 'vaga-direta' : 'vaga-semi';
      return pos <= 4 ? 'vaga-semi' : '';
    };
    const legenda = n === 3
      ? '<span><i style="background:var(--accent)"></i>Direto na final</span><span><i style="background:var(--fg-soft)"></i>Semifinal</span>'
      : '<span><i style="background:var(--fg-soft)"></i>Semifinais (1º × 4º, 2º × 3º)</span>';
    return '' +
      '<section class="painel" aria-labelledby="t-classif">' +
        '<h2 class="painel-titulo" id="t-classif">' + (titulo || 'Classificação · Fase 1') + '</h2>' +
        '<div class="tabela-wrap"><table>' +
          '<thead><tr><th scope="col"><span class="sr">Posição</span></th><th scope="col" class="esq">Jogador</th><th scope="col" title="Jogos">J</th><th scope="col" title="Vitórias">V</th><th scope="col" title="Empates">E</th><th scope="col" title="Derrotas">D</th><th scope="col" class="col-opc" title="Gols pró">GP</th><th scope="col" class="col-opc" title="Gols contra">GC</th><th scope="col" title="Saldo de gols">SG</th><th scope="col" title="Pontos">PTS</th></tr></thead>' +
          '<tbody>' + tabela.map(l =>
            '<tr class="' + classe(l.pos) + '" data-flip="cl:' + esc(l.id) + '">' +
              '<td class="pos"><span>' + l.pos + '</span></td>' +
              '<td class="esq jogador">' + esc(nome(l.id)) + '</td>' +
              '<td>' + l.j + '</td><td>' + l.v + '</td><td>' + l.e + '</td><td>' + l.d + '</td>' +
              '<td class="col-opc">' + l.gp + '</td><td class="col-opc">' + l.gc + '</td>' +
              '<td>' + (l.sg > 0 ? '+' : '') + l.sg + '</td>' +
              '<td class="pts">' + l.pts + '</td>' +
            '</tr>').join('') + '</tbody>' +
        '</table></div>' +
        '<div class="legenda">' + legenda + '</div>' +
        '<p class="regras">Vitória vale 3 pontos, empate 1. Empate na pontuação: saldo de gols.</p>' +
      '</section>';
  }

  /* ================= aba campeonato ================= */

  function viewCampeonato() {
    const c = estado.campeonatoAtual;

    if (!c) {
      const f = descreverFormato(estado.selecao.length);
      const nomes = estado.selecao.map(id => esc(nome(id))).join(', ');
      return '' +
        '<section class="painel vazio">' +
          mesaGol({ heroi: true }) +
          '<h2>Sorteio da chave</h2>' +
          '<p class="texto">' + (estado.selecao.length ? nomes : 'Nenhum jogador selecionado.') + '</p>' +
          '<div class="formato' + (f.ok ? '' : ' invalido') + '" style="max-width:520px;margin:16px auto 0">' + f.texto + '</div>' +
          '<div class="acoes">' +
            '<button class="btn btn-acc btn-grande" id="sortear" ' + (f.ok ? '' : 'disabled') + '>' + ICONE.sorteio + 'Sortear chave</button>' +
            '<button class="btn btn-linha" id="editarSel">Escolher jogadores</button>' +
          '</div>' +
          '<p class="regras">Vitória vale 3 pontos, empate 1. Empate na pontuação: saldo de gols.</p>' +
        '</section>';
    }

    const comecou = Copa.comecou(c);
    const acoes = comecou
      ? '<button class="btn btn-perigo" id="reiniciar">' + ICONE.reiniciar + 'Reiniciar campeonato</button>'
      : '<button class="btn btn-linha" id="sortear">' + ICONE.sorteio + 'Sortear de novo</button>';
    const irVivo = c.estado === 'encerrado'
      ? '<button class="btn btn-acc" id="irVivo">Ver campeão' + ICONE.seta + '</button>'
      : '<button class="btn btn-acc" id="irVivo">' + (comecou ? 'Voltar ao ao vivo' : 'Começar ao vivo') + ICONE.seta + '</button>';

    return '' +
      '<section class="painel" aria-labelledby="t-chave">' +
        '<h2 class="painel-titulo" id="t-chave">Chaveamento <span class="contador">' + rotuloEstado(c) + '</span></h2>' +
        '<div id="chave">' + chaveamento(c, false) + '</div>' +
        '<div class="acoes" style="margin-top:22px">' + irVivo + acoes + '</div>' +
        (c.participantes.length < 3 ? '<p class="regras">Final direta: lance o placar, sem empate.</p>' : '') +
      '</section>' +
      tabelaClassificacao(c);
  }

  function rotuloEstado(c) {
    if (c.estado === 'encerrado') return 'encerrado';
    if (c.empatePendente) return 'desempate pendente';
    if (c.estado === 'fase1') {
      const feitos = c.fase1.filter(m => m.encerrada).length;
      return 'Fase 1 · ' + feitos + '/' + c.fase1.length;
    }
    return c.estado === 'semis' ? 'Semifinal' : 'Final';
  }

  function ligarCampeonato() {
    const sortear = $('#sortear');
    if (sortear) sortear.addEventListener('click', sortearChave);
    const editar = $('#editarSel');
    if (editar) editar.addEventListener('click', () => irPara('participantes'));
    const irVivo = $('#irVivo');
    if (irVivo) irVivo.addEventListener('click', () => irPara('aovivo'));
    const reiniciar = $('#reiniciar');
    if (reiniciar) reiniciar.addEventListener('click', () => {
      confirmar({
        titulo: 'Reiniciar campeonato?',
        texto: 'Todos os resultados deste campeonato serão apagados. O histórico de campeões não muda.',
        ok: 'Reiniciar',
        perigo: true,
        aoConfirmar: () => {
          estado.campeonatoAtual = null;
          ui.resultadoVisivel = null;
          salvar();
          render();
          toast('Campeonato reiniciado.');
        }
      });
    });
  }

  function sortearChave() {
    const erro = Copa.validarQuantidade(estado.selecao.length);
    if (erro) { toast(erro, 'erro'); return; }
    if (ui.sorteando) return;

    const novo = Copa.criarCampeonato(estado.selecao.slice());
    estado.campeonatoAtual = novo;
    ui.resultadoVisivel = null;
    salvar();

    if (reduzMovimento.matches) { render(); toast('Chave sorteada.'); return; }

    ui.sorteando = true;
    render();
    const alvo = $('#chave');
    alvo.innerHTML = chaveamento(novo, true);
    document.querySelectorAll('#sortear, #irVivo, #reiniciar').forEach(b => { b.disabled = true; });

    const nomes = novo.participantes.map(nome);
    const cartoes = [...alvo.querySelectorAll('.cartao')].filter(el => el.querySelector('.slot.rolando'));
    const inicio = performance.now();
    const DURACAO = 2000;
    const travas = cartoes.map((_, i) => 500 + (i + 1) * (DURACAO - 500) / cartoes.length);

    let ultimoTique = 0;
    function quadro(t) {
      const dt = t - inicio;
      if (t - ultimoTique > 60) {
        ultimoTique = t;
        cartoes.forEach((card, i) => {
          if (dt >= travas[i]) {
            if (!card.dataset.travado) {
              card.dataset.travado = '1';
              card.querySelectorAll('.slot.rolando').forEach(s => {
                s.textContent = s.dataset.final;
                s.classList.remove('rolando');
                s.classList.add('travou');
              });
              vibrar(12);
            }
            return;
          }
          card.querySelectorAll('.slot.rolando').forEach(s => {
            s.textContent = nomes[Math.floor(Math.random() * nomes.length)];
          });
        });
      }
      if (dt < DURACAO + 250) requestAnimationFrame(quadro);
      else {
        ui.sorteando = false;
        render();
        toast('Chave sorteada.');
      }
    }
    requestAnimationFrame(quadro);
  }

  /* ================= aba ao vivo ================= */

  function acharPartida(c, id) {
    return c.fase1.concat(c.semis).concat(c.final ? [c.final] : []).find(m => m.id === id) || null;
  }

  function rotuloPartida(c, m) {
    const i = c.fase1.indexOf(m);
    if (i >= 0) return 'Fase 1 · jogo ' + (i + 1) + ' de ' + c.fase1.length;
    const s = c.semis.indexOf(m);
    if (s >= 0) return c.semis.length > 1 ? 'Semifinal ' + (s + 1) : 'Semifinal';
    return 'Final';
  }

  function todasPartidas(c) {
    return c.fase1.concat(c.semis).concat(c.final ? [c.final] : []);
  }

  // O que mudou na chave entre dois estados: alimenta as animações do modo Chave.
  function diferenca(antes, depois) {
    const r = { mudou: null, acabou: null, chegou: new Set() };
    if (!antes || !depois || antes.id !== depois.id) return r;
    const anterior = new Map(todasPartidas(antes).map(m => [m.id, m]));
    for (const m of todasPartidas(depois)) {
      const a = anterior.get(m.id);
      if (a && !a.resultado && m.resultado) r.mudou = m.id;
      if (m.encerrada && (!a || !a.encerrada)) r.acabou = m.id;
      for (const lado of ['a', 'b']) {
        if (m[lado] && (!a || !a[lado])) r.chegou.add(m.id + ':' + lado);
      }
    }
    return r;
  }

  function seletorModo() {
    const b = (modo, rotulo, icone) =>
      '<button class="seg" data-modo="' + modo + '" aria-pressed="' + (estado.modoVivo === modo) + '">' + icone + rotulo + '</button>';
    return '<div class="segmento" role="group" aria-label="Visualização do ao vivo">' +
      b('placar', 'Placar', ICONE.placar) + b('chave', 'Chave', ICONE.chave) + '</div>';
  }

  function textoProximo(c, m) {
    if (c.estado === 'encerrado') return 'Ver campeão';
    if (c.empatePendente) return 'Ir para o desempate';
    if (c.estado === 'semis' && c.fase1.length && c.fase1[c.fase1.length - 1] === m) return 'Ir para a semifinal';
    if (c.estado === 'final' && m !== c.final && c.semis.indexOf(m) === c.semis.length - 1) return 'Ir para a final';
    return 'Próxima partida';
  }

  function viewChaveVivo(c, m, encerrada) {
    const vivo = ui.diff;
    ui.diff = null;

    const desfazerBtn = '<button class="btn btn-linha icone-so" id="desfazer" aria-label="Desfazer último resultado" title="Desfazer último resultado" ' +
      (Copa.podeDesfazer(c) ? '' : 'disabled') + '>' + ICONE.desfazer + '</button>';

    let acao;
    if (encerrada) {
      const s = Copa.estadoSerie(m.resultado);
      const texto = m.vencedor
        ? '<span>' + esc(nome(m.vencedor)) + '</span> vence ' + s.golsA + ' × ' + s.golsB
        : 'Empate ' + s.golsA + ' × ' + s.golsB;
      acao = '' +
        '<p class="mini-venc">' + texto + '</p>' +
        '<div class="rodape-vivo" style="margin-top:12px"><button class="btn btn-acc" id="proxima">' + textoProximo(c, m) + ICONE.seta + '</button></div>';
    } else {
      acao = formResultado(c, m);
    }

    const rotulo = rotuloPartida(c, m) + (encerrada ? ' · fim de jogo' : '');
    const mostraTabela = c.fase1.length && (c.estado === 'fase1' || c.fase1.indexOf(m) >= 0);

    return seletorModo() +
      '<section class="painel mini-vivo" aria-labelledby="t-mini">' +
        '<div class="mini-topo"><h2 class="fase-rotulo" id="t-mini">' + rotulo + '</h2>' + desfazerBtn + '</div>' +
        (encerrada ? '<div class="compacto">' + blocoPlacar(m, Copa.estadoSerie(m.resultado)) + '</div>' : '') +
        acao +
      '</section>' +
      '<section class="painel" aria-labelledby="t-chave-vivo">' +
        '<h2 class="painel-titulo" id="t-chave-vivo">Chaveamento <span class="contador">' + rotuloEstado(c) + '</span></h2>' +
        chaveamento(c, false, vivo) +
      '</section>' +
      (mostraTabela ? tabelaClassificacao(c) : '');
  }

  function blocoPlacar(m, s) {
    const ant = ui.placarAnterior && ui.placarAnterior.id === m.id ? ui.placarAnterior : null;
    const bumpA = ant && s.golsA !== ant.a ? ' bump' : '';
    const bumpB = ant && s.golsB !== ant.b ? ' bump' : '';
    ui.placarAnterior = { id: m.id, a: s.golsA, b: s.golsB };
    const lado = (id, l) => '' +
      '<div class="lado">' +
        '<span class="lado-nome" style="--len:' + Math.max(5, ...nome(id).split(/\s+/).map(p => p.length)) + '">' + esc(nome(id)) + '</span>' +
      '</div>';
    return '' +
      '<div class="placar">' +
        lado(m.a, 'a') +
        '<div class="gols" aria-label="Placar ' + s.golsA + ' a ' + s.golsB + '"><span class="n' + bumpA + '">' + s.golsA + '</span><span class="sep">–</span><span class="n' + bumpB + '">' + s.golsB + '</span></div>' +
        lado(m.b, 'b') +
      '</div>';
  }

  function artePalco(chute) {
    return '<div class="palco-arte">' + mesaGol(chute && !reduzMovimento.matches ? { chute } : {}) + '</div>';
  }

  function contarAte(els) {
    if (reduzMovimento.matches) return;
    els.forEach(el => {
      const alvo = parseInt(el.textContent, 10);
      if (!alvo) return;
      const dur = Math.min(900, 300 + alvo * 90);
      const t0 = performance.now();
      el.textContent = '0';
      const passo = t => {
        const p = Math.min(1, (t - t0) / dur);
        el.textContent = String(Math.round(alvo * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(passo);
      };
      requestAnimationFrame(passo);
    });
  }

  function formResultado(c, m) {
    const podeEmpatar = Copa.permiteEmpate(c, m);
    const lado = (id, campo) => '' +
      '<div class="lado-input" id="lado-' + campo + '">' +
        '<label class="lado-nome" for="' + campo + '" style="--len:' + Math.max(5, ...nome(id).split(/\s+/).map(p => p.length)) + '">' + esc(nome(id)) + '</label>' +
        '<div class="stepper">' +
          '<button type="button" class="passo" data-passo="-1" data-alvo="' + campo + '" aria-label="Menos um gol para ' + esc(nome(id)) + '">−</button>' +
          '<input class="campo campo-placar" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="off" id="' + campo + '" placeholder="0" aria-label="Gols de ' + esc(nome(id)) + '">' +
          '<button type="button" class="passo" data-passo="1" data-alvo="' + campo + '" aria-label="Mais um gol para ' + esc(nome(id)) + '">+</button>' +
        '</div>' +
      '</div>';
    return '' +
      '<form class="form-resultado" id="formResultado" novalidate data-empate="' + podeEmpatar + '" data-nome-a="' + esc(nome(m.a)) + '" data-nome-b="' + esc(nome(m.b)) + '">' +
        '<div class="placar-input">' +
          lado(m.a, 'placarA') +
          '<span class="sep" aria-hidden="true">×</span>' +
          lado(m.b, 'placarB') +
        '</div>' +
        '<p class="veredito" id="veredito" aria-live="polite">' + (podeEmpatar ? 'Fase de grupos · empate vale 1 ponto' : 'Mata-mata · precisa de vencedor') + '</p>' +
        '<p class="erro-msg" id="erroResultado" role="alert">' + esc(ui.erroResultado || '') + '</p>' +
        '<button class="btn btn-acc btn-grande" type="submit" id="btnConfirmar">Confirmar resultado' + ICONE.seta + '</button>' +
      '</form>';
  }

  function lerPlacar(campo) {
    const v = campo.value.trim();
    return v === '' ? NaN : parseInt(v, 10);
  }

  function atualizarVeredito() {
    const form = $('#formResultado');
    if (!form) return;
    const a = lerPlacar($('#placarA')), b = lerPlacar($('#placarB'));
    const podeEmpatar = form.dataset.empate === 'true';
    const nA = esc(form.dataset.nomeA), nB = esc(form.dataset.nomeB);
    const ladoA = $('#lado-placarA'), ladoB = $('#lado-placarB');
    const ver = $('#veredito');
    let html, aviso = false, pronto = false;
    if (isNaN(a) && isNaN(b)) html = podeEmpatar ? 'Fase de grupos · empate vale 1 ponto' : 'Mata-mata · precisa de vencedor';
    else if (isNaN(a) || isNaN(b)) html = 'Falta o placar de ' + (isNaN(a) ? nA : nB);
    else if (a === b) {
      html = podeEmpatar ? 'Empate ' + a + ' × ' + b : 'Empate não vale no mata-mata';
      aviso = !podeEmpatar; pronto = podeEmpatar;
    } else {
      html = '<span class="acc">' + (a > b ? nA : nB) + '</span> vence ' + a + ' × ' + b;
      pronto = true;
    }
    ladoA.classList.toggle('lider', !isNaN(a) && !isNaN(b) && a > b);
    ladoB.classList.toggle('lider', !isNaN(a) && !isNaN(b) && b > a);
    ladoA.classList.toggle('empate', pronto && a === b);
    ladoB.classList.toggle('empate', pronto && a === b);
    if (ver.innerHTML !== html) {
      ver.innerHTML = html;
      ver.classList.remove('muda'); void ver.offsetWidth; ver.classList.add('muda');
    }
    ver.classList.toggle('aviso', aviso);
    $('#btnConfirmar').classList.toggle('pronto', pronto);
    if (pronto || aviso) $('#erroResultado').textContent = '';
  }

  function ligarResultado() {
    const form = $('#formResultado');
    if (!form) return;
    const pulsar = el => { el.classList.remove('pulsa'); void el.offsetWidth; el.classList.add('pulsa'); };
    form.querySelectorAll('.campo-placar').forEach(campo => {
      campo.addEventListener('input', () => {
        const limpo = campo.value.replace(/\D/g, '').slice(0, 2);
        if (limpo !== campo.value) campo.value = limpo;
        atualizarVeredito();
      });
      campo.addEventListener('focus', () => campo.select());
      campo.addEventListener('keydown', e => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          form.querySelector('[data-alvo="' + campo.id + '"][data-passo="' + (e.key === 'ArrowUp' ? 1 : -1) + '"]').click();
        }
        if (e.key === 'Enter' && campo.id === 'placarA' && $('#placarB').value === '') {
          e.preventDefault();
          $('#placarB').focus();
        }
      });
    });
    form.querySelectorAll('[data-passo]').forEach(b => {
      b.addEventListener('click', () => {
        const campo = $('#' + b.dataset.alvo);
        const atual = parseInt(campo.value, 10) || 0;
        campo.value = String(Math.max(0, Math.min(99, atual + Number(b.dataset.passo))));
        pulsar(campo);
        vibrar(12);
        atualizarVeredito();
      });
    });
    if (window.matchMedia('(pointer: fine)').matches) $('#placarA').focus({ preventScroll: true });
  }

  function viewAoVivo() {
    const c = estado.campeonatoAtual;
    if (!c) {
      return '' +
        '<section class="painel vazio">' +
          mesaGol({}) +
          '<h2>Nenhum campeonato sorteado</h2>' +
          '<p class="texto">Sorteie a chave para começar a lançar os resultados.</p>' +
          '<div class="acoes"><button class="btn btn-acc" id="irCamp">Ir para Campeonato' + ICONE.seta + '</button></div>' +
        '</section>';
    }

    const modoChave = estado.modoVivo === 'chave';
    if (ui.resultadoVisivel) {
      const m = acharPartida(c, ui.resultadoVisivel);
      if (m && m.encerrada) return modoChave ? viewChaveVivo(c, m, true) : viewResultado(c, m);
      ui.resultadoVisivel = null;
    }
    if (c.estado === 'encerrado') return viewCampeao(c);
    if (c.empatePendente || ui.desempateRevelado) return viewDesempate(c);

    const m = Copa.partidaAtual(c);
    if (!m || !m.a || !m.b) return '<section class="painel vazio"><h2>Aguardando a próxima partida</h2></section>';
    if (modoChave) return viewChaveVivo(c, m, false);
    ui.diff = null;

    const proximas = c.estado === 'fase1'
      ? c.fase1.filter(x => !x.encerrada && x !== m).slice(0, 3)
      : [];

    return seletorModo() +
      '<section class="painel palco" aria-labelledby="t-vivo">' +
        '<h2 class="fase-rotulo" id="t-vivo">' + rotuloPartida(c, m) + '</h2>' +
        artePalco() +
        formResultado(c, m) +
        '<div class="rodape-vivo">' +
          '<button class="btn btn-linha btn-mini" id="desfazer" ' + (Copa.podeDesfazer(c) ? '' : 'disabled') + '>' + ICONE.desfazer + 'Desfazer último resultado</button>' +
        '</div>' +
      '</section>' +
      (proximas.length ? '' +
        '<section class="painel" aria-labelledby="t-prox">' +
          '<h2 class="painel-titulo" id="t-prox">Próximos jogos</h2>' +
          '<ul class="proximas">' + proximas.map(x =>
            '<li><span>' + esc(nome(x.a)) + ' × ' + esc(nome(x.b)) + '</span><span class="meta">Jogo ' + (c.fase1.indexOf(x) + 1) + '</span></li>').join('') +
          '</ul>' +
        '</section>' : '') +
      (c.estado === 'fase1' ? tabelaClassificacao(c) : '');
  }

  function viewResultado(c, m) {
    const s = Copa.estadoSerie(m.resultado);
    const proximo = textoProximo(c, m);
    ui.diff = null;

    const resumo = m.vencedor
      ? '<p class="vencedor"><span>' + esc(nome(m.vencedor)) + '</span> vence</p>' +
        '<p class="texto">' + s.golsA + ' × ' + s.golsB + ' contra ' + esc(nome(m.vencedor === m.a ? m.b : m.a)) + '.</p>'
      : '<p class="vencedor">Empate</p>' +
        '<p class="texto">' + s.golsA + ' × ' + s.golsB + ' entre ' + esc(nome(m.a)) + ' e ' + esc(nome(m.b)) + '.</p>';

    return seletorModo() +
      '<section class="painel palco fim-jogo" aria-labelledby="t-fim">' +
        '<h2 class="fase-rotulo" id="t-fim">' + rotuloPartida(c, m) + ' · fim de jogo</h2>' +
        artePalco(ui.comemorar ? (m.vencedor ? 'gol' : 'trave') : null) +
        resumo +
        blocoPlacar(m, s).replace('class="placar"', 'class="placar" style="margin-top:18px"') +
        '<div class="rodape-vivo" style="margin-top:24px">' +
          '<button class="btn btn-acc btn-grande" id="proxima">' + proximo + ICONE.seta + '</button>' +
        '</div>' +
        '<div class="rodape-vivo">' +
          '<button class="btn btn-linha btn-mini" id="desfazer" ' + (Copa.podeDesfazer(c) ? '' : 'disabled') + '>' + ICONE.desfazer + 'Desfazer último resultado</button>' +
        '</div>' +
      '</section>' +
      (c.fase1.indexOf(m) >= 0 ? tabelaClassificacao(c, 'Classificação atualizada') : '');
  }

  function viewDesempate(c) {
    if (ui.desempateRevelado) {
      const proximo = c.empatePendente ? 'Próximo desempate' : 'Seguir para a semifinal';
      return '' +
        '<section class="painel palco" aria-labelledby="t-des">' +
          '<h2 class="fase-rotulo" id="t-des">Desempate por sorteio · resultado</h2>' +
          '<ol class="desempate-lista final">' + ui.desempateRevelado.map(id => '<li>' + esc(nome(id)) + '</li>').join('') + '</ol>' +
          '<div class="rodape-vivo" style="margin-top:24px"><button class="btn btn-acc btn-grande" id="seguirDes">' + proximo + ICONE.seta + '</button></div>' +
          '<div class="rodape-vivo"><button class="btn btn-linha btn-mini" id="desfazer">' + ICONE.desfazer + 'Desfazer último resultado</button></div>' +
        '</section>' + tabelaClassificacao(c);
    }
    const grupo = c.empatePendente;
    return '' +
      '<section class="painel palco" aria-labelledby="t-des">' +
        '<h2 class="fase-rotulo" id="t-des">Desempate por sorteio</h2>' +
        '<p class="texto" style="margin-top:12px">Empate em pontos, saldo, gols marcados e confronto direto entre ' + grupo.map(id => esc(nome(id))).join(', ') + '. A ordem sai no sorteio.</p>' +
        '<ol class="desempate-lista" id="listaDes">' + grupo.map(id => '<li>' + esc(nome(id)) + '</li>').join('') + '</ol>' +
        '<div class="rodape-vivo" style="margin-top:24px"><button class="btn btn-acc btn-grande" id="sortearDes">' + ICONE.sorteio + 'Sortear desempate</button></div>' +
        '<div class="rodape-vivo"><button class="btn btn-linha btn-mini" id="desfazer" ' + (Copa.podeDesfazer(c) ? '' : 'disabled') + '>' + ICONE.desfazer + 'Desfazer último resultado</button></div>' +
      '</section>' + tabelaClassificacao(c);
  }

  function viewCampeao(c) {
    const jaSalvo = c.salvo || estado.historico.some(h => h.campeonatoId === c.id);
    const letras = [...nome(c.campeao)].map((ch, i) =>
      ch === ' ' ? ' ' : '<span class="letra" style="animation-delay:' + (0.35 + i * 0.05).toFixed(2) + 's">' + esc(ch) + '</span>').join('');
    return '' +
      '<section class="painel campeao" aria-labelledby="t-camp">' +
        '<canvas id="festa" aria-hidden="true"></canvas>' +
        '<h2 class="sr" id="t-camp">Campeão</h2>' +
        '<div class="selo carimba">Campeão</div>' +
        '<p class="campeao-nome" aria-label="' + esc(nome(c.campeao)) + '">' + letras + '</p>' +
        '<p class="vice">Vice: ' + esc(nome(c.vice)) + ' · Final ' + placarDe(c.final).replace('–', ' × ') + '</p>' +
        '<div class="acoes">' +
          (jaSalvo
            ? '<span class="salvo-ok">' + ICONE.check + 'Salvo no histórico</span>'
            : '<button class="btn btn-acc btn-grande" id="salvarHist">Salvar no histórico</button>') +
          '<button class="btn btn-linha" id="novoCamp">' + ICONE.reiniciar + 'Novo campeonato</button>' +
        '</div>' +
        (!jaSalvo ? '<div class="rodape-vivo"><button class="btn btn-linha btn-mini" id="desfazer">' + ICONE.desfazer + 'Desfazer último resultado</button></div>' : '') +
      '</section>' +
      '<section class="painel" aria-labelledby="t-chave-final"><h2 class="painel-titulo" id="t-chave-final">Chave final</h2>' + chaveamento(c, false) + '</section>';
  }

  function festa() {
    const cv = $('#festa');
    if (!cv || reduzMovimento.matches) return;
    const ctx = cv.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth, h = cv.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    ctx.scale(dpr, dpr);
    const cores = [estado.tema.destaque, '#F4F7EF', '#B8C9BD'];
    const pecas = Array.from({ length: 90 }, () => ({
      x: w / 2 + (Math.random() - 0.5) * 80,
      y: h * 0.32,
      vx: (Math.random() - 0.5) * 11,
      vy: -Math.random() * 11 - 4,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      s: 5 + Math.random() * 7,
      cor: cores[Math.floor(Math.random() * cores.length)],
      forma: Math.random() < 0.5 ? 'q' : 'l'
    }));
    const t0 = performance.now();
    (function passo(t) {
      if (!document.contains(cv)) return;
      const dt = t - t0;
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = Math.max(0, 1 - dt / 2600);
      for (const p of pecas) {
        p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.cor;
        if (p.forma === 'q') ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s);
        else ctx.fillRect(-p.s, -1.5, p.s * 2, 3);
        ctx.restore();
      }
      if (dt < 2600) requestAnimationFrame(passo);
    })(t0);
  }

  function ligarAoVivo() {
    const irCamp = $('#irCamp');
    if (irCamp) irCamp.addEventListener('click', () => irPara('campeonato'));

    document.querySelectorAll('[data-modo]').forEach(b => {
      b.addEventListener('click', () => {
        if (estado.modoVivo === b.dataset.modo) return;
        estado.modoVivo = b.dataset.modo;
        salvar();
        abaRenderizada = null;
        render();
        const ativo = document.querySelector('[data-modo="' + estado.modoVivo + '"]');
        if (ativo) ativo.focus();
      });
    });

    const formRes = $('#formResultado');
    if (formRes) formRes.addEventListener('submit', e => { e.preventDefault(); confirmarResultado(); });
    ligarResultado();

    if (ui.comemorar) {
      ui.comemorar = false;
      contarAte(document.querySelectorAll('#vista .gols .n'));
    }

    const desf = $('#desfazer');
    if (desf) desf.addEventListener('click', desfazer);

    const prox = $('#proxima');
    if (prox) prox.addEventListener('click', () => { ui.resultadoVisivel = null; ui.placarAnterior = null; render(); });

    const sortDes = $('#sortearDes');
    if (sortDes) sortDes.addEventListener('click', sortearDesempate);

    const seguir = $('#seguirDes');
    if (seguir) seguir.addEventListener('click', () => { ui.desempateRevelado = null; render(); });

    const salvarH = $('#salvarHist');
    if (salvarH) salvarH.addEventListener('click', salvarHistorico);

    const novo = $('#novoCamp');
    if (novo) novo.addEventListener('click', novoCampeonato);

    if ($('#festa') && ui.celebrou !== estado.campeonatoAtual.id) {
      ui.celebrou = estado.campeonatoAtual.id;
      festa();
    }
  }

  function confirmarResultado() {
    const c = estado.campeonatoAtual;
    const m = Copa.partidaAtual(c);
    if (!m || !m.a || !m.b) return;
    const campoA = $('#placarA'), campoB = $('#placarB');
    const golsA = parseInt(campoA.value, 10);
    const golsB = parseInt(campoB.value, 10);
    const erro = Copa.validarPlacar(golsA, golsB, Copa.permiteEmpate(c, m));
    if (erro) {
      ui.erroResultado = erro;
      const el = $('#erroResultado');
      if (el) el.textContent = erro;
      const pl = $('.placar-input');
      if (pl) { pl.classList.remove('shake'); void pl.offsetWidth; pl.classList.add('shake'); }
      vibrar([15, 40, 15]);
      return;
    }
    ui.erroResultado = '';
    const depois = Copa.registrarResultado(c, golsA, golsB);
    if (depois === c) return;
    ui.comemorar = true;
    ui.diff = diferenca(c, depois);
    estado.campeonatoAtual = depois;
    ui.resultadoVisivel = m.id;
    vibrar([30, 60, 30, 60, 80]);
    salvar();
    render();
  }

  function desfazer() {
    const c = estado.campeonatoAtual;
    if (!Copa.podeDesfazer(c)) return;
    estado.campeonatoAtual = Copa.desfazer(c);
    ui.diff = null;
    ui.resultadoVisivel = null;
    ui.desempateRevelado = null;
    ui.placarAnterior = null;
    ui.erroResultado = '';
    salvar();
    render();
    toast('Último resultado desfeito.');
  }

  function sortearDesempate() {
    if (ui.sorteandoDesempate) return;
    const c = estado.campeonatoAtual;
    const depois = Copa.registrarDesempate(c);
    const ordem = depois.desempates[depois.desempates.length - 1];
    const concluir = () => {
      ui.sorteandoDesempate = false;
      estado.campeonatoAtual = depois;
      ui.desempateRevelado = ordem;
      salvar();
      render();
    };
    if (reduzMovimento.matches) { concluir(); return; }

    ui.sorteandoDesempate = true;
    const lista = $('#listaDes');
    $('#sortearDes').disabled = true;
    const nomes = c.empatePendente.map(nome);
    const t0 = performance.now();
    let tique = 0;
    (function rolar(t) {
      if (t - tique > 70) {
        tique = t;
        const emb = Copa.embaralhar(nomes, Math.random);
        lista.querySelectorAll('li').forEach((li, i) => { li.textContent = emb[i]; });
      }
      if (t - t0 < 1500) requestAnimationFrame(rolar);
      else concluir();
    })(t0);
  }

  function salvarHistorico() {
    const c = estado.campeonatoAtual;
    if (!c || c.estado !== 'encerrado') return;
    if (c.salvo || estado.historico.some(h => h.campeonatoId === c.id)) {
      toast('Este campeonato já está no histórico.', 'erro');
      return;
    }
    estado.historico.unshift(Copa.registroHistorico(c, hojeISO()));
    c.salvo = true;
    salvar();
    render();
    toast('+1 título para ' + nome(c.campeao) + '.');
  }

  function novoCampeonato() {
    const c = estado.campeonatoAtual;
    const jaSalvo = c.salvo || estado.historico.some(h => h.campeonatoId === c.id);
    const limpar = () => {
      estado.campeonatoAtual = null;
      ui.resultadoVisivel = null;
      ui.desempateRevelado = null;
      salvar();
      irPara('campeonato');
    };
    if (jaSalvo) { limpar(); return; }
    confirmar({
      titulo: 'Descartar sem salvar?',
      texto: 'Este campeonato ainda não foi salvo no histórico. O título de ' + nome(c.campeao) + ' não vai contar no ranking.',
      ok: 'Descartar',
      perigo: true,
      aoConfirmar: limpar
    });
  }

  /* ================= aba campeões ================= */

  function viewCampeoes() {
    const ranking = Copa.calcularRanking(estado.pessoas, estado.historico);
    const linhas = ranking.map((r, i) =>
      '<tr class="' + (i === 0 && r.titulos > 0 ? 'podio-1' : '') + '" data-flip="rk:' + esc(r.id) + '">' +
        '<td class="pos"><span>' + (i + 1) + '</span></td>' +
        '<td class="esq jogador">' + nomeRotulado(r.id) + '</td>' +
        '<td class="pts">' + r.titulos + '</td>' +
        '<td>' + r.vices + '</td>' +
        '<td>' + r.disputados + '</td>' +
        '<td>' + r.aproveitamento + '%</td>' +
      '</tr>').join('');

    const hist = estado.historico.map(h => {
      const editando = ui.editandoData === h.id;
      const data = editando
        ? '<form class="data-edit" data-form-data="' + esc(h.id) + '">' +
            '<input class="campo" type="date" value="' + esc(h.data) + '" max="' + hojeISO() + '" required aria-label="Nova data">' +
            '<button class="btn btn-acc btn-mini" type="submit" aria-label="Salvar data">' + ICONE.check + '</button>' +
            '<button class="btn btn-linha btn-mini" type="button" data-cancelar-data aria-label="Cancelar">×</button>' +
          '</form>'
        : '<div class="data">' + esc(dataBR(h.data)) +
            '<button class="data-lapis" data-editar-data="' + esc(h.id) + '" aria-label="Editar data de ' + esc(dataBR(h.data)) + '" title="Editar data">' + ICONE.editar + '</button>' +
          '</div>';
      return '<li data-flip="hi:' + esc(h.id) + '">' +
        '<div>' + data +
        '<div class="quem"><span class="acc">' + nomeRotulado(h.campeao) + '</span> campeão · vice ' + nomeRotulado(h.vice) + '</div>' +
        '<div class="lista">' + h.participantes.map(id => esc(nome(id))).join(' · ') + '</div></div>' +
        '<button class="btn btn-perigo btn-mini" data-excluir="' + esc(h.id) + '" aria-label="Excluir campeonato de ' + esc(dataBR(h.data)) + '">' + ICONE.lixo + '</button>' +
      '</li>';
    }).join('');

    return '' +
      '<section class="painel" aria-labelledby="t-rank">' +
        '<h2 class="painel-titulo" id="t-rank">Ranking histórico <span class="contador">' + estado.historico.length + ' campeonatos</span></h2>' +
        (ranking.length
          ? '<div class="tabela-wrap"><table>' +
              '<thead><tr><th scope="col"><span class="sr">Posição</span></th><th scope="col" class="esq">Jogador</th><th scope="col">Títulos</th><th scope="col">Vices</th><th scope="col" title="Campeonatos disputados">Disp.</th><th scope="col" title="Aproveitamento de títulos">Aprov.</th></tr></thead>' +
              '<tbody>' + linhas + '</tbody>' +
            '</table></div>' +
            '<p class="regras">Desempate: vices, depois menos campeonatos disputados, depois ordem alfabética.</p>'
          : '<p class="texto">Nenhum campeonato salvo ainda. Termine uma final e toque em "Salvar no histórico".</p>') +
      '</section>' +
      formCampeaoManual() +
      '<section class="painel" aria-labelledby="t-hist">' +
        '<h2 class="painel-titulo" id="t-hist">Histórico</h2>' +
        (hist ? '<ul class="historico">' + hist + '</ul>' : '<p class="texto">Vazio por enquanto.</p>') +
      '</section>' +
      '<section class="painel" aria-labelledby="t-dados">' +
        '<h2 class="painel-titulo" id="t-dados">Backup</h2>' +
        '<p class="texto">Os dados ficam só neste navegador. Exporte para guardar ou passar para outro aparelho.</p>' +
        '<div class="acoes" style="margin-top:16px">' +
          '<button class="btn btn-linha" id="exportar">' + ICONE.baixar + 'Exportar dados</button>' +
          '<button class="btn btn-linha" id="importar">' + ICONE.subir + 'Importar dados</button>' +
          '<input type="file" id="arquivo" accept=".json,application/json" hidden>' +
        '</div>' +
      '</section>';
  }

  function formCampeaoManual() {
    const ativos = estado.pessoas.filter(p => !p.removida);
    if (ativos.length < 2) return '';
    const opcoes = (sel) => '<option value="">Escolha</option>' +
      ativos.map(p => '<option value="' + esc(p.id) + '"' + (p.id === sel ? ' selected' : '') + '>' + esc(p.nome) + '</option>').join('');
    return '' +
      '<section class="painel" aria-labelledby="t-manual">' +
        '<h2 class="painel-titulo" id="t-manual">Adicionar campeão</h2>' +
        '<p class="texto">Para campeonatos jogados fora do app.</p>' +
        '<form class="form-manual" id="formManual" novalidate>' +
          '<div class="manual-campos">' +
            '<label class="manual-campo"><span>Data</span><input class="campo" type="date" id="manData" value="' + hojeISO() + '" max="' + hojeISO() + '" required></label>' +
            '<label class="manual-campo"><span>Campeão</span><select class="campo" id="manCampeao" required>' + opcoes('') + '</select></label>' +
            '<label class="manual-campo"><span>Vice</span><select class="campo" id="manVice" required>' + opcoes('') + '</select></label>' +
          '</div>' +
          '<p class="manual-rotulo" id="t-manPart">Participantes</p>' +
          '<div class="selecao" role="group" aria-labelledby="t-manPart">' +
            ativos.map(p =>
              '<div class="escolha">' +
                '<input type="checkbox" id="man-' + esc(p.id) + '" data-man="' + esc(p.id) + '" checked>' +
                '<label for="man-' + esc(p.id) + '"><span class="marca">' + ICONE.check + '</span><span class="nome">' + esc(p.nome) + '</span></label>' +
              '</div>').join('') +
          '</div>' +
          '<p class="erro-msg" id="erroManual" role="alert"></p>' +
          '<div class="acoes" style="margin-top:16px"><button class="btn btn-acc" type="submit">' + ICONE.check + 'Adicionar ao histórico</button></div>' +
        '</form>' +
      '</section>';
  }

  function adicionarCampeaoManual() {
    const data = $('#manData').value;
    const campeao = $('#manCampeao').value;
    const vice = $('#manVice').value;
    const participantes = [...document.querySelectorAll('[data-man]')].filter(x => x.checked).map(x => x.dataset.man);
    let erro = '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) erro = 'Informe a data.';
    else if (data > hojeISO()) erro = 'A data não pode estar no futuro.';
    else if (!campeao || !vice) erro = 'Escolha o campeão e o vice.';
    else if (campeao === vice) erro = 'Campeão e vice precisam ser pessoas diferentes.';
    if (erro) {
      const el = $('#erroManual');
      el.textContent = erro;
      el.parentElement.classList.remove('shake'); void el.offsetWidth; el.parentElement.classList.add('shake');
      return;
    }
    [campeao, vice].forEach(id => { if (!participantes.includes(id)) participantes.push(id); });
    estado.historico.push({
      id: Copa.gerarId('h'),
      campeonatoId: Copa.gerarId('cm'),
      data,
      participantes,
      campeao,
      vice
    });
    estado.historico.sort((x, y) => y.data.localeCompare(x.data));
    salvar();
    render();
    toast('Título de ' + nome(campeao) + ' adicionado.');
  }

  function ligarCampeoes() {
    const formMan = $('#formManual');
    if (formMan) formMan.addEventListener('submit', e => { e.preventDefault(); adicionarCampeaoManual(); });

    document.querySelectorAll('[data-editar-data]').forEach(b => {
      b.addEventListener('click', () => {
        ui.editandoData = b.dataset.editarData;
        render();
        const campo = document.querySelector('.data-edit input');
        if (campo) campo.focus();
      });
    });
    document.querySelectorAll('[data-cancelar-data]').forEach(b => {
      b.addEventListener('click', () => { ui.editandoData = null; render(); });
    });
    document.querySelectorAll('[data-form-data]').forEach(f => {
      f.addEventListener('submit', e => {
        e.preventDefault();
        const nova = f.querySelector('input').value;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(nova) || nova > hojeISO()) {
          toast('Data inválida ou no futuro.', 'erro');
          return;
        }
        const h = estado.historico.find(x => x.id === f.dataset.formData);
        if (h) h.data = nova;
        estado.historico.sort((x, y) => y.data.localeCompare(x.data));
        ui.editandoData = null;
        salvar();
        render();
        toast('Data atualizada.');
      });
    });

    document.querySelectorAll('[data-excluir]').forEach(b => {
      b.addEventListener('click', () => {
        const h = estado.historico.find(x => x.id === b.dataset.excluir);
        confirmar({
          titulo: 'Excluir este campeonato?',
          texto: dataBR(h.data) + ': título de ' + nome(h.campeao) + '. O ranking será recalculado.',
          ok: 'Excluir',
          perigo: true,
          aoConfirmar: () => {
            estado.historico = estado.historico.filter(x => x.id !== h.id);
            const c = estado.campeonatoAtual;
            if (c && c.id === h.campeonatoId) c.salvo = false;
            salvar();
            render();
            toast('Registro excluído.');
          }
        });
      });
    });

    $('#exportar').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(estado, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'copa-transformacao-digital-' + hojeISO() + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('Arquivo exportado.');
    });

    const arquivo = $('#arquivo');
    $('#importar').addEventListener('click', () => arquivo.click());
    arquivo.addEventListener('change', () => {
      const f = arquivo.files[0];
      arquivo.value = '';
      if (!f) return;
      if (f.size > 2 * 1024 * 1024) { toast('Arquivo grande demais (máximo 2 MB).', 'erro'); return; }
      const leitor = new FileReader();
      leitor.onload = () => {
        let dados;
        try { dados = JSON.parse(leitor.result); }
        catch (e) { toast('O arquivo não é um JSON válido.', 'erro'); return; }
        const erro = Copa.validarDados(dados);
        if (erro) { toast('Importação recusada: ' + erro, 'erro'); return; }
        confirmar({
          titulo: 'Substituir os dados atuais?',
          texto: 'O arquivo tem ' + dados.pessoas.length + ' pessoas e ' + dados.historico.length + ' campeonatos. Tudo o que está neste navegador será trocado.',
          ok: 'Importar',
          aoConfirmar: () => {
            const ativos = dados.pessoas.filter(p => !p.removida).map(p => p.id);
            estado = {
              pessoas: dados.pessoas.map(p => ({ id: p.id, nome: p.nome, removida: !!p.removida })),
              historico: dados.historico,
              edicoesSemeadas: true,
              campeonatoAtual: dados.campeonatoAtual ? Copa.derivar(dados.campeonatoAtual) : null,
              tema: dados.tema || { destaque: Copa.DESTAQUES[0] },
              selecao: Array.isArray(dados.selecao) ? dados.selecao.filter(id => ativos.includes(id)) : ativos.slice(0, Copa.MAX_JOGADORES),
              modoVivo: estado.modoVivo
            };
            Object.assign(ui, { resultadoVisivel: null, desempateRevelado: null, placarAnterior: null });
            aplicarTema();
            salvar();
            render();
            toast('Dados importados.');
          }
        });
      };
      leitor.onerror = () => toast('Não foi possível ler o arquivo.', 'erro');
      leitor.readAsText(f);
    });
  }

  /* ================= render ================= */

  const VIEWS = {
    campeonato: [viewCampeonato, ligarCampeonato],
    aovivo: [viewAoVivo, ligarAoVivo],
    campeoes: [viewCampeoes, ligarCampeoes],
    participantes: [viewParticipantes, ligarParticipantes]
  };

  let abaRenderizada = null;

  // Posição de cada [data-flip] relativa ao próprio pai: assim mudanças acima da lista não contam como movimento.
  function medirFlip() {
    const m = new Map();
    document.querySelectorAll('#vista [data-flip]').forEach(el => {
      m.set(el.dataset.flip, el.getBoundingClientRect().top - el.parentElement.getBoundingClientRect().top);
    });
    return m;
  }

  function animarFlip(antes) {
    const grupos = new Set([...antes.keys()].map(k => k.split(':')[0]));
    document.querySelectorAll('#vista [data-flip]').forEach(el => {
      const k = el.dataset.flip;
      if (antes.has(k)) {
        const dy = antes.get(k) - (el.getBoundingClientRect().top - el.parentElement.getBoundingClientRect().top);
        if (Math.abs(dy) < 2) return;
        el.animate([{ transform: 'translateY(' + dy + 'px)' }, { transform: 'none' }],
          { duration: 560, easing: 'cubic-bezier(.2, .8, .2, 1)' });
        el.classList.add(dy > 0 ? 'subiu' : 'desceu');
      } else if (grupos.has(k.split(':')[0])) {
        el.classList.add('novo');
      }
    });
  }

  function render() {
    atualizarCabecalho();
    posicionarIndicador(abaRenderizada === null);
    const [view, ligar] = VIEWS[ui.aba];
    const vista = $('#vista');
    const mesma = abaRenderizada === ui.aba;
    const antes = mesma && !reduzMovimento.matches ? medirFlip() : null;
    vista.innerHTML = '<div class="vista' + (mesma ? ' mesma' : '') + (ui.vt ? ' vt' : '') + '">' + view() + '</div>';
    ui.vt = false;
    abaRenderizada = ui.aba;
    if (antes && antes.size) animarFlip(antes);
    ligar();
  }

  document.getElementById('rotuloAno').textContent = '// Copa de mesa-gol · ' + new Date().getFullYear();
  document.getElementById('heroArte').innerHTML = mesaGol({ heroi: true });
  aplicarTema();
  irPara(estado.campeonatoAtual && Copa.comecou(estado.campeonatoAtual) && estado.campeonatoAtual.estado !== 'encerrado' ? 'aovivo' : 'campeonato');
})();
