import test from 'node:test';
import assert from 'node:assert/strict';
import {issueSession,hasSession,passwordMatches} from '../lib/admin-session.js';
import admin from '../api/admin.js';
const saved={...process.env};
process.env.ADMIN_PASSWORD='local-test-admin-only';
process.env.SESSION_SECRET='local-test-session-secret-at-least-32-characters';
process.env.APP_ORIGIN='https://vote.example.com';
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};}
test.after(()=>{for(const key of ['ADMIN_PASSWORD','SESSION_SECRET','APP_ORIGIN']){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}});
test('Sessão rejeita adulteração e expiração',()=>{
 const now=Date.now(),token=issueSession(now),req={headers:{cookie:'tba_admin='+token}};
 assert.equal(hasSession(req,now),true);assert.equal(hasSession(req,now+14401000),false);
 assert.equal(hasSession({headers:{cookie:'tba_admin='+token.slice(0,-5)+'xxxxx'}},now),false);
 assert.equal(passwordMatches('errada'),false);
});
test('Cookie é privado e Seguro em HTTPS',async()=>{
 const res=response();await admin({method:'POST',clientIp:'admin-test',headers:{origin:process.env.APP_ORIGIN,'content-type':'application/json'},body:{password:process.env.ADMIN_PASSWORD}},res);
 assert.equal(res.body.ok,true);assert.match(res.headers['Set-Cookie'],/HttpOnly/);assert.match(res.headers['Set-Cookie'],/Secure/);assert.match(res.headers['Set-Cookie'],/SameSite=Strict/);
});
test('Admin rejeita acesso sem sessão e alterações de origem externa',async()=>{
 const read=response();await admin({method:'GET',headers:{}},read);assert.equal(read.code,401);assert.equal(read.body.results,undefined);
 const patch=response();await admin({method:'PATCH',headers:{origin:'https://other.example.com'},body:{action:'moderate'}},patch);assert.equal(patch.code,403);
});
test('Sair apaga a sessão',async()=>{
 const res=response();await admin({method:'DELETE',headers:{origin:process.env.APP_ORIGIN}},res);assert.match(res.headers['Set-Cookie'],/Max-Age=0/);
});
