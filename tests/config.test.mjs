import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../api/config.js';
test('Diagnóstico distingue configuração, segredo, versão, rede e fechamento',async()=>{
 const keys=['VOTING_OPEN','GOOGLE_SCRIPT_URL','GOOGLE_SCRIPT_SECRET'],saved=Object.fromEntries(keys.map(k=>[k,process.env[k]])),originalFetch=globalThis.fetch;
 const call=async()=>{const res={setHeader(){},status(){return this;},json(body){this.body=body;}};await config({method:'GET'},res);return res.body;};
 try{
 delete process.env.GOOGLE_SCRIPT_URL;delete process.env.GOOGLE_SCRIPT_SECRET;
 assert.equal((await call()).reason,'not_configured');
 process.env.GOOGLE_SCRIPT_URL='https://example.com';process.env.GOOGLE_SCRIPT_SECRET='secret';process.env.VOTING_OPEN='true';
 for(const [data,reason] of [[{ok:false},'connection_rejected'],[{ok:true},'script_outdated'],[{ok:true,open:false},'script_closed'],[{ok:true,open:true},'open']]){
  globalThis.fetch=async()=>({ok:true,json:async()=>data});const result=await call();assert.equal(result.reason,reason);assert.equal(result.open,reason==='open');
 }
 process.env.VOTING_OPEN='false';assert.equal((await call()).reason,'vercel_closed');
 globalThis.fetch=async()=>{throw new Error('network');};assert.equal((await call()).reason,'connection_failed');
 }finally{globalThis.fetch=originalFetch;for(const key of keys){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}}
});
