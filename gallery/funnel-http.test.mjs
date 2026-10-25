// ABOUTME: Tests the funnel endpoint's per-campaign totals from saved tracker state.
// ABOUTME: Uses a temporary tracker file, so no real data or network is touched.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createServer} from './server.mjs';
import {initialContact,readTracker,writeTracker} from './contact-tracker.mjs';

const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve('http://127.0.0.1:'+server.address().port)));
const close=server=>new Promise(resolve=>server.close(resolve));

test('funnel endpoint reports per-campaign totals from saved tracker state',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'funnel-api-'));const file=path.join(dir,'tracker.json');
  const a=initialContact('acme',{name:'Alice Smith',linkedin:'https://www.linkedin.com/in/alice-smith',connection_status:'sent'});
  const b=initialContact('wellness~yoga',{name:'Bea Jones',linkedin:'https://www.linkedin.com/in/bea-jones',connection_status:'connected'});
  writeTracker(file,{version:1,monitor:{},contacts:{[a.key]:{...a,connection_checked_at:'2026-10-18T10:00:00Z'}},page_views:{acme:{count:3,last_at:'2026-10-18T11:00:00Z',ids:[]}}});
  const server=createServer({trackerFile:file,directory:()=>[a,b],definitions:[{id:'direct',name:'Direct'},{id:'wellness',name:'Wellness'}]});
  const base=await listen(server);
  try{
    const r=await (await fetch(base+'/api/funnel')).json();
    assert.equal(r.campaigns.find(c=>c.id==='direct').name,'Direct');
    assert.equal(r.campaigns.find(c=>c.id==='direct').totals.A,1);
    assert.equal(r.campaigns.find(c=>c.id==='wellness').totals.A,0);
    assert.deepEqual(r.page_views,{acme:{count:3,last_at:'2026-10-18T11:00:00Z'}});
    const alice=r.people.find(p=>p.name==='Alice Smith');
    assert.deepEqual({campaign:alice.campaign,reached:alice.reached},{campaign:'direct',reached:'A'});
    assert.equal(r.people.find(p=>p.name==='Bea Jones').reached,null);
    assert.equal(alice.events,undefined);
  }finally{await close(server);fs.rmSync(dir,{recursive:true,force:true});}
});
