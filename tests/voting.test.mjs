import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {players,validateVote,validateBallot} from '../lib/validation.js';
import vote from '../api/vote.js';
const line=players.filter(p=>p.position==='line').slice(0,6).map(p=>p.id),keeper=players.find(p=>p.position==='goalkeeper').id;
const valid={category:'selection',name:'José',team:'Azul',requestId:'12345678-1234-4123-8123-123456789abc',playerIds:[keeper,...line]};
const top10=[keeper,...players.filter(p=>p.position==='line').slice(0,9).map(p=>p.id)];
const gold={...valid,category:'gold',playerIds:top10};
const ballot={name:valid.name,team:valid.team,requestId:valid.requestId,selection:valid.playerIds,gold:top10};
function harness(){
 const rows={Votos:[['data','protocolo','categoria','nome','time','ids','id_envio']]};
 const props={SHARED_SECRET:'server-secret',SPREADSHEET_ID:'test',VOTING_OPEN:'true'};
 const sheets={};
 for(const name of ['Jogadores','Votos','Resultados']){
  rows[name]??=[['header']];
  sheets[name]={getLastRow:()=>rows[name].length,getDataRange:()=>({getValues:()=>rows[name]}),appendRow:r=>rows[name].push(r),getRange:()=>({
   clearContent(){rows[name]=[rows[name][0]];},
   setValues(values){rows[name]=[rows[name][0],...values];}
  })};
 }
 let sequence=0;
 const context=vm.createContext({
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k],setProperty:(k,v)=>{props[k]=v;}})},
  SpreadsheetApp:{openById:()=>({getSheetByName:name=>sheets[name]}),flush:()=>{}},
  LockService:{getScriptLock:()=>({tryLock:()=>true,waitLock:()=>{},releaseLock:()=>{}})},
  Utilities:{getUuid:()=> 'receipt-'+(++sequence)},
  ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({setMimeType:()=>JSON.parse(s)})}
 });
 vm.runInContext(readFileSync('google-apps-script/Code.gs','utf8'),context);
 return {rows,props,context,post:body=>context.doPost({postData:{contents:JSON.stringify({secret:'server-secret',...body})}})};
}
test('Seleção exige 1 goleiro e 6 jogadores de linha',()=>{
 assert.equal(validateVote(valid),null);
 for(const ids of [line,[keeper,...line.slice(0,5)],[...line,players.filter(p=>p.position==='line')[7].id],[keeper,keeper,...line.slice(0,5)]])assert.ok(validateVote({...valid,playerIds:ids}));
});
test('Bola de Ouro exige 10 atletas diferentes e aceita goleiro',()=>{
 assert.equal(validateVote(gold),null);
 for(const ids of [[keeper],top10.slice(0,9),[...top10,players[20].id],[...top10.slice(0,9),top10[0]],[...top10.slice(0,9),'inventado']])assert.ok(validateVote({...gold,playerIds:ids}));
});
test('Rejeita identidade e categoria inválidas',()=>{
 for(const change of [{name:''},{team:'Verde'},{team:''},{requestId:'invalido'},{category:'outro'},{playerIds:null}])assert.ok(validateVote({...valid,...change}));
});
test('Reenvio preserva o voto e alteração da ordem da Bola de Ouro é recusada',()=>{
 const {post,rows}=harness();
 assert.equal(post({action:'results'}).ok,false);
 assert.equal(post(ballot).ok,true);assert.equal(rows.Votos.length,2);
 assert.deepEqual(JSON.parse(rows.Votos[1][5]).gold,top10);
 assert.equal(post(ballot).ok,true);assert.equal(rows.Votos.length,2);
 assert.equal(post({...ballot,gold:[...top10].reverse()}).code,'DUPLICATE');
 assert.equal(rows.Votos[1][4],'Azul');
 assert.equal(post({...ballot,team:'Verde'}).ok,false);
});
test('Apps Script também rejeita ranking incompleto e repetido',()=>{
 const {post,rows}=harness();
 for(const ids of [[keeper],top10.slice(0,9),[...top10.slice(0,9),top10[0]]])assert.equal(post({...ballot,gold:ids}).ok,false);
 assert.equal(rows.Votos.length,1);
});
test('Apuração soma 10 a 1 e mantém votos da Seleção sem pesos',()=>{
 const {post,rows,props,context}=harness();
 assert.equal(post(ballot).ok,true);
 assert.equal(rows.Votos.length,2);
 assert.equal(rows.Votos[1][2],'ballot');
 assert.deepEqual(JSON.parse(rows.Votos[1][5]).selection,[...valid.playerIds].sort());
 context.encerrarEApurar();
 const result=post({action:'results'});
 assert.equal(result.ok,true);
 const goldRows=result.results.filter(r=>r.category==='gold');
 assert.equal(goldRows.find(r=>r.id===top10[0]).points,10);
 assert.equal(goldRows.find(r=>r.id===top10[9]).points,1);
 assert.equal(goldRows.reduce((sum,r)=>sum+r.points,0),55);
 assert.equal(result.results.find(r=>r.category==='selection'&&r.id===keeper).votes,1);
 assert.equal(result.results.find(r=>r.category==='selection'&&r.id===keeper).points,0);
 assert.equal(props.VOTING_OPEN,'false');assert.equal(post(ballot).code,'CLOSED');
 assert.equal(rows.Resultados.length,109);
});
test('Apuração acumula pontos de diferentes cédulas',()=>{
 const {post,context}=harness();
 post(ballot);post({...ballot,requestId:'12345678-1234-4123-8123-123456789abd',gold:[...top10].reverse()});
 context.encerrarEApurar();
 const results=post({action:'results'}).results.filter(r=>r.category==='gold');
 for(const id of top10){assert.equal(results.find(r=>r.id===id).points,11);assert.equal(results.find(r=>r.id===id).votes,2);}
 assert.equal(results.reduce((sum,r)=>sum+r.points,0),110);
});
test('Apuração não publica cédulas antigas de um único jogador',()=>{
 const {rows,context,post}=harness();
 rows.Votos.push([new Date(),'old','gold','José','Azul',JSON.stringify([keeper]),'old-id']);
 assert.throws(()=>context.encerrarEApurar(),/antigo ou inválido/);
 assert.equal(post({action:'results'}).ok,false);
});
test('API preserva a ordem e não permite substituir o segredo do servidor',async()=>{
 const saved={...process.env},originalFetch=globalThis.fetch;
 process.env.VOTING_OPEN='true';process.env.GOOGLE_SCRIPT_URL='https://example.com';process.env.GOOGLE_SCRIPT_SECRET='real-secret';
 let sent;
 globalThis.fetch=async(url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({ok:true,receipt:'ok'})};};
 const res={setHeader(){},status(code){this.code=code;return this;},json(value){this.body=value;return this;}};
 try{await vote({method:'POST',headers:{'content-type':'application/json'},body:{...ballot,secret:'attacker'}},res);assert.equal(sent.secret,'real-secret');assert.deepEqual(sent.gold,top10);assert.deepEqual(sent.selection,valid.playerIds);assert.equal(res.code,200);}
 finally{globalThis.fetch=originalFetch;for(const key of ['VOTING_OPEN','GOOGLE_SCRIPT_URL','GOOGLE_SCRIPT_SECRET']){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}}
});

