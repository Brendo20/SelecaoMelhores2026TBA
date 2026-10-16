import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
export const COOKIE='tba_admin';
const TTL=4*60*60;
const hash=value=>createHash('sha256').update(value).digest();
function key(){return createHmac('sha256',process.env.GOOGLE_SCRIPT_SECRET||'').update('tba-admin-session-v1:'+process.env.ADMIN_PASSWORD).digest();}
export function passwordMatches(value){return typeof value==='string'&&value.length<=200&&Boolean(process.env.ADMIN_PASSWORD)&&timingSafeEqual(hash(value),hash(process.env.ADMIN_PASSWORD));}
export function issueSession(now=Date.now()){const body=Buffer.from(JSON.stringify({expires:Math.floor(now/1000)+TTL,nonce:randomBytes(16).toString('hex')})).toString('base64url');return body+'.'+createHmac('sha256',key()).update(body).digest('base64url');}
export function hasSession(req,now=Date.now()){
 if(!process.env.ADMIN_PASSWORD||!process.env.GOOGLE_SCRIPT_SECRET)return false;
 const token=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
 if(!token||token.length>1024)return false;
 try{
  const [body,signature,extra]=token.split('.');
  if(extra||!body||!signature)return false;
  const expected=createHmac('sha256',key()).update(body).digest(),actual=Buffer.from(signature,'base64url');
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return false;
  const {expires}=JSON.parse(Buffer.from(body,'base64url').toString());
  return Number.isInteger(expires)&&expires>Math.floor(now/1000)&&expires<=Math.floor(now/1000)+TTL;
 }catch{return false;}
}
export function sessionCookie(req,token='',clear=false){
 const secure=process.env.VERCEL==='1'||req.headers['x-forwarded-proto']==='https';
 return COOKIE+'='+token+'; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age='+(clear?0:TTL)+(secure?'; Secure':'');
}
export function sameOrigin(req){
 try{const origin=new URL(req.headers.origin);return origin.host===req.headers.host&&(origin.protocol==='https:'||origin.protocol==='http:');}catch{return false;}
}
