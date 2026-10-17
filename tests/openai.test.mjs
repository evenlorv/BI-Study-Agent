import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpenAIClient, diagnostic, OpenAIError } from '../backend/openai.mjs';
import { createStudyServer, configFromEnv } from '../backend/server.mjs';
import { runAssistant, studyData } from '../backend/study.mjs';
const id='req_0123456789abcdef0123456789abcdef';
const sensitive='PRIVATE_CONTENT_MUST_NEVER_BE_LOGGED';
const config={token:'test-token-'.repeat(5),apiKey:sensitive,model:'gpt-4.1-mini',origins:[],dailyLimit:10};
const data=()=>studyData({subjects:[{id:'math',name:'Matematikk',target:'A–B',exam:'2027-12-01',progress:20}],tasks:[],sessions:[],selectedDate:'2027-11-01',availableHours:4});
for(const [status,code] of [[400,'invalid_json_schema'],[400,'invalid_function_parameters'],[401,'invalid_api_key'],[403,'insufficient_permissions'],[404,'model_not_found'],[429,'insufficient_quota'],[429,'rate_limit_exceeded']]){
 test(`HTTP ${status}/${code}: safe metadata reaches logs, sensitive content never reaches logs or UI`,async()=>{
 const logs=[];
 const provider=createOpenAIClient(config,{fetchImpl:async()=>new Response(JSON.stringify({error:{code,type:'invalid_request_error',message:sensitive,param:sensitive}}),{status,headers:{'x-request-id':id}})});
 const server=createStudyServer(config,{callOpenAI:provider,logFailure:entry=>logs.push(entry)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
 const result=await fetch(`http://127.0.0.1:${server.address().port}/api/chat`,{method:'POST',headers:{Authorization:`Bearer ${config.token}`,'Content-Type':'application/json'},body:JSON.stringify({message:sensitive,history:[],data:data()})});
 assert.equal(result.status,502);const publicBody=await result.text();assert.match(publicBody,/Ingen studiedata er endret/);
 assert.deepEqual(logs,[{event:'openai_failure',http_status:status,error_code:code,request_id:id}]);
 assert.ok(!JSON.stringify(logs).includes(sensitive));assert.ok(!publicBody.includes(sensitive));assert.ok(!publicBody.includes(id));assert.ok(!publicBody.includes(code));assert.ok(!JSON.stringify(logs).includes(config.token));
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 });
}
test('unknown provider strings, non-JSON errors, network failures and timeout stay sanitized',async()=>{
 const scenarios=[
 [async()=>new Response(JSON.stringify({error:{code:sensitive,message:sensitive}}),{status:403,headers:{'x-request-id':sensitive}}),'invalid_request_error',403],
 [async()=>new Response(sensitive,{status:401}),'invalid_request_error',401],
 [async()=>{throw Error(sensitive);},'network_error',null],
 [async()=>{throw new DOMException(sensitive,'TimeoutError');},'timeout',null],
 [async()=>new Response(sensitive,{status:200}),'invalid_json_response',200],
 [async()=>Response.json({status:'incomplete',output:[],incomplete_details:{reason:sensitive}},{headers:{'x-request-id':id}}),'incomplete_response',200]
 ];
 for(const [fetchImpl,code,status] of scenarios){
 await assert.rejects(createOpenAIClient(config,{fetchImpl})({}),error=>{
 const entry=diagnostic(error);assert.equal(entry.error_code,code);assert.equal(entry.http_status,status);assert.ok(!JSON.stringify(entry).includes(sensitive));assert.ok(!error.message.includes(sensitive));return true;
 });
 }
 assert.equal(diagnostic(new Error(sensitive)).error_code,'unexpected_backend_error');
 assert.equal(diagnostic(new OpenAIError(sensitive)).error_code,'unexpected_backend_error');
});
test('actual serialized Responses request and strict tools survive a function round-trip',async()=>{
 const requests=[];
 const client=createOpenAIClient(config,{fetchImpl:async(url,options)=>{
 assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.method,'POST');assert.equal(options.headers.Authorization,`Bearer ${sensitive}`);
 const body=JSON.parse(options.body);requests.push(body);
 assert.equal(body.model,'gpt-4.1-mini');assert.equal(body.store,false);assert.equal(body.parallel_tool_calls,false);
 assert.ok(!('messages' in body));assert.ok(Array.isArray(body.input));
 for(const tool of body.tools){assert.equal(tool.type,'function');assert.equal(tool.strict,true);assert.equal(tool.function,undefined);assert.equal(tool.parameters.additionalProperties,false);assert.deepEqual(tool.parameters.required,Object.keys(tool.parameters.properties));}
 if(requests.length===1)return Response.json({status:'completed',output:[{type:'function_call',call_id:'call_plan',name:'propose_daily_plan',arguments:'{}'}]},{headers:{'x-request-id':id}});
 assert.ok(body.input.some(item=>item.type==='function_call_output'&&item.call_id==='call_plan'&&JSON.parse(item.output).status==='pending_user_approval'));
 assert.ok(!JSON.stringify(body).includes('diagnostics'));
 return Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'Forslag klart.'}]}]});
 }});
 const result=await runAssistant({message:'Lag plan',history:[],data:data(),callOpenAI:client});
 assert.equal(result.reply,'Forslag klart.');assert.equal(result.proposals[0].type,'daily_plan');assert.equal(requests.length,2);
});
test('model configuration trims whitespace and refuses a secret accidentally used as model',()=>{
 const env={STUDY_ACCESS_TOKEN:config.token,OPENAI_API_KEY:sensitive,OPENAI_MODEL:' gpt-4.1-mini '};
 assert.equal(configFromEnv(env).model,'gpt-4.1-mini');
 assert.throws(()=>configFromEnv({...env,OPENAI_MODEL:'sk-'+'x'.repeat(30)}),/modell-ID/);
});
