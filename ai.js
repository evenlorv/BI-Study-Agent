import { applyProposals } from './study-actions.mjs';
const el=id=>document.getElementById(id);
let connection=null,history=[],pending=null,controller=null;
const status=message=>{el('ai-status').textContent=message;};
function clearPending(){pending=null;el('ai-proposals').replaceChildren();}
function message(role,content){const box=document.createElement('div');box.className=`chat-message ${role}`;const label=document.createElement('strong');label.textContent=role==='user'?'Du':'BI Study Agent';const body=document.createElement('p');body.textContent=content;box.append(label,body);el('ai-messages').append(box);}
function apiError(statusCode){
 const messages={401:'Logg inn med gyldig tilgangstoken (STUDY_ACCESS_TOKEN fra Render, ikke OpenAI-nøkkelen).',403:'Nettsiden er ikke tillatt av backend. Kontroller ALLOWED_ORIGINS i Render: https://evenlorv.github.io.',429:'Backend har nådd en bruksgrense eller er opptatt. Vent og prøv igjen.',502:'AI-tjenesten svarte ikke som forventet. Kontroller modelltilgang og fakturering privat i OpenAI.',503:'Backend er midlertidig utilgjengelig. Vent på at Render-tjenesten våkner og prøv igjen.'};
 return Error(messages[statusCode]||`Backend svarte med HTTP ${statusCode}. Kontroller tjenestestatus i Render.`);
}
async function readJSON(response){try{return await response.json();}catch{throw Error('Backend svarte ikke med JSON. Kontroller adressen og vent på eventuell oppvåkning i Render.');}}
function connectionError(error){return error.name==='AbortError'?'Tilkoblingen eller forespørselen ble avbrutt. Vent på eventuell oppvåkning i Render og prøv igjen.':error instanceof TypeError?'Nettverksfeil. Kontroller HTTPS-adressen, at Render er våken, og at ALLOWED_ORIGINS tillater denne nettsiden.':error.message;}
function disconnect(){controller?.abort();controller=null;connection=null;history=[];clearPending();el('ai-messages').replaceChildren();el('ai-token').value='';el('ai-send').disabled=true;el('ai-connect-button').disabled=false;status('Frakoblet. Chat og token er fjernet fra appens minne.');}
el('ai-disconnect').addEventListener('click',disconnect);
el('ai-connect').addEventListener('submit',async event=>{
 event.preventDefault();
 let url,token;
 try{
 url=new URL(el('ai-url').value);
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||(url.protocol!=='https:'&&!(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname))))throw Error('Bruk en HTTPS-adresse uten sti, eller localhost ved lokal testing.');
 token=el('ai-token').value.trim();if(token.startsWith('sk-')){el('ai-token').value='';throw Error('Dette ser ut som en OpenAI-nøkkel. Bruk STUDY_ACCESS_TOKEN fra Render i dette feltet.');}if(token.length<32)throw Error('Tilgangstoken må være minst 32 tegn.');
 }catch(error){status(error.message);return;}
 disconnect();
 const currentController=new AbortController();controller=currentController;
 const timeout=setTimeout(()=>currentController.abort(),120000);
 el('ai-connect-button').disabled=true;
 status('Kontrollerer backend og tilgang. Render Free kan trenge tid på å våkne. Ingen studiedata sendes.');
 try{
 const options={signal:currentController.signal,credentials:'omit',referrerPolicy:'no-referrer'};
 const health=await fetch(`${url.origin}/health`,options);
 if(!health.ok)throw apiError(health.status);
 if((await readJSON(health)).status!=='ok')throw Error('Adressen svarte ikke som forventet på health-kontrollen.');
 // Existing backend authenticates before validating its body. {} must return
 // the known validation error. This checks auth+CORS without data or paid calls.
 const probe=await fetch(`${url.origin}/api/chat`,{...options,method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:'{}'});
 if(probe.status!==400)throw apiError(probe.status);
 if((await readJSON(probe)).error!=='Ugyldig tekst.')throw Error('Backend svarte med et uventet valideringsformat. Kontroller backend-versjonen.');
 if(currentController.signal.aborted||controller!==currentController)return;
 connection={url:url.origin,token};status('Tilkoblet. Backend og tilgangstoken er kontrollert. OpenAI testes først når du sender en melding.');
 }catch(error){if(controller===currentController)status(connectionError(error));}
 finally{clearTimeout(timeout);if(controller===currentController){controller=null;el('ai-connect-button').disabled=false;el('ai-send').disabled=!connection;}}
});
function showProposals(proposals,snapshot){
 clearPending();if(!proposals.length)return;
 // Reject malformed model output before enabling approval.
 applyProposals(snapshot.state,proposals,snapshot.day);
 pending={proposals,snapshot};
 const box=el('ai-proposals');const heading=document.createElement('h3');heading.textContent='Forhåndsvisning – ikke lagret';box.append(heading);
 const name=id=>snapshot.state.subjects.find(s=>s.id===id)?.name||id;
 for(const proposal of proposals){const card=document.createElement('div');card.className='proposal';
 const p=document.createElement('p');
 if(proposal.type==='tasks')p.textContent='Nye oppgaver:\n'+proposal.tasks.map(t=>`${name(t.subject)}: ${t.title}`).join('\n');
 if(proposal.type==='progress')p.textContent=`Progresjon i ${name(proposal.subject)}: ${snapshot.state.subjects.find(s=>s.id===proposal.subject).progress} % → ${proposal.progress} %\n${proposal.reason}`;
 if(proposal.type==='daily_plan')p.textContent=`Dagsplan ${proposal.date} – erstatter eventuell godkjent plan for denne datoen.\n${proposal.blocks.map(b=>`${b.minutes} min · ${name(b.subject)}: ${b.title}\n${b.reason}`).join('\n')}\nTotalt ${proposal.blocks.reduce((n,b)=>n+b.minutes,0)} minutter.\n${proposal.reason}`;
 card.append(p);box.append(card);}
 const approve=document.createElement('button');approve.textContent='Godkjenn og lagre forslagene';approve.id='ai-approve';
 approve.addEventListener('click',()=>{try{if(!pending)return;const {snapshot,proposals}=pending;const next=applyProposals(snapshot.state,proposals,snapshot.day);window.studyAgent.commit(snapshot,next);clearPending();status('Forslagene er godkjent og lagret lokalt.');}catch(error){clearPending();status(error.message);}});
 const reject=document.createElement('button');reject.textContent='Avvis forslagene';reject.className='secondary';reject.id='ai-reject';reject.addEventListener('click',()=>{clearPending();status('Forslagene er avvist. Ingen studiedata er endret.');});box.append(approve,reject);
}
el('ai-chat').addEventListener('submit',async event=>{
 event.preventDefault();if(!connection||controller)return;
 const content=el('ai-message').value.trim();if(!content)return;
 let snapshot;try{snapshot=window.studyAgent.snapshot();}catch{status('Kan ikke lese nettleserlagring. Aktiver lagring før du bruker AI.');return;}
 const data={subjects:snapshot.state.subjects,tasks:snapshot.state.tasks,sessions:snapshot.state.sessions.map(s=>({subject:s.subject,date:s.date,minutes:s.minutes})),selectedDate:snapshot.day,availableHours:snapshot.state.availability[snapshot.day]??4};
 clearPending();message('user',content);el('ai-message').value='';el('ai-send').disabled=true;status('Assistenten arbeider. Ingen endringer lagres automatisk.');
 const currentController=new AbortController();controller=currentController;const timeout=setTimeout(()=>currentController.abort(),150000);
 try{
 const response=await fetch(`${connection.url}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${connection.token}`},body:JSON.stringify({message:content,history:history.slice(-10),data}),signal:currentController.signal,credentials:'omit',referrerPolicy:'no-referrer'});
 if(!response.ok)throw apiError(response.status);const result=await readJSON(response);
 if(typeof result.reply!=='string'||result.reply.length>16000||!Array.isArray(result.proposals))throw Error('Ugyldig svar fra backend.');
 message('assistant',result.reply);history.push({role:'user',content},{role:'assistant',content:result.reply.slice(0,8000)});history=history.slice(-10);
 showProposals(result.proposals,snapshot);status(result.proposals.length?'Se forslagene og godkjenn eller avvis.':'Svar mottatt. Ingen studiedata er endret.');
 }catch(error){if(connection)status(`${connectionError(error)} Ingen studiedata er endret.`);}
 finally{clearTimeout(timeout);if(controller===currentController){controller=null;el('ai-send').disabled=!connection;}}
});
