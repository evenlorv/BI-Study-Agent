'use strict';
const KEY = 'bi-study-agent-v1';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const seed = () => ({version:1,subjects:[
 ['investments','Investments','A–B','2026-11-23',20],['math','Matematikk','A–B','2026-11-27',35],['quant','Kvantitativ finans','A–B','2026-12-02',15],['finance','Finansiell styring','A–B','2026-12-07',25],['communication','Business Communication','Minst C','2026-12-10',40],['organization','Organisasjon og ledelse','Minst C','2026-12-15',30]
].map(([id,name,target,exam,progress])=>({id,name,target,exam,progress})),availability:{},tasks:[{id:'demo-1',subject:'investments',title:'Repeter risiko og avkastning (eksempel)',done:false},{id:'demo-2',subject:'math',title:'Løs fem derivasjonsoppgaver (eksempel)',done:false}],sessions:[]});
let state;
try { const raw=localStorage.getItem(KEY);state=raw?JSON.parse(raw):seed(); if(state.version!==1 || !Array.isArray(state.subjects)||!Array.isArray(state.tasks)||!Array.isArray(state.sessions)||!state.availability) throw Error('format'); } catch { state=seed(); document.querySelector('#status').textContent='Lagrede data kunne ikke leses. Eksempeldata vises. Originalen overskrives først når du gjør en endring.'; }
const $=s=>document.querySelector(s);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const subjectName=id=>state.subjects.find(s=>s.id===id)?.name || 'Ukjent fag';
const fmt=d=>new Intl.DateTimeFormat('nb-NO',{day:'numeric',month:'short',year:'numeric'}).format(new Date(d+'T12:00:00'));
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));$('#status').textContent='Endringene er lagret i denne nettleseren.';}catch{$('#status').textContent='Kunne ikke lagre lokalt. Last ned en sikkerhetskopi før du lukker siden.';}render();}
$('#day').value=today();
for(const select of document.querySelectorAll('.subject-select')) select.innerHTML=state.subjects.map(s=>`<option value="${escape(s.id)}">${escape(s.name)}</option>`).join('');
function render(){
 const day=$('#day').value||today();const goal=state.availability[day]??4;const minutes=state.sessions.filter(s=>s.date===day).reduce((sum,s)=>sum+s.minutes,0);const remaining=Math.max(0,Math.round(goal*60-minutes));
 $('#availability').value=goal;
 $('#stats').innerHTML=`<div class="stat"><span>Planlagt selvstudietid</span><strong>${goal} t</strong></div><div class="stat"><span>Registrert denne dagen</span><strong>${minutes} min</strong></div><div class="stat"><span>Gjenstår av dagsmålet</span><strong>${remaining} min</strong></div>`;
 $('#subject-list').innerHTML=state.subjects.map(s=>`<article class="subject"><h3>${escape(s.name)}</h3><span class="target">Karaktermål: ${escape(s.target)}</span><progress value="${s.progress}" max="100" aria-label="Progresjon i ${escape(s.name)}"></progress><label>Progresjon (%)<input type="number" min="0" max="100" step="1" value="${s.progress}" data-progress="${escape(s.id)}" aria-label="Progresjon i ${escape(s.name)} i prosent"></label></article>`).join('');
 $('#exam-list').innerHTML=[...state.subjects].sort((a,b)=>a.exam.localeCompare(b.exam)).map(s=>`<div class="row"><div><strong>${escape(s.name)}</strong><small>Eksempeldato · mål ${escape(s.target)}</small></div><label><span class="muted">Eksamensdato</span><input type="date" value="${escape(s.exam)}" data-exam="${escape(s.id)}" aria-label="Eksamensdato for ${escape(s.name)}" required></label></div>`).join('');
 $('#task-list').innerHTML=state.tasks.map(t=>`<div class="row"><input type="checkbox" data-task="${escape(t.id)}" ${t.done?'checked':''} aria-label="Fullfør ${escape(t.title)}"><div class="task-title ${t.done?'done':''}">${escape(t.title)}<small>${escape(subjectName(t.subject))}</small></div><button class="icon" data-delete-task="${escape(t.id)}" aria-label="Slett oppgave">×</button></div>`).join('')||'<p class="muted">Ingen oppgaver. Legg til din første.</p>';
 $('#session-list').innerHTML=[...state.sessions].reverse().map(s=>`<div class="row"><div class="task-title"><strong>${escape(subjectName(s.subject))} · ${s.minutes} min</strong><small>${fmt(s.date)} · ${escape(s.note)}</small></div><button class="icon" data-delete-session="${escape(s.id)}" aria-label="Slett studieøkt">×</button></div>`).join('')||'<p class="muted">Ingen økter registrert ennå.</p>';
}
$('#day').addEventListener('change',render);
$('#availability').addEventListener('change',e=>{if(!e.target.checkValidity()||e.target.value===''){e.target.reportValidity();return;}state.availability[$('#day').value||today()]=Number(e.target.value);save();});
document.addEventListener('change',e=>{const el=e.target;if(el.dataset.progress){if(!el.checkValidity()||el.value===''){el.reportValidity();return;}state.subjects.find(s=>s.id===el.dataset.progress).progress=Number(el.value);save();}if(el.dataset.exam){if(!el.checkValidity())return;state.subjects.find(s=>s.id===el.dataset.exam).exam=el.value;save();}if(el.dataset.task){state.tasks.find(t=>t.id===el.dataset.task).done=el.checked;save();}});
document.addEventListener('click',e=>{if(e.target.dataset.deleteTask){state.tasks=state.tasks.filter(t=>t.id!==e.target.dataset.deleteTask);save();}if(e.target.dataset.deleteSession){state.sessions=state.sessions.filter(s=>s.id!==e.target.dataset.deleteSession);save();}});
$('#task-form').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target);const title=f.get('title').trim();if(!title)return;state.tasks.push({id:crypto.randomUUID(),subject:f.get('subject'),title,done:false});e.target.reset();save();});
$('#session-form').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target);const note=f.get('note').trim();if(!note)return;state.sessions.push({id:crypto.randomUUID(),subject:f.get('subject'),minutes:Number(f.get('minutes')),note,date:$('#day').value||today()});e.target.reset();save();});
$('#export').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`bi-study-agent-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('#reset').addEventListener('click',()=>{if(confirm('Slette dine registrerte data og gjenopprette eksempeldata? Last gjerne ned en sikkerhetskopi først.')){state=seed();save();}});
render();
