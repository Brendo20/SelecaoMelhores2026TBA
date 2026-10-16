import {isConfigured} from '../lib/validation.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Método inválido.'});}
 let remote={open:false,resultsAvailable:false},reason='not_configured';
 if(isConfigured()){
  try{
   const response=await fetch(process.env.GOOGLE_SCRIPT_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'status',secret:process.env.GOOGLE_SCRIPT_SECRET}),signal:AbortSignal.timeout(15000)});
   if(!response.ok)reason='connection_failed';
   else{
    const data=await response.json();
    if(!data.ok)reason='connection_rejected';
    else if(typeof data.open!=='boolean')reason='script_outdated';
    else{remote=data;reason=!remote.open?'script_closed':process.env.VOTING_OPEN!=='true'?'vercel_closed':'open';}
   }
  }catch{reason='connection_failed';}
 }
 res.status(200).json({open:reason==='open',reason,selection:{goalkeepers:1,line:6},gold:{size:10,points:[10,9,8,7,6,5,4,3,2,1]},resultsAvailable:Boolean(remote.resultsAvailable)});
}
