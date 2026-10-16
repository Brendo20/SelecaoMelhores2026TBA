import {isConfigured} from '../lib/validation.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Método inválido.'});}
 if(!isConfigured())return res.status(503).json({error:'Resultados indisponíveis.'});
 try{
  const response=await fetch(process.env.GOOGLE_SCRIPT_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'results',secret:process.env.GOOGLE_SCRIPT_SECRET}),signal:AbortSignal.timeout(15000)});
  const data=await response.json();
  if(!response.ok||!data.ok)return res.status(403).json({error:'Resultados ainda não publicados.'});
  return res.status(200).json({results:data.results});
 }catch{return res.status(502).json({error:'Não foi possível carregar os resultados.'});}
}
