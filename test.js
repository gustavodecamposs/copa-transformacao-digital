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

// 3 jogadores: turno único de 3 jogos, final entre os 2 melhores, e nada de returno.
let k = Copa.criarCampeonato(['x', 'y', 'z'], rnd);
assert.equal(k.formato, 'b');
assert.equal(k.fase1.length, 3);
const pares = k.fase1.map(m => [m.a, m.b].sort().join());
assert.equal(new Set(pares).size, 3);
for (let i = 0; i < 3; i++) k = jogar(k, i % 2 ? 0 : 2, i % 2 ? 1 : 0);
if (k.empatePendente) k = Copa.registrarDesempate(k, rnd);
assert.equal(k.estado, 'final');
assert.equal(k.semis.length, 0);
const tabK = Copa.classificar(k.participantes, k.fase1, k.desempates).tabela.map(l => l.id);
assert.deepEqual([k.final.a, k.final.b], tabK.slice(0, 2));
k = jogar(k, 0, 2); // o 2º da tabela vence a final
assert.equal(k.estado, 'encerrado');
assert.equal(k.campeao, k.final.b);
assert.equal(k.vice, k.final.a);

// Turno e returno é opcional: com 4 jogadores dobra os jogos e cada par se enfrenta 2 vezes.
const ida = Copa.criarCampeonato(['p', 'q', 'r', 's'], rnd, 'c');
assert.equal(ida.formato, 'c');
assert.equal(ida.fase1.length, 12);
const paresIda = ida.fase1.map(m => [m.a, m.b].sort().join());
assert.equal(new Set(paresIda).size, 6);
for (const par of new Set(paresIda)) assert.equal(paresIda.filter(x => x === par).length, 2);

// Com 5 jogadores ou mais o returno não é oferecido.
assert.equal(Copa.aceitaReturno(4), true);
assert.equal(Copa.aceitaReturno(5), false);
assert.equal(Copa.criarCampeonato(['a', 'b', 'c', 'd', 'e'], rnd, 'c').formato, 'b');

// 4 jogadores: 6 jogos na fase 1, sem semis, final entre 1º e 2º. 7 no total.
let v = Copa.criarCampeonato(['p', 'q', 'r', 's'], rnd);
assert.equal(v.fase1.length, 6);
for (let i = 0; i < 6; i++) v = jogar(v, i % 3, i % 2);
if (v.empatePendente) v = Copa.registrarDesempate(v, rnd);
assert.equal(v.estado, 'final');
assert.equal(v.semis.length, 0);
const tabV = Copa.classificar(v.participantes, v.fase1, v.desempates).tabela.map(l => l.id);
assert.deepEqual([v.final.a, v.final.b], tabV.slice(0, 2));
v = jogar(v, 2, 1);
assert.equal(v.estado, 'encerrado');
assert.equal(v.campeao, tabV[0]);
assert.equal(v.vice, tabV[1]);

// 5 jogadores: turno único e as semifinais continuam.
let w = Copa.criarCampeonato(['a', 'b', 'c', 'd', 'e'], rnd);
assert.equal(w.formato, 'b');
assert.equal(w.fase1.length, 10);
for (let i = 0; i < 10; i++) w = jogar(w, i % 4, i % 3);
while (w.empatePendente) w = Copa.registrarDesempate(w, rnd);
assert.equal(w.estado, 'semis');
assert.equal(w.semis.length, 2);

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
