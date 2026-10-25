// ABOUTME: Contacts added outside the microsite campaigns, by hand or by CSV import, stored in the private contact tracker.
// ABOUTME: Validates and de-duplicates people, scopes them to a campaign, and replays any stage history given in the CSV.
import crypto from 'node:crypto';
import {profileURL,contextFrom} from './contact-tracker.mjs';
import {campaignOf} from './funnel.mjs';

export function uuidv7(ms=Date.now()){
  const b=crypto.randomBytes(16),t=BigInt(ms);
  for(let i=0;i<6;i++)b[i]=Number((t>>BigInt(40-8*i))&0xffn);
  b[6]=(b[6]&0x0f)|0x70;b[8]=(b[8]&0x3f)|0x80;
  const h=b.toString('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
export function parseCSV(text){
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quoted){if(ch==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(ch==='"')quoted=false;else cell+=ch;continue;}
    if(ch==='"')quoted=true;else if(ch===','){row.push(cell);cell='';}
    else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}
    else cell+=ch;
  }
  if(cell||row.length){row.push(cell);rows.push(row);}
  const [head,...body]=rows;if(!head)return [];
  const keys=head.map(h=>h.trim().toLowerCase().replace(/\s+/g,'_'));
  return body.filter(r=>r.some(c=>c.trim())).map(r=>Object.fromEntries(keys.map((k,i)=>[k,(r[i]||'').trim()])));
}
const slug=s=>s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'company';
const same=(a,b)=>String(a||'').trim().toLowerCase()===String(b||'').trim().toLowerCase();
const field=(value,label,max,required)=>{const v=String(value??'').trim();if(required&&!v)throw new Error(`A ${label} is required`);if(v.length>max)throw new Error(`The ${label} is too long`);return v;};
export const manualDirectory=data=>Object.values(data.contacts).filter(c=>c.manual);

export function addManualContact(data,directory,input,now=new Date().toISOString()){
  const name=field(input.name,'name',120,true),company=field(input.company,'company',160,true);
  const role=field(input.role,'role',160),notes=field(input.notes,'note',4000);
  // Adding to a company already in a campaign keeps its id, so the person shows on that company's card.
  const existing=field(input.company_id,'company',120);
  if(existing&&!/^[a-z0-9-]+(~[a-z0-9-]+)?$/.test(existing))throw new Error('Unknown company');
  const campaign=existing?campaignOf(existing):slug(field(input.campaign||'direct','campaign',60));
  const email=field(input.email,'email',200);
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Use a valid email address');
  let profile_url='';
  if(field(input.linkedin,'LinkedIn link',400)){try{profile_url=profileURL(input.linkedin.trim());}catch{throw new Error('Use a personal LinkedIn profile link');}}
  const everyone=[...directory,...manualDirectory(data)];
  if(profile_url&&everyone.some(c=>c.profile_url&&profileURL(c.profile_url)===profile_url))throw new Error(`${name} is already in the tracker`);
  if(everyone.some(c=>same(c.name,name)&&same(c.company||c.company_id,company)))throw new Error(`${name} at ${company} is already in the tracker`);
  const context={source:'',source_url:'',reason:'',next_step:'',thread:'',...contextFrom(input)};
  const draft=field(input.draft,'draft',12000),next_follow_up=field(input.next_follow_up,'follow-up date',10);
  if(next_follow_up&&!/^\d{4}-\d{2}-\d{2}$/.test(next_follow_up))throw new Error('Use a follow-up date like 2026-10-27');
  const key='manual|'+uuidv7(new Date(now).getTime());
  const contact={key,manual:true,company_id:existing||campaign+'~'+slug(company),campaign,name,company,role,email,profile_url,
    connection:'unknown',connection_checked_at:null,connection_evidence:'',connected_observed_at:null,
    stage:null,draft,next_follow_up,notes,...context,events:[],revision:1,created_at:now,updated_at:now};
  data.contacts[key]=contact;return contact;
}

const STAGE_EVENTS=[[/^(a|initiated|initiate|contacted|dm sent|messaged|first touch)$/,'dm_sent'],[/^(ms|seen|media seen|microsite seen)$/,'page_viewed'],
  [/^(b|replied|engaged|reply)$/,'reply_received'],[/^(c|call link sent|calendly'?d|call link)$/,'call_link_sent'],[/^(d|booked|call booked)$/,'call_booked']];
const PARKED={'not now':'not_now','do not contact':'do_not_contact'};
function stageDate(value){
  if(!value)return null;
  const uk=value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/),iso=value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const [y,m,d]=uk?[uk[3],uk[2],uk[1]]:iso?[iso[1],iso[2],iso[3]]:[];
  const at=y&&new Date(Date.UTC(+y,+m-1,+d,12));
  if(!at||at.getUTCDate()!==+d)throw new Error('Use a date like 2026-10-18 or 18/10/2026');
  return at.toISOString();
}
export function importCSV(data,directory,csv,now=new Date().toISOString()){
  const result={added:0,skipped:[]};
  parseCSV(csv).forEach((row,i)=>{
    try{
      const stage=(row.stage||'').toLowerCase().trim(),kind=STAGE_EVENTS.find(([re])=>re.test(stage))?.[1];
      if(stage&&!kind&&!PARKED[stage])throw new Error(`Unknown stage “${row.stage}”`);
      const at=stageDate(row.date);
      const contact=addManualContact(data,directory,row,now);
      if(kind){
        contact.events.push({id:'import-'+uuidv7(),kind,body:'Imported from CSV.',at:at||now,time_basis:at?'actual':'observed',recorded_at:now});
        contact.stage=kind==='call_booked'?'call_booked':kind==='dm_sent'?'awaiting_reply':kind==='page_viewed'?null:'replied';
        if(kind==='call_booked')contact.booked_at=at||now;
      }else if(PARKED[stage])contact.stage=PARKED[stage];
      result.added++;
    }catch(error){result.skipped.push({row:i+2,name:row.name||'',reason:error.message});}
  });
  return result;
}
