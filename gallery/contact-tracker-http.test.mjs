import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createServer} from './server.mjs';
import {initialContact} from './contact-tracker.mjs';
test('tracker API persists observations and messages, rejects cross-origin edits and unknown people',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'microsite-tracker-'));
  const person=initialContact('acme',{name:'Alice Smith',linkedin:'https://www.linkedin.com/in/alice-smith',connection_status:'sent'});
  const server=createServer({trackerFile:path.join(dir,'tracker.json'),directory:()=>[person]});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const update=(body,origin=base)=>fetch(base+'/api/contact-tracker',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
  const check={action:'check_connection',company_id:'acme',profile_url:person.profile_url,connection:'connected',checked_at:'2026-10-18T12:00:00Z',evidence:'Exact URL in own Connections'};
  try{
    assert.equal((await update(check,'https://unrelated.example')).status,403);
    assert.equal((await update({...check,company_id:'unknown'})).status,400);
    assert.equal((await update(check)).status,200);
    const result=await (await fetch(base+'/api/contact-tracker')).json();
    assert.equal(result.contacts[0].stage,'ready_to_dm');
    const draft=await update({action:'save',company_id:'acme',profile_url:person.profile_url,revision:1,draft:'Thanks for connecting.'});
    assert.equal(draft.status,200);
    assert.equal((await update({action:'save',company_id:'acme',profile_url:person.profile_url,revision:1,draft:'Stale text'})).status,409);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'tracker.json'))).contacts[person.key].draft,'Thanks for connecting.');
  }finally{await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true});}
});
test('the monitor list includes hand-added people so their LinkedIn connections are checked too',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'microsite-tracker-'));
  const server=createServer({trackerFile:path.join(dir,'tracker.json'),directory:()=>[]});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const post=(url,body)=>fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(body)});
  try{
    const added=await (await post('/api/contacts',{action:'add',name:'Gina Hall',company:'Hall Family Office',campaign:'family-office',linkedin:'https://www.linkedin.com/in/gina-hall'})).json();
    const listed=(await (await fetch(base+'/api/contact-tracker')).json()).contacts;
    assert.deepEqual(listed.map(c=>c.key),[added.key]);
    const res=await post('/api/contact-tracker',{action:'check_connection',company_id:added.company_id,profile_url:'https://www.linkedin.com/in/gina-hall',connection:'connected',checked_at:'2026-10-22T18:00:00Z',evidence:'Exact URL in own Connections'});
    assert.equal(res.status,200);assert.equal((await res.json()).connection,'connected');
  }finally{await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true});}
});
