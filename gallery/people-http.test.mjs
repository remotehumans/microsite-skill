// ABOUTME: Tests the people API: adding a contact, importing CSV, listing everyone, and one-click stage changes by contact key.
// ABOUTME: Runs the gallery server against a temporary tracker file and a fixed campaign directory.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createServer} from './server.mjs';
import {initialContact} from './contact-tracker.mjs';

test('people can be added, imported, listed and moved through stages',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'people-api-'));const file=path.join(dir,'tracker.json');
  const campaignPerson={...initialContact('acme',{name:'Alice Smith',linkedin:'https://www.linkedin.com/in/alice-smith',connection_status:'sent'}),company:'Acme',role:'MD'};
  const server=createServer({trackerFile:file,directory:()=>[campaignPerson],definitions:[{id:'direct',name:'Direct'}]});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const post=(url,body)=>fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(body)});
  try{
    let res=await post('/api/contacts',{action:'add',name:'Dan Ray',company:'Delta',campaign:'events'});
    assert.equal(res.status,200);const dan=await res.json();
    assert.equal((await post('/api/contacts',{action:'add',name:'Alice Smith',company:'Acme',campaign:'events'})).status,400);
    res=await post('/api/contacts',{action:'import',csv:'name,company,stage,date\nEve Ng,Echo,replied,2026-10-02\n,Bad,,\n'});
    assert.deepEqual((await res.json()).added,1);
    const people=(await (await fetch(base+'/api/people')).json()).people;
    assert.deepEqual(people.map(p=>p.name).sort(),['Alice Smith','Dan Ray','Eve Ng']);
    assert.equal(people.find(p=>p.name==='Eve Ng').reached,'B');
    assert.equal(people.find(p=>p.name==='Alice Smith').campaign,'direct');
    const eve=people.find(p=>p.name==='Eve Ng');
    assert.equal(eve.events[0].kind,'reply_received');assert.equal(eve.draft,'');assert.equal(typeof eve.notes,'string');
    res=await post('/api/contact-tracker',{action:'add_event',key:dan.key,event:{id:'e1',kind:'dm_sent',body:'Logged from People table.'}});
    assert.equal(res.status,200);assert.equal((await res.json()).stage,'awaiting_reply');
    const funnel=await (await fetch(base+'/api/funnel')).json();
    assert.equal(funnel.campaigns.find(c=>c.id==='events').totals.A,1);
    res=await post('/api/contacts',{action:'add',name:'Fay Oh',company:'Foxtrot',campaign:'events',source:'Expo speakers page',source_url:'https://familyoffice.example/',reason:'Coffee in event week',next_step:'Send T1',thread:'Family office outreach'});
    assert.equal(res.status,200);
    const fay=(await (await fetch(base+'/api/people')).json()).people.find(p=>p.name==='Fay Oh');
    assert.deepEqual([fay.source,fay.source_url,fay.reason,fay.next_step,fay.thread],['Expo speakers page','https://familyoffice.example/','Coffee in event week','Send T1','Family office outreach']);
  }finally{await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true});}
});
