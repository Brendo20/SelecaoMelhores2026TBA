import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkChoices,ballotHash,normalizeName,ROLES} from '../lib/rules.js';
const roster=JSON.parse(readFileSync(new URL('../public/players.json',import.meta.url),'utf8'));
const line=roster.filter(p=>p.position==='line').slice(0,6).map(p=>p.id),keeper=roster.find(p=>p.position==='goalkeeper').id;
const selection=[keeper,...line],gold=[keeper,...roster.filter(p=>p.position==='line').slice(0,9).map(p=>p.id)];
test('Seleção exige um goleiro e seis jogadores de linha',()=>{
 assert.doesNotThrow(()=>checkChoices(selection,gold,roster));
 for(const invalid of [line,[...line,roster[10].id],[keeper,keeper,...line.slice(0,5)]])assert.throws(()=>checkChoices(invalid,gold,roster));
});
test('Bola de Ouro exige dez atletas distintos',()=>{
 for(const invalid of [gold.slice(0,9),[...gold,gold[0]],[...gold.slice(0,9),gold[0]],['inexistente',...gold.slice(1)]])assert.throws(()=>checkChoices(selection,invalid,roster));
});
test('A ordem do ranking faz parte do envio; a ordem da Seleção não',()=>{
 assert.equal(ballotHash(selection,gold),ballotHash([...selection].reverse(),gold));
 assert.notEqual(ballotHash(selection,gold),ballotHash(selection,[...gold].reverse()));
});
test('Pesos definidos no servidor e normalização de nomes',()=>{
 assert.deepEqual(Object.fromEntries(Object.entries(ROLES).map(([role,r])=>[role,r.units/2])),{capitao:2,organizacao:1.5,atleta:1,tecnico:1});
 assert.equal(normalizeName('  JOSÉ   da Silva  '),'jose da silva');
});
