const $ = s => document.querySelector(s);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url = (p,r=current) => (r?.asset_base||'/collection/') + p.split('/').map(encodeURIComponent).join('/');
const safeWeb = s => { try { const u = new URL(s); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch { return ''; } };
const pretty = s => String(s).replace(/_/g,' ').replace(/\bqa\b/gi,'QA').replace(/\bsha256\b/gi,'SHA-256');
const date = d => d ? new Date(d).toLocaleString(undefined, {dateStyle:'medium', timeStyle:'short'}) : 'Not recorded';
const storeKey = 'rh-microsite-feedback-v1';
let feedback = {};
try { feedback = JSON.parse(localStorage.getItem(storeKey) || '{}'); if (!feedback || typeof feedback !== 'object' || Array.isArray(feedback)) feedback = {}; } catch {}
let data, filtered = [], current, stage = 'built', tab = 'overview', documentSequence = 0, lastFocus;
let collection=new URLSearchParams(location.search).get('collection')||'all';
const collectionRows=()=>data.rows.filter(r=>collection==='all'||r.collection_id===collection);
const labels = {unreviewed:'To review',shortlist:'Shortlisted',changes:'Changes requested',reviewed:'Reviewed'};
const outreachLabels = {to_contact:'To contact',contacted:'Contacted',replied:'Replied',call_booked:'Call booked',not_now:'Not now',skip:'Skip'};
// A company's status comes from its people: the furthest any of them has got, or parked when all of them are.
const outreachState = r => {
  const stages=(r.contacts?.people||[]).map(p=>p.tracker?.stage).filter(Boolean);
  if(stages.includes('call_booked'))return 'call_booked';
  if(stages.includes('replied'))return 'replied';
  if(stages.includes('awaiting_reply'))return 'contacted';
  if(stages.length&&stages.every(s=>['not_now','do_not_contact'].includes(s)))return 'not_now';
  return 'to_contact';
};
const inConversation = r => ['contacted','replied','call_booked'].includes(outreachState(r))||(r.contacts?.people||[]).some(p=>['awaiting_reply','replied','call_booked'].includes(p.tracker?.stage));
const parked = r => ['not_now','skip'].includes(outreachState(r));
const sendable = r => r.page && r.checks?.ready && !/^hold$/i.test(r.status||'');
const conversationLabels={ready_to_dm:'Ready to DM',draft_ready:'Draft ready',awaiting_reply:'Awaiting reply',replied:'Replied',call_booked:'Call booked',not_now:'Not now',do_not_contact:'Do not contact'};
const readyPeople=r=>(r.contacts?.people||[]).filter(p=>p.tracker?.connection==='connected'&&['ready_to_dm','draft_ready'].includes(p.tracker.stage));
const pendingPeople=r=>(r.contacts?.people||[]).filter(p=>p.tracker?.connection==='pending');
const followUpPeople=r=>(r.contacts?.people||[]).filter(p=>p.tracker?.next_follow_up&&p.tracker.next_follow_up<=new Date().toLocaleDateString('en-CA')&&!['not_now','do_not_contact','call_booked'].includes(p.tracker.stage));
const followUpDue=r=>followUpPeople(r).length>0;
const stages = [ ['dm-ready','Ready to DM',r=>readyPeople(r).length>0], ['pending','Requests pending',r=>pendingPeople(r).length>0], ['due','Follow-ups due',followUpDue], ['ready','Pages ready',r=>sendable(r)&&!inConversation(r)&&!parked(r)], ['rewrite','Being fixed',r=>r.page&&!sendable(r)&&!parked(r)], ['contacted','In conversation',inConversation], ['parked','Not now / skip',parked], ['built','All microsites',r=>!!r.page], ['all','All research',()=>true] ];
const stageLabel = r => inConversation(r)||parked(r) ? (outreachLabels[outreachState(r)]==='To contact'?'In conversation':outreachLabels[outreachState(r)]) : sendable(r) ? 'Page ready' : r.page ? 'Checks needed' : 'Research only';
const stageClass = r => inConversation(r) ? 'verified' : parked(r) ? 'hold' : sendable(r) ? 'verified' : r.page ? 'working' : 'research';
const linkFor = r => publishedLink(r);
const openerFor = r => { const o=r.card?.opener||''; const l=linkFor(r); return l?o.replaceAll('{link}',l):o.replaceAll('{link}','[page link]'); };
function cardFacts(r, full=false) {
  const c=r.card;
  if(!c) return `<p class="signal">${esc(r.card_summary)}</p>`;
  const why=safeWeb(c.why_now_url);
  return `<dl class="facts"><div><dt>What they do</dt><dd>${esc(c.what)}</dd></div><div><dt>Why now</dt><dd>${esc(c.why_now)}${why?` <a href="${esc(why)}" target="_blank" rel="noopener noreferrer">Source ↗</a>`:''}</dd></div><div><dt>The opportunity</dt><dd>${esc(c.opportunity)}</dd></div>${full?`<div><dt>Can they pay</dt><dd>${esc(c.pay)}</dd></div>`:''}</dl>`;
}
function leadHTML(r) {
  const c=r.card; if(!c?.contact_name) return '';
  const p=readyPeople(r)[0]||(r.contacts?.people||[]).find(x=>x.name===c.contact_name)||r.contacts?.people?.[0];
  return `<div class="lead"><span class="small">Message first</span><strong>${esc(p?.name||c.contact_name)}</strong>${p?`<span class="person-role">${esc(p.role)}</span>`:''}<p>${esc(p&&p.name!==c.contact_name?p.why:c.contact_why)}</p>${p?connectionSummary(p):''}${p?`<div class="contact-actions">${personLinks(p)}</div>`:''}</div>`;
}
function openerHTML(r) {
  if(!r.card?.opener) return '';
  const live=linkFor(r);
  return `<section class="opener"><h4>Opening message</h4><blockquote>${esc(openerFor(r))}</blockquote><div class="contact-actions"><button data-copy-opener="${esc(r.id)}">Copy message</button></div>${live?'':'<p class="small">The page has no public link yet, so the message shows [page link]. Publish the page before sending.</p>'}</section>`;
}
// The hand-written outreach kit: DM, Loom script, email and follow-up, with {link} and {loom} filled in.
// Cue card for recording: facts to know cold, then the five beats as one-line prompts.
function cueHTML(k) {
  if(!k.facts&&!k.beats) return '';
  return `<div class="cue-card"><p class="small">Learn the beats and the facts, then say it your way.</p>${k.facts?`<h5>Know cold</h5><ul>${k.facts.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>`:''}${k.beats?`<h5>The five beats</h5><ol>${k.beats.map(([beat,where,cue])=>`<li><strong>${esc(beat)}</strong> <span class="small">· ${esc(where)}</span><br>${esc(cue)}</li>`).join('')}</ol>`:''}</div>`;
}
function kitHTML(r) {
  const k=r.card?.kit; if(!k) return '';
  const fill=s=>(s||'').replaceAll('{link}',linkFor(r)||'[page link]').replaceAll('{loom}',k.loom_url||'[Loom link]');
  const piece=(title,text,open)=>text?`<details${open?' open':''}><summary>${esc(title)}</summary><pre class="deal-copy">${esc(fill(text))}</pre><button data-copy="${esc(fill(text))}">Copy</button></details>`:'';
  const email=k.email_body?`Subject: ${k.email_subject}\n\n${k.email_body}`:'';
  return `<section class="opener kit"><h4>Outreach kit · ${esc(k.contact)}</h4>${linkFor(r)?'':'<p class="small">Page not live yet. Publish it before recording or sending.</p>'}${k.loom_url?'':'<p class="small">No Loom link saved yet, so messages show [Loom link].</p>'}
    ${cueHTML(k)}${piece('Full Loom script (about 90 seconds)',k.loom_script)}${piece('LinkedIn connection note (only if you add one; connecting without a note works best)',k.connection_note)}${piece('LinkedIn DM (connected)',k.linkedin_dm)}${piece('Reply when they say yes',k.on_yes)}${piece(`Email to ${k.email_to}`,email)}${piece(`Follow-up · ${k.follow_up_when||'day 7'}`,k.follow_up)}${!k.follow_up&&k.follow_up_when?`<p class="small">Follow-up: ${esc(k.follow_up_when)}.</p>`:''}</section>`;
}
function statusHTML(r) {
  // Read-only: status is set per person in the person drawer, never on the company.
  const people=(r.contacts?.people||[]).filter(p=>p.tracker);
  if(!people.length)return '<p class="small">No people with a LinkedIn profile yet. Add one in People.</p>';
  return `<p class="small">Status: <b>${esc(outreachLabels[outreachState(r)])}</b>, from the people below.</p>`+people.map(p=>`<div class="status-person"><span><b>${esc(p.name)}</b> ${esc(conversationLabels[p.tracker.stage]||(p.tracker.connection==='pending'?'Request pending':'Not started'))}</span><button data-person-open="${esc(p.tracker.key)}">Open</button></div>`).join('');
}
function populateSectors(){
  const sector=$('#sector').value;
  $('#sector').innerHTML='<option value="">All sectors</option>'+[...new Set(collectionRows().map(r=>r.sector).filter(Boolean))].sort().map(s=>`<option>${esc(s)}</option>`).join('');
  $('#sector').value=[...$('#sector').options].some(o=>o.value===sector)?sector:'';
}
function renderCollections(){
  const items=[{id:'all',name:'All collections',built:data.rows.filter(r=>r.page).length},...data.collections];
  $('#collections').innerHTML=items.map(c=>`<button data-collection="${esc(c.id)}" aria-pressed="${collection===c.id}">${esc(c.name)}<span>${c.built} pages</span></button>`).join('');
  $('#campaign-select').innerHTML=[{id:'all',name:'All campaigns'},...data.collections].map(c=>`<option value="${esc(c.id)}" ${collection===c.id?'selected':''}>${esc(c.name)}</option>`).join('');
  $('#nav-companies-count').textContent=collectionRows().filter(r=>r.page).length;
  $('#creation-chats').innerHTML=data.collections.filter(c=>c.thread&&(collection==='all'||c.id===collection)).map(c=>`<a href="${esc(c.thread)}">${esc(c.name)} chat ↗</a>`).join('');
}
function summarise() {
  const rows=collectionRows(), ready=rows.flatMap(readyPeople).length,pending=rows.flatMap(pendingPeople).length;
  $('#collection-summary').textContent=`${rows.filter(r=>r.page).length} pages · ${rows.length} research records · ${ready} ready to DM · ${pending} requests pending`;
  $('#monitor-state').textContent=data.monitor?.checked_at?`LinkedIn checked ${date(data.monitor.checked_at)} · ${data.monitor.status==='ok'?'Check complete':pretty(data.monitor.status)}`:'LinkedIn has not been checked yet';
  $('#monitor-state').title=data.monitor?.coverage||'';
}
async function setStatus(id,status) {
  try {
    const res=await fetch('/api/outreach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status,note:data.rows.find(r=>r.id===id)?.outreach?.note||''})});
    if(!res.ok) throw new Error((await res.json()).error||'Save failed');
    const saved=await res.json(); const r=data.rows.find(r=>r.id===id); r.outreach=saved;
    if(current?.id===id) current.outreach=saved;
    renderStages(); render(); summarise(); if(current?.id===id&&tab==='overview') switchTab('overview');
    toast(outreachLabels[status]+' saved');
  } catch(e) { toast('Could not save: '+e.message); }
}
// The private preview link uses the address the gallery was opened on, for example a private network name.
const previewOrigin=location.origin;
const previewLink=r=>r.page?previewOrigin+url(r.page,r):null;
const publishedLink=r=>safeWeb(r.published?.url||'');
const emailLink=email=>'mailto:'+encodeURIComponent(email);
function personLinks(p) {
  return `${p.phone?`<a href="${esc(callLink(p.phone))}">Phone ↗</a>`:''}${p.linkedin?`<a href="${esc(safeWeb(p.linkedin))}" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>`:`<a href="${esc(safeWeb(p.search_url))}" target="_blank" rel="noopener noreferrer">Find on LinkedIn ↗</a>`}${p.email?`<a href="${esc(emailLink(p.email))}">Email ↗</a>`:''}`;
}
function connectionSummary(p) {
  const t=p.tracker;if(!t)return '';
  const label=t.connection==='connected'?(conversationLabels[t.stage]||'Connected'):t.connection==='pending'?'Request pending':'Connection not confirmed';
  return `<span class="person-role connection-state">${esc(label)}${t.connection_checked_at?' · checked '+esc(date(t.connection_checked_at)):''}</span>`;
}
function conversationHTML(r) {
  return `<h3>Connections & conversations</h3><p class="small">Draft here. Send in LinkedIn, then record what you sent. Dates and message history are saved on this Mac.</p>`+(r.contacts?.people||[]).map(p=>{
    const t=p.tracker;if(!t)return `<section class="conversation-contact"><h4>${esc(p.name||p.role)}</h4><p>A personal LinkedIn profile is still needed.</p>${personLinks(p)}</section>`;
    const eventTime=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
    return `<section class="conversation-contact" data-conversation="${esc(t.key)}" data-company="${esc(r.id)}" data-profile="${esc(t.profile_url)}"><h4>${esc(p.name)}</h4><p>${esc(p.role)}</p>${connectionSummary(p)}<div class="contact-actions">${personLinks(p)}${t.connection==="connected"?"":`<button data-track-action="pending">Mark request sent</button>`}<button data-track-action="connected">Mark connected</button></div><p class="small">${esc(t.connection_evidence||'No acceptance check recorded yet.')}</p><label>Conversation stage<select data-track="stage"><option value="">${t.connection==='pending'?'Waiting for acceptance':'Not started'}</option>${Object.entries(conversationLabels).map(([v,l])=>`<option value="${v}" ${t.stage===v?'selected':''}>${l}</option>`).join('')}</select></label><label>Next follow-up<input type="date" data-track="next_follow_up" value="${esc(t.next_follow_up)}"></label><label>Draft message<textarea data-track="draft" placeholder="Write or edit your next DM…">${esc(t.draft)}</textarea></label><div class="contact-actions"><button data-track-action="starter" ${t.connection!=='connected'?'disabled':''}>Start a thank-you DM</button><button data-track-action="copy">Copy draft</button><button data-track-action="save">Save draft & details</button></div><label>Activity date and time<input type="datetime-local" data-track="event_at" value="${eventTime}"></label><button data-track-action="dm_sent">Record draft as sent</button><label>Reply or note<textarea data-track="activity" placeholder="Paste a reply, or add a conversation note…"></textarea></label><div class="contact-actions"><button data-track-action="reply_received">Record reply</button><button data-track-action="note">Add note</button></div><div class="contact-actions"><button data-track-action="call_link_sent">Record call link sent</button><button data-track-action="call_booked">Record call booked</button></div>${publishedLink(r)?`<div class="contact-actions"><button data-track-action="tracked_link">Copy ${esc(p.name.split(' ')[0])}'s microsite link</button></div><p class="small">This link records when ${esc(p.name.split(' ')[0])} opens the page (Microsite seen). No cookies, IP or device details are kept.</p>`:''}<label>Working notes<textarea data-track="notes">${esc(t.notes)}</textarea></label><p class="small" data-track-save>${t.updated_at?'Saved '+esc(date(t.updated_at)):'No draft or activity saved yet.'}</p><details class="review-detail" ${t.events.length?'open':''}><summary>Message history (${t.events.length})</summary>${[...t.events].sort((a,b)=>b.at.localeCompare(a.at)).map(e=>`<article class="conversation-event"><strong>${esc(({dm_sent:'DM sent',reply_received:'Reply received',note:'Note',call_link_sent:'Call link sent',call_booked:'Call booked',page_viewed:'Opened microsite'})[e.kind])}</strong><time>${e.time_basis==='observed'?'Observed ':''}${esc(date(e.at))}</time><p>${esc(e.body)}</p></article>`).join('')}</details></section>`;
  }).join('');
}
async function updateConversation(box,action) {
  const p=current.contacts.people.find(p=>p.tracker?.key===box.dataset.conversation),t=p?.tracker;if(!t)return;
  const value=name=>box.querySelector(`[data-track="${name}"]`).value;
  const body={key:t.key,company_id:current.id,profile_url:t.profile_url,action:'save',revision:t.revision};
  if(action==='copy'){await copyText(value('draft'));return;}
  if(action==='tracked_link'){
    try{
      let ref=t.view_ref;
      if(!ref){const response=await fetch('/api/contact-tracker',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({company_id:current.id,profile_url:t.profile_url,action:'issue_ref'})}),saved=await response.json();if(!response.ok)throw new Error(saved.error||'Link reference failed');p.tracker=saved;ref=saved.view_ref;}
      const link=new URL(publishedLink(current));link.searchParams.set('r',ref);await copyText(link.href);
    }catch(error){toast(error.message);}
    return;
  }
  if(action==='starter'&&t.connection!=='connected'){toast('Confirm the connection first');return;}
  if(action==='starter')box.querySelector('[data-track="draft"]').value=`Hi ${p.name.split(' ')[0]}, thanks for connecting. I’ve put together a short page for ${current.name} showing a few ways AI could help the business. Would you like me to send it over?`;
  if(action==='connected')Object.assign(body,{action:'check_connection',connection:'connected',checked_at:new Date().toISOString(),evidence:'Marked connected by you in the microsite gallery.'});
  else if(action==='pending')Object.assign(body,{action:'check_connection',connection:'pending',checked_at:new Date().toISOString(),evidence:'Connection request marked as sent in the microsite gallery.'});
  else if(['dm_sent','reply_received','note','call_link_sent','call_booked'].includes(action)){
    if(!value('event_at')||!Number.isFinite(new Date(value('event_at')).getTime())){toast('Choose a valid activity date and time');return;}
    const button=box.querySelector(`[data-track-action="${action}"]`);button.dataset.eventId ||= crypto.randomUUID();
    Object.assign(body,{action:'add_event',event:{id:button.dataset.eventId,kind:action,body:action==='dm_sent'?value('draft'):value('activity')||({call_link_sent:'Call link sent.',call_booked:'Call booked.'})[action]||'',at:new Date(value('event_at')).toISOString()}});
  }else {Object.assign(body,{draft:value('draft'),notes:value('notes'),next_follow_up:value('next_follow_up')});if(value('stage'))body.stage=value('stage');}
  const buttons=[...box.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
  try{
    const response=await fetch('/api/contact-tracker',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),saved=await response.json();
    if(!response.ok)throw new Error(saved.error||'Save failed');
    p.tracker=saved;box.querySelector('[data-track-save]').textContent='Saved '+date(saved.updated_at);summarise();renderStages();render();
    if(['dm_sent','reply_received','note','call_link_sent','call_booked','connected'].includes(action))switchTab('conversation');
    toast(body.action==='add_event'?'Activity recorded':'Contact saved');
  }catch(error){toast(error.message);}finally{buttons.forEach(b=>b.disabled=false);}
}
const callLink=value=>'tel:'+String(value||'').replace(/(\+44)\s*\(0\)/,'$1').replace(/[^+\d]/g,'');
function contactResearchHTML(r,full=false){
  const review=r.contact_review;if(!review)return '';
  const status=r.contacts?.research_status;
  return `<div class="contact-research ${review.missing.length?'has-gaps':''}"><p>${esc(review.message)}</p><small>Checked ${esc(date(review.checked_at))} · ${review.attempts} source checks</small>${full?`<details><summary>Research sources and search notes</summary>${structured(status.notes)}${(status.attempts||[]).map(a=>`<p>${a.url&&safeWeb(a.url)?`<a href="${esc(safeWeb(a.url))}" target="_blank" rel="noopener noreferrer">${esc(a.query||a.url)}</a>`:esc(a.query||'Source check')}<br><span class="small">${esc(a.outcome||a.result||'Checked')}</span></p>`).join('')}</details>`:''}</div>`;
}
function cardContactLinks(r){
  const people=r.contacts?.people||[],p=people.find(p=>p.name===r.card?.contact_name)||people[0];
  const office=r.contacts?.company_phones?.[0],inbox=r.contacts?.company_emails?.[0];
  return `<div class="ccard-reach">${p?.email?`<a href="${esc(emailLink(p.email))}">Email ${esc(p.name.split(' ')[0])}</a>`:inbox?`<a href="${esc(emailLink(inbox.email))}">Company inbox</a>`:''}${p?.phone?`<a href="${esc(callLink(p.phone))}">${/direct/i.test(p.phone_kind||'')?'Direct phone':'Business phone'}</a>`:office?`<a href="${esc(callLink(office.phone))}">${/unconfirmed|directory|confirmation not found/i.test(office.kind||'')?'Unconfirmed phone':'Call '+(/branch/i.test(office.kind||'')?'branch':'office')}</a>`:''}${p?.linkedin?`<a href="${esc(safeWeb(p.linkedin))}" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>`:''}${r.contacts?.research_status?.team_count?`<button data-research-team="${esc(r.id)}">Team · ${r.contacts.research_status.team_count}</button>`:''}</div>${contactResearchHTML(r)}`;
}
function peopleHTML(r,compact=false) {
  const c=r.contacts||{people:[],company_emails:[]};
  const people=compact?c.people.slice(0,2):c.people;
  let html=people.map(p=>`<div class="person-row"><div><strong>${esc(p.name||p.role)}</strong>${p.name?`<span class="person-role">${esc(p.role)}</span>`:'<span class="person-role">Name still needs checking</span>'}${p.tracker?connectionSummary(p):p.connection_status?`<span class="small">${esc(({sent:'Request sent without a note',already_pending:'Request already pending',connected:'Connected',not_attempted_weekly_limit:'Not sent · weekly limit',send_unverified:'Send not confirmed',skipped_employer_unverified:'Current employer needs checking',skipped_search_limit:'Profile still needed'})[p.connection_status]||'Connection needs checking')}${p.connection_updated_on?' · '+esc(p.connection_updated_on):''}</span>`:''}${!compact?`<p>${esc(p.why)}</p>`:''}</div><div class="contact-actions">${personLinks(p)}</div>${!compact?`${p.email?`<div class="email-line"><a href="${esc(emailLink(p.email))}">${esc(p.email)}</a><button data-copy="${esc(p.email)}" aria-label="Copy ${esc(p.email)}">Copy</button></div>`:'<p class="small">No published email matched to this person.</p>'}${p.email_note?`<p class="small">${esc(p.email_note)}</p>`:''}${p.email_candidate?`<p class="small">Unverified work email candidate: ${esc(p.email_candidate)}. ${esc(p.email_candidate_note)}</p>`:''}${p.phone?`<p class="small">${esc(p.phone_kind||'Business phone')}: ${esc(p.phone)}</p>`:''}<p class="small">${p.linkedin?'Profile link: '+esc(p.linkedin_kind||'published source'):'LinkedIn opens a name and company search; an exact profile is not confirmed.'}</p>${p.company_profile?`<a class="small" href="${esc(safeWeb(p.company_profile))}" target="_blank" rel="noopener noreferrer">Company profile ↗</a>`:''}<button class="text-button small" data-doc="${esc(p.role_source||r.research)}">Check role source ↗</button>`:''}</div>`).join('');
  if(!people.length)html='<p class="small">A named contact has not been found yet.</p>';
  if(!compact&&people.length)html+=`<details class="review-detail"><summary>Contact sources</summary>${people.map(p=>`<p><strong>${esc(p.name||p.role)}</strong></p>${docButton(p.role_source||r.research,'Role evidence')}${p.email_source?docButton(p.email_source,'Email evidence'):''}${p.email_verification_source?docButton(p.email_verification_source,'Mailbox check'):''}${p.linkedin_source?docButton(p.linkedin_source,'LinkedIn source'):''}`).join('')}</details>`;
  const inboxes=c.company_emails||[];
  if(inboxes.length){
    html+=`<div class="company-route"><span class="small">${compact?'Company inbox':'Published company routes'}</span>${inboxes.slice(0,compact?1:4).map(x=>`<div class="email-line"><a href="${esc(emailLink(x.email))}">${esc(x.email)}</a>${!compact?`<button data-copy="${esc(x.email)}">Copy</button>`:''}</div>`).join('')}${!compact?'<p class="small">A shared inbox is separate from a person’s direct email.</p>':''}</div>`;
  }
  if(!compact&&c.contact_page)html+=`<a class="contact-page" href="${esc(safeWeb(c.contact_page))}" target="_blank" rel="noopener noreferrer">Company contact page ↗</a>`;
  if(!compact){html+=contactResearchHTML(r,true);for(const x of c.company_phones||[])html+=`<p class="company-route"><span>${esc(x.kind||'Company phone')}</span> <a href="${esc(callLink(x.phone))}">${esc(x.phone)}</a>${x.source?docButton(x.source,'Phone source'):''}</p>`;}
  return html;
}
function shareHTML(r) {
  const live=publishedLink(r);
  return `<section class="share-box"><h4>Share the microsite</h4>${live?`<p>This link opens for the person you send it to.</p><a class="share-url" href="${esc(live)}" target="_blank" rel="noopener">${esc(live)}</a><div class="contact-actions"><button data-share="${esc(r.id)}">Share microsite ↗</button><button data-copy="${esc(live)}">Copy link</button></div>`:`<p class="share-not-live">Public link not live yet</p><p>The current preview only opens on your Tailscale network. A prospect cannot use it.</p><p class="small">The site needs an unlisted public link before you send it to someone.</p>${r.page?`<button data-copy="${esc(previewLink(r))}">Copy private preview link</button>`:''}`}</section>`;
}
function renderStages() {
  if (!data) return;
  $('#stages').innerHTML = stages.map(([id,label,test])=>`<button data-stage="${id}" aria-pressed="${stage===id}">${label}<span>${id==='pending'?collectionRows().flatMap(pendingPeople).length:id==='dm-ready'?collectionRows().flatMap(readyPeople).length:id==='due'?collectionRows().flatMap(followUpPeople).length:collectionRows().filter(test).length}</span></button>`).join('');
}
function render() {
  if (!data) return;
  const q = $('#search').value.toLowerCase().trim();
  const test = stages.find(s=>s[0]===stage)[2];
  filtered = collectionRows().filter(r=>test(r)&&(!$('#sector').value||r.sector===$('#sector').value)&&(!$('#feedback-filter').value||(feedback[r.id]?.status||'unreviewed')===$('#feedback-filter').value)&&(!q||[r.name,r.sector,r.location,r.why_now,r.card_summary,r.card_signal,r.card,r.contacts?.people,r.financial_capacity,r.id].map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' ').toLowerCase().includes(q)));
  const sort = $('#sort').value;
  if (sort==='name') filtered.sort((a,b)=>a.name.localeCompare(b.name));
  if (sort==='updated') filtered.sort((a,b)=>(b.page_modified||'').localeCompare(a.page_modified||''));
  $('#results').textContent = `${filtered.length} ${filtered.length===1?'company':'companies'}`;
  // Card markup lives in companies-view.js, which loads after this file; it re-renders once ready.
  if(typeof renderCompanyGallery==='function')renderCompanyGallery(filtered);
  $('#empty').hidden = filtered.length > 0;
}
async function load(manual = false) {
  const button = $('#refresh'); button.disabled = true;
  try {
    const response = await fetch('/api/gallery');
    if (!response.ok) throw new Error('The collection is being updated or is unavailable. Try Refresh shortly.');
    const next = await response.json();
    if (!Array.isArray(next.rows)) throw new Error('The collection could not be read.');
    data = next;
    if(collection!=='all'&&!data.collections.some(c=>c.id===collection))collection='all';
    renderCollections();
    populateSectors();
    summarise();
    $('#updated').textContent = 'Campaign saved ' + date(data.campaign.last_updated_utc);
    const warnings=data.collections.filter(c=>c.error).map(c=>c.name+': '+c.error);
    $('#error').textContent=warnings.join(' ');$('#error').hidden=!warnings.length; renderStages(); render();
    if (manual) toast('Collection refreshed');
    if (current) { const updated = data.rows.find(r=>r.id===current.id); if(updated) current=updated; }
    if (!current && location.hash.startsWith('#review=')) openReview(decodeURIComponent(location.hash.slice(8)));
  } catch(e) { $('#error').textContent=e.message; $('#error').hidden=false; }
  finally { button.disabled=false; }
}
function structured(value, depth=0) {
  if(value==null||value==='') return '<span class="small">Not recorded</span>';
  if(typeof value==='boolean') return value?'Yes':'No';
  if(typeof value!=='object') {
    const s=String(value), web=safeWeb(s);
    return web?`<a href="${esc(web)}" target="_blank" rel="noopener noreferrer">${esc(s)}</a>`:esc(s).replace(/\n/g,'<br>');
  }
  if(Array.isArray(value)) return value.length?'<ul>'+value.map(v=>`<li>${structured(v,depth+1)}</li>`).join('')+'</ul>':'<span class="small">None recorded</span>';
  return '<dl class="json-object">'+Object.entries(value).map(([k,v])=>{
    const body=structured(v,depth+1);
    return `<div><dt>${esc(pretty(k))}</dt><dd>${depth>0&&typeof v==='object'&&v!==null?`<details><summary>Show ${esc(pretty(k))}</summary>${body}</details>`:body}</dd></div>`;
  }).join('')+'</dl>';
}
function docButton(p, label) { return p?`<button class="doc-link" data-doc="${esc(p)}">${esc(label||pathLabel(p))}<small>${esc(p)}</small></button>`:''; }
function pathLabel(p) { return pretty(p.split('/').pop().replace(/\.[^.]+$/,'')); }
function gate(label, ok, fallback='Pending / needs review') { return `<div class="gate"><span>${label}</span><b class="${ok?'pass':'pending'}">${ok?'Current / passed':fallback}</b></div>`; }
function switchTab(next) {
  tab=next; documentSequence++;
  $$('#tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===tab));
  const r=current; if(!r) return;
  const e=$('#evidence'); e.scrollTop=0;
  if(tab==='overview') {
    e.innerHTML=overviewHTML(r);
  } else if(tab==='conversation') {
    e.innerHTML=conversationHTML(r);
  } else if(tab==='people') {
    e.innerHTML=`<h3>People to check</h3><p class="small">These people have public roles linked to the proposed work. Their buying authority is not confirmed.</p>${peopleHTML(r)}${shareHTML(r)}<details class="review-detail"><summary>Original contact evidence & limits</summary>${structured(r.contacts?.raw_buyer||r.buyer)}${structured(r.contacts?.raw_contact||r.public_contact)}</details><p class="small">Earlier contact: ${esc(r.contacts?.prior_contact||r.prior_contact)}</p>`;
  } else if(tab==='research') {
    e.innerHTML=`<h3>Research & sources</h3><p class="small">Read the saved research, then follow the public sources to check the agent’s conclusions.</p>${docButton(r.research,'Read the full research record')}${(r.files||[]).filter(p=>/research\/brief\.html$/.test(p)).map(p=>docButton(p,'Read the client brief')).join('')}<h4>Public sources</h4><ul>${(r.sources||[]).filter(safeWeb).map(s=>`<li><a href="${esc(safeWeb(s))}" target="_blank" rel="noopener noreferrer">${esc(s)}</a></li>`).join('')||'<li>No public links recorded here. Check the full research record.</li>'}</ul>`;
  } else if(tab==='reviews') {
    const k=r.checks||{},f=k.fidelity;
    e.innerHTML=`<h3>Page checks</h3><p class="small">The skill's own checks on this version of the page. Your feedback is kept separately under My review.</p>${gate('Built and lint passed',k.built,'No page yet')}${gate(f?`Looks like their site · desktop ${f.desktop??'–'}, phone ${f.phone??'–'} (needs ${f.threshold})`:'Looks like their site',f?.pass,f?'Below threshold':'Not scored on this version')}${gate('Desktop and phone QA',k.qa,'Not run on this version')}${k.problem?`<p class="notice">${esc(k.problem)}</p>`:''}`;
  } if(tab==='files'||tab==='reviews') {
    const before=tab==='reviews'?e.innerHTML:'';
    const imgs=r.files.filter(p=>/\.(png|jpe?g|webp)$/i.test(p));
    e.innerHTML=before+`<h3>Working files</h3><p class="small">Design choices, source copy, research records and saved browser evidence.</p>${r.files.filter(p=>!imgs.includes(p)).map(p=>docButton(p)).join('')}<h4>Saved captures · ${imgs.length}</h4><div class="file-images">${imgs.map(p=>`<a href="${esc(url(p))}" target="_blank" rel="noopener"><img loading="lazy" src="${esc(url(p))}" alt="${esc(pathLabel(p))}">${esc(pathLabel(p))}</a>`).join('')}</div>`;
  } else if(tab==='feedback') {
    const own=feedback[r.id]||{};
    e.innerHTML=`<h3>Your review</h3><p>Keep a shortlist or flag changes for the microsite agent.</p><label for="my-status">Your decision</label><select id="my-status">${Object.entries(labels).map(([v,l])=>`<option value="${v}" ${own.status===v?'selected':''}>${l}</option>`).join('')}</select><label for="my-notes">Feedback for ${esc(r.name)}</label><textarea id="my-notes" placeholder="What works? What needs to change?"></textarea><p id="save-state" class="saved">${own.updated?'Saved '+date(own.updated):'Changes save automatically in this browser.'}</p><p class="small">Feedback stays on this device and browser. Use Export my feedback to create a file for the agent. It does not change the campaign’s verification status.</p><button id="export-one">Export this review ↓</button>`;
    $('#my-notes').value=own.notes||'';
    $('#my-status').value=own.status||'unreviewed';
    $('#my-notes').addEventListener('input',saveFeedback);
    $('#my-status').addEventListener('change',saveFeedback);
    $('#export-one').addEventListener('click',()=>exportFeedback([r.id]));
  }
}
function $$(s) { return [...document.querySelectorAll(s)]; }
function saveFeedback() {
  feedback[current.id]={status:$('#my-status').value,notes:$('#my-notes').value,updated:new Date().toISOString()};
  try {localStorage.setItem(storeKey,JSON.stringify(feedback));$('#save-state').textContent='Saved '+date(feedback[current.id].updated);}
  catch {$('#save-state').textContent='Browser storage unavailable. Export your feedback before closing.';}
  render();
}
function exportFeedback(ids=Object.keys(feedback)) {
  const entries=ids.filter(id=>feedback[id]).map(id=>({id,company:data.rows.find(r=>r.id===id)?.name,collection:data.rows.find(r=>r.id===id)?.collection_id,...feedback[id]}));
  if(!entries.length){toast('No feedback saved yet. Open a site and choose My review.');return;}
  const blob=new Blob([JSON.stringify({collection:'Microsite gallery',collections:data.collections.map(c=>({id:c.id,creation_chat:c.thread})),creation_chat:data.thread,exported:new Date().toISOString(),reviews:entries},null,2)],{type:'application/json'});
  const href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download='microsite-review-feedback-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);toast(`${entries.length} reviews exported`);
}
function openReview(id, updateHash=true) {
  const r=data.rows.find(r=>r.id===id);if(!r)return;
  current=r;const index=filtered.findIndex(r=>r.id===id);
  $('#review-title').textContent=r.name;
  $('#position').textContent=index>=0?`${index+1} of ${filtered.length} in this view`:'From the working collection';
  $('#previous').disabled=index<=0;$('#next').disabled=index<0||index>=filtered.length-1;
  $('#external-site').hidden=!r.page;
  if(r.page)$('#external-site').href=url(r.page);
  $('#site-frame').hidden=!r.page;$('#no-page').hidden=!!r.page;
  $('#site-frame').src=r.page?url(r.page):'about:blank';
  $('#share-site').textContent=publishedLink(r)?'Share microsite':'Sharing status';
  switchTab(tab);
  if(!$('#reviewer').open){lastFocus=document.activeElement;$('#reviewer').showModal();document.body.style.overflow='hidden';}
  if(updateHash)history.replaceState(null,'','#review='+encodeURIComponent(id));
}
function closeReview() { $('#reviewer').close(); }
function navigate(delta) { const i=filtered.findIndex(r=>r.id===current?.id);if(i>=0&&filtered[i+delta])openReview(filtered[i+delta].id); }
function toast(message) { $('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),3000); }
async function openDocument(p) {
  if(p.startsWith('contact-research/')){window.open('/'+p.split('/').map(encodeURIComponent).join('/'),'_blank','noopener');return;}
  if(safeWeb(p)){window.open(safeWeb(p),'_blank','noopener,noreferrer');return;}
  if(/\.(png|jpe?g|webp|gif|svg|pdf|html)$/i.test(p)) { window.open(url(p),'_blank','noopener');return; }
  const token=++documentSequence;
  $('#evidence').innerHTML='<p role="status">Opening document…</p>';
  try {
    const response=await fetch('/api/document?collection='+encodeURIComponent(current.collection_id)+'&path='+encodeURIComponent(p));if(!response.ok)throw new Error('This file is unavailable. It may still be in progress.');
    const d=await response.json();if(token!==documentSequence)return;
    let content;try{content=structured(JSON.parse(d.text));}catch{content='<pre class="document-text">'+esc(d.text)+'</pre>';}
    $('#evidence').innerHTML=`<div class="doc-toolbar"><button data-back>← Back to ${tab==='reviews'?'agent checks':tab}</button><a href="${esc(url(p))}" target="_blank" rel="noopener">Raw file ↗</a></div><h3>${esc(pathLabel(p))}</h3><p class="small">${esc(p)}</p>${content}`;
    $('#evidence').scrollTop=0;
  } catch(e) {if(token===documentSequence)$('#evidence').innerHTML=`<button data-back>← Back</button><p role="alert">${esc(e.message)}</p>`;}
}
async function copyText(value){
  try{await navigator.clipboard.writeText(value);toast('Copied');}
  catch{const field=document.createElement('textarea');field.value=value;field.setAttribute('readonly','');field.style.position='fixed';field.style.top='-1000px';document.body.append(field);field.select();const copied=document.execCommand('copy');field.remove();toast(copied?'Copied':'Copy is unavailable in this browser.');}
}
async function shareSite(id){
  const r=data.rows.find(r=>r.id===id);if(!r)return;
  const link=publishedLink(r);
  if(!link){if(!current||current.id!==id)openReview(id);switchTab('people');setMobilePane('opportunity');$('#evidence .share-box')?.scrollIntoView({block:'center'});toast('This draft needs a public link before a prospect can open it.');return;}
  try{if(navigator.share)await navigator.share({title:'Prepared for '+r.name,url:link});else await copyText(link);}catch(e){if(e.name!=='AbortError')await copyText(link);}
}
function copyOpener(id){const r=data.rows.find(r=>r.id===id);if(!r?.card?.opener)return;copyText(openerFor(r));if(!linkFor(r))setTimeout(()=>toast('Copied. Add the public page link before sending.'),300);}
function setMobilePane(which){$('#reviewer').classList.toggle('show-page',which==='page');$('#show-page').setAttribute('aria-pressed',which==='page');$('#show-opportunity').setAttribute('aria-pressed',which!=='page');}
$('#gallery').addEventListener('click',e=>{const cv=e.target.closest('[data-converse]');if(cv){const r=data.rows.find(x=>x.id===cv.dataset.converse),p=(r?.contacts?.people||[]).find(p=>p.tracker);if(p)openPerson(p.tracker.key);else{openReview(cv.dataset.converse);switchTab('people');}return;}const o=e.target.closest('[data-copy-opener]');if(o){copyOpener(o.dataset.copyOpener);return;}const p=e.target.closest('[data-people]');if(p){openReview(p.dataset.people);switchTab('people');setMobilePane('opportunity');return;}const b=e.target.closest('[data-open]');if(b){openReview(b.dataset.open);switchTab('overview');setMobilePane('page');}});
$('#collections').addEventListener('click',e=>{
  const b=e.target.closest('[data-collection]');if(!b)return;
  collection=b.dataset.collection;stage='built';$('#sector').value='';$('#search').value='';$('#feedback-filter').value='';
  const u=new URL(location.href);if(collection==='all')u.searchParams.delete('collection');else u.searchParams.set('collection',collection);
  history.replaceState(null,'',u.pathname+u.search+u.hash);populateSectors();renderCollections();renderStages();render();summarise();
});
$('#stages').addEventListener('click',e=>{const b=e.target.closest('[data-stage]');if(b){stage=b.dataset.stage;renderStages();render();}});
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b)switchTab(b.dataset.tab);});
$('#evidence').addEventListener('click',e=>{const track=e.target.closest('[data-track-action]');if(track){updateConversation(track.closest('[data-conversation]'),track.dataset.trackAction);return;}const d=e.target.closest('[data-doc]');if(d)openDocument(d.dataset.doc);if(e.target.closest('[data-back]'))switchTab(tab);const p=e.target.closest('[data-panel]');if(p)switchTab(p.dataset.panel);const c=e.target.closest('[data-copy]');if(c)copyText(c.dataset.copy);const s=e.target.closest('[data-share]');if(s)shareSite(s.dataset.share);const o=e.target.closest('[data-copy-opener]');if(o)copyOpener(o.dataset.copyOpener);const st=e.target.closest('[data-status]');if(st)setStatus(st.dataset.id,st.dataset.status);});
$('#share-site').addEventListener('click',()=>current&&shareSite(current.id));
$('#show-opportunity').addEventListener('click',()=>setMobilePane('opportunity'));
$('#show-page').addEventListener('click',()=>setMobilePane('page'));
$('#search').addEventListener('input',render);
['sector','sort','feedback-filter'].forEach(id=>$('#'+id).addEventListener('change',render));
$('#reset').addEventListener('click',()=>{$('#search').value='';$('#sector').value='';$('#feedback-filter').value='';stage='built';renderStages();render();});
$('#refresh').addEventListener('click',()=>load(true));
$('#export').addEventListener('click',()=>exportFeedback());
$('#previous').addEventListener('click',()=>navigate(-1));$('#next').addEventListener('click',()=>navigate(1));
$('#close-review').addEventListener('click',closeReview);
$('#reviewer').addEventListener('close',()=>{current=null;documentSequence++;$('#site-frame').src='about:blank';document.body.style.overflow='';history.replaceState(null,'',location.pathname+location.search);if(lastFocus?.isConnected)lastFocus.focus();else $('#gallery').focus();});
['desktop','phone'].forEach(id=>$('#'+id).addEventListener('click',()=>{$('#site-frame').classList.toggle('phone',id==='phone');$('#desktop').setAttribute('aria-pressed',id==='desktop');$('#phone').setAttribute('aria-pressed',id==='phone');}));
$('#reload-preview').addEventListener('click',()=>{if(current?.page)$('#site-frame').src=url(current.page);});
['roomy','compact'].forEach(id=>$('#'+id).addEventListener('click',()=>{$('#gallery').classList.toggle('compact',id==='compact');$('#roomy').setAttribute('aria-pressed',id==='roomy');$('#compact').setAttribute('aria-pressed',id==='compact');}));
document.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select')||e.metaKey||e.ctrlKey||e.altKey)return;if(e.key==='/'&&!$('#reviewer').open){e.preventDefault();$('#search').focus();}if($('#reviewer').open&&e.key==='ArrowRight')navigate(1);if($('#reviewer').open&&e.key==='ArrowLeft')navigate(-1);});
window.addEventListener('hashchange',()=>{if(data&&location.hash.startsWith('#review='))openReview(decodeURIComponent(location.hash.slice(8)),false);});
load();
setInterval(()=>{if(!document.hidden&&!$('#reviewer').open)load();},60000);

document.addEventListener('click',e=>{const b=e.target.closest('[data-research-team]');if(b){openReview(b.dataset.researchTeam);switchTab('team');setMobilePane('page');}});
