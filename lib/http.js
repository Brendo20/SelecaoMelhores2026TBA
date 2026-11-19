export function handler(fn){
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{return await fn(req,res);}
  catch(error){
   const status=error.status||(error.code==='23505'?409:503);
   if(status>=500)console.error('Falha de operação:',error.code||'DATABASE_UNAVAILABLE');
   return res.status(status).json({error:error.status?error.message:status===409?'Este registro já foi utilizado.':'Serviço indisponível. Tente novamente.'});
  }
 };
}
export function allow(req,res,methods){
 if(methods.includes(req.method))return true;
 res.setHeader('Allow',methods.join(', '));res.status(405).json({error:'Método inválido.'});return false;
}
export function requireOrigin(req){
 try{if(new URL(req.headers.origin).origin===process.env.APP_ORIGIN)return;}catch{}
 const error=new Error('Origem inválida.');error.status=403;throw error;
}
const attempts=new Map();
export function limit(req,bucket,max=10){
 const now=Date.now(),key=bucket+':'+(req.clientIp||req.socket?.remoteAddress||'local');
 if(attempts.size>10000)for(const [k,v] of attempts)if(v.until<=now)attempts.delete(k);
 let entry=attempts.get(key);if(!entry||entry.until<=now){entry={count:0,until:now+600000};attempts.set(key,entry);}
 entry.count++;
 if(entry.count>max){const error=new Error('Muitas tentativas. Aguarde 10 minutos.');error.status=429;throw error;}
}
