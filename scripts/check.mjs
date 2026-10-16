import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
for(const file of ['public/app.js','api/config.js','api/results.js','api/vote.js','lib/validation.js','scripts/dev.mjs'])execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
const roster=JSON.parse(readFileSync('public/players.json','utf8'));
if(roster.length!==54||roster.filter(p=>p.position==='goalkeeper').length!==6||new Set(roster.map(p=>p.id)).size!==54)throw new Error('Cadastro inconsistente.');
console.log('JavaScript e cadastro de 54 atletas verificados. Site estático pronto em public/.');
