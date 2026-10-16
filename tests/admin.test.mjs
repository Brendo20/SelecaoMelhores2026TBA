import test from 'node:test';
import assert from 'node:assert/strict';
import admin from '../api/admin.js';
import {issueSession,hasSession,passwordMatches} from '../lib/admin-session.js';
const envKeys=['ADMIN_PASSWORD','GOOGLE_SCRIPT_SECRET','GOOGLE_SCRIPT_URL','VOTING_OPEN','VERCEL'];
async function configured(fn){
 const saved=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
 process.env.ADMIN_PASSWORD='test-only-admin-password';process.env.GOOGLE_SCRIPT_SECRET='test-only-server-secret';process.env.GOOGLE_SCRIPT_URL='https://example.com/script';process.env.VOTING_OPEN='true';process.env.VERCEL='1';
 try{return await fn();}finally{for(const key of envKeys){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}}
}
function res(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};}
const request=(method,extra={})=>({method,headers:{host:'vote.example.com',origin:'https://vote.example.com','content-type':'application/json',...extra.headers},...extra});
test('Sessão assinada rejeita adulteração, expiração e senha antiga',()=>configured(()=>{
 const now=Date.now(),token=issueSession(now),req={headers:{cookie:'tba_admin='+token}};
 assert.equal(hasSession(req,now),true);
 assert.equal(hasSession({headers:{cookie:'tba_admin='+token.slice(0,-5)+'xxxxx'}},now),false);
 assert.equal(hasSession(req,now+4*60*60*1000+1000),false);
 assert.equal(passwordMatches('wrong'),false);assert.equal(passwordMatches(process.env.ADMIN_PASSWORD),true);
 process.env.ADMIN_PASSWORD='new-test-password';assert.equal(hasSession(req,now),false);
}));
test('Sem login o endpoint não consulta nem revela parciais',()=>configured(async()=>{
 const originalFetch=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;throw new Error();};
 try{const response=res();await admin(request('GET'),response);assert.equal(response.code,401);assert.equal(calls,0);assert.equal(response.body.results,undefined);assert.match(response.headers['Cache-Control'],/no-store/);}
 finally{globalThis.fetch=originalFetch;}
}));
test('Login bloqueia origem externa e usa cookie HttpOnly Secure SameSite',()=>configured(async()=>{
 const cross=res();await admin({method:'POST',headers:{host:'vote.example.com',origin:'https://evil.example.com'},body:{password:process.env.ADMIN_PASSWORD}},cross);assert.equal(cross.code,403);
 const wrong=res();await admin(request('POST',{body:{password:'wrong'}}),wrong);assert.equal(wrong.code,401);
 const response=res();await admin(request('POST',{body:{password:process.env.ADMIN_PASSWORD}}),response);assert.equal(response.code,200);
 assert.match(response.headers['Set-Cookie'],/HttpOnly/);assert.match(response.headers['Set-Cookie'],/Secure/);assert.match(response.headers['Set-Cookie'],/SameSite=Strict/);
}));
test('Somente sessão válida consulta a ação administrativa',()=>configured(async()=>{
 const originalFetch=globalThis.fetch;let sent;
 globalThis.fetch=async(url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({ok:true,open:true,updatedAt:new Date().toISOString(),summary:{totalBallots:1},results:[]})};};
 try{
 const response=res();await admin({method:'GET',headers:{cookie:'tba_admin='+issueSession()}},response);
 assert.equal(response.code,200);assert.equal(sent.action,'admin_results');assert.equal(sent.secret,process.env.GOOGLE_SCRIPT_SECRET);assert.equal(response.body.summary.totalBallots,1);
 }finally{globalThis.fetch=originalFetch;}
}));
test('Sair remove a sessão e configuração ausente não abre o painel',()=>configured(async()=>{
 const response=res();await admin(request('DELETE'),response);assert.equal(response.code,200);assert.match(response.headers['Set-Cookie'],/Max-Age=0/);
 delete process.env.ADMIN_PASSWORD;const missing=res();await admin(request('GET'),missing);assert.equal(missing.code,503);assert.equal(missing.body.results,undefined);
}));
