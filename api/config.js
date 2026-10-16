import {isConfigured} from '../lib/validation.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Método inválido.'});}
 let remote={open:false,resultsAvailable:false};
 if(isConfigured()){
  try{
   const response=await fetch(process.env.GOOGLE_SCRIPT_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'status',secret:process.env.GOOGLE_SCRIPT_SECRET}),signal:AbortSignal.timeout(15000)});
   const data=await response.json();if(response.ok&&data.ok)remote=data;
  }catch{}
 }
 res.status(200).json({open:process.env.VOTING_OPEN==='true'&&remote.open,selection:{goalkeepers:1,line:6},gold:{size:10,points:[10,9,8,7,6,5,4,3,2,1]},resultsAvailable:Boolean(remote.resultsAvailable)});
}
