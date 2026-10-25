import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {gallery,createServer,contactDirectory} from './server.mjs';

test('collections isolate duplicate IDs, assets, research, cards and contact keys',async()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gallery-collections-'));
  const definitions=['sme','wellness'].map(id=>({id,name:id,source:path.join(tmp,id),gallery:path.join(tmp,id,'gallery'),thread:'codex://threads/'+id}));
  const write=(root,name,data)=>{const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,typeof data==='string'?data:JSON.stringify(data));};
  for(const c of definitions){
    write(c.source,'data/prospects.json',[{id:'shared',name:c.name,group:c.id==='wellness'?'H':'A',research:'research/profile.json',buyer:[{name:'Alex Smith',title:'Founder'}],verified_complete:false}]);
    write(c.source,'data/campaign.json',{counts:{built:1,verified_complete:0},last_updated_utc:'2026-10-18T12:00:00Z'});
    write(c.source,'microsites/shared/build/shared.html',`<h1>${c.id}</h1><img src="asset.svg">`);
    write(c.source,'microsites/shared/build/asset.svg',`<svg xmlns="http://www.w3.org/2000/svg"><text>${c.id}</text></svg>`);
    write(c.source,'research/profile.json',{collection:c.id});
    write(c.gallery,'outreach-cards.json',{shared:{chip:c.id,opportunity:'More repeat bookings'}});
    write(c.gallery,'contact-profile-overrides.json',{'Alex Smith':{url:'https://www.linkedin.com/in/alex-smith'}});
  }
  const server=createServer({definitions,trackerFile:path.join(tmp,'tracker.json')});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  try{
    const data=gallery(definitions);
    assert.deepEqual(data.rows.map(r=>r.id),['sme~shared','wellness~shared']);
    assert.deepEqual(data.rows.map(r=>r.card.chip),['sme','wellness']);
    assert.equal(data.campaign.counts.built,2);
    assert.equal(data.rows[1].verified_complete,false);
    assert.notEqual(data.rows[0].contacts.people[0].tracker.key,data.rows[1].contacts.people[0].tracker.key);
    assert.deepEqual(contactDirectory(definitions).map(p=>p.company_id),['sme~shared','wellness~shared']);
    for(const r of data.rows){
      const page=await fetch(base+r.asset_base+r.page);assert.equal(page.status,200);assert.match(await page.text(),new RegExp(r.collection_id));
      const asset=await fetch(new URL('asset.svg',base+r.asset_base+r.page));assert.equal(asset.status,200);assert.match(await asset.text(),new RegExp(r.collection_id));
      const doc=await (await fetch(base+'/api/document?collection='+r.collection_id+'&path=research/profile.json')).json();
      assert.equal(JSON.parse(doc.text).collection,r.collection_id);
    }
    for(const route of ['/api/document?collection=unknown&path=research/profile.json','/collections/unknown/research/profile.json','/collections/wellness/%2e%2e%2fdata/prospects.json','/api/document?collection=wellness&path=../sme/research/profile.json'])assert.equal((await fetch(base+route)).status,404);
    // A missing campaign must not take the other collection offline, and the failure is logged.
    fs.unlinkSync(path.join(definitions[1].source,'data/campaign.json'));
    const logged=[],original=console.error;console.error=(...a)=>logged.push(a.join(' '));
    let partial;try{partial=gallery(definitions);assert.equal((await fetch(base+'/api/gallery')).status,200);}finally{console.error=original;}
    assert.ok(logged.some(l=>/Gallery collection wellness unavailable/.test(l)));
    assert.equal(partial.rows.length,1);assert.ok(partial.collections[1].error);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(tmp,{recursive:true,force:true});}
});
