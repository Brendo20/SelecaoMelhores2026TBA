import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import config from './api/config.js';
import vote from './api/vote.js';
import results from './api/results.js';
import admin from './api/admin.js';
import {database,closeDatabase} from './lib/db.js';
const root=path.resolve(fileURLToPath(new URL('./public/',import.meta.url)));
const routes={'/api/config':config,'/api/vote':vote,'/api/results':results,'/api/admin':admin};
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
export function createServer(){
 return http.createServer(async(req,res)=>{
  res.status=function(code){this.statusCode=code;return this;};res.json=function(value){this.setHeader('Content-Type','application/json; charset=utf-8');this.end(JSON.stringify(value));};
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  req.clientIp=process.env.TRUST_PROXY==='true'?String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',').at(-1).trim():req.socket.remoteAddress;
  try{
   const url=new URL(req.url,'http://localhost');req.query=Object.fromEntries(url.searchParams);
   if(url.pathname==='/healthz'){
    res.setHeader('Cache-Control','no-store');
    try{const ready=await database().query('SELECT id FROM election WHERE id=1');return res.status(ready.rowCount===1?200:503).json({ok:ready.rowCount===1});}catch{return res.status(503).json({ok:false});}
   }
   if(routes[url.pathname]){
    res.setHeader('Cache-Control','no-store');
    if(['POST','PATCH'].includes(req.method)){
     if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(415).json({error:'Envie JSON.'});
     const chunks=[];let size=0;
     for await(const chunk of req){size+=chunk.length;if(size>16384)return res.status(413).json({error:'Requisição muito grande.'});chunks.push(chunk);}
     try{req.body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return res.status(400).json({error:'JSON inválido.'});}
    }
    return await routes[url.pathname](req,res);
   }
   if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return res.status(405).end();}
   const pathname=decodeURIComponent(url.pathname),relative=pathname==='/'?'index.html':pathname==='/admin'?'admin.html':'.'+pathname;
   const file=path.resolve(root,relative);
   if(!file.startsWith(root+path.sep))return res.status(403).end();
   let content;try{content=await readFile(file);}catch(error){if(['ENOENT','EISDIR','ENOTDIR'].includes(error.code))return res.status(404).end('Não encontrado');throw error;}
   res.setHeader('Cache-Control','no-cache');res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
   if(path.basename(file)==='admin.html')res.setHeader('X-Robots-Tag','noindex, nofollow');
   res.end(req.method==='HEAD'?undefined:content);
  }catch{if(!res.headersSent)res.status(500).json({error:'Falha ao processar a requisição.'});else res.end();}
 });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.env.NODE_ENV==='production'&&(!process.env.DATABASE_URL||!process.env.APP_ORIGIN||!process.env.ADMIN_PASSWORD||String(process.env.SESSION_SECRET||'').length<32))throw new Error('Configure DATABASE_URL, APP_ORIGIN, ADMIN_PASSWORD e SESSION_SECRET (32+ caracteres).');
 const server=createServer();server.requestTimeout=30000;server.headersTimeout=15000;
 server.listen(Number(process.env.PORT||3000),process.env.HOST||'127.0.0.1',()=>console.log('Aplicação iniciada na porta '+(process.env.PORT||3000)));
 const shutdown=()=>{server.close(async()=>{await closeDatabase();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();};
 process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
}
