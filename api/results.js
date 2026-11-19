import {handler,allow} from '../lib/http.js';
import {publicResults} from '../lib/store.js';
export default handler(async(req,res)=>{
 if(!allow(req,res,['GET']))return;
 return res.json(await publicResults());
});
