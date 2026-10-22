const assert = require('node:assert/strict');
const Copa = require('./logic.js');

const rnd = () => 0.3;
const jogar = (c, a, b) => Copa.registrarResultado(c, a, b);

// 3 jogadores, tudo empatado 0x0: sem critério, o sorteio de desempate decide e libera a final.
let c = Copa.criarCampeonato(['x', 'y', 'z'], rnd);
for (let i = 0; i < 3; i++) c = jogar(c, 0, 0);
assert.equal(c.estado, 'fase1');
assert.equal(c.empatePendente.length, 3);
c = Copa.registrarDesempate(c, rnd);
assert.equal(c.estado, 'final');
assert.equal(c.empatePendente, null);

// 3 jogadores: sem semi. Fase 1 de 3 jogos, final 1º × 2º, o 3º fica fora.
let t = Copa.criarCampeonato(['x', 'y', 'z'], rnd);
const [m1, m2, m3] = t.fase1;
t = jogar(t, 2, 0); // m1: a vence
t = jogar(t, 0, 1); // m2: b vence
t = jogar(t, 3, 0); // m3: a vence
assert.equal(t.semis.length, 0);
if (t.empatePendente) t = Copa.registrarDesempate(t, rnd);
assert.equal(t.estado, 'final');
const topo = Copa.classificar(t.participantes, t.fase1, t.desempates).tabela.map(l => l.id);
assert.deepEqual([t.final.a, t.final.b], topo.slice(0, 2));
t = jogar(t, 1, 0);
assert.equal(t.estado, 'encerrado');
assert.equal(t.campeao, t.final.a);
assert.equal(t.vice, t.final.b);

// Formato C (3 jogadores): turno e returno, 6 jogos, líder da tabela é campeão e não há final.
let k = Copa.criarCampeonato(['x', 'y', 'z'], rnd, 'c');
assert.equal(k.fase1.length, 6);
const pares = k.fase1.map(m => [m.a, m.b].sort().join());
for (const p of new Set(pares)) assert.equal(pares.filter(q => q === p).length, 2);
for (let i = 0; i < 6; i++) k = jogar(k, i % 2 ? 0 : 2, i % 2 ? 1 : 0);
if (k.empatePendente) k = Copa.registrarDesempate(k, rnd);
assert.equal(k.estado, 'encerrado');
assert.equal(k.final, null);
const tabK = Copa.classificar(k.participantes, k.fase1, k.desempates).tabela;
assert.equal(k.campeao, tabK[0].id);
assert.equal(k.vice, tabK[1].id);
assert.equal(Copa.criarCampeonato(['a', 'b', 'c', 'd'], rnd, 'c').formato, 'b');

// Mata-mata não aceita empate: o registro é ignorado e o replay recusa.
const final = Copa.criarCampeonato(['a', 'b'], rnd);
assert.equal(jogar(final, 1, 1), final);
assert.throws(() => Copa.derivar(Object.assign({}, final, { eventos: [{ tipo: 'resultado', golsA: 1, golsB: 1 }] })));

// Dados importados ou salvos: evento antigo, tipo desconhecido e placar não numérico são recusados.
const dados = ev => ({
  pessoas: [{ id: 'a', nome: 'A' }, { id: 'b', nome: 'B' }],
  historico: [],
  campeonatoAtual: Object.assign({}, final, { eventos: ev })
});
assert.equal(Copa.validarDados(dados([{ tipo: 'resultado', golsA: 2, golsB: 1 }])), null);
assert.ok(Copa.validarDados(dados([{ tipo: 'cobranca', gol: true }])));
assert.ok(Copa.validarDados(dados([{ tipo: 'resultado', golsA: '<img src=x>', golsB: 1 }])));

console.log('ok');
