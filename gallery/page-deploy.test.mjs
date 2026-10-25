import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {reviewState,saveReview,deploymentQueue,handlePageReview,reviewStore} from './page-review.mjs';
import {createPublisher,publishPage} from './page-deploy.mjs';

process.env.MICROSITE_PROFILE='sample-studio';
const hash=b=>createHash('sha256').update(b).digest('hex');
const html='<html><head><meta name="robots" content="noindex,nofollow"><title>Example</title></head><body><h1>Example company</h1></body></html>';
function fixture(t,{stale=true,collection='direct'}={}){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'microsite-deploy-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const source=path.join(root,collection),gallery=path.join(root,'.gallery'),local=path.join(source,'gallery');
  fs.mkdirSync(path.join(source,'data'),{recursive:true});fs.mkdirSync(local,{recursive:true});fs.mkdirSync(gallery,{recursive:true});
  const page=path.join(source,'microsites/example/build/example.html');fs.mkdirSync(path.dirname(page),{recursive:true});fs.writeFileSync(page,html);
  fs.writeFileSync(path.join(source,'data/prospects.json'),JSON.stringify([{id:'example',name:'Example',page:'microsites/example/build/example.html'}]));
  // Checks pass only when fidelity was scored on this version of the page.
  if(!stale){fs.mkdirSync(path.join(source,'microsites/example/design'));fs.writeFileSync(path.join(source,'microsites/example/design/fidelity.json'),JSON.stringify({threshold:80,desktop:{score:92},phone:{score:88}}));}
  const definitions=[{id:collection,source,gallery:local}],file=path.join(gallery,'page-reviews.json'),id=collection+'~example';
  return {root,source,gallery,local,page,definitions,file,id};
}
const approve=async f=>{
  const s=reviewState(f.definitions,f.file,f.id);
  return saveReview(f.definitions,f.file,{id:f.id,decision:'approved_to_deploy',page_sha256:s.page_sha256,revision:s.revision,acknowledge_pending_checks:true});
};
const receipt=job=>({url:'https://northlight.example/for/'+job.slug,page_sha256:job.page_sha256,verification:{content:true,noindex:true,assets:true,sitemap_excluded:true}});

