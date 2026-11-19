import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
const url=process.env.TEST_DATABASE_URL;
test('PostgreSQL: identificação livre, time Organização, pesos privados e revisão',{skip:!url},async t=>{
 const parsed=new URL(url);
 assert.ok(['127.0.0.1','localhost'].includes(parsed.hostname)&&parsed.pathname.endsWith('_test'),'Use um banco local descartável terminado em _test.');
 process.env.DATABASE_URL=url;
 const {database,closeDatabase}=await import('../lib/db.js');
 const {migrate}=await import('../scripts/migrate.mjs');
 const {seed}=await import('../scripts/seed.mjs');
 const store=await import('../lib/store.js');
 const roster=JSON.parse(readFileSync(new URL('../public/players.json',import.meta.url),'utf8'));
 const keeper=roster.find(p=>p.position==='goalkeeper').id,line=roster.filter(p=>p.position==='line');
 const selection=[keeper,...line.slice(0,6).map(p=>p.id)],gold=[keeper,...line.slice(0,9).map(p=>p.id)];
 const ballot=(name='Eleitor de teste',role='atleta',team='Azul')=>({name,role,team,selection,gold,requestId:randomUUID()});
 const reset=async()=>{await database().query('TRUNCATE choices,ballots,voters,audit_events RESTART IDENTITY');await database().query('UPDATE election SET is_open=false,results_published=false WHERE id=1');};
 const open=()=>store.changeElection({status:'open',reason:'Teste de integração'});
 try{
  await migrate();await migrate();await seed();await seed();

  await t.test('Elenco ativo troca Junior por Rodolfo sem reutilizar o ID',async()=>{
   await reset();await open();
   const goalies=(await database().query("SELECT id,name,team FROM players WHERE active AND position='goalkeeper'")).rows;
   assert.equal(goalies.length,6);
   assert.equal(goalies.filter(p=>p.team==='Branco').length,2);
   assert.equal(goalies.filter(p=>p.team==='Vermelho').length,1);
   assert.ok(goalies.some(p=>p.id==='goleiro-7'&&p.name==='Rodolfo'&&p.team==='Branco'));
   assert.ok(!goalies.some(p=>p.id==='goleiro-4'));
   await assert.rejects(()=>store.castBallot({...ballot(),selection:['goleiro-4',...selection.slice(1)]}),/Atleta inválido/);
   const sent=await store.castBallot({...ballot(),selection:['goleiro-7',...selection.slice(1)]});
   assert.ok(sent.receipt);
   const snapshot=await store.adminSnapshot();
   assert.equal(snapshot.results.find(r=>r.category==='selection'&&r.id==='goleiro-7').votes,1);
   assert.ok(!snapshot.results.some(r=>r.id==='goleiro-4'));
  });

  await t.test('Pesos internos seguem o perfil; Organização recebe seu próprio time',async()=>{
   await reset();await open();
   for(const role of ['capitao','organizacao','atleta','tecnico'])await store.castBallot({...ballot('Eleitor '+role,role),weight:999,weight_units:999});
   const data=await store.adminSnapshot();
   assert.equal(data.summary.totalBallots,4);assert.equal(data.summary.byTeam.Azul,3);assert.equal(data.summary.byTeam['Organização'],1);
   assert.equal(data.ballots.find(b=>b.role==='organizacao').team,'Organização');
   assert.equal(data.results.find(r=>r.category==='selection'&&r.id===keeper).weightedVotes,5.5);
   assert.equal(data.results.filter(r=>r.category==='gold').reduce((n,r)=>n+r.points,0),302.5);
   assert.equal(data.results.find(r=>r.category==='gold'&&r.id===keeper).points,55);
   await assert.rejects(()=>store.publicResults(),/não publicados/);
  });
  await t.test('Mesmo nome pode enviar de novo e é sinalizado para revisão',async()=>{
   await reset();await open();
   await store.castBallot(ballot('José   da Silva','atleta','Preto'));
   await store.castBallot(ballot('  JOSE DA SILVA ','capitao','Branco'));
   const data=await store.adminSnapshot({filter:'duplicates'});
   assert.equal(data.summary.totalBallots,2);assert.equal(data.summary.duplicateNames,1);assert.equal(data.ballots.length,2);
   assert.ok(data.ballots.every(b=>b.duplicate_count===2&&b.duplicate_valid_count===2));
   const id=data.ballots[0].id;
   await store.moderateBallots({ids:[id],excluded:true,reason:'Envio repetido conferido'});
   const after=await store.adminSnapshot();assert.equal(after.summary.validBallots,1);assert.equal(after.summary.excludedBallots,1);
   assert.ok(after.ballots.every(b=>b.duplicate_valid_count===1));
   await store.moderateBallots({ids:[id],excluded:false,reason:'Identidade reavaliada'});
   assert.equal((await store.adminSnapshot()).summary.validBallots,2);
   assert.equal((await database().query('SELECT count(*)::int n FROM choices')).rows[0].n,34);
  });
  await t.test('Reenvio idêntico concorrente não duplica; novos envios simultâneos são permitidos',async()=>{
   await reset();await open();const payload=ballot();
   const [a,b]=await Promise.all([store.castBallot(payload),store.castBallot(payload)]);assert.equal(a.receipt,b.receipt);
   assert.equal((await store.adminSnapshot()).summary.totalBallots,1);
   await Promise.all([store.castBallot(ballot()),store.castBallot(ballot())]);
   assert.equal((await store.adminSnapshot()).summary.totalBallots,3);
   await assert.rejects(()=>store.castBallot({...payload,role:'capitao'}),/identificador/);
  });
  await t.test('Time inválido, perfil inválido e ranking incompleto não deixam registros parciais',async()=>{
   await reset();await open();
   for(const patch of [{name:''},{role:'visitante'},{team:'Organização'},{team:''},{gold:gold.slice(0,9)}])await assert.rejects(()=>store.castBallot({...ballot(),...patch}));
   assert.equal((await store.adminSnapshot()).summary.totalBallots,0);
   assert.equal((await database().query('SELECT count(*)::int n FROM choices')).rows[0].n,0);
  });
  await t.test('Desconsideração mantém soma exata e reflete no público após publicação',async()=>{
   await reset();await open();
   const captain=await store.castBallot(ballot('Capitão','capitao')),org=await store.castBallot(ballot('Organizador','organizacao'));
   await store.changeElection({status:'closed',reason:'Fim do teste'});
   await store.changeElection({status:'published',reason:'Publicação de teste'});
   assert.equal((await store.publicResults()).results.find(r=>r.category==='selection'&&r.id===keeper).weightedVotes,3.5);
   await store.moderateBallots({ids:[captain.receipt],excluded:true,reason:'Duplicidade confirmada'});
   assert.equal((await store.publicResults()).results.find(r=>r.category==='selection'&&r.id===keeper).weightedVotes,1.5);
   assert.equal((await store.adminSnapshot()).summary.byTeam.Azul,0);
   assert.equal((await store.adminSnapshot()).summary.byTeam['Organização'],1);
   await store.moderateBallots({ids:[captain.receipt],excluded:false,reason:'Validação posterior'});
   assert.equal((await store.publicResults()).results.find(r=>r.category==='selection'&&r.id===keeper).weightedVotes,3.5);
   await assert.rejects(()=>store.moderateBallots({ids:[org.receipt,randomUUID()],excluded:true,reason:'Teste em lote'}),/não foi encontrada/);
   assert.equal((await store.adminSnapshot()).summary.validBallots,2);
  });
  await t.test('Fluxo HTTP sem senha do eleitor; admin continua protegido',async()=>{
   await reset();
   const {createServer}=await import('../server.mjs');
   const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
   const origin='http://127.0.0.1:'+server.address().port;
   process.env.APP_ORIGIN=origin;process.env.ADMIN_PASSWORD='integration-admin-password';process.env.SESSION_SECRET='integration-secret-longer-than-32-characters';
   const call=async(route,method='GET',body,cookie)=>{
    const r=await fetch(origin+route,{method,headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
    return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
   };
   try{
    assert.equal((await call('/api/admin')).status,401);
    const login=await call('/api/admin','POST',{password:process.env.ADMIN_PASSWORD}),cookie=login.cookie;
    await call('/api/admin','PATCH',{action:'election',status:'open',reason:'Teste HTTP'},cookie);
    const payload=ballot('Organizador HTTP','organizacao');
    const sent=await call('/api/vote','POST',payload);assert.equal(sent.status,200);assert.deepEqual(Object.keys(sent.data).sort(),['ok','receipt']);
    const second=await call('/api/vote','POST',{...payload,requestId:randomUUID()});assert.equal(second.status,200);
    const config=await call('/api/config');assert.equal(config.data.roles,undefined);assert.equal(config.data.weights,undefined);
    const data=(await call('/api/admin','GET',undefined,cookie)).data;assert.equal(data.ballots[0].team,'Organização');assert.equal(data.summary.duplicateNames,1);
    await call('/api/admin','PATCH',{action:'moderate',ids:[second.data.receipt],excluded:true,reason:'Repetição conferida'},cookie);
    assert.equal((await call('/api/admin','GET',undefined,cookie)).data.summary.validBallots,1);
    assert.equal((await call('/api/results')).status,403);
    assert.equal((await call('/api/admin','DELETE',undefined,cookie)).status,200);
   }finally{await new Promise(resolve=>server.close(resolve));}
  });
 }finally{await closeDatabase();}
});
