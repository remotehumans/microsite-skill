// ABOUTME: Tests the A/MS/B/C/D outreach funnel: stage dates per contact, campaign grouping and conversion maths.
// ABOUTME: Uses in-memory tracker records only, so the real contact tracker is never read or written.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {campaignOf,funnelMarks,funnelReport,FUNNEL} from './funnel.mjs';

const ev=(kind,at,id=kind+at)=>({id,kind,body:'x',at,time_basis:'actual',recorded_at:at});
const contact=(company_id,extra={})=>({company_id,connection:'unknown',connection_checked_at:null,stage:null,events:[],...extra});

test('campaign comes from the collection prefix, with SME as the unprefixed default',()=>{
  assert.equal(campaignOf('acme'),'direct');
  assert.equal(campaignOf('wellness~yoga-studio'),'wellness');
});
test('each stage takes its earliest dated evidence and later stages imply initiation',()=>{
  const c=contact('acme',{events:[ev('reply_received','2026-10-05T09:00:00Z'),ev('reply_received','2026-10-03T09:00:00Z'),ev('page_viewed','2026-10-02T09:00:00Z'),ev('call_link_sent','2026-10-06T09:00:00Z'),ev('call_booked','2026-11-01T09:00:00Z')]});
  const m=funnelMarks(c);
  assert.equal(m.A,'2026-10-02T09:00:00Z');
  assert.equal(m.MS,'2026-10-02T09:00:00Z');
  assert.equal(m.B,'2026-10-03T09:00:00Z');
  assert.equal(m.C,'2026-10-06T09:00:00Z');
  assert.equal(m.D,'2026-11-01T09:00:00Z');
});
test('a pending request counts as initiated, an unconfirmed contact does not',()=>{
  assert.equal(funnelMarks(contact('acme',{connection:'pending',connection_checked_at:'2026-10-18T10:00:00Z'})).A,'2026-10-18T10:00:00Z');
  assert.deepEqual(funnelMarks(contact('acme',{connection_checked_at:'2026-10-18T10:00:00Z'})),{A:null,MS:null,B:null,C:null,D:null});
});
test('a booked stage without a booking event uses the saved booking date',()=>{
  const m=funnelMarks(contact('acme',{stage:'call_booked',booked_at:'2026-10-09T10:00:00Z'}));
  assert.equal(m.D,'2026-10-09T10:00:00Z');assert.equal(m.A,'2026-10-09T10:00:00Z');
});
test('the report groups by campaign and London month, and empty denominators give null not an error',()=>{
  const contacts=[
    contact('acme',{connection:'pending',connection_checked_at:'2026-10-01T10:00:00Z'}),
    contact('beta',{connection:'connected',connection_checked_at:'2026-10-02T10:00:00Z',events:[ev('page_viewed','2026-10-03T10:00:00Z'),ev('reply_received','2026-10-04T10:00:00Z')]}),
    contact('wellness~yoga',{connection:'pending',connection_checked_at:'2026-09-30T23:30:00Z'})
  ];
  const r=funnelReport(contacts);
  assert.deepEqual(FUNNEL.map(s=>s.id),['A','MS','B','C','D']);
  assert.deepEqual(r.campaigns.map(c=>c.id).sort(),['direct','wellness']);
  const sme=r.campaigns.find(c=>c.id==='direct');
  assert.deepEqual(sme.totals,{A:2,MS:1,B:1,C:0,D:0});
  assert.equal(sme.overall.B,0.5);assert.equal(sme.step.B,1);assert.equal(sme.step.D,null);
  // 23:30 UTC on 30 September is 00:30 on 1 October in London.
  assert.deepEqual(r.campaigns.find(c=>c.id==='wellness').months.map(m=>m.month),['2026-10']);
  assert.deepEqual(r.all.totals,{A:3,MS:1,B:1,C:0,D:0});
  assert.deepEqual(r.months,['2026-10']);
});
