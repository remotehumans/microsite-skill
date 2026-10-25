import {test} from 'node:test';
import assert from 'node:assert/strict';
import {profileURL,initialContact,changeContact,decorateContact,recordViews} from './contact-tracker.mjs';
const person={name:'Alice Smith',linkedin:'https://uk.linkedin.com/in/Alice-Smith/?tracking=1',connection_status:'sent'};
const seed=()=>initialContact('acme',person);
const state=()=>({version:1,contacts:{},monitor:{}});
const check=(connection,at='2026-10-18T12:00:00Z')=>({company_id:'acme',profile_url:person.linkedin,action:'check_connection',connection,checked_at:at,evidence:'Own Connections list, exact profile URL'});
test('profile identities ignore tracking and reject unrelated hosts',()=>{
  assert.equal(profileURL(person.linkedin),'https://www.linkedin.com/in/alice-smith');
  assert.throws(()=>profileURL('https://linkedin.com.evil.test/in/alice'));
  assert.throws(()=>profileURL('https://linkedin.com/company/acme'));
});
test('verified acceptance promotes to DM-ready and incomplete checks do not undo it',()=>{
  const data=state();let saved=changeContact([seed()],data,check('connected'));
  assert.equal(saved.stage,'ready_to_dm');
  saved=changeContact([seed()],data,check('unknown','2026-10-19T12:00:00Z'));
  assert.equal(saved.connection,'connected');assert.equal(saved.connected_observed_at,'2026-10-18T12:00:00.000Z');
  assert.equal(decorateContact('acme',person,data).tracker.connection,'connected');
});
test('unknown and stale observations cannot create acceptance or overwrite fresh checks',()=>{
  const data=state();let saved=changeContact([seed()],data,check('unknown'));
  assert.equal(saved.connection,'pending');assert.equal(saved.stage,null);
  saved=changeContact([seed()],data,check('connected','2026-10-17T12:00:00Z'));
  assert.equal(saved.connection,'pending');
  assert.throws(()=>changeContact([seed()],data,{...check('connected'),company_id:'other'}),/Unknown/);
  assert.throws(()=>changeContact([seed()],data,{...check('connected'),evidence:''}),/evidence/);
});
test('sent messages and replies retain exact text and deduplicate retries',()=>{
  const data=state(),entry={company_id:'acme',profile_url:person.linkedin,action:'add_event',event:{id:'event-1',kind:'dm_sent',body:'Hi Alice. May I send the page?',at:'2026-10-18T12:00:00Z'}};
  let saved=changeContact([seed()],data,entry);assert.equal(saved.stage,'awaiting_reply');
  saved=changeContact([seed()],data,entry);assert.equal(saved.events.length,1);
  saved=changeContact([seed()],data,{...entry,event:{...entry.event,id:'reply-1',kind:'reply_received',body:'Yes, please.'}});
  assert.equal(saved.stage,'replied');assert.equal(saved.events[0].body,entry.event.body);
});
test('stale edits cannot overwrite a draft saved on another device',()=>{
  const data=state();changeContact([seed()],data,{company_id:'acme',profile_url:person.linkedin,action:'save',revision:0,draft:'First draft'});
  assert.throws(()=>changeContact([seed()],data,{company_id:'acme',profile_url:person.linkedin,action:'save',revision:0,draft:'Stale draft'}),/changed/);
  assert.equal(Object.values(data.contacts)[0].draft,'First draft');
  assert.throws(()=>changeContact([seed()],data,{company_id:'acme',profile_url:person.linkedin,action:'save',revision:1,stage:'ready_to_dm'}),/Confirm/);
});
test('monitoring a reply does not reopen a do-not-contact decision',()=>{
  const data=state();
  changeContact([seed()],data,{company_id:'acme',profile_url:person.linkedin,action:'save',revision:0,stage:'do_not_contact'});
  const saved=changeContact([seed()],data,{company_id:'acme',profile_url:person.linkedin,action:'add_event',event:{id:'late-reply',kind:'reply_received',body:'Thanks.',time_basis:'observed'}});
  assert.equal(saved.stage,'do_not_contact');assert.equal(saved.events[0].time_basis,'observed');
});
test('importing an older sent DM preserves a later reply and the working draft',()=>{
  const data=state(),base={company_id:'acme',profile_url:person.linkedin};
  changeContact([seed()],data,{...base,action:'save',revision:0,draft:'My next reply'});
  changeContact([seed()],data,{...base,action:'add_event',event:{id:'new-reply',kind:'reply_received',body:'Tell me more.',at:'2026-10-18T12:00:00Z'}});
  const saved=changeContact([seed()],data,{...base,action:'add_event',event:{id:'old-dm',kind:'dm_sent',body:'May I send it?',at:'2026-10-17T12:00:00Z'}});
  assert.equal(saved.stage,'replied');assert.equal(saved.draft,'My next reply');
});
test('contacts carry their campaign and booking a call records the stage and date',()=>{
  const data=state(),base={company_id:'acme',profile_url:person.linkedin};
  assert.equal(seed().campaign,'direct');
  assert.equal(initialContact('wellness~yoga',person).campaign,'wellness');
  let saved=changeContact([seed()],data,{...base,action:'add_event',event:{id:'link-1',kind:'call_link_sent',body:'Sent my booking link.',at:'2026-10-18T12:00:00Z'}});
  assert.equal(saved.events[0].kind,'call_link_sent');
  saved=changeContact([seed()],data,{...base,action:'add_event',event:{id:'booked-1',kind:'call_booked',body:'Tuesday 10am.',at:'2026-10-19T09:00:00Z'}});
  assert.equal(saved.stage,'call_booked');assert.equal(saved.booked_at,'2026-10-19T09:00:00.000Z');
  const other=state();
  saved=changeContact([seed()],other,{...base,action:'save',revision:0,stage:'call_booked'},'2026-10-20T08:00:00.000Z');
  assert.equal(saved.booked_at,'2026-10-20T08:00:00.000Z');
  assert.throws(()=>changeContact([seed()],data,{...base,action:'add_event',event:{id:'v',kind:'page_viewed',body:'x'}}),/Unknown activity/);
});
test('a view reference is issued once and imported views attach to that person only once',()=>{
  const data=state(),base={company_id:'acme',profile_url:person.linkedin};
  const ref=changeContact([seed()],data,{...base,action:'issue_ref'}).view_ref;
  assert.match(ref,/^[a-z0-9]{12}$/);
  assert.equal(changeContact([seed()],data,{...base,action:'issue_ref'}).view_ref,ref);
  const views=[{id:'view-1',slug:'acme',ref,viewed_at:'2026-10-18T13:00:00Z'},{id:'view-2',slug:'acme',ref:null,viewed_at:'2026-10-18T14:00:00Z'},{id:'view-3',slug:'acme',ref:'unknownref123',viewed_at:'2026-10-18T15:00:00Z'}];
  assert.deepEqual(recordViews(data,views),{attributed:1,unattributed:2});
  recordViews(data,views);
  const saved=Object.values(data.contacts)[0];
  assert.equal(saved.events.filter(e=>e.kind==='page_viewed').length,1);
  assert.equal(saved.stage,null);
  assert.deepEqual(data.page_views.acme,{count:2,last_at:'2026-10-18T15:00:00Z',ids:['view-2','view-3']});
});
test('saving updates the why, next step and where-found context',()=>{
  const data=state();
  const saved=changeContact([seed()],data,{company_id:'acme',profile_url:person.linkedin,action:'save',revision:0,reason:'Met at Trade Expo',next_step:'Send coffee email',source:'Trade Expo speakers page'});
  assert.equal(saved.reason,'Met at Trade Expo');assert.equal(saved.next_step,'Send coffee email');assert.equal(saved.source,'Trade Expo speakers page');
});
test('a hand-added person can gain a LinkedIn profile later, campaign people cannot have theirs changed',()=>{
  const data=state(),manual={key:'manual|1',manual:true,company_id:'events~acme',name:'Ann Lee',profile_url:'',connection:'unknown',events:[],revision:1,draft:''};
  data.contacts[manual.key]=manual;
  const saved=changeContact([manual],data,{key:manual.key,action:'save',revision:1,profile_url:'https://uk.linkedin.com/in/Ann-Lee/'});
  assert.equal(saved.profile_url,'https://www.linkedin.com/in/ann-lee');
  assert.throws(()=>changeContact([manual],data,{key:manual.key,action:'save',revision:2,profile_url:'https://evil.test/in/x'}),/LinkedIn/);
  assert.throws(()=>changeContact([seed()],state(),{company_id:'acme',profile_url:person.linkedin,action:'save',revision:0,profile_url_change:true,profile_url:'https://www.linkedin.com/in/other'}),/Unknown|campaign/);
});
test('a hand-added person can have their company and role corrected',()=>{
  const data=state(),manual={key:'manual|2',manual:true,company_id:'warm~to-confirm',name:'Sam Ray',company:'To confirm',role:'',profile_url:'',connection:'unknown',events:[],revision:1,draft:''};
  data.contacts[manual.key]=manual;
  const saved=changeContact([manual],data,{key:manual.key,action:'save',revision:1,company:'Northwind Group',role:'Partner'});
  assert.equal(saved.company,'Northwind Group');assert.equal(saved.role,'Partner');assert.equal(saved.company_id,'warm~to-confirm');
  assert.throws(()=>changeContact([manual],data,{key:manual.key,action:'save',revision:2,company:''}),/company/);
});
