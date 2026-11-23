const $=selector=>document.querySelector(selector);
const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
const date=value=>value?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(value)):'Nenhum voto ainda';
let authenticated=false,busy=false,timer,page=1,snapshotData=null,pendingAction=null;
const selectedIds=new Set();
const number=value=>Number(value).toLocaleString('pt-BR',{maximumFractionDigits:1});
const roleLabels={capitao:'Capitão',organizacao:'Organização',atleta:'Atleta',tecnico:'Técnico'};
function showLogin(message=''){authenticated=false;clearInterval(timer);if($('#ballot-detail-dialog').open)$('#ballot-detail-dialog').close();clearBallotDetails();$('#login-panel').hidden=false;$('#dashboard').hidden=true;$('#login-error').textContent=message;$('#admin-rankings').replaceChildren();$('#ballots-list').replaceChildren();$('#audit-list').replaceChildren();selectedIds.clear();$('#admin-password').value='';}
function showDashboard(){authenticated=true;$('#login-panel').hidden=true;$('#dashboard').hidden=false;$('#admin-password').value='';clearInterval(timer);timer=setInterval(()=>{if(authenticated&&$('#auto-refresh').checked&&!document.hidden&&!selectedIds.size&&!$('#action-dialog').open&&!$('#ballot-detail-dialog').open)load();},30000);}
function render(data){
 $('#admin-status').textContent=data.open?'● Votação aberta':'Votação encerrada ou ainda não aberta';
 $('#updated-at').textContent='Consultado em '+date(data.updatedAt);
 $('#total-ballots').textContent=data.summary.totalBallots;
 $('#total-points').textContent=data.results.filter(r=>r.category==='gold').reduce((sum,r)=>sum+r.points,0);
 $('#last-vote').textContent=date(data.summary.lastVote);
 $('#team-stats').replaceChildren();
 for(const role of Object.keys(roleLabels)){
  const n=data.summary.byRole[role]||0,percentage=data.summary.validBallots?Math.round(n/data.summary.validBallots*100):0;
  const card=el('article','team-stat');card.append(el('span','',roleLabels[role]),el('strong','',n+' cédula'+(n===1?'':'s')),el('small','',percentage+'% das válidas'));
  const meter=el('div','team-meter'),fill=el('span');fill.style.width=percentage+'%';meter.append(fill);card.append(meter);$('#team-stats').append(card);
 }

 $('#team-participation').replaceChildren();
 for(const team of ['Preto','Branco','Vermelho','Azul','Organização']){
  const card=el('article','team-stat');card.append(el('span','',team),el('strong','',(data.summary.byTeam[team]||0)+' cédulas válidas'));$('#team-participation').append(card);
 }

 $('#admin-rankings').replaceChildren();
 for(const [category,position,title,help] of [['selection','Goleiro','Goleiro','Votos ponderados para a vaga de goleiro.'],['selection','Linha','Jogadores de linha','Votos ponderados para as 6 vagas de linha.'],['gold',null,'Bola de Ouro','Classificação pela soma de pontos das posições.']]){
  const section=el('section','admin-ranking');section.append(el('h2','',title),el('p','',help));
  const rows=data.results.filter(r=>r.category===category&&(!position||r.position===position)).sort((a,b)=>(category==='gold'?b.points-a.points:b.weightedVotes-a.weightedVotes)||a.name.localeCompare(b.name,'pt-BR'));
  const list=el('ol');let rank=0,lastScore;
  rows.forEach((row,index)=>{
   const score=category==='gold'?row.points:row.weightedVotes;if(score!==lastScore)rank=index+1;lastScore=score;
   const li=el('li'),athlete=el('span','athlete',row.name);athlete.append(el('small','',row.team+' · '+row.position));
   const points=el('span','score',number(score)+(category==='gold'?' pts':' votos ponderados'));
   points.append(el('small','',row.votes+' indicações'));
   li.append(el('span','place',score?rank+'º':'—'),athlete,points);list.append(li);
  });
  section.append(list);$('#admin-rankings').append(section);
 }
 renderManagement(data);
}
async function load(){
 if(busy)return;busy=true;$('#refresh').disabled=true;$('#dashboard-error').textContent='';
 try{
  const response=await fetch('/api/admin?'+new URLSearchParams({page:String(page),query:$('#ballot-query').value,filter:$('#ballot-filter').value}),{cache:'no-store'}),data=await response.json();
  if(response.status===401){showLogin();return;}
  if(!response.ok){if(authenticated)$('#dashboard-error').textContent=data.error;else showLogin(data.error);return;}
  if(selectedIds.size||$('#action-dialog').open||$('#ballot-detail-dialog').open)return;
  if(!authenticated)showDashboard();render(data);
 }catch{if(authenticated)$('#dashboard-error').textContent='Falha ao consultar. Os dados exibidos podem estar desatualizados.';else showLogin('Não foi possível conectar ao painel.');}
 finally{busy=false;$('#refresh').disabled=false;}
}
$('#admin-login').addEventListener('submit',async event=>{
 event.preventDefault();$('#login-button').disabled=true;$('#login-error').textContent='';
 try{
  const response=await fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('#admin-password').value})}),data=await response.json();
  if(!response.ok){$('#login-error').textContent=data.error||'Não foi possível entrar.';return;}
  showDashboard();await load();
 }catch{$('#login-error').textContent='Não foi possível entrar. Tente novamente.';}
 finally{$('#login-button').disabled=false;}
});
$('#logout').addEventListener('click',async()=>{
 $('#logout').disabled=true;
 try{const response=await fetch('/api/admin',{method:'DELETE'});if(!response.ok)throw new Error();showLogin('Sessão encerrada.');}
 catch{$('#dashboard-error').textContent='Não foi possível encerrar a sessão. Tente novamente.';}
 finally{$('#logout').disabled=false;}
});
$('#refresh').addEventListener('click',()=>{selectedIds.clear();load();});


