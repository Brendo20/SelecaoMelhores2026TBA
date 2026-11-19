import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../server.mjs';
import {closeDatabase} from '../lib/db.js';
test('Servidor serve páginas e aplica cabeçalhos fora da Vercel',async()=>{
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port;
 try{
  const main=await fetch(url);assert.equal(main.status,200);assert.match(main.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  const admin=await fetch(url+'/admin');assert.equal(admin.status,200);assert.match(admin.headers.get('x-robots-tag'),/noindex/);assert.match(await admin.text(),/Revisão das cédulas/);
  const api=await fetch(url+'/api/admin');assert.ok([401,503].includes(api.status));assert.equal((await api.json()).results,undefined);
  const missing=await fetch(url+'/arquivo-inexistente');assert.equal(missing.status,404);
  const badJson=await fetch(url+'/api/vote',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'});assert.equal(badJson.status,400);
 }finally{await new Promise(resolve=>server.close(resolve));await closeDatabase();}
});
