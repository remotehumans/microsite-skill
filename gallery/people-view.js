// ABOUTME: People view: every contact in one fast table with one-click stage buttons, plus the Add contact form and CSV import.
// ABOUTME: Reads /api/people and writes through /api/contact-tracker and /api/contacts; works for campaign and hand-added people alike.

let peopleData=null,peopleFilter='open',peopleQuery='',peopleCampaign='',peopleSort='next';
const STAGE_NAME={A:'Initiated',MS:'Seen',B:'Replied',C:'Call link sent',D:'Booked'};
const PARKED_NAME={not_now:'Not now',do_not_contact:'Do not contact'};
// One click logs the step as done now. The next logical step for each person is the highlighted button.
const STEP_BUTTONS=[['dm_sent','DM sent','A'],['reply_received','Replied','B'],['call_link_sent','Call link','C'],['call_booked','Booked','D']];
const today=()=>new Date().toLocaleDateString('en-CA');
const campaignLabel=id=>peopleData?.campaigns.find(c=>c.id===id)?.name||id.replace(/-/g,' ').replace(/^./,c=>c.toUpperCase());
const isParked=p=>!!PARKED_NAME[p.stage];
const dueNow=p=>p.next_follow_up&&p.next_follow_up<=today()&&!isParked(p)&&p.reached!=='D';
const ago=at=>{if(!at)return 'No activity';const d=Math.floor((Date.now()-new Date(at).getTime())/86400000);return d<=0?'Today':d===1?'Yesterday':d<7?d+' days ago':d<60?Math.floor(d/7)+' wk ago':date(at).split(',')[0];};
function eventId(){
  // uuidv7: 48-bit millisecond time, then random bits, so ids sort by creation time.
  const b=crypto.getRandomValues(new Uint8Array(16)),t=Date.now();
  for(let i=0;i<6;i++)b[i]=Math.floor(t/2**(40-8*i))&255;
  b[6]=(b[6]&15)|112;b[8]=(b[8]&63)|128;
  const h=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
const PEOPLE_FILTERS=[['open','Active',p=>!isParked(p)&&p.reached!=='D'],['due','Follow-up due',dueNow],['new','Not started',p=>!p.reached&&!isParked(p)],
  ['A','Initiated',p=>p.reached==='A'||p.reached==='MS'],['B','Replied',p=>p.reached==='B'],['C','Call link sent',p=>p.reached==='C'],['D','Booked',p=>p.reached==='D'],["parked","Parked",isParked],['all','Everyone',()=>true]];

// Steps count as done only when that action was logged; a pending connection request is not a DM.
const logged=(p,kind)=>p.kinds.includes(kind);
function nextStep(p){return isParked(p)?null:STEP_BUTTONS.findLast(([kind])=>logged(p,kind))?STEP_BUTTONS[STEP_BUTTONS.findLastIndex(([kind])=>logged(p,kind))+1]?.[0]||null:'dm_sent';}
function stageChip(p){
  if(isParked(p))return `<span class="stage-chip parked">${PARKED_NAME[p.stage]}</span>`;
  if(!p.reached)return `<span class="stage-chip">${p.connection==='connected'?'Connected':p.connection==='pending'?'Request pending':'Not started'}</span>`;
  return `<span class="stage-chip on" style="--c:${COLOR[p.reached]};--ink:${INK_ON[p.reached]}">${STAGE_NAME[p.reached]}</span>`;
}
function personRow(p){
  const next=nextStep(p),done=id=>logged(p,STEP_BUTTONS.find(b=>b[2]===id)[0]);
  const buttons=STEP_BUTTONS.map(([kind,label,id])=>`<button class="step${kind===next?' next':''}${done(id)?' done':''}" data-step="${kind}" ${done(id)?'aria-pressed="true"':''} title="${done(id)?label+' logged'+(p.marks[id]?' · '+esc(date(p.marks[id])):''):'Log '+label.toLowerCase()+' now'}">${done(id)?'✓ ':''}${label}</button>`).join('');
  return `<tr data-person="${esc(p.key)}" class="${dueNow(p)?'due':''}">
    <td class="who"><button class="name-link" data-person-open="${esc(p.key)}">${esc(p.name)}</button><span>${esc(p.role)}${p.role&&p.company?' · ':''}${esc(p.company)}</span>${p.reason?`<span class="why">${esc(p.reason)}</span>`:''}</td>
    <td class="next">${esc(p.next_step)}${p.source?`<span>${p.source_url?`<a href="${esc(p.source_url)}" target="_blank" rel="noopener noreferrer">${esc(p.source)}</a>`:esc(p.source)}</span>`:''}</td>
    <td class="camp"><span class="camp-tag">${esc(campaignLabel(p.campaign))}</span></td>
    <td>${stageChip(p)}</td>
    <td class="when">${esc(ago(p.last_at))}</td>
    <td><input type="date" class="follow" value="${esc(p.next_follow_up)}" aria-label="Next follow-up for ${esc(p.name)}"></td>
    <td class="steps">${buttons}<button class="step park" data-step="not_now" title="Stop follow-ups for now">${p.stage==='not_now'?'Resume':'Not now'}</button></td>
    <td class="links">${p.profile_url?`<a href="${esc(p.profile_url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(p.name)} on LinkedIn">in</a>`:''}${p.email?`<a href="mailto:${esc(p.email)}" aria-label="Email ${esc(p.name)}">@</a>`:''}${p.manual?'':`<button class="text-button" data-open-person="${esc(p.company_id)}">Open ↗</button>`}</td>
  </tr>`;
}
function filteredPeople(){
  const test=PEOPLE_FILTERS.find(f=>f[0]===peopleFilter)[2],q=peopleQuery.toLowerCase();
  const list=peopleData.people.filter(p=>(collection==='all'||p.campaign===collection)&&(!peopleCampaign||p.campaign===peopleCampaign)&&test(p)&&(!q||[p.name,p.company,p.role,p.email,p.source,p.reason,p.next_step].join(' ').toLowerCase().includes(q)));
  const by={next:(a,b)=>(a.next_follow_up||'9999').localeCompare(b.next_follow_up||'9999')||(b.last_at||'').localeCompare(a.last_at||''),
    recent:(a,b)=>(b.last_at||'').localeCompare(a.last_at||''),name:(a,b)=>a.name.localeCompare(b.name),company:(a,b)=>a.company.localeCompare(b.company)};
  return list.sort(by[peopleSort]);
}
function renderPeopleTable(){
  const box=$('#people-view'),list=filteredPeople(),base=peopleData.people.filter(p=>(collection==='all'||p.campaign===collection)&&(!peopleCampaign||p.campaign===peopleCampaign));
  box.querySelector('.people-filters').innerHTML=PEOPLE_FILTERS.map(([id,label,test])=>`<button data-filter="${id}" aria-pressed="${peopleFilter===id}">${label}<span>${base.filter(test).length}</span></button>`).join('');
  box.querySelector('.people-count').textContent=`${list.length} ${list.length===1?'person':'people'}`;
  box.querySelector('tbody').innerHTML=list.length?list.slice(0,400).map(personRow).join(''):`<tr><td colspan="8" class="none">Nobody matches. Try another filter or add someone.</td></tr>`;
}
async function renderPeople(){
  const box=$('#people-view');
  if(!box.dataset.ready){
    box.innerHTML=`<header class="view-head"><div><h1>People</h1><p class="sub">Everyone you are talking to. Click a name to open them.</p></div><div class="head-actions"><button class="primary" data-panel-open="add">Add contact</button><button data-panel-open="import">Import CSV</button></div></header>
      <section class="people-panel" data-panel="add" hidden><h3>Add a contact</h3><form id="add-person" class="person-form">
        <label>Name<input name="name" required maxlength="120" autocomplete="off"></label><label>Company<input name="company" required maxlength="160" autocomplete="off"></label>
        <label>Role<input name="role" maxlength="160" autocomplete="off"></label><label>Campaign<input name="campaign" list="campaign-options" placeholder="e.g. events, warm intros" maxlength="60" autocomplete="off"></label>
        <label>LinkedIn profile<input name="linkedin" type="url" placeholder="https://www.linkedin.com/in/…" autocomplete="off"></label><label>Email<input name="email" type="email" autocomplete="off"></label>
        <label>Found at<input name="source" maxlength="300" placeholder="e.g. Speakers page of a trade event" autocomplete="off"></label><label>Source link<input name="source_url" type="url" placeholder="https://…" autocomplete="off"></label>
        <label class="wide">Why<input name="reason" maxlength="2000" placeholder="Why you're connecting" autocomplete="off"></label><label>Next step<input name="next_step" maxlength="300" placeholder="e.g. Coffee email on 27 Oct" autocomplete="off"></label><label>Follow up on<input name="next_follow_up" type="date"></label>
        <label class="wide">Notes<textarea name="notes" maxlength="4000" placeholder="Anything else worth remembering…"></textarea></label>
        <div class="wide form-actions"><button class="primary" type="submit">Save contact</button><button type="button" data-panel-close>Cancel</button><span class="form-msg" role="status"></span></div></form><datalist id="campaign-options"></datalist></section>
      <section class="people-panel" data-panel="import" hidden><h3>Import from a CSV</h3><p class="small">Columns: <b>name</b> and <b>company</b> are required. Optional: role, campaign, linkedin, email, source (where you found them), source_url, reason (why), next_step, thread, next_follow_up, draft, notes, stage (initiated, seen, replied, call link sent, booked, not now, do not contact) and date (2026-10-18 or 18/10/2026). Export your Google Sheet as CSV and match the headings.</p>
        <div class="form-actions"><label class="file-pick">Choose CSV file<input type="file" id="csv-file" accept=".csv,text/csv"></label><button type="button" id="csv-template">Download template</button></div>
        <textarea id="csv-text" placeholder="…or paste CSV here, heading row first"></textarea>
        <div class="form-actions"><button class="primary" type="button" id="csv-import">Import</button><button type="button" data-panel-close>Cancel</button><span class="form-msg" role="status"></span></div><div id="csv-result"></div></section>
      <div class="people-tools"><label class="search"><span aria-hidden="true">⌕</span><input id="people-search" type="search" placeholder="Find a person, company or email…" aria-label="Search people"></label>
        <select id="people-campaign" aria-label="Filter campaign"><option value="">All campaigns</option></select>
        <select id="people-sort" aria-label="Sort people"><option value="next">Next follow-up</option><option value="recent">Recent activity</option><option value="name">Name A–Z</option><option value="company">Company A–Z</option></select><span class="people-count small"></span></div>
      <nav class="people-filters" aria-label="Filter by stage"></nav>
      <div class="table-wrap"><table class="people-table"><thead><tr><th>Person</th><th>Next · found at</th><th>Campaign</th><th>Stage</th><th>Last activity</th><th>Follow up</th><th>Log a step</th><th></th></tr></thead><tbody></tbody></table></div>
      <p class="small">Each step button records that step as done now, with today's date. The highlighted button is the next step. To log a message's text or a past date, use Open → Conversation.</p>`;
    box.dataset.ready='1';bindPeople(box);
  }
  try{
    const res=await fetch('/api/people',{cache:'no-store'});if(!res.ok)throw new Error('People unavailable');
    peopleData=await res.json();
    const ids=[...new Set(peopleData.people.map(p=>p.campaign))].sort();
    $('#people-campaign').innerHTML='<option value="">All campaigns</option>'+ids.map(id=>`<option value="${esc(id)}" ${id===peopleCampaign?'selected':''}>${esc(campaignLabel(id))}</option>`).join('');
    $('#campaign-options').innerHTML=ids.map(id=>`<option value="${esc(id)}">`).join('');
    renderPeopleTable();
  }catch(error){console.error('People render failed:',error);box.querySelector('tbody').innerHTML='<tr><td colspan="8" class="none">People could not load. Try Refresh.</td></tr>';}
}
async function postJSON(url,body){
  const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),out=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(out.error||'Save failed');return out;
}
async function logStep(row,kind){
  const p=peopleData.people.find(x=>x.key===row.dataset.person);if(!p)return;
  const buttons=[...row.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
  try{
    if(kind==='not_now')await postJSON('/api/contact-tracker',{action:'save',key:p.key,revision:p.revision,stage:p.stage==='not_now'?(p.reached==='D'?'call_booked':p.reached==='B'||p.reached==='C'?'replied':p.reached?'awaiting_reply':'not_now'):'not_now'});
    else{
      const label=STEP_BUTTONS.find(s=>s[0]===kind)[1];
      if(logged(p,kind)&&!confirm(`${label} is already logged for ${p.name}. Log it again?`)){buttons.forEach(b=>b.disabled=false);return;}
      await postJSON('/api/contact-tracker',{action:'add_event',key:p.key,event:{id:eventId(),kind,body:`${label} · logged from the People table.`}});
      toast(`${label} logged for ${p.name}`);
    }
    await renderPeople();
  }catch(error){toast(error.message);buttons.forEach(b=>b.disabled=false);}
}
function csvTemplate(){
  const csv='name,company,role,campaign,linkedin,email,source,source_url,reason,next_step,next_follow_up,stage,date,notes\nAlice Smith,Acme Ltd,Managing Director,events,https://www.linkedin.com/in/alice-smith,alice@example.com,Local business breakfast,https://example.com/event,Runs AI pilots for SMEs,Send coffee invite,2026-10-27,replied,18/10/2026,\n';
  const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob([csv],{type:'text/csv'})),download:'people-template.csv'});a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function bindPeople(box){
  const panel=id=>box.querySelector(`[data-panel="${id}"]`);
  box.addEventListener('click',async e=>{
    const open=e.target.closest('[data-panel-open]');if(open){box.querySelectorAll('.people-panel').forEach(p=>p.hidden=p.dataset.panel!==open.dataset.panelOpen||!p.hidden);panel(open.dataset.panelOpen).querySelector('input,textarea')?.focus();return;}
    if(e.target.closest('[data-panel-close]')){e.target.closest('.people-panel').hidden=true;return;}
    const f=e.target.closest('[data-filter]');if(f){peopleFilter=f.dataset.filter;renderPeopleTable();return;}
    const s=e.target.closest('[data-step]');if(s){logStep(s.closest('tr'),s.dataset.step);return;}
    const o=e.target.closest('[data-open-person]');if(o){setView('companies');openReview(o.dataset.openPerson);return;}
    if(e.target.closest('#csv-template')){csvTemplate();return;}
    if(e.target.closest('#csv-import')){
      const msg=panel('import').querySelector('.form-msg'),text=$('#csv-text').value;
      if(!text.trim()){msg.textContent='Choose a file or paste CSV first.';return;}
      try{const r=await postJSON('/api/contacts',{action:'import',csv:text});msg.textContent=`${r.added} added${r.skipped.length?`, ${r.skipped.length} skipped`:''}.`;
        $('#csv-result').innerHTML=r.skipped.length?`<ul class="skipped">${r.skipped.map(s=>`<li>Row ${s.row}${s.name?' ('+esc(s.name)+')':''}: ${esc(s.reason)}</li>`).join('')}</ul>`:'';
        if(r.added){$('#csv-text').value='';await renderPeople();}
      }catch(error){msg.textContent=error.message;}
    }
  });
  box.addEventListener('change',async e=>{
    if(e.target.id==='csv-file'){const file=e.target.files[0];if(file)$('#csv-text').value=await file.text();return;}
    if(e.target.id==='people-campaign'){peopleCampaign=e.target.value;renderPeopleTable();return;}
    if(e.target.id==='people-sort'){peopleSort=e.target.value;renderPeopleTable();return;}
    if(e.target.classList.contains('follow')){
      const p=peopleData.people.find(x=>x.key===e.target.closest('tr').dataset.person);
      try{await postJSON('/api/contact-tracker',{action:'save',key:p.key,revision:p.revision,next_follow_up:e.target.value});toast(e.target.value?`Follow-up set for ${p.name}`:'Follow-up cleared');await renderPeople();}catch(error){toast(error.message);}
    }
  });
  box.addEventListener('input',e=>{if(e.target.id==='people-search'){peopleQuery=e.target.value;renderPeopleTable();}});
  box.querySelector('#add-person').addEventListener('submit',async e=>{
    e.preventDefault();const form=e.target,msg=form.querySelector('.form-msg');
    try{const c=await postJSON('/api/contacts',{action:'add',...Object.fromEntries(new FormData(form))});form.reset();msg.textContent='';panel('add').hidden=true;toast(`${c.name} added`);peopleFilter='all';peopleQuery=c.name;$('#people-search').value=c.name;await renderPeople();}
    catch(error){msg.textContent=error.message;}
  });
}