function selectionCount(){const n=selectedIds.size;$('#selection-count').textContent=n+' selecionadas';$('#exclude-selected').disabled=!n;$('#restore-selected').disabled=!n;}
function showAction(payload,title,description){
 pendingAction=payload;$('#action-title').textContent=title;$('#action-description').textContent=description;$('#action-reason').value='';$('#action-error').textContent='';$('#action-dialog').showModal();
}
function renderManagement(data){
 snapshotData=data;selectedIds.clear();$('#select-page').checked=false;selectionCount();
 $('#valid-ballots').textContent=data.summary.validBallots;$('#excluded-ballots').textContent=data.summary.excludedBallots;$('#duplicate-names').textContent=data.summary.duplicateNames;
 $('#ballots-list').replaceChildren();
 for(const b of data.ballots){
  const row=el('tr'),choice=el('input');choice.type='checkbox';choice.setAttribute('aria-label','Selecionar cédula de '+b.name+' — '+b.id.slice(0,8));choice.addEventListener('change',()=>{if(choice.checked)selectedIds.add(b.id);else selectedIds.delete(b.id);selectionCount();});
  const box=el('td');box.append(choice);
  const who=el('td','',b.name);who.append(el('small','',date(b.date)),el('small','',b.id));
  if(b.duplicate_count>1)who.append(el('small','duplicate-flag','Possível repetição: '+b.duplicate_count+' recebidas · '+b.duplicate_valid_count+' válidas'));
  if(b.retired_choice_count)who.append(el('small','duplicate-flag','Contém escolha de atleta retirado do elenco. Confira esta cédula.'));
  const profile=el('td','',b.roleLabel);profile.append(el('small','',number(b.weight)+'×'));
  const status=el('td','',b.excluded?'Desconsiderada':'Válida');if(b.exclusion_reason)status.append(el('small','',b.exclusion_reason));
  const detailsCell=el('td'),detailsButton=el('button','secondary','Ver voto');detailsButton.type='button';detailsButton.setAttribute('aria-label','Ver voto de '+b.name+' — '+b.id.slice(0,8));detailsButton.addEventListener('click',()=>viewBallot(b.id));detailsCell.append(detailsButton);
  row.append(box,who,el('td','',b.team||'Não informado'),profile,status,detailsCell);$('#ballots-list').append(row);
 }
 if(!data.ballots.length){const row=el('tr'),cell=el('td','','Nenhuma cédula encontrada.');cell.colSpan=6;row.append(cell);$('#ballots-list').append(row);}
 $('#page-label').textContent='Página '+data.pagination.page+' de '+data.pagination.pages+' · '+data.pagination.total+' cédulas';
 $('#previous-page').disabled=data.pagination.page<=1;$('#next-page').disabled=data.pagination.page>=data.pagination.pages;
 const labels={'ballot.exclude':'Cédula desconsiderada','ballot.restore':'Cédula restaurada','voter.create':'Eleitor cadastrado','voter.active':'Acesso de eleitor alterado','election.open':'Votação aberta','election.closed':'Votação encerrada','election.published':'Resultados publicados'};
 $('#audit-list').replaceChildren();
 for(const event of data.audit){const row=el('tr');row.append(el('td','',date(event.created_at)),el('td','',labels[event.action]||event.action),el('td','',event.target_id||'Votação'),el('td','',event.reason));$('#audit-list').append(row);}
}
async function mutate(payload){
 const response=await fetch('/api/admin',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),data=await response.json();
 if(response.status===401)showLogin('Sessão expirada. Entre novamente.');
 if(!response.ok)throw new Error(data.error||'Não foi possível concluir a alteração.');
 return data;
}
$('#ballot-search').addEventListener('submit',event=>{event.preventDefault();page=1;selectedIds.clear();load();});
$('#select-page').addEventListener('change',event=>{selectedIds.clear();for(const b of snapshotData?.ballots||[])if(event.target.checked)selectedIds.add(b.id);document.querySelectorAll('#ballots-list input[type=checkbox]').forEach(input=>{input.checked=event.target.checked;});selectionCount();});
$('#previous-page').addEventListener('click',()=>{if(page>1){page--;selectedIds.clear();load();}});
$('#next-page').addEventListener('click',()=>{if(page<(snapshotData?.pagination.pages||1)){page++;selectedIds.clear();load();}});
$('#exclude-selected').addEventListener('click',()=>{if(selectedIds.size)showAction({action:'moderate',ids:[...selectedIds],excluded:true},'Desconsiderar '+selectedIds.size+' cédula(s)','As cédulas selecionadas sairão das duas eleições e de todos os totais válidos. O registro original será preservado.');});
$('#restore-selected').addEventListener('click',()=>{if(selectedIds.size)showAction({action:'moderate',ids:[...selectedIds],excluded:false},'Restaurar '+selectedIds.size+' cédula(s)','As cédulas selecionadas voltarão aos cálculos das duas eleições com seu peso original.');});
$('#cancel-action').addEventListener('click',()=>$('#action-dialog').close());
$('#action-form').addEventListener('submit',async event=>{
 event.preventDefault();if(!pendingAction)return;const button=$('#confirm-action');button.disabled=true;$('#cancel-action').disabled=true;$('#action-error').textContent='';
 try{await mutate({...pendingAction,reason:$('#action-reason').value.trim()});$('#action-dialog').close();pendingAction=null;selectedIds.clear();await load();}
 catch(error){$('#action-error').textContent=error.message;}
 finally{button.disabled=false;$('#cancel-action').disabled=false;}
});
document.querySelectorAll('[data-election]').forEach(button=>button.addEventListener('click',()=>{
 const status=button.dataset.election,title={open:'Abrir votação',closed:'Encerrar votação',published:'Publicar resultados'}[status];
 showAction({action:'election',status},title,status==='published'?'Os resultados ponderados válidos ficarão visíveis ao público. Encerre a votação antes.':status==='open'?'Novos envios serão aceitos. Resultados públicos anteriores ficarão ocultos.':'Novos envios serão bloqueados. Resultados só ficam públicos quando você publicar.');
}));


