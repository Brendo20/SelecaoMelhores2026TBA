import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync} from 'node:fs';
const files=['server.mjs',...['api','lib','scripts','public'].flatMap(dir=>readdirSync(dir).filter(name=>/\.(mjs|js)$/.test(name)).map(name=>dir+'/'+name))];
for(const file of files)execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
const roster=JSON.parse(readFileSync('public/players.json','utf8'));
if(roster.length!==54||roster.filter(p=>p.position==='goalkeeper').length!==6||new Set(roster.map(p=>p.id)).size!==54)throw new Error('Cadastro inconsistente.');
console.log('Sintaxe e cadastro de 54 atletas verificados.');
