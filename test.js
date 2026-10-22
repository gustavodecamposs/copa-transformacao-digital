const assert = require('node:assert/strict');
const Copa = require('./logic.js');

const rnd = () => 0.3;
const jogar = (c, a, b) => Copa.registrarResultado(c, a, b);

// 3 jogadores, tudo empatado 0x0: sem critério, o sorteio de desempate decide e libera as semis.
let c = Copa.criarCampeonato(['x', 'y', 'z'], rnd);
for (let i = 0; i < 3; i++) c = jogar(c, 0, 0);
assert.equal(c.estado, 'fase1');
assert.equal(c.empatePendente.length, 3);
c = Copa.registrarDesempate(c, rnd);
assert.equal(c.estado, 'semis');
assert.equal(c.empatePendente, null);

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
