import {handler,allow,requireOrigin,limit} from '../lib/http.js';
import {castBallot} from '../lib/store.js';
export default handler(async(req,res)=>{
 if(!allow(req,res,['POST']))return;requireOrigin(req);limit(req,'vote',240);
 return res.json(await castBallot(req.body));
});
