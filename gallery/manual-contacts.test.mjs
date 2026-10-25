// ABOUTME: Tests contacts added by hand or by CSV: validation, duplicate checks, campaign keys and imported stage history.
// ABOUTME: Works on in-memory tracker data only, so the real contact tracker is never touched.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCSV,addManualContact,importCSV,manualDirectory,uuidv7} from './manual-contacts.mjs';
import {funnelMarks} from './funnel.mjs';

const state=()=>({version:1,contacts:{},monitor:{}});

test('uuidv7 ids are version 7 and sort by creation time',()=>{
  const a=uuidv7(1000),b=uuidv7(2000);
  assert.match(a,/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.ok(a<b);
});
test('CSV parsing handles quotes, commas, escaped quotes and blank lines',()=>{
  const rows=parseCSV('Name,Company,Notes\r\n"Smith, Alice",Acme,"Said ""yes"""\n\nBob,Beta,\n');
  assert.deepEqual(rows,[{name:'Smith, Alice',company:'Acme',notes:'Said "yes"'},{name:'Bob',company:'Beta',notes:''}]);
});
test('a hand-added contact gets a campaign-scoped company, a tracker record and shows in the directory',()=>{
  const data=state();
  const c=addManualContact(data,[],{name:'Alice Smith',company:'Acme Ltd',role:'MD',linkedin:'https://uk.linkedin.com/in/Alice-S/',email:'alice@acme.com',campaign:'Events'},'2026-10-18T10:00:00.000Z');
  assert.equal(c.company_id,'events~acme-ltd');
  assert.equal(c.profile_url,'https://www.linkedin.com/in/alice-s');
  assert.equal(c.campaign,'events');
  assert.equal(data.contacts[c.key].name,'Alice Smith');
  assert.deepEqual(manualDirectory(data).map(x=>x.key),[c.key]);
  assert.equal(funnelMarks(data.contacts[c.key]).A,null);
});
test('bad input and duplicates are refused',()=>{
  const data=state(),directory=[{key:'x',company_id:'sme~acme',name:'Alice Smith',company:'Acme',profile_url:'https://www.linkedin.com/in/alice-s'}];
  assert.throws(()=>addManualContact(data,[],{name:'',company:'Acme',campaign:'events'}),/name/);
  assert.throws(()=>addManualContact(data,[],{name:'A',company:'Acme',campaign:'events',email:'nope'}),/email/);
  assert.throws(()=>addManualContact(data,[],{name:'A',company:'Acme',campaign:'events',linkedin:'https://evil.test/in/a'}),/LinkedIn/);
  assert.throws(()=>addManualContact(data,directory,{name:'Someone',company:'Other',campaign:'events',linkedin:'https://linkedin.com/in/alice-s'}),/already/);
  assert.throws(()=>addManualContact(data,directory,{name:'alice smith',company:'ACME',campaign:'events'}),/already/);
});
test('CSV import adds rows, reports skipped ones and replays stage history with dates',()=>{
  const data=state();
  const csv='name,company,campaign,stage,date,linkedin\nAlice Smith,Acme,warm,replied,2026-09-03,\nBob Jones,Beta,warm,call booked,2026-10-01,\n,NoName,warm,,,\nAlice Smith,Acme,warm,,,\nCara Lee,Gamma,warm,booked,not-a-date,\n';
  const r=importCSV(data,[],csv,'2026-10-18T10:00:00.000Z');
  assert.equal(r.added,2);
  assert.deepEqual(r.skipped.map(s=>s.row),[4,5,6]);
  const alice=Object.values(data.contacts).find(c=>c.name==='Alice Smith'),bob=Object.values(data.contacts).find(c=>c.name==='Bob Jones');
  assert.equal(funnelMarks(alice).B,'2026-09-03T12:00:00.000Z');
  assert.equal(funnelMarks(alice).A,'2026-09-03T12:00:00.000Z');
  assert.equal(alice.stage,'replied');
  assert.equal(bob.stage,'call_booked');assert.equal(funnelMarks(bob).D,'2026-10-01T12:00:00.000Z');
});
test('a person can be added to an existing campaign company and keeps that company and campaign',()=>{
  const data=state();
  const c=addManualContact(data,[],{name:'Gail Hart',company:'Grayson Lowe LLP',company_id:'grayson-lowe',role:'Partner'});
  assert.equal(c.company_id,'grayson-lowe');assert.equal(c.campaign,'direct');
  const w=addManualContact(data,[],{name:'Yan Li',company:'Yoga Co',company_id:'wellness~yoga-co'});
  assert.equal(w.campaign,'wellness');
  assert.throws(()=>addManualContact(data,[],{name:'X',company:'Y',company_id:'../bad id'}),/company/);
});
test('a contact keeps where they were found, why, the next step, the thread, a draft and a follow-up date',()=>{
  const data=state();
  const c=addManualContact(data,[],{name:'Kai Morgan',company:'Example Capital',campaign:'event-access',
    source:'Trade Expo About page',source_url:'https://events.example/about',reason:'Picks Trade Expo speakers. Pitch an AI session for 2027.',
    next_step:'Send speaking email',thread:'Event Access Thread',draft:'Hi Kai,',next_follow_up:'2026-10-27'});
  assert.equal(c.source,'Trade Expo About page');assert.equal(c.source_url,'https://events.example/about');
  assert.equal(c.reason,'Picks Trade Expo speakers. Pitch an AI session for 2027.');
  assert.equal(c.next_step,'Send speaking email');assert.equal(c.thread,'Event Access Thread');
  assert.equal(c.draft,'Hi Kai,');assert.equal(c.next_follow_up,'2026-10-27');
  assert.throws(()=>addManualContact(data,[],{name:'A',company:'B',source_url:'javascript:alert(1)'}),/source link/);
  assert.throws(()=>addManualContact(data,[],{name:'A',company:'B',next_follow_up:'27/10/2026'}),/follow-up/);
});
test('CSV import carries the context columns',()=>{
  const data=state();
  const csv='name,company,campaign,source,source_url,reason,next_step,thread,next_follow_up\nAnna Bell,Bell FO,family-office,Expo speakers page,https://familyoffice.example/,Coffee in event week,Send T1,Family office outreach,2026-10-27\n';
  assert.equal(importCSV(data,[],csv).added,1);
  const a=Object.values(data.contacts)[0];
  assert.deepEqual([a.source,a.source_url,a.reason,a.next_step,a.thread,a.next_follow_up],['Expo speakers page','https://familyoffice.example/','Coffee in event week','Send T1','Family office outreach','2026-10-27']);
});
