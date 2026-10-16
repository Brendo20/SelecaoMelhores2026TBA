import {validateBallot,isConfigured} from '../lib/validation.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Método inválido.'});}
 if(process.env.VOTING_OPEN!=='true'||!isConfigured())return res.status(503).json({error:'A votação está fechada.'});
 if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(415).json({error:'Formato inválido.'});
 let body=req.body;
 try{if(typeof body==='string')body=JSON.parse(body);}catch{return res.status(400).json({error:'Voto inválido.'});}
 if(JSON.stringify(body||{}).length>4096)return res.status(413).json({error:'Voto muito grande.'});
 const error=validateBallot(body);if(error)return res.status(400).json({error});
 try{
  const upstream=await fetch(process.env.GOOGLE_SCRIPT_URL,{method:'POST',redirect:'follow',headers:{'Content-Type':'application/json'},body:JSON.stringify({selection:body.selection,gold:body.gold,name:body.name,team:body.team,requestId:body.requestId,secret:process.env.GOOGLE_SCRIPT_SECRET}),signal:AbortSignal.timeout(20000)});
  if(!upstream.ok)throw new Error('upstream');
  const result=await upstream.json();
  if(!result.ok)return res.status(result.code==='DUPLICATE'?409:result.code==='CLOSED'?403:400).json({error:result.error||'Voto recusado.'});
  return res.status(200).json({ok:true,receipt:result.receipt});
 }catch{return res.status(502).json({error:'Não foi possível confirmar o registro. Tente novamente sem alterar as escolhas para consultar o mesmo envio.'});}
}
