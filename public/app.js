const $=selector=>document.querySelector(selector);
const categories={selection:'Seleção do Campeonato',gold:'Bola de Ouro'};
const state={players:[],step:0,position:'goalkeeper',team:'Todos',search:'',picks:{selection:new Set(),gold:new Set()},config:{open:false},pending:false,request:null,receipt:null};
const norm=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function selected(category=state.step<2?'selection':'gold'){
 const list=[...state.picks[category]].map(id=>state.players.find(p=>p.id===id));
 return category==='gold'?list:list.sort((a,b)=>(a.position==='goalkeeper'?0:1)-(b.position==='goalkeeper'?0:1));
}
function complete(category){
 const picks=selected(category);
 return category==='gold'?picks.length===10:picks.filter(p=>p.position==='goalkeeper').length===1&&picks.filter(p=>p.position==='line').length===6;
}
function element(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
function go(step){
 if(state.pending)return;
 if(step>=2&&!complete('selection'))return;
 if(step===3&&!complete('gold'))return;
 state.step=step;state.search='';state.team='Todos';$('#search').value='';$('#notice').textContent='';$('#send-notice').textContent='';
 render();$('#vote-title').focus();$('#voting-flow').scrollIntoView({block:'start',behavior:'smooth'});
}
function toggle(player){
 if(state.pending)return;
 const category=state.step<2?'selection':'gold',set=state.picks[category];
 if(set.has(player.id))set.delete(player.id);
 else if(category==='gold'){
  if(set.size>=10){$('#notice').textContent='Seu ranking já tem 10 atletas. Remova um para escolher outro.';return;}
  set.add(player.id);
 }else{
  const same=selected('selection').filter(p=>p.position===player.position),limit=player.position==='goalkeeper'?1:6;
  if(same.length>=limit){$('#notice').textContent=limit===1?'Remova o goleiro escolhido antes de escolher outro.':'Você já escolheu os 6 jogadores de linha. Remova um para trocar.';return;}
  set.add(player.id);if(player.position==='goalkeeper')state.position='line';
 }
 $('#notice').textContent='';render();
}
function reviewList(category,host){
 host.replaceChildren();
 selected(category).forEach((p,index)=>{
  const row=element('li','review-athlete'),details=element('span','',p.name);
  details.append(element('small','',p.team+' · '+(p.position==='goalkeeper'?'Goleiro':'Linha')));
  if(category==='gold')row.append(element('span','review-place',(index+1)+'º'));
  row.append(details);
  if(category==='gold')row.append(element('strong','',(10-index)+' ponto'+(index===9?'':'s')));
  host.append(row);
 });
}
function render(){
 const category=state.step<2?'selection':'gold',editing=state.step===0||state.step===2;
 $('#edit-workspace').hidden=!editing||Boolean(state.receipt);
 $('#selection-review').hidden=state.step!==1||Boolean(state.receipt);
 $('#final-review').hidden=state.step!==3||Boolean(state.receipt);
 $('#success').hidden=!state.receipt;
 $('#flow-steps').hidden=Boolean(state.receipt);
 const titles=['Monte a sua Seleção','Revise sua Seleção','Monte seu top 10 da Bola de Ouro','Revise e envie seus votos'];
 $('#vote-title').textContent=state.receipt?'Votos registrados!':titles[state.step];
 document.querySelectorAll('[data-step]').forEach(el=>{
  const n=Number(el.dataset.step);el.classList.toggle('current',n===state.step);el.classList.toggle('done',n<state.step);
  if(n===state.step)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');
 });
 document.querySelectorAll('[data-go]').forEach(b=>{b.disabled=state.pending;});
 $('#send').disabled=state.pending||!state.config.open||!complete('selection')||!complete('gold');
 $('#send').textContent=state.pending?'Enviando seus votos…':'Enviar meus votos →';
 $('#voter-name').disabled=state.pending;$('#voter-team').disabled=state.pending;
 $('#final-availability').textContent=state.config.open?'Seus dois votos serão enviados juntos ao confirmar.':'A votação está fechada. Você pode revisar as escolhas, mas o envio ainda não está disponível.';
 if(state.step===1)reviewList('selection',$('#selection-review-list'));
 if(state.step===3){reviewList('selection',$('#final-selection-list'));reviewList('gold',$('#final-gold-list'));}
 if(state.receipt){$('#receipt').textContent=state.receipt;return;}
 if(!editing)return;
 document.querySelectorAll('[data-team]').forEach(b=>{const active=b.dataset.team===state.team;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});
 $('#category-title').textContent=category==='selection'?'Escolha seus destaques em campo':'Do primeiro ao décimo lugar';
 $('#position-menu').hidden=category!=='selection';$('#position-help').hidden=category!=='selection';
 $('#position-help').textContent=state.position==='goalkeeper'?'Escolha 1 goleiro. Depois, monte seu time com 6 jogadores de linha.':'Escolha os 6 jogadores de linha. Volte ao menu Goleiro se quiser trocar.';
 $('#goalkeeper-count').textContent=selected('selection').filter(p=>p.position==='goalkeeper').length+'/1';
 $('#line-count').textContent=selected('selection').filter(p=>p.position==='line').length+'/6';
 document.querySelectorAll('[data-position]').forEach(b=>{const active=b.dataset.position===state.position;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});
 $('#rule').textContent=category==='selection'?'1 goleiro + 6 jogadores de linha.':'Escolha 10 atletas: o 1º recebe 10 pontos, até o 10º receber 1 ponto.';
 $('#ballot-title').textContent=categories[category];
 const picks=selected(category);
 $('#counter').textContent=category==='gold'?picks.length+' / 10 escolhidos':picks.filter(p=>p.position==='goalkeeper').length+'/1 goleiro · '+picks.filter(p=>p.position==='line').length+'/6 linha';
 $('#players').replaceChildren();
 const visible=state.players.filter(p=>(state.team==='Todos'||p.team===state.team)&&norm(p.name).includes(norm(state.search))&&(category==='gold'||p.position===state.position));
 for(const p of visible){
  const isSelected=state.picks[category].has(p.id),button=element('button','player'+(isSelected?' selected':''));
  button.type='button';button.setAttribute('aria-pressed',isSelected);
  const avatar=element('span','avatar '+p.team,p.name.split(' ').map(s=>s[0]).slice(0,2).join(''));
  const details=element('span');details.append(element('strong','',p.name),element('small','',p.team+' · '+(p.position==='goalkeeper'?'Goleiro':'Linha')));
  button.append(avatar,details,element('span','tick',isSelected?(category==='gold'?([...state.picks.gold].indexOf(p.id)+1)+'º':'✓'):'+'));
  button.addEventListener('click',()=>toggle(p));$('#players').append(button);
 }
 $('#empty').hidden=visible.length>0;$('#chosen').replaceChildren();
 if(!picks.length&&category==='selection')$('#chosen').append(element('p','chosen-empty','Comece pelo goleiro e complete com 6 jogadores de linha.'));
 for(let index=0;index<(category==='gold'?10:picks.length);index++){
  const p=picks[index],row=element('div','chosen-row'+(!p?' vacant':''));
  if(category==='gold')row.append(element('span','rank-position',(index+1)+'º'));
  if(!p){row.append(element('span','rank-placeholder','Escolha um atleta'),element('small','rank-points',(10-index)+' pt'+(index===9?'':'s')));$('#chosen').append(row);continue;}
  const text=element('span','chosen-name',p.name);text.append(element('small','',p.team+' · '+(p.position==='goalkeeper'?'Goleiro':'Linha')));row.append(text);
  if(category==='gold'){
   const controls=element('span','rank-controls');
   for(const [delta,label,symbol] of [[-1,'Subir','↑'],[1,'Descer','↓']]){
    const move=element('button','rank-move',symbol);move.type='button';move.setAttribute('aria-label',label+' '+p.name+' no ranking');
    move.disabled=delta===-1?index===0:index===picks.length-1;move.addEventListener('click',()=>moveRank(index,delta));controls.append(move);
   }
   row.append(element('small','rank-points',(10-index)+' pt'+(index===9?'':'s')),controls);
  }
  const remove=element('button','rank-remove','×');remove.type='button';remove.setAttribute('aria-label','Remover '+p.name);remove.addEventListener('click',()=>toggle(p));row.append(remove);$('#chosen').append(row);
 }
 $('#ballot-help').textContent=category==='gold'?'Use as setas para ajustar as posições antes de revisar.':'Seu time terá 1 goleiro e 6 jogadores de linha.';
 $('#review').disabled=!complete(category);
 $('#review').textContent=category==='selection'?'Revisar minha Seleção →':'Revisar meus votos →';
 $('#editor-back').hidden=state.step!==2;
}
function moveRank(index,delta){
 const ids=[...state.picks.gold],target=index+delta;if(target<0||target>=ids.length)return;
 [ids[index],ids[target]]=[ids[target],ids[index]];state.picks.gold=new Set(ids);render();
 $('#notice').textContent=state.players.find(p=>p.id===ids[target]).name+' agora está em '+(target+1)+'º, com '+(10-target)+' pontos.';
 document.querySelectorAll('.rank-move')[target*2+(delta===-1?0:1)]?.focus();
}
document.querySelectorAll('[data-position]').forEach(b=>b.addEventListener('click',()=>{state.position=b.dataset.position;state.search='';$('#search').value='';render();}));
document.querySelectorAll('[data-team]').forEach(b=>b.addEventListener('click',()=>{state.team=b.dataset.team;render();}));
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>go(Number(b.dataset.go))));
$('#search').addEventListener('input',e=>{state.search=e.target.value;render();});
$('#review').addEventListener('click',()=>{const category=state.step===0?'selection':'gold';if(complete(category))go(state.step+1);});
$('#vote-form').addEventListener('submit',async e=>{
 e.preventDefault();
 if(state.pending||state.step!==3||!state.config.open||!complete('selection')||!complete('gold'))return;
 const name=$('#voter-name').value.trim(),team=$('#voter-team').value;
 if(name.length<2||!['Preto','Branco','Vermelho','Azul'].includes(team)){$('#send-notice').textContent='Informe seu nome e selecione seu time.';return;}
 state.pending=true;$('#send-notice').textContent='';render();
 try{
  const payload={selection:[...state.picks.selection],gold:[...state.picks.gold],name,team},signature=JSON.stringify(payload);
  if(!state.request||state.request.signature!==signature)state.request={signature,id:crypto.randomUUID()};
  const response=await fetch('/api/vote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,requestId:state.request.id})});
  const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||'Não foi possível registrar seus votos.');
  state.receipt=result.receipt;state.request=null;
 }catch(error){$('#send-notice').textContent=error.message;}
 finally{state.pending=false;render();if(state.receipt){$('#vote-title').focus();$('#voting-flow').scrollIntoView({block:'start'});}}
});
try{
 const [rosterResponse,configResponse]=await Promise.all([fetch('/players.json'),fetch('/api/config')]);
 if(!rosterResponse.ok||!configResponse.ok)throw new Error('Falha ao carregar a votação. Atualize a página.');
 state.players=await rosterResponse.json();state.config=await configResponse.json();
 if(state.config.resultsAvailable)loadResults();
 $('#availability').textContent=state.config.open?'● Votação aberta':'Votação indisponível';
 if(!state.config.open)$('#notice').textContent='Você pode montar e revisar suas escolhas. O envio estará disponível quando a votação abrir.';
 render();
}catch(error){$('#availability').textContent='Falha de conexão';$('#notice').textContent=error.message;}

async function loadResults(){
 const host=$('#results');host.hidden=false;
 try{
 const response=await fetch('/api/results'),data=await response.json();
 if(!response.ok)throw new Error(data.error||'Resultados indisponíveis.');
 const groups=[['selection','Goleiro','Seleção · Goleiro'],['selection','Linha','Seleção · Jogadores de linha'],['gold',null,'Bola de Ouro']];
 const grid=$('#results-grid');grid.replaceChildren();
 for(const [category,position,title] of groups){
  const section=element('div','result-card');section.append(element('h3','',title));
  const ranked=data.results.filter(r=>r.category===category&&(!position||r.position===position)).sort((a,b)=>(category==='gold'?b.points-a.points:b.votes-a.votes)||a.name.localeCompare(b.name,'pt-BR'));
  const list=element('ol','ranking');
  for(const row of ranked){const li=element('li');li.append(element('span','',row.name+' · '+row.team),element('strong','',category==='gold'?row.points+' pontos · '+row.votes+' indicações':row.votes+' voto'+(row.votes===1?'':'s')));list.append(li);}
  section.append(list);grid.append(section);
 }
 }catch(error){$('#results-error').textContent=error.message;}
}
