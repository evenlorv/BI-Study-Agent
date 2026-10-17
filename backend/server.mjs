import { createOpenAIClient, diagnostic } from './openai.mjs';
import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { InputError, text, studyData, runAssistant } from './study.mjs';
export function configFromEnv(env=process.env){
 const token=env.STUDY_ACCESS_TOKEN||'';
 if(token.length<32) throw Error('STUDY_ACCESS_TOKEN må være minst 32 tegn og tilfeldig generert.');
 if(!env.OPENAI_API_KEY) throw Error('OPENAI_API_KEY mangler på backend.');
 const origins=(env.ALLOWED_ORIGINS||'http://127.0.0.1:8000').split(',').map(s=>s.trim());
 for(const origin of origins){const u=new URL(origin);if(u.origin!==origin||(!['http://127.0.0.1:8000','http://localhost:8000'].includes(origin)&&u.protocol!=='https:'))throw Error('ALLOWED_ORIGINS må inneholde eksakte HTTPS-origins, uten sti.');}
 const limit=Number(env.MAX_REQUESTS_PER_DAY||30);if(!Number.isInteger(limit)||limit<1||limit>10000)throw Error('Ugyldig dagsgrense.');
 const model=(env.OPENAI_MODEL||'gpt-4.1-mini').trim();
 if(!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,99}$/.test(model)||model.startsWith('sk-'))throw Error('OPENAI_MODEL må være en modell-ID, for eksempel gpt-4.1-mini.');
 return {token,origins,apiKey:env.OPENAI_API_KEY,model,dailyLimit:limit};
}
export function createStudyServer(config,{callOpenAI,logFailure=entry=>console.error(JSON.stringify(entry))}={}){
 const provider=callOpenAI||createOpenAIClient(config);
 let count=0,day='',busy=false;const attempts=new Map();
 const server=http.createServer(async(req,res)=>{
 res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Vary','Origin');
 const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(body));};
 const origin=req.headers.origin;
 if(origin&&!config.origins.includes(origin)) return send(403,{error:'Denne nettsiden har ikke tilgang.'});
 if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');}
 if(req.url==='/health'&&req.method==='GET')return send(200,{status:'ok'});
 if(req.url!=='/api/chat') return send(404,{error:'Ikke funnet.'});
 if(req.method==='OPTIONS')return send(204,{});
 if(req.method!=='POST')return send(405,{error:'Bruk POST.'});
 // Do not trust X-Forwarded-For. Bound map and rate-limit all attempts before authentication.
 const ip=req.socket.remoteAddress;const minute=Math.floor(Date.now()/60000);
 if(attempts.size>10000)attempts.clear();
 const entry=attempts.get(ip);const rate=entry?.minute===minute?entry:{minute,count:0};rate.count++;attempts.set(ip,rate);
 if(rate.count>30)return send(429,{error:'For mange forespørsler. Vent ett minutt.'});
 const actual=Buffer.from(req.headers.authorization||'');const expected=Buffer.from(`Bearer ${config.token}`);
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return send(401,{error:'Logg inn med gyldig tilgangstoken.'});
 if((req.headers['content-type']||'').split(';')[0].trim().toLowerCase()!=='application/json')return send(415,{error:'Bruk application/json.'});
 let body;
 try {
 let size=0;const chunks=[];
 for await(const chunk of req){size+=chunk.length;if(size>128*1024){send(413,{error:'Studiedata er for store (maks 128 KiB).'});req.resume();return;}chunks.push(chunk);}
 body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 const message=text(body.message,2000);const data=studyData(body.data);
 if(!Array.isArray(body.history)||body.history.length>10)throw new InputError('Ugyldig samtalehistorikk.');
 const history=body.history.map(m=>({role:['user','assistant'].includes(m.role)?m.role:(()=>{throw new InputError('Ugyldig rolle.');})(),content:text(m.content,8000)}));
 const currentDay=new Date().toISOString().slice(0,10);if(day!==currentDay){day=currentDay;count=0;}
 if(count>=config.dailyLimit)return send(429,{error:'Dagens AI-grense er nådd.'});
 if(busy)return send(429,{error:'Assistenten jobber allerede. Prøv igjen snart.'});
 busy=true;count++;
 try {const result=await runAssistant({message,history,data,callOpenAI:provider});send(200,result);}
 catch(error) {logFailure(diagnostic(error));send(502,{error:'AI-tjenesten svarte ikke som forventet. Prøv igjen senere. Ingen studiedata er endret.'});}
 finally {busy=false;}
 }catch(e){if(!res.headersSent)send(e instanceof InputError||e instanceof SyntaxError?400:500,{error:e instanceof InputError?e.message:'Forespørselen kunne ikke behandles.'});}
 });
 server.requestTimeout=15000;server.headersTimeout=10000;
 return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const config=configFromEnv();const host=process.env.HOST||'127.0.0.1';const port=Number(process.env.PORT||8787);const server=createStudyServer(config);server.listen(port,host,()=>console.log(`BI Study Agent backend listening on port ${port}`));}
 catch(e){console.error(e.message);process.exitCode=1;}
}
