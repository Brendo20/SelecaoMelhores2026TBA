const $=selector=>document.querySelector(selector);
const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
const date=value=>value?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(value)):'Nenhum voto ainda';
let authenticated=false,busy=false,timer;
function showLogin(message=''){authenticated=false;clearInterval(timer);$('#login-panel').hidden=false;$('#dashboard').hidden=true;$('#login-error').textContent=message;$('#admin-rankings').replaceChildren();$('#recent-votes').replaceChildren();$('#admin-password').value='';}
function showDashboard(){authenticated=true;$('#login-panel').hidden=true;$('#dashboard').hidden=false;$('#admin-password').value='';clearInterval(timer);timer=setInterval(()=>{if(authenticated&&$('#auto-refresh').checked&&!document.hidden)load();},30000);}
function render(data){
 $('#admin-status').textContent=data.open?'● Votação aberta':'Votação encerrada ou ainda não aberta';
 $('#updated-at').textContent='Consultado em '+date(data.updatedAt);
 $('#total-ballots').textContent=data.summary.totalBallots;
 $('#total-points').textContent=data.results.filter(r=>r.category==='gold').reduce((sum,r)=>sum+r.points,0);
 $('#last-vote').textContent=date(data.summary.lastVote);
 $('#team-stats').replaceChildren();
 for(const team of ['Preto','Branco','Vermelho','Azul']){
  const n=data.summary.byTeam[team]||0,percentage=data.summary.totalBallots?Math.round(n/data.summary.totalBallots*100):0;
  const card=el('article','team-stat');card.append(el('span','',team),el('strong','',n+' cédula'+(n===1?'':'s')),el('small','',percentage+'% do total'));
  const meter=el('div','team-meter'),fill=el('span');fill.style.width=percentage+'%';meter.append(fill);card.append(meter);$('#team-stats').append(card);
 }
 $('#admin-rankings').replaceChildren();
 for(const [category,position,title,help] of [['selection','Goleiro','Goleiro','Classificação por votos para a vaga de goleiro.'],['selection','Linha','Jogadores de linha','Classificação por votos para as 6 vagas de linha.'],['gold',null,'Bola de Ouro','Classificação pela soma de pontos das posições.']]){
  const section=el('section','admin-ranking');section.append(el('h2','',title),el('p','',help));
  const rows=data.results.filter(r=>r.category===category&&(!position||r.position===position)).sort((a,b)=>(category==='gold'?b.points-a.points:b.votes-a.votes)||a.name.localeCompare(b.name,'pt-BR'));
  const list=el('ol');let rank=0,lastScore;
  rows.forEach((row,index)=>{
   const score=category==='gold'?row.points:row.votes;if(score!==lastScore)rank=index+1;lastScore=score;
   const li=el('li'),athlete=el('span','athlete',row.name);athlete.append(el('small','',row.team+' · '+row.position));
   const points=el('span','score',score+(category==='gold'?' pts':' votos'));
   if(category==='gold')points.append(el('small','',row.votes+' indicações'));
   li.append(el('span','place',score?rank+'º':'—'),athlete,points);list.append(li);
  });
  section.append(list);$('#admin-rankings').append(section);
 }
 $('#recent-votes').replaceChildren();
 for(const row of data.summary.recent){const tr=el('tr');tr.append(el('td','',date(row.date)),el('td','',row.name),el('td','',row.team));$('#recent-votes').append(tr);}
 if(!data.summary.recent.length){const td=el('td','','Nenhuma cédula recebida.');td.colSpan=3;const tr=el('tr');tr.append(td);$('#recent-votes').append(tr);}
}
async function load(){
 if(busy)return;busy=true;$('#refresh').disabled=true;$('#dashboard-error').textContent='';
 try{
  const response=await fetch('/api/admin',{cache:'no-store'}),data=await response.json();
  if(response.status===401){showLogin();return;}
  if(!response.ok){if(authenticated)$('#dashboard-error').textContent=data.error;else showLogin(data.error);return;}
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
$('#refresh').addEventListener('click',load);
load();
