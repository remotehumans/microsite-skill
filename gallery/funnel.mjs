// ABOUTME: Maps saved contact tracker records onto the A/MS/B/C/D outreach funnel and builds campaign and monthly conversion stats.
// ABOUTME: Pure functions over tracker data; stage dates come only from recorded evidence, never from guesses.

export const FUNNEL=[
  {id:'A',label:'Initiated',rate:'Initiated'},
  {id:'MS',label:'Microsite seen',rate:'Seen rate'},
  {id:'B',label:'Replied',rate:'Reply rate'},
  {id:'C',label:'Call link sent',rate:'Call link rate'},
  {id:'D',label:'Call booked',rate:'Booking rate'}
];
const EVENT_STAGE={page_viewed:'MS',reply_received:'B',call_link_sent:'C',call_booked:'D'};
export const campaignOf=companyId=>companyId.includes('~')?companyId.split('~')[0]:'direct';
const earliest=values=>values.filter(Boolean).sort()[0]||null;
const londonMonth=at=>new Date(at).toLocaleDateString('en-CA').slice(0,7);

export function funnelMarks(contact){
  const events=contact.events||[];
  const first=kind=>earliest(events.filter(e=>e.kind===kind).map(e=>e.at));
  const marks={MS:first('page_viewed'),B:first('reply_received'),C:first('call_link_sent'),D:first('call_booked')};
  if(!marks.D&&contact.stage==='call_booked')marks.D=contact.booked_at||null;
  const requested=['pending','connected'].includes(contact.connection)?contact.connection_checked_at:null;
  // Reaching any later stage proves outreach began, so it also dates initiation when nothing earlier was recorded.
  marks.A=earliest([first('dm_sent'),requested,marks.MS,marks.B,marks.C,marks.D]);
  return {A:marks.A,MS:marks.MS,B:marks.B,C:marks.C,D:marks.D};
}
const zero=()=>Object.fromEntries(FUNNEL.map(s=>[s.id,0]));
const ratio=(n,d)=>d?n/d:null;
function summarise(totals){
  const ids=FUNNEL.map(s=>s.id);
  return {totals,
    overall:Object.fromEntries(ids.map(id=>[id,ratio(totals[id],totals.A)])),
    step:Object.fromEntries(ids.map((id,i)=>[id,i?ratio(totals[id],totals[ids[i-1]]):null]))};
}
function group(contacts){
  const totals=zero(),months={};
  for(const c of contacts){
    for(const [id,at] of Object.entries(funnelMarks(c))){
      if(!at)continue;
      totals[id]++;
      const m=londonMonth(at);(months[m]||=zero())[id]++;
    }
  }
  return {...summarise(totals),months:Object.keys(months).sort().map(month=>({month,...summarise(months[month])}))};
}
export function funnelReport(contacts,names={}){
  const byCampaign={};
  for(const c of contacts)(byCampaign[campaignOf(c.company_id)]||=[]).push(c);
  const campaigns=Object.entries(byCampaign).map(([id,list])=>({id,name:names[id]||id,contacts:list.length,...group(list)}));
  const all=group(contacts);
  return {stages:FUNNEL,campaigns,all,months:all.months.map(m=>m.month)};
}
// One row per person for the flow chart: the furthest stage they reached and its date, with no message text.
export function funnelPeople(contacts){
  return contacts.map(c=>{const marks=funnelMarks(c),reached=[...FUNNEL].reverse().find(s=>marks[s.id])?.id||null;
    return {name:c.name,company:c.company||c.company_id,campaign:campaignOf(c.company_id),reached,marks};});
}
