import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {transaction,closeDatabase} from '../lib/db.js';
export async function seed(){
 const roster=JSON.parse(await readFile(new URL('../public/players.json',import.meta.url),'utf8'));
 await transaction(async client=>{
  for(const p of roster){
   const old=(await client.query('SELECT * FROM players WHERE id=$1',[p.id])).rows[0];
   if(old){if(old.name!==p.name||old.team!==p.team||old.position!==p.position)throw new Error('Elenco divergente: '+p.id);continue;}
   await client.query('INSERT INTO players(id,name,team,position) VALUES($1,$2,$3,$4)',[p.id,p.name,p.team,p.position]);
  }
 });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await seed();console.log('54 atletas cadastrados.');}catch(error){console.error('Seed falhou:',error.code||error.message);process.exitCode=1;}finally{await closeDatabase();}
}
