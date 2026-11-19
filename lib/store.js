const RESULTS_SQL="SELECT cat.category,p.id,p.name,p.team,p.position,\n count(b.id)::int AS votes,\n coalesce(sum(b.weight_units),0)::numeric/2 AS weighted_votes,\n coalesce(sum((11-c.rank)*b.weight_units) FILTER(WHERE cat.category='gold'),0)::numeric/2 AS points\n FROM players p CROSS JOIN (VALUES('selection'),('gold')) AS cat(category)\n LEFT JOIN choices c ON c.player_id=p.id AND c.category=cat.category\n LEFT JOIN ballots b ON b.id=c.ballot_id AND NOT b.excluded\n WHERE p.active\n GROUP BY cat.category,p.id,p.name,p.team,p.position";
import {randomUUID} from 'node:crypto';
import {database,transaction} from './db.js';
import {ROLES,TEAMS,UUID,normalizeName,ballotHash,checkChoices,fail} from './rules.js';
async function audit(client,action,target,reason,before,after){
 await client.query('INSERT INTO audit_events(actor,action,target_id,reason,before_state,after_state) VALUES($1,$2,$3,$4,$5,$6)',['admin',action,target,reason,JSON.stringify(before),JSON.stringify(after)]);
}
function requireReason(reason){if(typeof reason!=='string'||reason.trim().length<3||reason.length>500)fail('Informe um motivo entre 3 e 500 caracteres.');return reason.trim();}
async function stateRow(client,lock=''){return (await client.query('SELECT * FROM election WHERE id=1 '+lock)).rows[0]||fail('Banco ainda não foi inicializado.',503);}
export async function configuration(){
 const row=await stateRow(database());
 return {open:row.is_open,reason:row.is_open?'open':'closed',resultsAvailable:row.results_published,selection:{goalkeepers:1,line:6},gold:{size:10,points:[10,9,8,7,6,5,4,3,2,1]}};
}
export async function castBallot(body){
 if(!body||!UUID.test(body.requestId||'')||typeof body.name!=='string'||body.name.trim().length<2||body.name.length>100||!Object.hasOwn(ROLES,body.role))fail('Informe seu nome e um perfil válido.');
 const name=body.name.trim().replace(/\s+/g,' '),nameKey=normalizeName(name);
 const team=body.role==='organizacao'?'Organização':body.team;
 if(body.role!=='organizacao'&&!TEAMS.includes(team))fail('Selecione um time válido.');
 return transaction(async client=>{
  const state=await stateRow(client,'FOR SHARE');
  const roster=(await client.query('SELECT id,position FROM players WHERE active')).rows;
  checkChoices(body.selection,body.gold,roster);
  const hash=ballotHash(body.selection,body.gold);
  const same=b=>b.name_key===nameKey&&b.role===body.role&&b.team===team&&b.payload_hash===hash;
  const existing=(await client.query('SELECT * FROM ballots WHERE request_id=$1',[body.requestId])).rows[0];
  if(existing){if(same(existing))return {ok:true,receipt:existing.id};fail('Este identificador já foi usado em outro envio.',409);}
  if(!state.is_open)fail('A votação está fechada.',403);
  const id=randomUUID();
  const inserted=await client.query('INSERT INTO ballots(id,request_id,name,name_key,team,role,weight_units,payload_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(request_id) DO NOTHING RETURNING id',[id,body.requestId,name,nameKey,team,body.role,ROLES[body.role].units,hash]);
  if(!inserted.rowCount){
   const previous=(await client.query('SELECT * FROM ballots WHERE request_id=$1',[body.requestId])).rows[0];
   if(previous&&same(previous))return {ok:true,receipt:previous.id};
   fail('Este identificador já foi usado em outro envio.',409);
  }
  for(const [category,ids] of [['selection',body.selection],['gold',body.gold]]){
   for(let i=0;i<ids.length;i++)await client.query('INSERT INTO choices(ballot_id,category,player_id,rank) VALUES($1,$2,$3,$4)',[id,category,ids[i],category==='gold'?i+1:null]);
  }
  return {ok:true,receipt:id};
 });
}
async function results(client){
 const rows=(await client.query(RESULTS_SQL)).rows;
 return rows.map(r=>({...r,position:r.position==='goalkeeper'?'Goleiro':'Linha',weightedVotes:Number(r.weighted_votes),points:Number(r.points)}));
}
export async function publicResults(){
 return transaction(async client=>{
  const state=await stateRow(client);
  if(!state.results_published||state.is_open)fail('Resultados ainda não publicados.',403);
  return {results:await results(client)};
 },{readOnly:true});
}
export async function adminSnapshot({page=1,query='',filter='all'}={}){
 page=Math.max(1,Math.min(10000,Number(page)||1));page=Math.floor(page);
 return transaction(async client=>{
  const state=await stateRow(client);
  const rows=(await client.query('SELECT count(*)::int total,count(*) FILTER(WHERE NOT excluded)::int valid,count(*) FILTER(WHERE excluded)::int excluded,max(created_at) last_vote FROM ballots')).rows[0];
  const byRole=Object.fromEntries(Object.keys(ROLES).map(r=>[r,0]));
  for(const r of (await client.query('SELECT role,count(*)::int total FROM ballots WHERE NOT excluded GROUP BY role')).rows)byRole[r.role]=r.total;
  const byTeam=Object.fromEntries([...TEAMS,'Organização'].map(t=>[t,0]));
  for(const r of (await client.query('SELECT team,count(*)::int total FROM ballots WHERE NOT excluded GROUP BY team')).rows)if(r.team)byTeam[r.team]=r.total;
  const duplicateNames=(await client.query('SELECT count(*)::int n FROM (SELECT name_key FROM ballots GROUP BY name_key HAVING count(*)>1) d')).rows[0].n;
  const args=['%'+String(query).slice(0,100)+'%',['excluded','valid','duplicates'].includes(filter)?filter:'all'];
  const where="WHERE (name ILIKE $1 OR team ILIKE $1) AND ($2='all' OR ($2='excluded' AND excluded) OR ($2='valid' AND NOT excluded) OR ($2='duplicates' AND name_key IN (SELECT name_key FROM ballots GROUP BY name_key HAVING count(*)>1)))";
  const total=(await client.query('SELECT count(*)::int total FROM ballots '+where,args)).rows[0].total;
  const ballots=(await client.query('SELECT id,name,team,role,weight_units,excluded,exclusion_reason,created_at,(SELECT count(*)::int FROM choices c JOIN players p ON p.id=c.player_id WHERE c.ballot_id=ballots.id AND NOT p.active) AS retired_choice_count,(SELECT count(*)::int FROM ballots other WHERE other.name_key=ballots.name_key) AS duplicate_count,(SELECT count(*)::int FROM ballots other WHERE other.name_key=ballots.name_key AND NOT other.excluded) AS duplicate_valid_count FROM ballots '+where+' ORDER BY created_at DESC,id LIMIT 50 OFFSET $3',[...args,(page-1)*50])).rows.map(b=>({...b,weight:b.weight_units/2,date:b.created_at,roleLabel:ROLES[b.role].label}));
  const auditLog=(await client.query('SELECT id,actor,action,target_id,reason,created_at FROM audit_events ORDER BY id DESC LIMIT 100')).rows;

  return {ok:true,open:state.is_open,resultsPublished:state.results_published,updatedAt:new Date().toISOString(),summary:{totalBallots:rows.total,validBallots:rows.valid,excludedBallots:rows.excluded,byRole,byTeam,duplicateNames,lastVote:rows.last_vote,recent:ballots},results:await results(client),ballots,pagination:{page,total,pages:Math.max(1,Math.ceil(total/50))},audit:auditLog};
 },{readOnly:true});
}
export async function moderateBallots({ids,excluded,reason}){
 reason=requireReason(reason);
 if(!Array.isArray(ids)||!ids.length||ids.length>100||new Set(ids).size!==ids.length||ids.some(id=>!UUID.test(id))||typeof excluded!=='boolean')fail('Selecione de 1 a 100 cédulas válidas.');
 return transaction(async client=>{
  await stateRow(client,'FOR UPDATE');
  const rows=(await client.query('SELECT id,excluded,exclusion_reason FROM ballots WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[ids])).rows;
  if(rows.length!==ids.length)fail('Uma das cédulas não foi encontrada.',404);
  let changed=0;
  for(const row of rows){
   if(row.excluded===excluded)continue;
   await client.query('UPDATE ballots SET excluded=$1,exclusion_reason=$2 WHERE id=$3',[excluded,excluded?reason:null,row.id]);
   await audit(client,excluded?'ballot.exclude':'ballot.restore',row.id,reason,row,{excluded,exclusion_reason:excluded?reason:null});changed++;
  }
  return {ok:true,changed};
 });
}
export async function changeElection({status,reason}){
 reason=requireReason(reason);
 if(!['open','closed','published'].includes(status))fail('Estado inválido.');
 return transaction(async client=>{
  const before=await stateRow(client,'FOR UPDATE');
  if(status==='published'&&before.is_open)fail('Encerre a votação antes de publicar os resultados.',409);
  const after=(await client.query('UPDATE election SET is_open=$1,results_published=$2 WHERE id=1 RETURNING *',[status==='open',status==='published'])).rows[0];
  await audit(client,'election.'+status,null,reason,before,after);return {ok:true};
 });
}
