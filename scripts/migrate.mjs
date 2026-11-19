import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {database,transaction,closeDatabase} from '../lib/db.js';
import {digest} from '../lib/rules.js';
export async function migrate(){
 const folder=new URL('../db/migrations/',import.meta.url);
 await transaction(async client=>{
  await client.query('SELECT pg_advisory_xact_lock(20262026)');
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
  for(const name of (await readdir(folder)).filter(n=>n.endsWith('.sql')).sort()){
   const sql=await readFile(new URL(name,folder),'utf8'),checksum=digest(sql);
   const old=(await client.query('SELECT checksum FROM schema_migrations WHERE name=$1',[name])).rows[0];
   if(old){if(old.checksum!==checksum)throw new Error('Migration alterada: '+name);continue;}
   await client.query(sql);await client.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)',[name,checksum]);
  }
 });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await migrate();console.log('Migrations aplicadas.');}catch(error){console.error('Migration falhou:',error.code||error.message);process.exitCode=1;}finally{await closeDatabase();}
}
