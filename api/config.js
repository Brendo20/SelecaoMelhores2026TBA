import {handler,allow} from '../lib/http.js';
import {configuration} from '../lib/store.js';
export default handler(async(req,res)=>{
 if(!allow(req,res,['GET']))return;
 if(!process.env.DATABASE_URL)return res.json({open:false,reason:'not_configured',resultsAvailable:false});
 return res.json(await configuration());
});
