export default function handler(req,res){res.setHeader('Cache-Control','no-store');return res.status(410).json({error:'A votação agora usa nome e perfil, sem código individual.'});}
