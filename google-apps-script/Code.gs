// Cole este arquivo em Extensões > Apps Script da sua planilha.
// Propriedades do script: SHARED_SECRET (segredo longo), SPREADSHEET_ID (ID da planilha).
const ATHLETES = [{"id":"preto-01","team":"Preto","name":"Lucas Soares","position":"line"},{"id":"preto-02","team":"Preto","name":"Sano","position":"line"},{"id":"preto-03","team":"Preto","name":"Chagas","position":"line"},{"id":"preto-04","team":"Preto","name":"Euller","position":"line"},{"id":"preto-05","team":"Preto","name":"DIEGO Victor","position":"line"},{"id":"preto-06","team":"Preto","name":"Junior Valenca","position":"line"},{"id":"preto-07","team":"Preto","name":"Marciel","position":"line"},{"id":"preto-08","team":"Preto","name":"Diego Guerra","position":"line"},{"id":"preto-09","team":"Preto","name":"Victor Almeida","position":"line"},{"id":"preto-10","team":"Preto","name":"Davi","position":"line"},{"id":"preto-11","team":"Preto","name":"Joesley","position":"line"},{"id":"preto-12","team":"Preto","name":"Esaú","position":"line"},{"id":"branco-01","team":"Branco","name":"Welison Freire","position":"line"},{"id":"branco-02","team":"Branco","name":"Diogo","position":"line"},{"id":"branco-03","team":"Branco","name":"Eric","position":"line"},{"id":"branco-04","team":"Branco","name":"Gislando","position":"line"},{"id":"branco-05","team":"Branco","name":"Joao Pedro","position":"line"},{"id":"branco-06","team":"Branco","name":"Rai Marcos","position":"line"},{"id":"branco-07","team":"Branco","name":"Douglas Lira","position":"line"},{"id":"branco-08","team":"Branco","name":"Guilherme Vilanova","position":"line"},{"id":"branco-09","team":"Branco","name":"Tito","position":"line"},{"id":"branco-10","team":"Branco","name":"Samuel","position":"line"},{"id":"branco-11","team":"Branco","name":"Anderson","position":"line"},{"id":"branco-12","team":"Branco","name":"Joao Filho","position":"line"},{"id":"azul-01","team":"Azul","name":"Isac Fialho","position":"line"},{"id":"azul-02","team":"Azul","name":"Fernando","position":"line"},{"id":"azul-03","team":"Azul","name":"Guilherme","position":"line"},{"id":"azul-04","team":"Azul","name":"Junior Lemos","position":"line"},{"id":"azul-05","team":"Azul","name":"Raidom","position":"line"},{"id":"azul-06","team":"Azul","name":"Jasson","position":"line"},{"id":"azul-07","team":"Azul","name":"Pedro Lucas","position":"line"},{"id":"azul-08","team":"Azul","name":"Colombiano","position":"line"},{"id":"azul-09","team":"Azul","name":"Giulio","position":"line"},{"id":"azul-10","team":"Azul","name":"Brendo","position":"line"},{"id":"azul-11","team":"Azul","name":"Saul","position":"line"},{"id":"azul-12","team":"Azul","name":"Thalyson","position":"line"},{"id":"vermelho-01","team":"Vermelho","name":"Paulo Warison","position":"line"},{"id":"vermelho-02","team":"Vermelho","name":"Wellington","position":"line"},{"id":"vermelho-03","team":"Vermelho","name":"Karllos","position":"line"},{"id":"vermelho-04","team":"Vermelho","name":"Jean","position":"line"},{"id":"vermelho-05","team":"Vermelho","name":"Alysson","position":"line"},{"id":"vermelho-06","team":"Vermelho","name":"Cryslan","position":"line"},{"id":"vermelho-07","team":"Vermelho","name":"Mayran","position":"line"},{"id":"vermelho-08","team":"Vermelho","name":"Renato","position":"line"},{"id":"vermelho-09","team":"Vermelho","name":"Claudio","position":"line"},{"id":"vermelho-10","team":"Vermelho","name":"Beethoven","position":"line"},{"id":"vermelho-11","team":"Vermelho","name":"Johne","position":"line"},{"id":"vermelho-12","team":"Vermelho","name":"Emanuel","position":"line"},{"id":"goleiro-1","team":"Azul","name":"Arlem","position":"goalkeeper"},{"id":"goleiro-2","team":"Branco","name":"Matheus","position":"goalkeeper"},{"id":"goleiro-3","team":"Vermelho","name":"Medrado","position":"goalkeeper"},{"id":"goleiro-4","team":"Vermelho","name":"Junior","position":"goalkeeper"},{"id":"goleiro-5","team":"Preto","name":"Ochoa","position":"goalkeeper"},{"id":"goleiro-6","team":"Preto","name":"Carlin","position":"goalkeeper"}];
const HEADERS = {
 Jogadores: ['id_jogador','time','nome','posicao'],
 Votos: ['data_hora','protocolo','categoria','nome_eleitor','time_eleitor','ids_jogadores','id_envio'],
 Resultados: ['categoria','posicao','id_jogador','nome','time','votos','pontos']
};
function db_(){const id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');if(!id)throw new Error('Configure SPREADSHEET_ID.');return SpreadsheetApp.openById(id);}
function init_(){
 const db=db_();
 Object.keys(HEADERS).forEach(name=>{
  let sheet=db.getSheetByName(name);if(!sheet)sheet=db.insertSheet(name);
  if(sheet.getLastRow()===0){sheet.appendRow(HEADERS[name]);sheet.setFrozenRows(1);sheet.getRange(1,1,1,HEADERS[name].length).setFontWeight('bold').setBackground('#542482').setFontColor('#ffffff');}
 });
 return db;
}
function configurarPlanilha(){
 const db=init_(),sheet=db.getSheetByName('Jogadores');
 if(sheet.getLastRow()===1)sheet.getRange(2,1,ATHLETES.length,4).setValues(ATHLETES.map(p=>[p.id,p.team,p.name,p.position==='goalkeeper'?'Goleiro':'Linha']));
 const props=PropertiesService.getScriptProperties();
 if(!props.getProperty('VOTING_OPEN'))props.setProperty('VOTING_OPEN','false');
}
function abrirVotacao(){
 const props=PropertiesService.getScriptProperties();if(!props.getProperty('SHARED_SECRET'))throw new Error('Configure SHARED_SECRET.');
 const db=init_();db.getSheetByName('Resultados').getRange('A2:G').clearContent();
 props.setProperty('RESULTS_PUBLISHED','false');
 props.setProperty('VOTING_OPEN','true');
}
function json_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
function safeText_(value){return /^[=+@\-\t\r]/.test(value)?"'"+value:value;}
function validChoices_(category,ids){
 if(!Array.isArray(ids)||new Set(ids).size!==ids.length)return false;
 const chosen=ids.map(id=>ATHLETES.find(p=>p.id===id));
 if(chosen.some(p=>!p))return false;
 return category==='gold'?chosen.length===10:chosen.length===7&&chosen.filter(p=>p.position==='goalkeeper').length===1&&chosen.filter(p=>p.position==='line').length===6;
}
function doPost(e){
 let data;
 try{if(!e||!e.postData||e.postData.contents.length>8192)return json_({ok:false,error:'Requisição inválida.'});data=JSON.parse(e.postData.contents);}catch(_){return json_({ok:false,error:'Requisição inválida.'});}
 const props=PropertiesService.getScriptProperties(),secret=props.getProperty('SHARED_SECRET');
 if(!secret||data.secret!==secret)return json_({ok:false,error:'Acesso negado.'});
 if(data.action==='status')return json_({ok:true,open:props.getProperty('VOTING_OPEN')==='true',resultsAvailable:props.getProperty('RESULTS_PUBLISHED')==='true'&&props.getProperty('VOTING_OPEN')!=='true'});
 if(data.action==='results'){
  if(props.getProperty('VOTING_OPEN')==='true'||props.getProperty('RESULTS_PUBLISHED')!=='true')return json_({ok:false,error:'Resultados ainda não publicados.'});
  const rows=db_().getSheetByName('Resultados').getDataRange().getValues().slice(1);
  return json_({ok:true,results:rows.map(r=>({category:r[0],position:r[1],id:r[2],name:r[3],team:r[4],votes:r[5],points:r[6]}))});
 }
 const {selection,gold,name,team,requestId}=data;
 if(typeof name!=='string'||name.trim().length<2||name.length>100||!['Preto','Branco','Vermelho','Azul'].includes(team)||typeof requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))return json_({ok:false,error:'Dados inválidos.'});
 if(!validChoices_('selection',selection)||!validChoices_('gold',gold))return json_({ok:false,error:'Complete sua Seleção e o ranking de 10 atletas.'});
 const ballot=JSON.stringify({selection:[...selection].sort(),gold});
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(15000))return json_({ok:false,error:'Sistema ocupado. Tente novamente.'});
 try{
  if(props.getProperty('VOTING_OPEN')!=='true')return json_({ok:false,code:'CLOSED',error:'A votação está fechada.'});
  const db=init_(),votes=db.getSheetByName('Votos');
  const previous=votes.getDataRange().getValues().slice(1).find(row=>row[6]===requestId);
  if(previous){
   const same=previous[2]==='ballot'&&previous[3]===safeText_(name.trim())&&previous[4]===team&&previous[5]===ballot;
   return same?json_({ok:true,receipt:previous[1]}):json_({ok:false,code:'DUPLICATE',error:'Este envio já foi registrado com outras escolhas.'});
  }
  const receipt=Utilities.getUuid();
  votes.appendRow([new Date(),receipt,'ballot',safeText_(name.trim()),team,ballot,requestId]);
  SpreadsheetApp.flush();
  return json_({ok:true,receipt});
 }catch(_){return json_({ok:false,error:'Não foi possível registrar. Tente novamente sem alterar as escolhas.'});}
 finally{lock.releaseLock();}
}
// Fecha antes de ler os votos. A apuração fica apenas na planilha privada.
function encerrarEApurar(){
 const lock=LockService.getScriptLock();lock.waitLock(20000);
 try{
 PropertiesService.getScriptProperties().setProperty('VOTING_OPEN','false');
 PropertiesService.getScriptProperties().setProperty('RESULTS_PUBLISHED','false');
 const db=init_(),counts={selection:{},gold:{}},points={};
 db.getSheetByName('Votos').getDataRange().getValues().slice(1).forEach(row=>{
  const data=JSON.parse(row[5]);
  const votes=row[2]==='ballot'?[['selection',data.selection],['gold',data.gold]]:[[row[2],data]];
  votes.forEach(([category,ids])=>{
   if(!counts[category]||!validChoices_(category,ids))throw new Error('Há voto antigo ou inválido. Use uma planilha da votação atual.');
   ids.forEach((id,index)=>{counts[category][id]=(counts[category][id]||0)+1;if(category==='gold')points[id]=(points[id]||0)+(10-index);});
  });
 });
 const rows=['selection','gold'].flatMap(category=>ATHLETES.map(p=>[category,p.position==='goalkeeper'?'Goleiro':'Linha',p.id,p.name,p.team,counts[category][p.id]||0,category==='gold'?(points[p.id]||0):0]).sort((a,b)=>(category==='gold'?b[6]-a[6]:b[5]-a[5])||a[3].localeCompare(b[3],'pt-BR')));
 const sheet=db.getSheetByName('Resultados');sheet.getRange('A2:G').clearContent();sheet.getRange(2,1,rows.length,7).setValues(rows);
 SpreadsheetApp.flush();
 PropertiesService.getScriptProperties().setProperty('RESULTS_PUBLISHED','true');
 }finally{lock.releaseLock();}
}
