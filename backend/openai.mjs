// Only explicit metadata is retained. Never include provider messages/bodies in errors.
export class OpenAIError extends Error {
 constructor(code,{status=null,requestId=null}={}){super('OpenAI request failed');this.name='OpenAIError';this.code=code;this.status=status;this.requestId=requestId;}
}
const codes=new Set(['invalid_api_key','insufficient_permissions','permission_denied','model_not_found','rate_limit_exceeded','insufficient_quota','invalid_request_error','invalid_json_schema','invalid_function_parameters','invalid_function_definition','missing_required_parameter','invalid_model','unsupported_model','unsupported_parameter','unsupported_value','invalid_value','context_length_exceeded','server_error','billing_hard_limit_reached','organization_deactivated']);
const internalCodes=new Set(['network_error','timeout','invalid_json_response','invalid_response','incomplete_response','empty_response','refusal','too_many_tool_calls','tool_limit_reached','unexpected_backend_error']);
const requestId=value=>typeof value==='string'&&/^req_[a-f0-9]{8,64}$/.test(value)?value:null;
export function diagnostic(error){
 return {event:'openai_failure',http_status:error instanceof OpenAIError&&Number.isInteger(error.status)?error.status:null,error_code:error instanceof OpenAIError&&(codes.has(error.code)||internalCodes.has(error.code))?error.code:'unexpected_backend_error',request_id:error instanceof OpenAIError?requestId(error.requestId):null};
}
export function responseError(code,response){return new OpenAIError(code,response?.diagnostics);}
export function createOpenAIClient(config,{fetchImpl=fetch}={}){
 return async body=>{
 let response;
 try{
 response=await fetchImpl('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${config.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({...body,model:config.model}),signal:AbortSignal.timeout(30000)});
 }catch(e){throw new OpenAIError(['TimeoutError','AbortError'].includes(e?.name)?'timeout':'network_error');}
 const meta={status:response.status,requestId:requestId(response.headers.get('x-request-id'))};
 let data;try{data=await response.json();}catch(e){throw new OpenAIError(['TimeoutError','AbortError'].includes(e?.name)?'timeout':response.ok?'invalid_json_response':'invalid_request_error',meta);}
 if(!response.ok)throw new OpenAIError(codes.has(data?.error?.code)?data.error.code:codes.has(data?.error?.type)?data.error.type:'invalid_request_error',meta);
 if(!data||typeof data!=='object'||!Array.isArray(data.output))throw new OpenAIError('invalid_response',meta);
 if(data.status==='incomplete')throw new OpenAIError('incomplete_response',meta);
 if(data.status==='failed'||data.error)throw new OpenAIError(codes.has(data.error?.code)?data.error.code:'invalid_response',meta);
 Object.defineProperty(data,'diagnostics',{value:meta,enumerable:false});
 return data;
 };
}
