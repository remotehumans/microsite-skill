import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {campaignOf} from './funnel.mjs';

export const STAGES=['ready_to_dm','draft_ready','awaiting_reply','replied','call_booked','not_now','do_not_contact'];
export function profileURL(value){
  const u=new URL(value);
  if(!['https:','http:'].includes(u.protocol)||!/(^|\.)linkedin\.com$/i.test(u.hostname)||!/^\/in\/[^/]+\/?$/.test(u.pathname))throw new Error('Use a personal LinkedIn profile URL');
  return 'https://www.linkedin.com'+u.pathname.replace(/\/$/,'').toLowerCase();
}
export const contactKey=(company,url)=>company+'|'+profileURL(url);
const empty=()=>({version:1,contacts:{},monitor:{}});
export function readTracker(file){return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):empty();}
export function writeTracker(file,data){
  fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2)+'\n',{mode:0o600});fs.renameSync(tmp,file);
}
export function initialContact(company,person){
  if(!person.name&&!person.linkedin)return null;
  const url=person.linkedin?profileURL(person.linkedin):'',state=person.connection_status;
  const key=url?contactKey(company,url):company+'|person:'+String(person.name).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  return {key,company_id:company,campaign:campaignOf(company),name:person.name,profile_url:url,
    connection:state==='connected'?'connected':['sent','already_pending'].includes(state)?'pending':'unknown',
    connection_checked_at:null,connection_evidence:'',connected_observed_at:null,
    stage:state==='connected'?'ready_to_dm':null,draft:'',next_follow_up:'',notes:'',events:[],revision:0};
}
export function decorateContact(company,person,tracker){
  const seed=initialContact(company,person);if(!seed)return {...person,tracker:null};
  return {...person,tracker:tracker.contacts[seed.key]||seed};
}
const text=(value,max)=>{if(typeof value!=='string'||value.length>max)throw new Error('Invalid text or text too long');return value;};
// Context every person carries: where they were found, why we are contacting them, the next step and the thread that found them.
const CONTEXT_FIELDS=[['source','where-found note',300],['reason','reason',2000],['next_step','next step',300],['thread','thread',300]];
export function contextFrom(input){
  const out={};
  for(const [key,label,max] of CONTEXT_FIELDS){
    if(input[key]===undefined)continue;
    const v=String(input[key]).trim();if(v.length>max)throw new Error(`The ${label} is too long`);out[key]=v;
  }
  if(input.source_url!==undefined){
    const v=String(input.source_url).trim();
    if(v){let ok=false;try{ok=['https:','http:'].includes(new URL(v).protocol);}catch{}if(!ok||v.length>600)throw new Error('Use a web address for the source link');}
    out.source_url=v;
  }
  return out;
}
const stamp=value=>{const d=new Date(value);if(!value||!Number.isFinite(d.getTime()))throw new Error('A valid observation date is required');return d.toISOString();};
export function changeContact(directory,data,body,now=new Date().toISOString()){
  // Hand-added people may have no LinkedIn profile, so they are addressed by their tracker key.
  const target=body.key?directory.find(c=>c.key===body.key):directory.find(c=>c.profile_url&&c.company_id===body.company_id&&profileURL(c.profile_url)===profileURL(body.profile_url));
  if(!target)throw new Error('Unknown gallery contact');
  const key=target.key||contactKey(target.company_id,target.profile_url);
  const current=data.contacts[key]||target;
  const next=structuredClone(current);
  if(body.action==='check_connection'){
    if(!['connected','pending','unknown'].includes(body.connection))throw new Error('Unknown connection state');
    const checked=stamp(body.checked_at),evidence=text(body.evidence,4000);
    if(!evidence.trim())throw new Error('Connection evidence is required');
    if(current.connection_checked_at&&checked<current.connection_checked_at)return current;
    next.connection_checked_at=checked;next.connection_evidence=evidence;
    // An incomplete check must never erase a previously verified acceptance.
    if(body.connection==='connected'){
      next.connection='connected';next.connected_observed_at ||= checked;
      if(!next.stage)next.stage='ready_to_dm';
    }else if(current.connection!=='connected'&&body.connection!=='unknown')next.connection=body.connection;
  }else if(body.action==='save'){
    if(body.revision!==current.revision)throw Object.assign(new Error('This contact changed. Refresh before saving.'),{status:409});
    if(body.draft!==undefined)next.draft=text(body.draft,12000);
    if(body.notes!==undefined)next.notes=text(body.notes,12000);
    Object.assign(next,contextFrom(body));
    // Hand-added people may be found on LinkedIn after import; campaign people keep their researched profile.
    if(body.key&&current.manual&&body.company!==undefined){const v=String(body.company).trim();if(!v||v.length>160)throw new Error('A company of up to 160 characters is required');next.company=v;}
    if(body.key&&current.manual&&body.role!==undefined)next.role=text(String(body.role).trim(),160);
    if(body.key&&current.manual&&body.profile_url!==undefined)next.profile_url=body.profile_url?profileURL(body.profile_url):'';
    if(body.next_follow_up!==undefined){
      if(body.next_follow_up!==''&&!/^\d{4}-\d{2}-\d{2}$/.test(body.next_follow_up))throw new Error('Use a follow-up date');
      next.next_follow_up=body.next_follow_up;
    }
    if(body.stage!==undefined){
      if(!STAGES.includes(body.stage))throw new Error('Unknown conversation stage');
      if(['ready_to_dm','draft_ready'].includes(body.stage)&&next.connection!=='connected')throw new Error('Confirm the connection before adding a DM-ready stage');
      next.stage=body.stage;
      if(body.stage==='call_booked')next.booked_at ||= now;
    }else if(next.connection==='connected'&&next.draft.trim()&&['ready_to_dm','draft_ready'].includes(next.stage))next.stage='draft_ready';
  }else if(body.action==='add_event'){
    const event=body.event||{};
    if(!['dm_sent','reply_received','note','call_link_sent','call_booked'].includes(event.kind))throw new Error('Unknown activity type');
    const id=text(event.id,200);if(!id)throw new Error('An activity ID is required');
    if(next.events.some(e=>e.id===id))return current;
    const content=text(event.body,20000);if(!content.trim())throw new Error('Record the message or note text');
    next.events.push({id,kind:event.kind,body:content,at:stamp(event.at||now),time_basis:event.time_basis==='observed'?'observed':'actual',recorded_at:now});
    if(event.kind==='call_booked'&&next.stage!=='do_not_contact'){next.stage='call_booked';next.booked_at ||= stamp(event.at||now);}
    else if(!['do_not_contact','not_now','call_booked'].includes(next.stage)){
      const latest=next.events.filter(e=>['dm_sent','reply_received'].includes(e.kind)).sort((a,b)=>a.at.localeCompare(b.at)).at(-1);
      if(latest)next.stage=latest.kind==='dm_sent'?'awaiting_reply':'replied';
    }
  }else if(body.action==='issue_ref'){
    if(current.view_ref)return current;
    // Opaque per-person link reference: it identifies who opened their link, and nothing about the viewer's device.
    next.view_ref=crypto.randomBytes(9).toString('base64url').toLowerCase().replace(/[^a-z0-9]/g,'').padEnd(12,'0').slice(0,12);
  }else throw new Error('Unknown contact action');
  next.updated_at=now;next.revision=current.revision+1;data.contacts[key]=next;return next;
}
export function updateMonitor(data,body){
  if(!['ok','login_needed','partial','error'].includes(body.status))throw new Error('Unknown monitor status');
  data.monitor={checked_at:stamp(body.checked_at),status:body.status,coverage:text(body.coverage||'',4000)};return data.monitor;
}
export function recordViews(data,views){
  const byRef=new Map(Object.values(data.contacts).filter(c=>c.view_ref).map(c=>[c.view_ref,c]));
  const result={attributed:0,unattributed:0};data.page_views ||= {};
  for(const v of views){
    const at=stamp(v.viewed_at),owner=v.ref&&byRef.get(v.ref);
    if(owner){
      if(!owner.events.some(e=>e.id===v.id)){owner.events.push({id:v.id,kind:'page_viewed',body:'Opened /for/'+v.slug,at:v.viewed_at,time_basis:'observed',recorded_at:at});owner.revision++;}
      result.attributed++;
    }else{
      const page=data.page_views[v.slug] ||= {count:0,last_at:null,ids:[]};
      if(!page.ids.includes(v.id)){page.ids.push(v.id);page.count++;if(!page.last_at||v.viewed_at>page.last_at)page.last_at=v.viewed_at;}
      result.unattributed++;
    }
  }
  return result;
}
