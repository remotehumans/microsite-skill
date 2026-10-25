// ABOUTME: Today: the home view, a short list of only the people who need something from you now, grouped by what to do.
// ABOUTME: Each card opens the person drawer; the counts at the top double as a quick read on the whole campaign.

const quietDays=7;
const daysSince=at=>at?(Date.now()-new Date(at).getTime())/86400000:Infinity;
const TODAY_GROUPS=[
  {id:'dm',title:'Send a DM',hint:'Connected, nothing sent yet',color:COLOR.A,test:p=>p.connection==='connected'&&!logged(p,'dm_sent')&&!logged(p,'reply_received')&&!isParked(p)},
  {id:'reply',title:'They replied',hint:'Answer and send your call link',color:COLOR.B,test:p=>p.last_kind==='reply_received'&&!logged(p,'call_booked')&&!isParked(p)},
  {id:'due',title:'Follow-ups due',hint:'The date you set has arrived',color:COLOR.D,test:p=>dueNow(p)&&p.last_kind!=='reply_received'},
  {id:'quiet',title:`Quiet for ${quietDays}+ days`,hint:'DM sent, no reply. A short nudge?',color:COLOR.C,test:p=>p.last_kind==='dm_sent'&&daysSince(p.last_at)>=quietDays&&!dueNow(p)&&!isParked(p)}
];
const inCampaign=p=>collection==='all'||p.campaign===collection;
function todayCard(p,g){
  return `<div class="today-task-row"><button class="queue-preview today-task-preview" data-today-preview="${esc(p.company_id)}" aria-label="Preview ${esc(p.company)} microsite" disabled><span class="placeholder">Loading preview…</span></button><button class="task" data-person-open="${esc(p.key)}" style="--c:${g.color}"><span class="task-main"><b>${esc(p.name)}</b><span>${esc(p.role)}${p.role?' · ':''}${esc(p.company)}</span></span><span class="task-meta">${p.next_step?`<b>Next:</b> ${esc(p.next_step)} · `:''}${esc(campaignLabel(p.campaign))}${p.source?' · '+esc(p.source):''} · ${esc(ago(p.last_at))}</span><span class="task-go" aria-hidden="true">→</span></button></div>`;
}
function renderTodayPreviews(){
  document.querySelectorAll('[data-today-preview]').forEach(button=>{
    const id=button.dataset.todayPreview,company=data?.rows?.find(r=>r.id===id)||queueItems.find(r=>r.id===id);
    button.disabled=!company?.page;
    if(company?.page){button.dataset.queueCompany=id;button.innerHTML=thumbHTML(company);}
    else button.innerHTML='<span class="placeholder">No microsite yet</span>';
    button.querySelector('img')?.addEventListener('error',()=>{button.innerHTML='<span class="placeholder">Open microsite</span>';},{once:true});
  });
}
async function renderToday(){
  const box=$('#today-view');
  try{
    const res=await fetch('/api/people',{cache:'no-store'});if(!res.ok)throw new Error('People unavailable');
    peopleData=await res.json();
    const list=peopleData.people.filter(inCampaign),seen=new Set();
    const groups=TODAY_GROUPS.map(g=>({...g,people:list.filter(p=>!seen.has(p.key)&&g.test(p)&&seen.add(p.key))}));
    const total=groups.reduce((n,g)=>n+g.people.length,0),pending=list.filter(p=>p.connection==='pending'&&!logged(p,'dm_sent')).length;
    const reached=list.filter(p=>p.reached).length,replied=list.filter(p=>logged(p,'reply_received')).length,booked=list.filter(p=>logged(p,'call_booked')).length;
    $('#nav-today-count').textContent=total||'';$('#nav-people-count').textContent=list.length;
    const day=new Date().toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'});
    box.innerHTML=`<header class="view-head"><div><h1>Today</h1><p class="sub">${esc(day)} · ${total?`${total} ${total===1?'person needs':'people need'} you`:'No follow-ups waiting'}</p></div><div class="head-actions"><button data-go="add">Add contact</button></div></header>
      <section class="kpis">${[['To do',total,COLOR.A],['Requests pending',pending,COLOR.MS],['Reached',reached,COLOR.A],['Replied',replied,COLOR.B],['Calls booked',booked,COLOR.D]].map(([l,n,c])=>`<div class="kpi"><i style="background:${c}"></i><span>${l}</span><b>${n}</b></div>`).join('')}</section>
      <section id="priority-queue" aria-label="Priority call queue"></section>
      ${total?`<div class="task-groups">${groups.filter(g=>g.people.length).map(g=>`<section class="task-group"><header><i style="background:${g.color}"></i><h2>${esc(g.title)}</h2><span class="count">${g.people.length}</span><p>${esc(g.hint)}</p></header><div class="tasks">${g.people.slice(0,30).map(p=>todayCard(p,g)).join('')}</div>${g.people.length>30?`<p class="more">+${g.people.length-30} more in People</p>`:''}</section>`).join('')}</div>`
        :`<section class="all-clear"><h2>No follow-ups due.</h2><p>${pending?`${pending} connection ${pending===1?'request is':'requests are'} still waiting to be accepted. `:''}Use the call queue above, review new microsites in Companies, or add someone you met.</p><div class="step-row"><button class="primary" data-go="companies">Review companies</button><button data-go="add">Add contact</button></div></section>`}`;
    if(typeof renderPriorityQueue==='function')await renderPriorityQueue();
    renderTodayPreviews();
  }catch(error){console.error('Today render failed:',error);box.innerHTML='<p class="sub">Today could not load. Try Refresh.</p>';}
}
document.addEventListener('click',e=>{
  const o=e.target.closest('[data-person-open]');if(o){if($('#reviewer').open)closeReview();openPerson(o.dataset.personOpen);return;}
  const g=e.target.closest('[data-go]');if(!g)return;
  if(g.dataset.go==='companies')setView('companies');
  if(g.dataset.go==='add'){setView('people');setTimeout(()=>document.querySelector('[data-panel-open=add]')?.click(),300);}
});
