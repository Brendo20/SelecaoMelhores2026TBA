import {isConfigured} from '../lib/validation.js';
import {passwordMatches,issueSession,hasSession,sessionCookie,sameOrigin} from '../lib/admin-session.js';
const attempts=new Map();
function clientKey(req){return String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();}
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary','Cookie');res.setHeader('X-Robots-Tag','noindex, nofollow');
 if(!['GET','POST','DELETE'].includes(req.method)){res.setHeader('Allow','GET, POST, DELETE');return res.status(405).json({error:'Método inválido.'});}
 if(req.method!=='GET'&&!sameOrigin(req))return res.status(403).json({error:'Origem inválida.'});
 if(req.method==='DELETE'){res.setHeader('Set-Cookie',sessionCookie(req,'',true));return res.status(200).json({ok:true});}
 if(!process.env.ADMIN_PASSWORD||!isConfigured())return res.status(503).json({error:'Configure ADMIN_PASSWORD e a conexão com a planilha nas variáveis da Vercel.'});
 if(req.method==='POST'){
  const key=clientKey(req),now=Date.now(),previous=attempts.get(key);
  if(previous&&previous.until>now&&previous.count>=5){res.setHeader('Retry-After',Math.ceil((previous.until-now)/1000));return res.status(429).json({error:'Muitas tentativas. Aguarde alguns minutos e tente novamente.'});}
  let body=req.body;
  try{if(typeof body==='string')body=JSON.parse(body);}catch{return res.status(400).json({error:'Dados inválidos.'});}
  if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(415).json({error:'Formato inválido.'});
  if(!passwordMatches(body?.password)){
   if(attempts.size>1000)attempts.clear();
   const entry=previous&&previous.until>now?previous:{count:0,until:now+10*60*1000};entry.count++;attempts.set(key,entry);
   return res.status(401).json({error:'Senha incorreta.'});
  }
  attempts.delete(key);res.setHeader('Set-Cookie',sessionCookie(req,issueSession()));return res.status(200).json({ok:true});
 }
 if(!hasSession(req))return res.status(401).json({error:'Entre com a senha para acessar o painel.'});
 try{
  const response=await fetch(process.env.GOOGLE_SCRIPT_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'admin_results',secret:process.env.GOOGLE_SCRIPT_SECRET}),signal:AbortSignal.timeout(20000)});
  const data=await response.json();
  if(!response.ok)return res.status(502).json({code:'SCRIPT_HTTP_ERROR',error:'O Apps Script não respondeu corretamente. Confira a implantação do aplicativo da Web.'});
  if(!data.ok){
   if(data.error==='Acesso negado.')return res.status(502).json({code:'SCRIPT_ACCESS_DENIED',error:'O Apps Script recusou a conexão. Confira o segredo configurado na Vercel.'});
   if(String(data.error||'').includes('apurar'))return res.status(502).json({code:'SHEET_RECORDS_ERROR',error:'O Apps Script recebeu a consulta, mas não conseguiu apurar os registros da aba Votos. A implantação já reconhece o painel; precisamos conferir os registros da planilha.'});
   return res.status(502).json({code:'SCRIPT_OUTDATED',error:'A versão publicada do Apps Script ainda não reconhece a consulta do painel. No Apps Script: Implantar → Gerenciar implantações → Editar (lápis) → Versão: Nova versão → Implantar. Salvar o código não atualiza a implantação.'});
  }
  if(!Array.isArray(data.results)||!data.summary)return res.status(502).json({code:'SCRIPT_OUTDATED',error:'A resposta do Apps Script pertence a uma versão antiga. Publique uma nova versão da implantação existente.'});
  return res.status(200).json({ok:true,open:Boolean(data.open)&&process.env.VOTING_OPEN==='true',updatedAt:data.updatedAt,summary:data.summary,results:data.results});
 }catch{return res.status(502).json({error:'Não foi possível consultar a planilha. Tente atualizar novamente.'});}
}
