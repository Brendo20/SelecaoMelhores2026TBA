import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import config from '../api/config.js';
import vote from '../api/vote.js';
import results from '../api/results.js';
import admin from '../api/admin.js';
try{process.loadEnvFile('.env.local');}catch(error){if(error.code!=='ENOENT')throw error;}
const publicRoot=path.resolve('public');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
http.createServer(async(req,res)=>{
 res.status=function(code){this.statusCode=code;return this;};res.json=function(body){this.setHeader('Content-Type','application/json');this.end(JSON.stringify(body));};
 try{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/api/config')return config(req,res);
 if(pathname==='/api/results')return results(req,res);
 if(pathname==='/api/admin'&&req.method!=='POST')return await admin(req,res);
 if(pathname==='/api/vote'||pathname==='/api/admin'){
 let body='';for await(const chunk of req){body+=chunk;if(body.length>8192)return res.status(413).json({error:'Requisição muito grande.'});}
 try{req.body=JSON.parse(body);}catch{return res.status(400).json({error:'JSON inválido.'});}
 return await (pathname==='/api/admin'?admin:vote)(req,res);
 }
 const file=path.resolve(publicRoot,'.'+decodeURIComponent(pathname==='/'?'/index.html':pathname==='/admin'?'/admin.html':pathname));
 if(!file.startsWith(publicRoot+path.sep))return res.status(403).end();
 const content=await readFile(file);res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(content);
 }catch{res.status(404).end('Não encontrado');}
}).listen(Number(process.env.PORT||3000),'127.0.0.1',()=>console.log('Prévia: http://127.0.0.1:'+ (process.env.PORT||3000)));