test('outdated checks inform the human without disabling Deploy',async t=>{
  const f=fixture(t),state=reviewState(f.definitions,f.file,f.id);
  assert.equal(state.stage,'checks_pending');assert.equal(state.can_approve,true);assert.match(state.warning,/not passed/);
  await assert.rejects(saveReview(f.definitions,f.file,{id:f.id,decision:'approved_to_deploy',page_sha256:state.page_sha256,revision:0}),/warning/);
  await approve(f);assert.equal(deploymentQueue(f.definitions,f.file)[0].deployable,true);
  assert.equal(fs.readFileSync(reviewStore(f.file).reviews[f.id].snapshot,'utf8'),html);
});
test('a page edit cannot reuse an old click or approval',async t=>{
  const f=fixture(t);await approve(f);fs.appendFileSync(f.page,'changed');
  assert.equal(reviewState(f.definitions,f.file,f.id).stage,'approval_expired');
  const publisher=createPublisher({...f,publish:()=>assert.fail('must not publish')});
  assert.throws(()=>publisher.start(f.id),/changed/);
});
test('one click starts one publication and saves a verified live link',async t=>{
  const f=fixture(t);await approve(f);let calls=0,finish;
  const publisher=createPublisher({...f,publish:async job=>{calls++;await new Promise(r=>finish=r);return receipt(job);}});
  publisher.start(f.id);publisher.start(f.id);assert.equal(calls,1);assert.equal(reviewState(f.definitions,f.file,f.id).stage,'deploying');
  finish();await publisher.idle();const state=reviewState(f.definitions,f.file,f.id);
  assert.equal(state.stage,'deployed');assert.equal(state.deployed_url,'https://northlight.example/for/example');
});
test('a failed deployment is visible and a fresh click retries it',async t=>{
  const f=fixture(t);await approve(f);let calls=0;
  const publisher=createPublisher({...f,publish:async job=>{if(++calls===1)throw new Error('Build failed. Retry deployment.');return receipt(job);}});
  publisher.start(f.id);await publisher.idle();assert.equal(reviewState(f.definitions,f.file,f.id).stage,'deployment_failed');
  await approve(f);publisher.start(f.id);await publisher.idle();assert.equal(calls,2);assert.equal(reviewState(f.definitions,f.file,f.id).stage,'deployed');
});
test('publication updates the campaign\'s own share record',async t=>{
  const f=fixture(t,{collection:'wellness'});await approve(f);
  const publisher=createPublisher({...f,publish:async job=>receipt(job)});publisher.start(f.id);await publisher.idle();
  const links=JSON.parse(fs.readFileSync(path.join(f.local,'share-links.json')));assert.equal(links.example.url,'https://northlight.example/for/example');
  assert.equal(reviewState(f.definitions,f.file,f.id).stage,'deployed');
});
test('a restart reports interrupted work and never publishes automatically',async t=>{
  const f=fixture(t);await approve(f);
  fs.writeFileSync(path.join(f.gallery,'.page-deployments.json'),JSON.stringify({jobs:{[f.id]:{id:f.id,page_sha256:hash(html),revision:1,status:'running'}}}));
  const publisher=createPublisher({...f,publish:()=>assert.fail('must not publish')});publisher.resume();await publisher.idle();
  assert.equal(reviewState(f.definitions,f.file,f.id).stage,'deployment_failed');
});
test('HTTP rejects foreign origins and starts deployment only after a valid click',async t=>{
  const f=fixture(t);let calls=0;
  const server=http.createServer((req,res)=>handlePageReview(req,res,{...f,deploy:()=>calls++}));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close();});
  const base='http://127.0.0.1:'+server.address().port;
  const body=JSON.stringify({id:f.id,decision:'approved_to_deploy',page_sha256:hash(html),revision:0,acknowledge_pending_checks:true});
  const post=origin=>fetch(base+'/api/page-reviews',{method:'POST',headers:{origin,'content-type':'application/json'},body});
  assert.equal((await post('https://foreign.example')).status,403);assert.equal(calls,0);
  assert.equal((await post(base)).status,200);assert.equal(calls,1);
  assert.equal((await post(base)).status,409);assert.equal(calls,1);
});
test('passed checks make a page ready for review',async t=>{
  const f=fixture(t,{stale:false}),state=reviewState(f.definitions,f.file,f.id);
  assert.equal(state.stage,'ready_for_review');assert.equal(state.warning,null);
});
test('publishing runs the skill deploy script and returns a receipt only when it reports the page live',async t=>{
  const f=fixture(t);await approve(f);const job={...reviewStore(f.file).reviews[f.id]},calls=[];
  const result=await publishPage(job,{command:async(c,args)=>{calls.push([c,args]);return 'LIVE https://northlight.example/for/example\nNot in sitemap\n';}});
  assert.equal(calls[0][0],'bash');assert.match(calls[0][1][0],/scripts\/deploy_private\.sh$/);assert.deepEqual(calls[0][1].slice(1,3),['example',job.snapshot]);
  assert.equal(result.url,'https://northlight.example/for/example');assert.equal(result.verification.sitemap_excluded,true);
  await assert.rejects(publishPage(job,{command:async()=>'Not live yet'}),/not verified live/);
});
test('pages with local assets are refused before publishing',async t=>{
  const f=fixture(t);fs.writeFileSync(f.page,html.replace('</body>','<img src="photo.jpg"></body>'));await approve(f);
  await assert.rejects(publishPage(reviewStore(f.file).reviews[f.id],{command:async()=>assert.fail('must not publish')}),/local assets/);
});
test('the same live version can be deployed again after a fresh click',async t=>{
  const f=fixture(t);let calls=0;const publisher=createPublisher({...f,publish:async job=>{calls++;return receipt(job);}});
  await approve(f);publisher.start(f.id);await publisher.idle();
  await approve(f);publisher.start(f.id);await publisher.idle();assert.equal(calls,2);
});
