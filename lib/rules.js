import {createHash} from 'node:crypto';
export const ROLES={capitao:{label:'Capitão',units:4},organizacao:{label:'Organização',units:3},atleta:{label:'Atleta',units:2},tecnico:{label:'Técnico',units:2}};
export const TEAMS=['Preto','Branco','Vermelho','Azul'];
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function digest(value){return createHash('sha256').update(value).digest('hex');}
export function normalizeCode(value){return typeof value==='string'?value.replace(/[\s-]/g,'').toUpperCase():'';}
export function ballotHash(selection,gold){return digest(JSON.stringify({selection:[...selection].sort(),gold}));}
export function fail(message,status=400){const error=new Error(message);error.status=status;throw error;}
export function checkChoices(selection,gold,roster){
 for(const [category,ids] of [['selection',selection],['gold',gold]]){
  if(!Array.isArray(ids)||ids.length!==(category==='gold'?10:7)||new Set(ids).size!==ids.length)fail(category==='gold'?'Escolha 10 atletas diferentes para a Bola de Ouro.':'Escolha 1 goleiro e 6 jogadores de linha.');
  const chosen=ids.map(id=>roster.find(p=>p.id===id));if(chosen.some(p=>!p))fail('Atleta inválido.');
  if(category==='selection'&&chosen.filter(p=>p.position==='goalkeeper').length!==1)fail('A Seleção precisa ter 1 goleiro e 6 jogadores de linha.');
 }
}

export function normalizeName(value){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase();}
