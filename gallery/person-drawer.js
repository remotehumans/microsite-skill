// ABOUTME: The one place to work with a person: who they are, their microsite, the next step, the draft DM, follow-up date and history.
// ABOUTME: Opened from Today and People; reads /api/people records and saves through /api/contact-tracker.

let drawerPerson=null;
const KIND_LABEL={dm_sent:'DM sent',reply_received:'Reply received',note:'Note',call_link_sent:'Call link sent',call_booked:'Call booked',page_viewed:'Opened microsite'};
const rowFor=p=>data?.rows?.find(r=>r.id===p.company_id)||null;
function starterDraft(p){
  const r=rowFor(p),first=p.name.split(' ')[0];
  return `Hi ${first}, thanks for connecting. I’ve put together a short page for ${p.company} showing a few ways AI could help the business. Would you like me to send it over?`;
}
async function reloadPerson(key){
  const res=await fetch('/api/people',{cache:'no-store'});peopleData=await res.json();
  return peopleData.people.find(p=>p.key===key);
}
// Where they were found, why we are talking to them, what happens next, and which agent thread found them.
function contextHTML(p){
  const line=(label,value)=>value?`<div><dt>${label}</dt><dd>${value}</dd></div>`:'';
  const found=p.source_url?`<a href="${esc(p.source_url)}" target="_blank" rel="noopener noreferrer">${esc(p.source||p.source_url)} ↗</a>`:esc(p.source);
  const lines=line('Found at',found)+line('Why',esc(p.reason))+line('Next',esc(p.next_step))+line('Thread',esc(p.thread));
  return `<section class="drawer-block context-block"><p class="label">Context</p>${lines?`<dl class="context-lines">${lines}</dl>`:'<p class="small">No context yet. Add where you found them and why.</p>'}
    <details${lines?'':' open'}><summary>Edit context</summary><div class="context-form">
      <label class="label">Found at<input id="ctx-source" maxlength="300" value="${esc(p.source)}" placeholder="e.g. Speakers page of a trade event"></label>
      <label class="label">Source link<input id="ctx-source-url" type="url" maxlength="600" value="${esc(p.source_url)}" placeholder="https://…"></label>
      <label class="label">Why<textarea id="ctx-reason" class="short" maxlength="2000" placeholder="Why you're connecting">${esc(p.reason)}</textarea></label>
      <label class="label">Next step<input id="ctx-next" maxlength="300" value="${esc(p.next_step)}" placeholder="e.g. Send coffee email on 27 Oct"></label>
      <label class="label">Thread<input id="ctx-thread" maxlength="300" value="${esc(p.thread)}" placeholder="Which agent thread found them"></label>
      <div class="step-row"><button data-d="context">Save context</button></div></div></details></section>`;
}
// An email draft may start with a "Subject:" line, which becomes the email subject.
function mailtoFor(p,draft){
  const m=draft.match(/^Subject:\s*(.+)\n+([\s\S]*)$/);
  return `mailto:${p.email}?subject=${encodeURIComponent(m?m[1].trim():'')}&body=${encodeURIComponent(m?m[2]:draft)}`;
}
function drawerHTML(p){
  const r=rowFor(p),site=r?publishedLink(r):'',next=nextStep(p),nextLabel=STEP_BUTTONS.find(s=>s[0]===next)?.[1];
  const history=p.events.length?p.events.map(e=>`<li><i style="background:${COLOR[{dm_sent:'A',page_viewed:'MS',reply_received:'B',call_link_sent:'C',call_booked:'D'}[e.kind]]||'#bdb9ad'}"></i><div><b>${esc(KIND_LABEL[e.kind]||e.kind)}</b><time>${esc(date(e.at))}</time>${e.body&&!/logged from the People table|Imported from CSV/.test(e.body)?`<p>${esc(e.body)}</p>`:''}</div></li>`).join(''):'<li class="none">Nothing logged yet.</li>';
  return `<header class="drawer-head"><div><h2>${esc(p.name)}</h2><p>${esc(p.role)}${p.role?' · ':''}${esc(p.company)}</p><div class="drawer-tags"><span class="camp-tag">${esc(campaignLabel(p.campaign))}</span>${stageChip(p)}</div></div><button class="icon-btn" data-drawer-close aria-label="Close">✕</button></header>
    <div class="drawer-links">${p.profile_url?`<a class="pill-link" href="${esc(p.profile_url)}" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>`:''}${p.email?`<a class="pill-link" href="mailto:${esc(p.email)}">Email</a>`:''}${p.phone?`<a class="pill-link" href="${esc(callLink(p.phone))}">Business phone</a>`:''}${site?`<a class="pill-link" href="${esc(site)}" target="_blank" rel="noopener">Microsite ↗</a><button class="pill-link" data-d="tracked">Copy their microsite link</button>`:''}</div>
    ${contextHTML(p)}
    ${p.email_status?`<p class="small">${esc(p.email_status==='provider_verified_catchall'?'Provider-rated email; accept-all domain, exact mailbox uncertain.':p.email_status==='provider_verified'?'Provider-verified work email; not found in public company material.':'Published business email.')}</p>`:''}<section class="drawer-block next-block">${next?`<p class="label">Next step</p><button class="big-step" data-step="${next}">Mark “${esc(nextLabel)}” done</button>`:`<p class="label">${isParked(p)?'Parked: '+PARKED_NAME[p.stage]:'Call booked. Nice.'}</p>`}
      ${p.connection==="connected"?"":`<div class="step-row connect-row"><button class="step${p.connection==="pending"?" done":""}" data-connect="pending">${p.connection==="pending"?"✓ ":""}LinkedIn request sent</button><button class="step" data-connect="connected">They accepted</button></div>`}<div class="step-row">${STEP_BUTTONS.map(([kind,label,id])=>`<button class="step${logged(p,kind)?' done':''}" data-step="${kind}">${logged(p,kind)?'✓ ':''}${label}</button>`).join('')}<button class="step park" data-step="not_now">${p.stage==='not_now'?'Resume':'Not now'}</button></div></section>
    <section class="drawer-block"><div class="block-head"><p class="label">Message</p>${p.draft?'':`<button class="text-button" data-d="starter">Use a starter</button>`}</div>
      <textarea id="drawer-draft" placeholder="Write your DM…">${esc(p.draft)}</textarea>
      <div class="step-row"><button class="primary" data-d="copy-open">${p.profile_url?'Copy & open LinkedIn':p.email?'Copy & open email':'Copy message'}</button><button data-d="save">Save draft</button></div></section>
    <section class="drawer-block two"><label class="label">Follow up on<input type="date" id="drawer-follow" value="${esc(p.next_follow_up)}"></label></section>
    <section class="drawer-block"><p class="label">Notes</p><textarea id="drawer-notes" class="short" placeholder="Anything worth remembering…">${esc(p.notes)}</textarea></section>
    <section class="drawer-block"><p class="label">History</p><ol class="timeline">${history}</ol></section>`;
}
async function openPerson(key){
  let p=peopleData?.people.find(x=>x.key===key);
  if(!p)p=await reloadPerson(key);if(!p){toast('That person could not be found');return;}
  drawerPerson=p;const d=$('#drawer');d.innerHTML=drawerHTML(p);d.hidden=false;document.body.classList.add('drawer-open');
  d.querySelector('.big-step,#drawer-draft')?.focus();
}
function closePerson(){$('#drawer').hidden=true;document.body.classList.remove('drawer-open');drawerPerson=null;}
async function drawerSave(fields,message){
  const p=drawerPerson;
  await postJSON('/api/contact-tracker',{action:'save',key:p.key,revision:p.revision,...fields});
  if(message)toast(message);
  const fresh=await reloadPerson(p.key);if(fresh){drawerPerson=fresh;$('#drawer').innerHTML=drawerHTML(fresh);}
  refreshView();
}
// Connection state is recorded as an observation with its time, the same way the LinkedIn check records it.
async function drawerConnect(state){
  const p=drawerPerson;
  await postJSON('/api/contact-tracker',{action:'check_connection',key:p.key,connection:state,checked_at:new Date().toISOString(),evidence:state==='connected'?'Marked accepted in the gallery.':'Connection request marked as sent in the gallery.'});
  toast(state==='connected'?`${p.name} marked as connected`:`Request to ${p.name} marked as sent`);
  const fresh=await reloadPerson(p.key);if(fresh){drawerPerson=fresh;$('#drawer').innerHTML=drawerHTML(fresh);}
  refreshView();
}
async function drawerStep(kind){
  const p=drawerPerson;
  if(kind==='not_now'){await drawerSave({stage:p.stage==='not_now'?(p.reached==='D'?'call_booked':['B','C'].includes(p.reached)?'replied':p.reached?'awaiting_reply':'not_now'):'not_now'},p.stage==='not_now'?'Resumed':'Parked for now');return;}
  const label=STEP_BUTTONS.find(s=>s[0]===kind)[1];
  if(logged(p,kind)&&!confirm(`${label} is already logged for ${p.name}. Log it again?`))return;
  const draft=$('#drawer-draft').value.trim();
  await postJSON('/api/contact-tracker',{action:'add_event',key:p.key,event:{id:eventId(),kind,body:kind==='dm_sent'&&draft?draft:`${label} · logged from the People table.`}});
  toast(`${label} logged for ${p.name}`);
  const fresh=await reloadPerson(p.key);if(fresh){drawerPerson=fresh;$('#drawer').innerHTML=drawerHTML(fresh);}
  refreshView();
}
$('#drawer').addEventListener('click',async e=>{
  try{
    if(e.target.closest('[data-drawer-close]'))return closePerson();
    const c=e.target.closest('[data-connect]');if(c)return await drawerConnect(c.dataset.connect);
    const s=e.target.closest('[data-step]');if(s)return await drawerStep(s.dataset.step);
    const a=e.target.closest('[data-d]')?.dataset.d;if(!a)return;
    const p=drawerPerson,draft=$('#drawer-draft').value;
    if(a==='starter'){$('#drawer-draft').value=starterDraft(p);$('#drawer-draft').focus();}
    if(a==='save')await drawerSave({draft,notes:$('#drawer-notes').value},'Saved');
    if(a==='copy-open'){if(!draft.trim()){toast('Write the message first');return;}await copyText(draft);if(draft!==p.draft)await drawerSave({draft});if(p.profile_url){window.open(p.profile_url,'_blank','noopener');toast('Copied. Paste it in LinkedIn, then mark “DM sent”.');}else if(p.email){location.href=mailtoFor(p,draft);toast('Copied and opened in your email app. Mark “DM sent” once it has gone.');}else toast('Copied.');}
    if(a==='context')await drawerSave({source:$('#ctx-source').value,source_url:$('#ctx-source-url').value,reason:$('#ctx-reason').value,next_step:$('#ctx-next').value,thread:$('#ctx-thread').value},'Context saved');
    if(a==='company'){const id=p.company_id;closePerson();setView('companies');openReview(id);}
    if(a==='tracked'){
      let ref=p.view_ref;
      if(!ref){const saved=await postJSON('/api/contact-tracker',{action:'issue_ref',key:p.key});ref=saved.view_ref;}
      const link=new URL(publishedLink(rowFor(p)));link.searchParams.set('r',ref);await copyText(link.href);
    }
  }catch(error){toast(error.message);}
});
$('#drawer').addEventListener('change',e=>{if(e.target.id==='drawer-follow')drawerSave({next_follow_up:e.target.value},e.target.value?'Follow-up set':'Follow-up cleared').catch(err=>toast(err.message));});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#drawer').hidden&&!$('#reviewer').open)closePerson();});
