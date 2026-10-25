// ABOUTME: Merges dated, sourced contact research (for example Treg lookups) into a company's people without changing campaign or conversation records.
// ABOUTME: Each company's report lives in microsites/<slug>/enrichment/contact-research.json; anything unsourced or personal is ignored.
const isSharedEmail=value=>/^(info|hello|sales|contact|enquir|office|admin|group|reception|support|marketing|accounts|mail|email|pr)([.@_-]|ies@|y@)/i.test(value);

const norm=value=>String(value||'').normalize('NFKD').replace(/[^a-z0-9]/gi,'').toLowerCase();
const web=value=>{try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}};
const evidence=value=>typeof value==='string'&&(!!web(value)||/^(?:research|enrichment|contact-research|microsites)\//.test(value)||value.startsWith('/'));
const profile=value=>{const u=web(value);return u&&/^https?:\/\/(?:[a-z]+\.)?linkedin\.com\/in\/[^/?#]+\/?(?:[?#].*)?$/i.test(u)?u:null;};
const email=value=>typeof value==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)?value:null;
const phone=value=>typeof value==='string'&&value.replace(/\D/g,'').length>=9?value:null;
export const phoneHref=value=>'tel:'+String(value||'').replace(/(\+44)\s*\(0\)/,'$1').replace(/[^+\d]/g,'');
const distinct=(items,key)=>[...new Map(items.map(item=>[key(item),item])).values()];

export function mergeContactResearch(existing,report,company=''){
  if(!report)return existing;
  if(!Number.isFinite(Date.parse(report.checked_at))||!Array.isArray(report.attempts)||!report.attempts.length)throw new Error('Contact research requires a date and search attempts');
  const record=structuredClone(existing||{people:[],company_emails:[]});
  record.people ||= [];record.company_emails ||= [];
  for(const rejected of report.rejected_existing||[]){
    const person=record.people.find(p=>norm(p.name)===norm(rejected.name));
    if(person&&['email','linkedin','phone'].includes(rejected.field)&&person[rejected.field]===rejected.value&&evidence(rejected.source)){
      person[rejected.field]=null;person[rejected.field+'_note']=rejected.reason;
    }
  }
  const companyEmails=[...record.company_emails],companyPhones=[...(record.company_phones||[])];
  const peopleByName=new Map(record.people.map(p=>[norm(p.name),p]));
  for(const found of report.people||[]){
    if(!found.name||!found.role||!evidence(found.role_source))continue;
    const linkedMatch=profile(found.linkedin)&&record.people.find(p=>profile(p.linkedin)&&new URL(p.linkedin).pathname.toLowerCase().replace(/\/$/,'')===new URL(found.linkedin).pathname.toLowerCase().replace(/\/$/,''));
    const person=peopleByName.get(norm(found.name))||linkedMatch||{name:found.name,search_url:'https://www.linkedin.com/search/results/people/?keywords='+encodeURIComponent(found.name+' '+company)};
    Object.assign(person,{role:found.role,role_source:found.role_source,why:found.why_relevant||person.why||'Check whether this role owns the proposed work.',checked_on:report.checked_at.slice(0,10)});
    if(profile(found.linkedin)&&evidence(found.linkedin_source)){
      const slug=value=>new URL(value).pathname.toLowerCase().replace(/\/$/,'');
      if(person.linkedin&&profile(person.linkedin)&&slug(person.linkedin)!==slug(found.linkedin))Object.assign(person,{linkedin_alternate:profile(found.linkedin),linkedin_alternate_source:found.linkedin_source,linkedin_note:'A different public profile URL was found. The existing tracked identity is kept until the match is confirmed.'});
      else Object.assign(person,{linkedin:profile(found.linkedin),linkedin_source:found.linkedin_source,linkedin_kind:'Public professional profile'});
    }
    if(email(found.email)&&evidence(found.email_source)&&['published_business','provider_verified','provider_verified_catchall'].includes(found.email_status)){
      if(isSharedEmail(found.email))companyEmails.push({email:found.email,source:found.email_source,kind:'Company inbox'});
      else Object.assign(person,{email:found.email,email_source:found.email_source,email_status:found.email_status,email_verification_source:found.email_verification_source||null,email_note:found.email_note||(found.email_status.startsWith('provider_verified')?'Provider-verified work email; not found in public company material.':'Published business email.')});
    }
    if(email(found.email)&&evidence(found.email_source)&&found.email_status==='provider_candidate')Object.assign(person,{email_candidate:found.email,email_candidate_source:found.email_source,email_candidate_note:'Mailbox not tested. Public publication not found.'});
    if(phone(found.phone)&&evidence(found.phone_source))Object.assign(person,{phone:found.phone,phone_source:found.phone_source,phone_kind:found.phone_kind||'Business phone'});
    peopleByName.set(norm(found.name),person);
  }
  record.people=[...new Set(peopleByName.values())];
  for(const found of report.company_emails||[])if(email(found.email)&&evidence(found.source))companyEmails.push({...found,kind:'Company inbox'});
  for(const found of report.company_phones||[])if(phone(found.phone)&&evidence(found.source))companyPhones.push(found);
  const personal=new Set(record.people.map(p=>p.email?.toLowerCase()).filter(Boolean));
  record.company_emails=distinct(companyEmails.filter(p=>!personal.has(p.email?.toLowerCase())),p=>p.email.toLowerCase());
  record.company_phones=distinct(companyPhones,p=>p.phone.replace(/\D/g,''));
  record.research_status={checked_at:report.checked_at,team_source:report.team_source||null,team_count:(report.people||[]).filter(p=>p.name&&p.role&&p.role_source).length,missing:report.missing||[],notes:report.notes||'',attempts:report.attempts,rejected_existing:report.rejected_existing||[]};
  return record;
}

export function researchSummary(record){
  const status=record?.research_status;if(!status)return null;
  const labels={direct_email:'direct work email',direct_work_email:'direct work email',direct_person_phone:'direct phone',direct_business_phone:'direct phone',email:'email',phone:'phone',team:'team details',linkedin:'exact LinkedIn profile',team_details:'team details'};
  const missing=[...new Set(status.missing.map(field=>labels[field]||(/email/i.test(field)?'some work emails':/phone|landline|mobile/i.test(field)?'direct phone':/linkedin/i.test(field)?'some exact LinkedIn profiles':/title|role/i.test(field)?'some current job titles':String(field).replace(/_/g,' '))))];
  return {checked_at:status.checked_at,missing,message:missing.length?'Unable to find contact info: '+missing.join(', ')+'.':'Contact research checked.',attempts:status.attempts.length};
}
