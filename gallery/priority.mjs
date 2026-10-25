import {phoneHref} from './contact-research.mjs';
// ABOUTME: Ranks built microsite firms into a call queue: who to contact next, how to reach them, and why they rank there.
// ABOUTME: Pure functions over gallery rows; every point comes with a plain reason so the order can be checked by eye.

const TURNOVER=/[£$€]\s?([\d,.]+)\s?(m|bn)\b/i;
const PHONE=/(?:\+44\s?(?:\(0\)\s?)?|\b0)\d[\d ]{8,12}\d/g;
const EMAIL=/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const DECIDER=/\b(founder|co-founder|owner|managing director|md|chief executive|ceo|managing partner|senior partner|principal|proprietor)\b/i;
const PARKED=new Set(['skip','not_now']);

export const POINTS={turnoverLarge:4,turnoverMid:2,decider:3,connected:5,pending:1,directEmail:3,companyEmail:1,phone:2,profile:1,viewed:6,replied:10};

export function turnoverMillions(text){
  const m=TURNOVER.exec(String(text||''));
  if(!m)return 0;
  const value=Number(m[1].replace(/,/g,''));
  return m[2].toLowerCase()==='bn'?value*1000:value;
}
export const phonesIn=record=>[...new Set(JSON.stringify(record||{}).match(PHONE)||[])].map(p=>p.trim());
export const emailsIn=record=>[...new Set(JSON.stringify(record||{}).match(EMAIL)||[])];
export const isDecisionMaker=title=>DECIDER.test(String(title||''));

const eventsOf=people=>people.flatMap(p=>p.tracker?.events||[]);
function chooseBuyer(r){
  const people=r.contacts?.people||[];
  const named=r.card?.contact_name&&people.find(p=>p.name===r.card.contact_name);
  const deciders=people.filter(p=>isDecisionMaker(p.role));
  return (named&&isDecisionMaker(named.role)?named:null)||deciders.find(p=>p.tracker?.connection==='connected')||deciders.find(p=>p.email)||deciders[0]||named||people.find(p=>p.name)||null;
}

