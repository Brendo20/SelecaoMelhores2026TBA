import {handler,allow,requireOrigin,limit} from '../lib/http.js';
import {passwordMatches,issueSession,hasSession,sessionCookie} from '../lib/admin-session.js';
import {adminSnapshot,moderateBallots,changeElection,ballotDetails} from '../lib/store.js';
import {fail} from '../lib/rules.js';
export default handler(async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary','Cookie');res.setHeader('X-Robots-Tag','noindex, nofollow');
 if(!allow(req,res,['GET','POST','PATCH','DELETE']))return;
 if(req.method!=='GET')requireOrigin(req);
 if(req.method==='DELETE'){res.setHeader('Set-Cookie',sessionCookie(req,'',true));return res.json({ok:true});}
 if(!process.env.ADMIN_PASSWORD||!process.env.SESSION_SECRET)fail('Configure a senha administrativa e o segredo de sessão.',503);
 if(req.method==='POST'){
  limit(req,'admin-login',10);
  if(!passwordMatches(req.body?.password))fail('Senha incorreta.',401);
  res.setHeader('Set-Cookie',sessionCookie(req,issueSession()));return res.json({ok:true});
 }
 if(!hasSession(req))fail('Entre com a senha para acessar o painel.',401);
 if(req.method==='PATCH'){
  const body=req.body||{};let result;
  switch(body.action){
   case 'moderate':result=await moderateBallots(body);break;
   case 'election':result=await changeElection(body);break;
   default:fail('Ação inválida.');
  }
  return res.json(result);
 }
 if(req.query?.ballotId!==undefined)return res.json(await ballotDetails(req.query.ballotId));
 return res.json(await adminSnapshot(req.query));
});
