// Shared, pure validation: AI output can propose only these three operations.
export function applyProposals(current, proposals, selectedDate) {
 const next=structuredClone(current);
 const fail=()=>{throw Error('Forslaget inneholder ugyldige eller utdaterte endringer.');};
 if(!Array.isArray(proposals)||!proposals.length||proposals.length>8)fail();
 const subject=id=>next.subjects.find(s=>s.id===id)||fail();
 const title=value=>typeof value==='string'&&value.trim()&&value.length<=180?value.trim():fail();
 const plannedDates=new Set();
 for(const proposal of proposals){
 if(proposal.type==='tasks'){
 if(!Array.isArray(proposal.tasks)||!proposal.tasks.length||proposal.tasks.length>8)fail();
 for(const task of proposal.tasks){subject(task.subject);next.tasks.push({id:crypto.randomUUID(),subject:task.subject,title:title(task.title),done:false});}
 }else if(proposal.type==='progress'){
 if(!Number.isInteger(proposal.progress)||proposal.progress<0||proposal.progress>100||typeof proposal.reason!=='string')fail();
 subject(proposal.subject).progress=proposal.progress;
 }else if(proposal.type==='daily_plan'){
 if(proposal.date!==selectedDate||plannedDates.has(proposal.date)||!Array.isArray(proposal.blocks)||proposal.blocks.length>30)fail();
 plannedDates.add(proposal.date);
 let total=0;const blocks=proposal.blocks.map(block=>{
 subject(block.subject);if(!Number.isInteger(block.minutes)||block.minutes<1||block.minutes>50||typeof block.reason!=='string')fail();total+=block.minutes;
 return {subject:block.subject,title:title(block.title),minutes:block.minutes,reason:block.reason.slice(0,500)};
 });
 const used=next.sessions.filter(s=>s.date===selectedDate).reduce((n,s)=>n+s.minutes,0);
 const budget=Math.max(0,Math.floor((next.availability[selectedDate]??4)*60-used));
 if(total>budget)fail();
 next.plans={...(next.plans||{}),[proposal.date]:{blocks,reason:String(proposal.reason||'').slice(0,500)}};
 }else fail();
 }
 if(next.tasks.length>300)throw Error('Maks 300 oppgaver. Slett gamle oppgaver før du legger til flere.');
 return next;
}