export function priorityItem(r){
  const people=r.contacts?.people||[],person=chooseBuyer(r),tracker=person?.tracker||null;
  const events=eventsOf(people),turnover=turnoverMillions(r.financial_capacity||r.card?.pay);
  const companyEmailRecords=[...(r.contacts?.company_emails||[]),...emailsIn(r.public_contact).map(email=>({email,source:r.research}))];
  const companyEmails=[...new Set(companyEmailRecords.map(x=>x.email).filter(e=>e!==person?.email))];
  const phoneRecords=[...(person?.phone?[{phone:person.phone,kind:person.phone_kind||'Business phone',source:person.phone_source}]:[]),...(r.contacts?.company_phones||[]),...phonesIn(r.public_contact).map(phone=>({phone,kind:'Company phone',source:r.research}))];
  const phones=[...new Map(phoneRecords.map(p=>[phoneHref(p.phone).replace(/^tel:\+44/,'tel:0'),p])).values()];
  const profile=tracker?.profile_url||person?.linkedin||'';
  const reasons=[],add=(points,label)=>points&&reasons.push({points,label});
  add(Math.round((r.score_total||0)/(r.score_out_of||25)*10),`Research fit ${r.score_total||0}/${r.score_out_of||25}`);
  if(turnover>=10)add(POINTS.turnoverLarge,`Turnover about ${turnover}m`);else if(turnover>=2)add(POINTS.turnoverMid,`Turnover about ${turnover}m`);
  if(person&&isDecisionMaker(person.role))add(POINTS.decider,'Named decision maker');
  if(tracker?.connection==='connected')add(POINTS.connected,'Connected on LinkedIn');
  else if(tracker?.connection==='pending')add(POINTS.pending,'LinkedIn request pending');
  else if(profile)add(POINTS.profile,'LinkedIn profile found');
  if(person?.email)add(POINTS.directEmail,'Direct email');else if(companyEmails.length)add(POINTS.companyEmail,'Company inbox only');
  if(phones.length)add(POINTS.phone,'Phone number');
  if(events.some(e=>e.kind==='reply_received')||r.outreach?.status==='replied')add(POINTS.replied,'They replied');
  else if(events.some(e=>e.kind==='page_viewed'))add(POINTS.viewed,'Opened their microsite');
  const recent=events.map(e=>Date.parse(e.at)).filter(Number.isFinite).sort((a,b)=>b-a)[0];
  const days=recent===undefined?Infinity:(Date.now()-recent)/86400000;
  if(days>=0&&days<=2)add(3,'Activity in the last two days');else if(days>=0&&days<=7)add(1,'Activity in the last week');
  const reach=[
    ...phones.map(p=>({kind:'phone',value:p.phone,label:p.kind,source:p.source})),
    ...(person?.email?[{kind:'email',value:person.email,direct:true,status:person.email_status||'existing source',source:person.email_source}]:[]),
    ...companyEmails.map(value=>({kind:'email',value,direct:false})),
    ...(profile?[{kind:'linkedin',value:profile,state:tracker?.connection||'unknown'}]:[])
  ];
  const last=[...(tracker?.events||events)].sort((a,b)=>a.at.localeCompare(b.at)).at(-1)||null;
  return {id:r.id,source_id:r.source_id,collection_id:r.collection_id,name:r.name,sector:r.sector||'',page:r.page,asset_base:r.asset_base||'',thumb:r.thumb||null,preview:r.preview||null,
    turnover,decider:!!person&&isDecisionMaker(person.role),connection:tracker?.connection||'unknown',
    person:person?{name:person.name,role:person.role||'',key:tracker?.key||null,search_url:person.search_url||''}:null,
    reach,contact_review:r.contact_review||null,team_count:r.contacts?.research_status?.team_count||0,signal:r.card?.chip||r.card_signal||'',why_now:r.card?.why_now||r.why_now||'',opener:r.card?.opener||tracker?.draft||'',
    outreach:r.outreach?.status||'to_contact',last_kind:last?.kind||null,last_at:last?.at||null,
    viewed:events.some(e=>e.kind==='page_viewed'),replied:reasons.some(x=>x.label==='They replied'),
    next_follow_up:tracker?.next_follow_up||'',pinned:person?.name==='Pamela Phillips',
    points:reasons.reduce((n,x)=>n+x.points,0),reasons};
}

const parked=r=>!r.page||/hold/i.test(`${r.status||''} ${r.raw_status||''}`)||PARKED.has(r.outreach?.status)||chooseBuyer(r)?.tracker?.stage==='not_now'
  ||(r.contacts?.people||[]).some(p=>p.tracker?.stage==='do_not_contact');
export const priorityQueue=rows=>rows.filter(r=>!parked(r)).map(priorityItem).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.points-a.points||b.turnover-a.turnover||a.name.localeCompare(b.name));
export const deadEnds=items=>items.filter(i=>!i.person||!i.reach.length).map(i=>({id:i.id,name:i.name,problem:!i.person?'No named person':'No phone, email or LinkedIn'}));

export function filterPriority(items,{campaign='all',query='',deciders=true,channel='',connection='',minTurnover=0,limit=40,researchedOnly=false}={}){
  const q=String(query).toLowerCase();
  return items.filter(i=>(campaign==='all'||i.collection_id===campaign)&&i.person&&i.reach.length
    &&(!researchedOnly||i.contact_review)&&(!deciders||i.decider)&&(!channel||i.reach.some(r=>r.kind===channel))
    &&(!connection||i.connection===connection)&&i.turnover>=Number(minTurnover||0)
    &&(!q||[i.name,i.person.name,i.sector,i.why_now].join(' ').toLowerCase().includes(q)))
    .slice(0,Math.max(1,Math.min(Number(limit)||40,500)));
}