test('API exige as duas categorias completas no envio único',()=>{
 assert.equal(validateBallot(ballot),null);
 for(const change of [{selection:[]},{gold:[]},{selection:null},{gold:top10.slice(0,9)},{name:''},{selection:undefined}])assert.ok(validateBallot({...ballot,...change}));
 assert.ok(validateBallot(gold));assert.ok(validateBallot(valid));
});
test('Apps Script não grava nenhuma categoria quando uma delas é inválida',()=>{
 const {post,rows}=harness();
 assert.equal(post({...ballot,gold:[]}).ok,false);
 assert.equal(post({...ballot,selection:[]}).ok,false);
 assert.equal(rows.Votos.length,1);
 assert.equal(post(ballot).ok,true);
 assert.equal(rows.Votos.length,2);
 assert.equal(post({...ballot,selection:[...ballot.selection].reverse()}).ok,true);
 assert.equal(rows.Votos.length,2);
});

test('Parciais administrativas usam a mesma apuração sem encerrar ou publicar',()=>{
 const {post,rows,props}=harness();
 post(ballot);
 const beforeVotes=rows.Votos.length,beforeResults=rows.Resultados.length;
 const partial=post({action:'admin_results'});
 assert.equal(partial.ok,true);assert.equal(partial.open,true);
 assert.equal(partial.summary.totalBallots,1);assert.equal(partial.summary.byTeam.Azul,1);
 assert.equal(partial.results.filter(r=>r.category==='gold').reduce((sum,r)=>sum+r.points,0),55);
 assert.equal(partial.results.find(r=>r.category==='gold'&&r.id===top10[0]).points,10);
 assert.equal(props.VOTING_OPEN,'true');assert.notEqual(props.RESULTS_PUBLISHED,'true');
 assert.equal(post({action:'results'}).ok,false);
 assert.equal(rows.Votos.length,beforeVotes);assert.equal(rows.Resultados.length,beforeResults);
 const denied=post({action:'admin_results',secret:'wrong'});assert.equal(denied.ok,false);assert.equal(denied.results,undefined);
});
