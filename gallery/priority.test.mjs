// ABOUTME: Tests the call-queue ranking: reach extraction, decision-maker detection, turnover parsing and point totals.
// ABOUTME: Uses small in-memory gallery rows only, so no campaign or tracker file is read.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {turnoverMillions,phonesIn,emailsIn,isDecisionMaker,priorityItem,priorityQueue,deadEnds} from './priority.mjs';

const row=(extra={})=>({id:'acme',source_id:'acme',collection_id:'sme',name:'Acme Ltd',sector:'Business services',status:'Verified private draft',
  page:'microsites/acme/build/acme.html',page_slug:'acme',score_total:20,score_out_of:25,financial_capacity:'',public_contact:{},
  contacts:{people:[]},card:null,outreach:null,...extra});
const person=(extra={})=>({name:'Ann Lee',role:'Managing Director',email:'',linkedin:'',tracker:null,...extra});

test('turnover reads £m and £bn figures and ignores text without one',()=>{
  assert.equal(turnoverMillions('FY May 2025 group turnover £19.63m and operating profit £4.27m.'),19.63);
  assert.equal(turnoverMillions('Revenue £1.2bn'),1200);
  assert.equal(turnoverMillions('Plausible capacity for a £1,950+ discovery fee.'),0);
  assert.equal(turnoverMillions(undefined),0);
});
test('phones and emails are found anywhere in the public contact record',()=>{
  const pc={alternative:'hello@harbourline.example /01372708090',phone:'+44 (0)20 7388 2444',public_business_email:'pam@harbourline.example'};
  assert.deepEqual(phonesIn(pc),['01372708090','+44 (0)20 7388 2444']);
  assert.deepEqual(emailsIn(pc).sort(),['hello@harbourline.example','pam@harbourline.example']);
});
test('owners, founders, MDs and CEOs count as decision makers; analysts do not',()=>{
  for(const t of ['Managing Director','Co-founder and CEO','Founder','Owner','Managing Partner','Chief Executive'])assert.ok(isDecisionMaker(t),t);
  for(const t of ['AI & Automation Analyst','Marketing Manager',''])assert.ok(!isDecisionMaker(t),t);
});
test('a connected MD with a direct email outranks an unreachable firm with a higher research score',()=>{
  const warm=priorityItem(row({id:'warm',score_total:18,contacts:{people:[person({email:'ann@acme.co.uk',linkedin:'https://www.linkedin.com/in/ann',tracker:{connection:'connected',events:[]}})]}}));
  const cold=priorityItem(row({id:'cold',score_total:25}));
  assert.ok(warm.points>cold.points);
  assert.ok(warm.reasons.some(r=>r.label==='Connected on LinkedIn'));
  assert.equal(cold.reach.length,0);
});
test('every point is explained and the total equals the sum of the reasons',()=>{
  const item=priorityItem(row({financial_capacity:'Turnover £28m',public_contact:{phone:'01555 662886'},contacts:{people:[person({email:'ann@acme.co.uk'})]}}));
  assert.equal(item.points,item.reasons.reduce((n,r)=>n+r.points,0));
  assert.equal(item.turnover,28);
  assert.equal(item.person.name,'Ann Lee');
});
test('a recorded microsite view or reply lifts a firm, and replies count most',()=>{
  const base=priorityItem(row()).points;
  const viewed=priorityItem(row({contacts:{people:[person({tracker:{connection:'pending',events:[{kind:'page_viewed',at:'2026-10-19T09:00:00Z'}]}})]}})).points;
  const replied=priorityItem(row({contacts:{people:[person({tracker:{connection:'connected',events:[{kind:'reply_received',at:'2026-10-19T09:00:00Z'}]}})]}})).points;
  assert.ok(viewed>base);assert.ok(replied>viewed);
});
test('the queue drops parked, on-hold and unbuilt firms, then sorts by points',()=>{
  const rows=[row({id:'a',score_total:10}),row({id:'b',score_total:24}),row({id:'held',status:'On hold'}),row({id:'skip',outreach:{status:'skip'}}),row({id:'nopage',page:null})];
  assert.deepEqual(priorityQueue(rows).map(i=>i.id),['b','a']);
});
test('the card contact becomes the person to call when research names them',()=>{
  const r=row({card:{contact_name:'Bo Diaz',opener:'Hi Bo, {link}'},contacts:{people:[person(),person({name:'Bo Diaz',role:'Founder'})]}});
  const item=priorityItem(r);
  assert.equal(item.person.name,'Bo Diaz');
  assert.equal(item.opener,'Hi Bo, {link}');
});
test('dead ends are firms with no named person or no way to reach them',()=>{
  const items=priorityQueue([row({id:'ok',contacts:{people:[person({email:'ann@acme.co.uk'})]}}),row({id:'noone'}),row({id:'noway',contacts:{people:[person()]}})]);
  assert.deepEqual(deadEnds(items).map(d=>d.id).sort(),['noone','noway']);
});
