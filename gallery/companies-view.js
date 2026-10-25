// ABOUTME: Companies view: decision-ready company cards and list rows, people management per company, and the company decision controls.
// ABOUTME: People come from /api/people (campaign and hand-added alike); decisions use the saved feedback and per-person stages.

let companyLayout='grid';
try{companyLayout=localStorage.getItem('rh-company-layout')||'grid';}catch{}
async function ensurePeople(force=false){
  if(peopleData&&!force)return peopleData;
  const res=await fetch('/api/people',{cache:'no-store'});if(res.ok)peopleData=await res.json();return peopleData;
}
const companyPeople=r=>(peopleData?.people||[]).filter(p=>p.company_id===r.id);
const ORDER=['A','MS','B','C','D'];
const furthest=list=>list.reduce((best,p)=>ORDER.indexOf(p.reached)>ORDER.indexOf(best)?p.reached:best,null);
const initials=n=>n.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase();
const firstName=p=>p.name.split(' ')[0];
const pageState=r=>!r.page?{id:'research',label:'Research only'}:sendable(r)?{id:'ready',label:'Page ready'}:{id:'fixing',label:'Checks needed'};
// A short size figure only (e.g. "£19.6m turnover"); longer caveats stay in the panel's facts.
const sizeLine=r=>{const t=(r.card?.pay||'').split(/[,(.]\s/)[0].trim();return /£|\$|€/.test(t)&&t.length<=32?t:'';};
function personState(p){
  if(isParked(p))return PARKED_NAME[p.stage];
  if(logged(p,'call_booked'))return 'Call booked';
  if(logged(p,'call_link_sent'))return 'Call link sent';
  if(p.last_kind==='reply_received')return 'Replied';
  if(logged(p,'dm_sent'))return 'DM sent';
  if(p.connection==='connected')return 'Connected';
  if(p.connection==='pending')return 'Request pending';
  return 'Not contacted';
}
// The one thing to do next for this company, in priority order.
function companyAction(r,list){
  const live=list.filter(p=>!isParked(p));
  const pick=test=>live.find(test);
  let p;
  if((p=pick(p=>p.last_kind==='reply_received'&&!logged(p,'call_booked'))))return {label:`Reply to ${firstName(p)}`,person:p,tone:'B'};
  if((p=pick(dueNow)))return {label:`Follow up ${firstName(p)}`,person:p,tone:'D'};
  if(pageState(r).id!=='ready')return {label:r.page?'Review page':'Read research',review:true};
  if((p=pick(p=>p.connection==='connected'&&!logged(p,'dm_sent'))))return {label:`Message ${firstName(p)}`,person:p,tone:'A'};
  if(list.length&&list.every(isParked))return {label:'Skipped',review:true,muted:true};
  if((p=pick(p=>p.connection==='pending')))return {label:'Waiting on acceptance',person:p,muted:true};
  if((p=pick(p=>logged(p,'dm_sent'))))return {label:`Open ${firstName(p)}`,person:p,muted:true};
  return {label:list.length?`Connect with ${firstName(list[0])}`:'Find the right person',person:list[0],review:!list.length};
}
function progressBar(stageId){
  const at=ORDER.indexOf(stageId);
  return `<div class="progress" role="img" aria-label="Furthest stage: ${stageId?STAGE_NAME[stageId]:'not started'}">${ORDER.map((id,i)=>`<span style="${i<=at?`background:${COLOR[id]}`:''}" title="${STAGE_NAME[id]}"></span>`).join('')}</div>`;
}
const avatar=p=>`<span class="avatar" style="--c:${p.reached?COLOR[p.reached]:'#cfccc2'};--ink:${p.reached?INK_ON[p.reached]:'#141311'}">${esc(initials(p.name))}</span>`;
function actionButton(r,a,cls=''){
  const attr=a.person?`data-person-open="${esc(a.person.key)}"`:`data-open="${esc(r.id)}"`;
  return `<button class="cta ${cls}${a.muted?' muted':''}" ${attr} ${a.tone?`style="--c:${COLOR[a.tone]}"`:''}>${esc(a.label)}</button>`;
}
function thumbHTML(r){
  return r.thumb?`<img src="/${esc(r.thumb)}" alt="" loading="lazy" decoding="async">`:r.preview?`<img src="${esc(url(r.preview,r))}" alt="" loading="lazy" decoding="async">`:`<span class="placeholder"><b>${esc(r.name)}</b><span>${r.page?'Open to see the live page':'No page built yet'}</span></span>`;
}
function companyCard(r){
  const list=companyPeople(r),top=furthest(list),a=companyAction(r,list),ps=pageState(r),own=feedback[r.id]?.status;
  const people=list.slice(0,3).map(p=>`<button class="person-line" data-person-open="${esc(p.key)}">${avatar(p)}<span><b>${esc(p.name)}</b><small>${esc(p.role||'Role not checked')}</small></span><em>${esc(personState(p))}</em></button>`).join('');
  return `<article class="ccard${list.length&&list.every(isParked)?' parked':''}" data-id="${esc(r.id)}">
    <button class="ccard-shot" data-open="${esc(r.id)}" aria-label="Review ${esc(r.name)}">${thumbHTML(r)}<span class="ribbon ${ps.id}">${ps.label}</span><span class="shot-hover">Review page</span></button>
    <button class="star${own==='shortlist'?' on':''}" data-star="${esc(r.id)}" aria-pressed="${own==='shortlist'}" aria-label="Shortlist ${esc(r.name)}">★</button>
    <div class="ccard-body">
      <div class="ccard-title"><h2><button data-open="${esc(r.id)}">${esc(r.name)}</button></h2>${r.rank?`<span class="rank">#${r.rank}</span>`:''}</div>
      <p class="ccard-meta">${esc(r.sector||'')}${sizeLine(r)?` · ${esc(sizeLine(r))}`:''}</p>
      <p class="why"><b>${esc(r.card?.chip||r.card_signal)}</b>${r.card?.why_now?` ${esc(r.card.why_now)}`:''}</p>
      ${cardContactLinks(r)}
      ${progressBar(top)}
      <div class="ccard-people">${people||'<p class="none">No named person yet.</p>'}${list.length>3?`<button class="more-people" data-open="${esc(r.id)}">+${list.length-3} more</button>`:''}</div>
    </div>
    <footer class="ccard-foot">${actionButton(r,a)}<button class="ghost" data-open="${esc(r.id)}">Details</button></footer>
  </article>`;
}
function companyRow(r){
  const list=companyPeople(r),a=companyAction(r,list),ps=pageState(r),own=feedback[r.id]?.status;
  return `<tr data-id="${esc(r.id)}"><td><button class="star small${own==='shortlist'?' on':''}" data-star="${esc(r.id)}" aria-label="Shortlist">★</button></td>
    <td class="co"><button class="name-link" data-open="${esc(r.id)}">${esc(r.name)}</button><small>${esc(r.sector||'')}${sizeLine(r)?` · ${esc(sizeLine(r))}`:''}</small></td>
    <td><span class="ribbon inline ${ps.id}">${ps.label}</span></td>
    <td class="why-cell">${esc(r.card?.chip||r.card_signal)}${contactResearchHTML(r)}</td>
    <td><div class="avatars">${list.slice(0,4).map(p=>`<button data-person-open="${esc(p.key)}" title="${esc(p.name)} · ${esc(personState(p))}">${avatar(p)}</button>`).join('')}${list.length>4?`<small>+${list.length-4}</small>`:''}</div></td>
    <td>${progressBar(furthest(list))}</td>
    <td class="act">${actionButton(r,a,'small')}</td></tr>`;
}
function renderCompanyGallery(list){
  const g=$('#gallery');g.classList.toggle('as-list',companyLayout==='list');
  g.innerHTML=companyLayout==='list'
    ?`<div class="table-wrap"><table class="company-table"><thead><tr><th></th><th>Company</th><th>Page</th><th>Why now</th><th>People</th><th>Progress</th><th>Next</th></tr></thead><tbody>${list.map(companyRow).join('')}</tbody></table></div>`
    :list.map(companyCard).join('');
  g.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{img.outerHTML='<span class="placeholder"><b>Preview unavailable</b><span>Open the live page</span></span>';},{once:true}));
  document.querySelectorAll('[data-layout]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.layout===companyLayout)));
}
function setFeedback(id,status){
  feedback[id]={...(feedback[id]||{}),status,updated:new Date().toISOString()};
  try{localStorage.setItem(storeKey,JSON.stringify(feedback));}catch{}
}
async function skipCompany(r,resume=false){
  const list=companyPeople(r);
  for(const p of list){
    if(resume?p.stage!=='not_now':isParked(p))continue;
    await postJSON('/api/contact-tracker',{action:'save',key:p.key,revision:p.revision,stage:resume?(p.reached==='D'?'call_booked':['B','C'].includes(p.reached)?'replied':p.reached?'awaiting_reply':'not_now'):'not_now'});
  }
  toast(resume?`${r.name} is back in play`:`${r.name} skipped. Follow-ups stop for its people.`);
  await ensurePeople(true);render();if(current?.id===r.id)switchTab(tab);
}

/* Company panel: people manager and decision block, used by the Overview tab. */
function peopleManagerHTML(r){
  const list=companyPeople(r);
  const rows=list.map(p=>{const next=nextStep(p),label=STEP_BUTTONS.find(s=>s[0]===next)?.[1];
    return `<div class="pm-row">${avatar(p)}<button class="pm-who" data-person-open="${esc(p.key)}"><b>${esc(p.name)}</b><small>${esc(p.role||'Role not checked')}</small></button><span class="pm-state">${esc(personState(p))}</span>${next&&!(next==='dm_sent'&&p.connection==='pending')?`<button class="pm-next" data-company-step="${esc(p.key)}" data-kind="${next}">${esc(label)}</button>`:''}</div>`;}).join('');
  return `<section class="panel-block"><div class="panel-head"><h3>People</h3><button class="ghost small" data-add-person-toggle>+ Add person</button></div>
    ${rows||'<p class="none">No named person yet. Add the right person below.</p>'}
    <form class="add-person-inline" data-add-person="${esc(r.id)}" ${rows?'hidden':''}><input name="name" placeholder="Full name" required><input name="role" placeholder="Role"><input name="linkedin" type="url" placeholder="LinkedIn profile link"><input name="email" type="email" placeholder="Email"><div class="step-row"><button class="primary" type="submit">Add to ${esc(r.name)}</button></div></form></section>`;
}
function decisionHTML(r){
  const own=feedback[r.id]||{},list=companyPeople(r),skipped=list.length&&list.every(isParked);
  const opts=[['shortlist','Shortlist'],['changes','Needs changes'],['reviewed','Reviewed']];
  return `<section class="panel-block"><h3>Your decision</h3><div class="seg">${opts.map(([v,l])=>`<button data-decide="${v}" aria-pressed="${own.status===v}">${l}</button>`).join('')}${list.length?`<button data-skip="${skipped?'resume':'skip'}" class="${skipped?'':'danger'}">${skipped?'Resume':'Skip company'}</button>`:''}</div>
    <textarea id="decision-notes" placeholder="Notes for the microsite agent: what works, what to change…">${esc(own.notes||'')}</textarea><p class="small" id="decision-saved">${own.updated?'Saved '+esc(date(own.updated)):'Saved in this browser as you type.'}</p></section>`;
}
function factsHTML(r){
  const c=r.card;if(!c)return `<section class="panel-block"><p>${esc(r.card_summary)}</p></section>`;
  const why=safeWeb(c.why_now_url);
  return `<section class="panel-block facts-grid">${[['Why now',c.why_now+(why?'':''),why],['What they do',c.what],['The opportunity',c.opportunity],['Can they pay',c.pay]].filter(x=>x[1]).map(([k,v,src])=>`<div><h4>${k}</h4><p>${esc(v)}${src?` <a href="${esc(src)}" target="_blank" rel="noopener noreferrer">Source ↗</a>`:''}</p></div>`).join('')}</section>`;
}
function overviewHTML(r){
  const ps=pageState(r),list=companyPeople(r),a=companyAction(r,list);
  const warn=r.page&&r.checks?.problem?`<p class="notice">${esc(r.checks.problem)} Wait before sending.</p>`:'';
  return `<div class="panel-top"><span class="ribbon inline ${ps.id}">${ps.label}</span><span class="small">${esc(r.collection_name)}${r.rank?` · Rank #${r.rank}`:''}${sizeLine(r)?` · ${esc(sizeLine(r))}`:''}</span></div>
    <p class="lead-signal">${esc(r.card?.chip||r.card_signal)}</p>${warn}
    <div class="panel-cta">${actionButton(r,a)}</div>
    ${peopleManagerHTML(r)}${typeof sessionsHTML==='function'?sessionsHTML(r):''}${factsHTML(r)}${kitHTML(r)||openerHTML(r)}${shareHTML(r)}${decisionHTML(r)}`;
}

/* Events for the Companies view and the company panel. */
document.addEventListener('click',async e=>{
  try{
    const st=e.target.closest('[data-star]');if(st){const id=st.dataset.star;setFeedback(id,feedback[id]?.status==='shortlist'?'unreviewed':'shortlist');render();return;}
    const lay=e.target.closest('[data-layout]');if(lay){companyLayout=lay.dataset.layout;try{localStorage.setItem('rh-company-layout',companyLayout);}catch{}render();return;}
    if(e.target.closest('[data-add-person-toggle]')){const f=$('#evidence [data-add-person]');f.hidden=!f.hidden;if(!f.hidden)f.querySelector('input').focus();return;}
    const dec=e.target.closest('[data-decide]');if(dec&&current){setFeedback(current.id,feedback[current.id]?.status===dec.dataset.decide?'unreviewed':dec.dataset.decide);switchTab('overview');render();return;}
    const sk=e.target.closest('[data-skip]');if(sk&&current){await skipCompany(current,sk.dataset.skip==='resume');return;}
    const cs=e.target.closest('[data-company-step]');if(cs){
      const p=peopleData.people.find(x=>x.key===cs.dataset.companyStep),kind=cs.dataset.kind,label=STEP_BUTTONS.find(s=>s[0]===kind)[1];
      cs.disabled=true;await postJSON('/api/contact-tracker',{action:'add_event',key:p.key,event:{id:eventId(),kind,body:`${label} · logged from the company panel.`}});
      toast(`${label} logged for ${p.name}`);await ensurePeople(true);if(current)switchTab('overview');render();return;
    }
  }catch(error){toast(error.message);}
});
document.addEventListener('submit',async e=>{
  const f=e.target.closest('[data-add-person]');if(!f)return;e.preventDefault();
  const r=data.rows.find(x=>x.id===f.dataset.addPerson);
  try{const c=await postJSON('/api/contacts',{action:'add',...Object.fromEntries(new FormData(f)),company:r.name,company_id:r.id});toast(`${c.name} added to ${r.name}`);await ensurePeople(true);switchTab('overview');render();}
  catch(error){toast(error.message);}
});
document.addEventListener('input',e=>{if(e.target.id==='decision-notes'&&current){feedback[current.id]={...(feedback[current.id]||{}),notes:e.target.value,updated:new Date().toISOString()};try{localStorage.setItem(storeKey,JSON.stringify(feedback));}catch{}$('#decision-saved').textContent='Saved just now';}});
ensurePeople().then(()=>{if(data)render();}).catch(()=>{});
