// Full browser -> real backend -> simulated OpenAI tool calls. No paid API calls.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const {createStudyServer}=await import('../backend/server.mjs');
 const baseURL=process.env.BASE_URL||'http://127.0.0.1:8000/BI-Study-Agent/';
 const token='test-only-private-token-'.repeat(3);let calls=0;let lastContext='';
 const server=createStudyServer({token,origins:[new URL(baseURL).origin],dailyLimit:30},{callOpenAI:async body=>{
 calls++;lastContext=JSON.stringify(body.input);
 if(body.input.at(-1).type==='function_call_output')return {output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'Her er forslagene. Ingen pensumfiler er lastet opp eller lest.'}]}]};
 return {output:[
 {type:'function_call',name:'propose_tasks',call_id:'tasks',arguments:JSON.stringify({tasks:[{subject:'math',title:'AI-oppgave <img src=x onerror=alert(1)>'}]})},
 {type:'function_call',name:'propose_daily_plan',call_id:'plan',arguments:'{}'},
 {type:'function_call',name:'propose_progress',call_id:'progress',arguments:JSON.stringify({subject:'math',progress:55,reason:'Du har selv vurdert mestringen til 55 %.'})}
 ]};
 }});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(baseURL);
 const original={version:1,subjects:[['math','Matematikk','A–B'],['investments','Investments','A–B']].map(([id,name,target])=>({id,name,target,exam:'2027-12-01',progress:20})),availability:{'2027-11-01':3},tasks:[{id:'existing',subject:'math',title:'Behold oppgaven min',done:false}],sessions:[{id:'private',subject:'math',date:'2027-11-01',minutes:45,note:'Hemmelig læringsnotat'}]};
 await page.evaluate(original=>localStorage.setItem('bi-study-agent-v1',JSON.stringify(original)),original);await page.reload();
 const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bi-study-agent-v1')));
 assert.deepEqual(await stored(),original);assert.equal(await page.locator('#ai-url').inputValue(),'https://bi-study-agent-api.onrender.com');await page.locator('#day').fill('2027-11-01');
 await page.locator('summary').click();await page.locator('#ai-url').fill(`http://127.0.0.1:${server.address().port}`);
 await page.locator('#ai-token').fill('sk-'+'x'.repeat(40));await page.locator('#ai-connect-button').click();
 assert.match(await page.locator('#ai-status').innerText(),/OpenAI-nøkkel/);assert.equal(calls,0);
 const healthURL=`http://127.0.0.1:${server.address().port}/health`;
 await page.route(healthURL,route=>route.abort());
 await page.locator('#ai-token').fill(token);await page.locator('#ai-connect-button').click();
 await page.waitForFunction(()=>document.getElementById('ai-status').textContent.startsWith('Nettverksfeil.'));
 assert.equal(await page.locator('#ai-send').isDisabled(),true);assert.deepEqual(await stored(),original);assert.equal(calls,0);
 await page.unroute(healthURL);
 await page.locator('#ai-token').fill('invalid-token-'.repeat(4));await page.locator('#ai-connect-button').click();
 await page.waitForFunction(()=>document.getElementById('ai-status').textContent.includes('gyldig tilgangstoken'));
 assert.equal(calls,0);assert.deepEqual(await stored(),original);assert.equal(await page.locator('#ai-approve').count(),0);
 await page.locator('#ai-token').fill(token);await page.locator('#ai-connect-button').click();
 await page.waitForFunction(()=>document.getElementById('ai-status').textContent.startsWith('Tilkoblet.'));assert.equal(calls,0);
 const send=async()=>{await page.locator('#ai-message').fill('Lag plan, oppgave og foreslå 55 % i matematikk.');await page.locator('#ai-send').click();await page.locator('#ai-approve').waitFor();};
 await send();assert.deepEqual(await stored(),original);assert.doesNotMatch(lastContext,/Hemmelig læringsnotat/);
 assert.equal(await page.locator('#ai-proposals img').count(),0);
 await page.locator('#ai-reject').click();assert.deepEqual(await stored(),original);
 await send();await page.locator('#ai-approve').click();
 const approved=await stored();assert.equal(approved.tasks.length,2);assert.equal(approved.subjects[0].progress,55);assert.deepEqual(approved.sessions,original.sessions);
 assert.equal(approved.plans['2027-11-01'].blocks.reduce((n,b)=>n+b.minutes,0),135);
 assert.equal(approved.tasks[0].title,'Behold oppgaven min');
 await send();await page.locator('#availability').fill('2');await page.locator('#availability').press('Tab');await page.locator('#ai-approve').click();
 assert.match(await page.locator('#ai-status').innerText(),/endret/);assert.equal((await stored()).tasks.length,2);
 // Browser quota failure must not mutate persisted or active data.
 await send();const beforeQuota=await stored();
 await page.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('Quota exceeded','QuotaExceededError');};});
 await page.locator('#ai-approve').click();assert.deepEqual(await stored(),beforeQuota);assert.equal(await page.locator('#task-list .row').count(),2);
 await page.evaluate(()=>Storage.prototype.setItem=window.originalSetItem);
 // Changes in another tab invalidate proposals as well.
 await send();await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('bi-study-agent-v1'));s.availability['2027-11-01']=1;localStorage.setItem('bi-study-agent-v1',JSON.stringify(s));});await page.locator('#ai-approve').click();assert.match(await page.locator('#ai-status').innerText(),/endret/);
 assert.equal((await stored()).availability['2027-11-01'],1);
 assert.ok(calls>0);assert.equal(await page.locator('#documents input').isDisabled(),true);
 await page.setViewportSize({width:375,height:812});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.locator('#ai-disconnect').click();assert.equal(await page.locator('#ai-send').isDisabled(),true);assert.equal(await page.locator('#ai-messages').innerText(),'');
 assert.equal(await page.evaluate(token=>JSON.stringify({...localStorage}).includes(token),token),false);
 await page.reload();assert.equal(await page.locator('#ai-send').isDisabled(),true);assert.match(await page.locator('#plan-content').innerText(),/Ingen godkjent/);
 await page.locator('#day').fill('2027-11-01');assert.match(await page.locator('#plan-content').innerText(),/135|Matematikk/);
 assert.deepEqual(errors,[]);
 console.log('PASS: existing data preserved; real CORS/auth/tool loop; reject/approve; daily plan budget; no private notes sent; no HTML execution; stale/localStorage conflict and quota rejection; token not persisted; mobile; reload. OpenAI simulated.');
 }finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
