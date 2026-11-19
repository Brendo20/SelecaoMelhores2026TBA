import pg from 'pg';
let pool;
export function database(){
 if(!process.env.DATABASE_URL)throw new Error('DATABASE_NOT_CONFIGURED');
 if(!pool){
  pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:5,connectionTimeoutMillis:5000,idleTimeoutMillis:30000});
  pool.on('error',()=>console.error('Conexão PostgreSQL interrompida.'));
 }
 return pool;
}
export async function transaction(fn,{readOnly=false}={}){
 const client=await database().connect();
 try{
  await client.query(readOnly?'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY':'BEGIN');
  const result=await fn(client);await client.query('COMMIT');return result;
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
 finally{client.release();}
}
export async function closeDatabase(){if(pool){await pool.end();pool=undefined;}}
