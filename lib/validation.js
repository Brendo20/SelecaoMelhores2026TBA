import {readFileSync} from 'node:fs';
export const players=JSON.parse(readFileSync(new URL('../public/players.json',import.meta.url),'utf8'));
export function validateVote(body) {
 if(!body||typeof body!=='object')return 'Voto inválido.';
 const {category,playerIds,name,team,requestId}=body;
 if(!['selection','gold'].includes(category))return 'Premiação inválida.';
 if(typeof name!=='string'||name.trim().length<2||name.length>100)return 'Informe um nome válido.';
 if(!['Preto','Branco','Vermelho','Azul'].includes(team))return 'Selecione um time válido.';
 if(typeof requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))return 'Identificador de envio inválido.';
 if(!Array.isArray(playerIds)||new Set(playerIds).size!==playerIds.length)return 'Escolhas inválidas.';
 const chosen=playerIds.map(id=>players.find(p=>p.id===id));
 if(chosen.some(p=>!p))return 'Jogador inválido.';
 if(category==='gold'&&chosen.length!==10)return 'Ordene 10 atletas diferentes para a Bola de Ouro.';
 if(category==='selection'&&(chosen.length!==7||chosen.filter(p=>p.position==='goalkeeper').length!==1||chosen.filter(p=>p.position==='line').length!==6))return 'Escolha 1 goleiro e 6 jogadores de linha.';
 return null;
}
export const isConfigured=()=>Boolean(process.env.GOOGLE_SCRIPT_URL&&process.env.GOOGLE_SCRIPT_SECRET);

export function validateBallot(body){
 if(!body||typeof body!=='object')return 'Votação inválida.';
 const identity={name:body.name,team:body.team,requestId:body.requestId};
 return validateVote({...identity,category:'selection',playerIds:body.selection})||validateVote({...identity,category:'gold',playerIds:body.gold});
}
