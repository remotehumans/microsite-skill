// ABOUTME: Tests the gallery server against a made-up workspace: campaign discovery, built pages, page checks, documents and request safety.
// ABOUTME: Builds the workspace in a temp folder, so no real campaign or tracker file is read or written.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createServer, within, gallery} from './server.mjs';
import {discoverCampaigns} from './config.mjs';

function workspace(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'gallery-server-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const write=(name,data)=>{const f=path.join(root,name);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof data==='string'?data:JSON.stringify(data));};
  write('accountants/data/campaign.json',{name:'UK accountants',mode:'many'});
  write('accountants/data/prospects.json',[
    {id:'ashby',name:'Ashby & Rowe',research:'microsites/ashby/research/research.json',sources:['https://example.com/about']},
    {id:'brook',name:'Brook Partners',research:'microsites/brook/research/research.json'}]);
  write('accountants/microsites/ashby/research/research.json',{company:'Ashby & Rowe'});
  write('accountants/microsites/brook/research/research.json',{company:'Brook Partners'});
  write('accountants/microsites/ashby/build/ashby.html','<html><head><meta name="robots" content="noindex"><title>Ashby</title></head><body>Prepared for Ashby & Rowe</body></html>');
  write('accountants/microsites/ashby/design/fidelity.json',{threshold:80,desktop:{score:91},phone:{score:86}});
  write('notes/README.md','not a campaign');
  return root;
}

test('campaigns are discovered from data/campaign.json folders only',t=>{
  const root=workspace(t),found=discoverCampaigns(root);
  assert.deepEqual(found.map(c=>[c.id,c.name,c.mode]),[['accountants','UK accountants','many']]);
  assert.throws(()=>within(found[0].source,'../notes/README.md'));
  assert.throws(()=>within(found[0].source,'/etc/passwd'));
});
test('gallery exposes built pages with the skill checks and keeps research-only companies',t=>{
  const d=gallery(discoverCampaigns(workspace(t)));
  const ashby=d.rows.find(r=>r.source_id==='ashby'),brook=d.rows.find(r=>r.source_id==='brook');
  assert.equal(ashby.id,'accountants~ashby');assert.equal(ashby.page,'microsites/ashby/build/ashby.html');
  assert.deepEqual([ashby.checks.ready,ashby.checks.fidelity.desktop],[true,91]);
  assert.equal(brook.page,null);assert.equal(brook.checks.ready,false);
});
test('a page rebuilt after its fidelity score needs scoring again',t=>{
  const root=workspace(t),page=path.join(root,'accountants/microsites/ashby/build/ashby.html');
  const later=new Date(Date.now()+60000);fs.utimesSync(page,later,later);
  const ashby=gallery(discoverCampaigns(root)).rows.find(r=>r.source_id==='ashby');
  assert.equal(ashby.checks.ready,false);assert.match(ashby.checks.problem,/fidelity/);
});
test('local server serves pages and documents; rejects traversal, writes and foreign hosts',async t=>{
  const root=workspace(t),definitions=discoverCampaigns(root);
  const server=createServer({definitions,trackerFile:path.join(root,'.gallery/tracker.json')});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  try {
    assert.equal((await fetch(base)).status,200);
    const d=await (await fetch(base+'/api/gallery')).json(),r=d.rows.find(r=>r.page);
    assert.equal((await fetch(base+r.asset_base+r.page)).status,200);
    const doc=await fetch(base+'/api/document?collection=accountants&path='+encodeURIComponent(r.research));
    assert.equal(doc.status,200);assert.match((await doc.json()).text,/Ashby/);
    assert.equal((await fetch(base+'/api/document?collection=accountants&path=../notes/README.md')).status,404);
    assert.equal((await fetch(base+'/collections/accountants/%2e%2e%2fnotes/README.md')).status,404);
    assert.equal((await fetch(base+'/api/gallery',{method:'POST'})).status,405);
    const foreign=await new Promise((resolve,reject)=>{
      const req=http.get(base+'/api/gallery',{headers:{Host:'example.com'},timeout:5000,agent:false},res=>{res.resume();resolve(res.statusCode);});
      req.on('error',reject);req.on('timeout',()=>req.destroy(new Error('Host test timed out')));
    });
    assert.equal(foreign,403);
  } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
