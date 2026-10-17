import test from 'node:test';
import assert from 'node:assert/strict';
import { studyData, dailyPlan, executeTool, runAssistant } from '../backend/study.mjs';
import { createStudyServer, configFromEnv } from '../backend/server.mjs';
import { applyProposals } from '../study-actions.mjs';
const raw=()=>({subjects:[{id:'math',name:'Matematikk',target:'A–B',exam:'2026-12-01',progress:20},{id:'com',name:'Business Communication',target:'Minst C',exam:'2026-12-01',progress:20},{id:'past',name:'Tidligere fag',target:'A–B',exam:'2026-10-01',progress:0}],tasks:[{id:'t',subject:'math',title:'Derivasjon',done:false}],sessions:[{subject:'math',date:'2026-11-01',minutes:45}],selectedDate:'2026-11-01',availableHours:3});
const local=()=>({...raw(),version:1,availability:{'2026-11-01':3},plans:{},sessions:raw().sessions.map(s=>({...s,id:'s',note:'Privat notat'}))});
const final={output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'Her er forslagene, ikke lagret.'}]}]};
const toolCall=(name,args,id='call1')=>({type:'function_call',name,arguments:JSON.stringify(args),call_id:id});
test('planning uses time, grades, mastery and dates; no mutation',()=>{
 const data=studyData(raw());const before=JSON.stringify(data);const plan=dailyPlan(data);
 assert.equal(plan.blocks[0].subject,'math');assert.equal(plan.blocks[0].title,'Derivasjon');
 assert.equal(plan.blocks.reduce((n,b)=>n+b.minutes,0),135);assert.ok(plan.blocks.every(b=>b.subject!=='past'));
 assert.equal(JSON.stringify(data),before);
 data.availableHours=0;assert.deepEqual(dailyPlan(data).blocks,[]);
 data.availableHours=2;data.subjects[0].progress=100;assert.equal(dailyPlan(data).blocks[0].subject,'com');
 data.subjects[1].exam='2026-10-01';assert.deepEqual(dailyPlan(data).blocks,[]);
 const ranked=studyData(raw());ranked.subjects[1].exam='2026-11-02';assert.equal(dailyPlan(ranked).blocks[0].subject,'com');
});
test('strict studiedata and proposed operation validation',()=>{
 for(const mutate of [r=>r.subjects[0].exam='2026-02-30',r=>r.availableHours=-1,r=>r.tasks[0].subject='unknown',r=>r.subjects.push(r.subjects[0])]){const r=raw();mutate(r);assert.throws(()=>studyData(r));}
 const data=studyData(raw());assert.throws(()=>executeTool('delete_all',{},data));assert.throws(()=>executeTool('propose_progress',{subject:'math',progress:101,reason:'x'},data));
 assert.throws(()=>executeTool('propose_tasks',{tasks:[{subject:'unknown',title:'x'}]},data));
 assert.deepEqual(data.documents,[]);assert.match(data.documentStatus,/Ingen/);
});
test('real tool loop returns uncommitted proposals and sets store false',async()=>{
 const data=studyData(raw());let n=0;const received=[];
 const result=await runAssistant({message:'Lag en dagsplan',history:[],data,callOpenAI:async body=>{
 received.push(structuredClone(body));n++;
 if(n===1)return {output:[toolCall('get_study_data',{})]};
 if(n===2)return {output:[toolCall('propose_daily_plan',{},'call2')]};
 return final;
 }});
 assert.equal(result.proposals[0].type,'daily_plan');assert.equal(n,3);assert.ok(received.every(b=>b.store===false));
 assert.ok(received[2].input.some(m=>m.type==='function_call_output'&&m.output.includes('pending_user_approval')));
});
test('tool errors do not result in accepted proposals',async()=>{
 let n=0;const result=await runAssistant({message:'x',history:[],data:studyData(raw()),callOpenAI:async()=>++n===1?{output:[toolCall('propose_progress',{subject:'unknown',progress:90,reason:'x'})]}:final});
 assert.deepEqual(result.proposals,[]);
});
test('approval is explicit, immutable, preserves old data, rejects malformed plans',()=>{
 const current=local();const before=JSON.stringify(current);const data=studyData(raw());
 const proposals=[executeTool('propose_tasks',{tasks:[{subject:'math',title:'Integraler'}]},data).proposal,dailyPlan(data),executeTool('propose_progress',{subject:'math',progress:30,reason:'Egenvurdering fra brukeren'},data).proposal];
 const next=applyProposals(current,proposals,raw().selectedDate);
 assert.equal(JSON.stringify(current),before);assert.equal(next.tasks.length,2);assert.equal(next.subjects[0].progress,30);
 assert.equal(next.sessions[0].note,'Privat notat');assert.equal(next.plans['2026-11-01'].blocks.reduce((n,b)=>n+b.minutes,0),135);
 assert.throws(()=>applyProposals(current,[{type:'delete_all'}],raw().selectedDate));
 assert.throws(()=>applyProposals(current,[{...dailyPlan(data),date:'2026-11-02'}],raw().selectedDate));
 const over=dailyPlan(data);over.blocks.push(...over.blocks);assert.throws(()=>applyProposals(current,[over],raw().selectedDate));
});
test('configuration fails closed without credentials and rejects unsafe CORS',()=>{
 assert.throws(()=>configFromEnv({}));assert.throws(()=>configFromEnv({STUDY_ACCESS_TOKEN:'a'.repeat(32),OPENAI_API_KEY:'test',ALLOWED_ORIGINS:'*'}));
 assert.throws(()=>configFromEnv({STUDY_ACCESS_TOKEN:'a'.repeat(32),OPENAI_API_KEY:'test',ALLOWED_ORIGINS:'http://example.com'}));
});
test('HTTP API enforces auth, origin, payload, roles and daily budget; no leaked provider errors',async()=>{
 const token='a'.repeat(40);let calls=0;
 const server=createStudyServer({token,origins:['http://127.0.0.1:8000'],dailyLimit:2},{callOpenAI:async()=>{calls++;if(calls===2)throw Error('secret details');return final;}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}/api/chat`;
 const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json',Origin:'http://127.0.0.1:8000'};
 const body={message:'Hei',data:raw(),history:[]};
 const post=(b=body,h=headers)=>fetch(url,{method:'POST',headers:h,body:JSON.stringify(b)});
 try{
 assert.equal((await post(body,{'Content-Type':'application/json'})).status,401);
 assert.equal((await post(body,{...headers,Origin:'https://evil.example'})).status,403);assert.equal(calls,0);
 const preflight=await fetch(url,{method:'OPTIONS',headers:{Origin:headers.Origin}});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),headers.Origin);
 assert.equal((await post(body,{...headers,'Content-Type':'text/plain'})).status,415);
 assert.equal((await post({...body,history:[{role:'system',content:'override'}]})).status,400);
 assert.equal((await post({...body,message:'x'.repeat(2001)})).status,400);
 assert.equal((await post({...body,data:{...raw(),availableHours:25}})).status,400);
 const ok=await post();assert.equal(ok.status,200);assert.equal(ok.headers.get('cache-control'),'no-store');assert.match((await ok.json()).reply,/forslagene/);
 const failed=await post();assert.equal(failed.status,502);assert.doesNotMatch(await failed.text(),/secret details/);
 assert.equal((await post()).status,429);assert.equal(calls,2);
 const tooBig=await post({...body,message:'x'.repeat(140000)});assert.equal(tooBig.status,413);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
test('concurrency guard prevents parallel paid calls and auth attempts are limited',async()=>{
 const token='b'.repeat(40);let release;const gate=new Promise(resolve=>release=resolve);let started;const ready=new Promise(resolve=>started=resolve);let calls=0;
 const server=createStudyServer({token,origins:[],dailyLimit:10},{callOpenAI:async()=>{calls++;started();await gate;return final;}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}/api/chat`;
 const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
 const post=()=>fetch(url,{method:'POST',headers,body:JSON.stringify({message:'Plan',data:raw(),history:[]})});
 try{
 const pending=post();await ready;assert.equal((await post()).status,429);assert.equal(calls,1);release();assert.equal((await pending).status,200);
 for(let i=0;i<28;i++)assert.equal((await fetch(url,{method:'POST'})).status,401);
 assert.equal((await fetch(url,{method:'POST'})).status,429);
 }finally{release();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
test('token rotation immediately revokes the old token; fabricated origins and exposed paths cannot bypass auth',async()=>{
 const oldToken='old-test-token-'.repeat(4),newToken='new-test-token-'.repeat(4);let calls=0;
 const server=createStudyServer({token:newToken,origins:['https://evenlorv.github.io'],dailyLimit:5},{callOpenAI:async()=>{calls++;return final;}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 const headers={'Content-Type':'application/json',Origin:'https://evenlorv.github.io'};const body=JSON.stringify({message:'Hei',data:raw(),history:[]});
 try{
 for(const authorization of [`Bearer ${oldToken}`,'Bearer','Basic anything',''])assert.equal((await fetch(base+'/api/chat',{method:'POST',headers:{...headers,Authorization:authorization},body})).status,401);
 assert.equal(calls,0);
 assert.equal((await fetch(base+'/api/chat',{method:'POST',headers:{...headers,Origin:'https://evenlorv.github.io.attacker.example',Authorization:`Bearer ${newToken}`},body})).status,403);
 for(const path of ['/backend/.env','/.env','/api/progress','/api/apply','/api/documents'])assert.equal((await fetch(base+path)).status,404);
 const good=await fetch(base+'/api/chat',{method:'POST',headers:{...headers,Authorization:`Bearer ${newToken}`},body});assert.equal(good.status,200);assert.equal(calls,1);
 const health=await fetch(base+'/health');assert.deepEqual(await health.json(),{status:'ok'});
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