let detailRequest=0;
function clearBallotDetails(){
 detailRequest++;
 $('#ballot-detail-content').hidden=true;
 $('#ballot-detail-meta').replaceChildren();
 $('#ballot-detail-selection').replaceChildren();
 $('#ballot-detail-gold').replaceChildren();
 $('#ballot-detail-notice').textContent='';
 $('#ballot-detail-totals').textContent='';
 $('#ballot-detail-status').textContent='';
 $('#ballot-detail-title').textContent='Detalhes da cédula';
}
function renderBallotDetails(data){
 const b=data.ballot;
 $('#ballot-detail-title').textContent='Voto de '+b.name;
 const meta=$('#ballot-detail-meta');meta.replaceChildren();
 for(const [label,value] of [['Eleitor',b.name],['Time',b.team||'Não informado'],['Perfil informado',b.roleLabel],['Peso aplicado',number(b.weight)+'×'],['Data e hora',date(b.date)],['Protocolo',b.id],['Estado',b.excluded?'Desconsiderada':'Válida']]){
  const group=el('div');group.append(el('dt','',label),el('dd','',value));meta.append(group);
 }
 if(b.excluded&&b.exclusionReason){const group=el('div');group.append(el('dt','','Motivo da desconsideração'),el('dd','',b.exclusionReason));meta.append(group);}
 $('#ballot-detail-notice').textContent=b.excluded?'Esta cédula está desconsiderada e não soma em nenhuma das eleições. As escolhas e pontuações originais permanecem abaixo.':'A coluna “Na apuração” mostra a contribuição atual de cada escolha. Atletas retirados do elenco não entram na classificação.';
 for(const [category,rows] of [['selection',data.selection],['gold',data.gold]]){
  const body=$('#ballot-detail-'+category);body.replaceChildren();
  for(const choice of rows){
   const row=el('tr'),athlete=el('td','',choice.name);athlete.append(el('small','',choice.team));if(!choice.active)athlete.append(el('small','duplicate-flag','Retirado do elenco'));
   if(category==='gold')row.append(el('td','',choice.rank+'º'));
   row.append(athlete);
   if(category==='gold')row.append(el('td','',number(choice.basePoints)));else row.append(el('td','',choice.position));
   row.append(el('td','',number(choice.weightedPoints)),el('td','',number(choice.effectivePoints)));body.append(row);
  }
 }
 $('#ballot-detail-totals').textContent='Contribuição atual: '+number(data.totals.selection)+' votos ponderados na Seleção e '+number(data.totals.gold)+' pontos na Bola de Ouro.';
 $('#ballot-detail-content').hidden=false;
}
async function viewBallot(id){
 clearBallotDetails();const request=detailRequest,dialog=$('#ballot-detail-dialog');
 $('#ballot-detail-status').textContent='Carregando escolhas…';if(!dialog.open)dialog.showModal();
 $('#ballot-detail-title').focus();
 try{
  const response=await fetch('/api/admin?'+new URLSearchParams({ballotId:id}),{cache:'no-store'}),data=await response.json();
  if(request!==detailRequest||!dialog.open)return;
  if(response.status===401){dialog.close();showLogin('Sessão expirada. Entre novamente.');return;}
  if(!response.ok)throw new Error(data.error||'Não foi possível consultar esta cédula.');
  renderBallotDetails(data);$('#ballot-detail-status').textContent='';
 }catch(error){if(request===detailRequest&&dialog.open)$('#ballot-detail-status').textContent=error.message||'Falha ao consultar a cédula.';}
}
$('#ballot-detail-dialog').addEventListener('close',clearBallotDetails);

load();
