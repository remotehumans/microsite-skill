import {pageChecks} from './checks.mjs';
// Human publication decisions. Campaign/agent verdicts never grant consent.
import fs from 'node:fs';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {publicURL} from './config.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const decisions = new Set(['unreviewed','changes_requested','approved_to_deploy']);
const json = file => JSON.parse(fs.readFileSync(file,'utf8'));
function failure(message,status=400){return Object.assign(new Error(message),{status});}
function inside(root,relative){
  const base=fs.realpathSync(root), target=fs.realpathSync(path.resolve(base,relative));
  if(!target.startsWith(base+path.sep)||!fs.statSync(target).isFile())throw failure('Page is outside its campaign.');
  return target;
}
export function campaignRows(c){
  return json(path.join(c.source,'data/prospects.json'));
}
export function campaignCards(c,saved={}){
  const file=path.join(c.source,'data/outreach-card-copy.json');
  if(!fs.existsSync(file))return saved;
  return {...saved,...Object.fromEntries(json(file).cards.map(r=>[r.slug,{...saved[r.slug],chip:r.signal_chip,what:r.what_they_do,
    pay:r.can_they_pay.text,why_now:r.why_now.text,why_now_url:r.why_now.sources?.[0]?.url,
    opportunity:r.opportunity,contact_why:r.who_to_contact.text,contact_routes:r.who_to_contact,
    opener:r.opening_line_draft,origin:'Saved campaign card; not a new draft.'}]))};
}
function pageFor(definitions,id){
  for(const c of definitions){
    const rows=campaignRows(c);
    const row=rows.find(r=>c.id+'~'+r.id===id);
    if(!row)continue;
    const slug=row.page_slug||row.id;
    if(!/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug))throw failure('Invalid page slug.');
    const file=inside(c.source,row.page||`microsites/${slug}/build/${slug}.html`);
    const bytes=fs.readFileSync(file);
    const hash=sha(bytes),checks=pageChecks(path.dirname(path.dirname(file)),file);
    return {id,slug,company:row.name,collection:c.id,file,sha256:hash,bytes,held:/^hold$/i.test(row.status||'')||!!row.page_access_hold,
      checks_current:checks.ready&&!/^hold$/i.test(row.status||'')&&!row.page_access_hold};
  }
  throw failure('Company is not in this gallery.',404);
}
export function reviewStore(file){return fs.existsSync(file)?json(file):{version:1,reviews:{},events:[]};}
export function writeStore(file,data){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const temp=file+'.'+randomUUID()+'.tmp';
  fs.writeFileSync(temp,JSON.stringify(data,null,2)+'\n',{mode:0o600});fs.renameSync(temp,file);
}
export function reviewState(definitions,file,id){
  const p=pageFor(definitions,id), saved=reviewStore(file).reviews[id];
  const current=!!saved&&saved.page_sha256===p.sha256;
  const linksFile=path.join(path.dirname(file),'share-links.json');
  const receipt=fs.existsSync(linksFile)?json(linksFile)[id]:null;
  const verified=receipt?.page_sha256===p.sha256&&receipt?.verification?.content===true&&
    receipt?.verification?.noindex===true&&receipt?.verification?.assets===true&&
    receipt?.verification?.sitemap_excluded===true&&
    receipt?.url===publicURL(p.slug);
  const jobsFile=path.join(path.dirname(file),'.page-deployments.json');
  const job=fs.existsSync(jobsFile)?json(jobsFile).jobs?.[id]:null;
  const activeJob=job?.page_sha256===p.sha256&&job?.revision===saved?.revision?job:null;
  const held=p.held;
  const warning=held?'This company is on hold. You can still choose to deploy this page.':!p.checks_current?
    'The page checks have not passed on this version. You can still choose to deploy it.':null;
  return {id,company:p.company,page_sha256:p.sha256,decision:saved?.decision||'unreviewed',
    current,stage:saved?.decision==='approved_to_deploy'?(current?(verified?'deployed':activeJob?.status==='failed'?'deployment_failed':activeJob?.status==='running'?'deploying':p.checks_current||saved.acknowledge_pending_checks?'queued':'checks_pending'):'approval_expired'):
      saved?.decision==='changes_requested'?'changes_requested':p.checks_current?'ready_for_review':'checks_pending',
    notes:saved?.notes||'',updated_at:saved?.updated_at||null,revision:saved?.revision||0,
    deployed_url:verified?receipt.url:null,can_approve:true,checks_current:p.checks_current,warning,
    deployment:activeJob?{status:activeJob.status,message:activeJob.message,updated_at:activeJob.updated_at}:null};
}
export async function saveReview(definitions,file,input){
  if(!decisions.has(input.decision))throw failure('Choose a review decision.');
  const p=pageFor(definitions,input.id);
  const feedbackOnly=input.decision==='changes_requested';
  if(feedbackOnly&&!/^[a-f0-9]{64}$/.test(input.page_sha256||''))throw failure('The reviewed page version is missing. Reload before saving feedback.');
  if(!feedbackOnly&&input.page_sha256!==p.sha256)throw failure('The page changed. Reload and review it before saving.',409);
  const initial=reviewStore(file).reviews[p.id];
  if(input.revision!==(initial?.revision||0))throw failure('Another review was saved. Reload before saving.',409);
  if(input.decision==='approved_to_deploy'&&!p.checks_current&&input.acknowledge_pending_checks!==true)
    throw failure('Review the warning about pending checks before deploying this version.',409);
  // Re-read after the asynchronous checker, so concurrent/revoked decisions win.
  const store=reviewStore(file), previous=store.reviews[p.id];
  if(input.revision!==(previous?.revision||0))throw failure('Another review was saved. Reload before saving.',409);
  if(!feedbackOnly&&pageFor(definitions,p.id).sha256!==p.sha256)throw failure('The page changed during validation. Reload it.',409);
  const at=new Date().toISOString();
  const saved={id:p.id,company:p.company,collection:p.collection,slug:p.slug,
    decision:input.decision,page_sha256:feedbackOnly?input.page_sha256:p.sha256,notes:String(input.notes||'').slice(0,10000),
    ...(feedbackOnly?{current_page_sha256_at_save:p.sha256}:{}),
    updated_at:at,revision:(previous?.revision||0)+1,
    acknowledge_pending_checks:input.decision==='approved_to_deploy'&&!p.checks_current&&input.acknowledge_pending_checks===true,
    authorization:input.decision==='approved_to_deploy'?'The provider selected Approved to deploy in the private gallery.':null};
  if(input.decision==='approved_to_deploy'){
    const folder=path.join(path.dirname(file),'.page-review-artifacts',p.sha256,randomUUID());
    fs.mkdirSync(folder,{recursive:true});const snapshot=path.join(folder,'index.html');
    if(fs.existsSync(snapshot)&&sha(fs.readFileSync(snapshot))!==p.sha256)throw failure('Approved snapshot is damaged.',409);
    if(!fs.existsSync(snapshot))fs.writeFileSync(snapshot,p.bytes,{mode:0o600,flag:'wx'});
    saved.snapshot=snapshot;
    saved.extra_files=[];
    const og=path.resolve(path.dirname(p.file),'../og.jpg');
    if(fs.existsSync(og)&&fs.statSync(og).isFile()){
      const bytes=fs.readFileSync(og),copy=path.join(folder,'og.jpg');
      fs.writeFileSync(copy,bytes,{mode:0o600});saved.extra_files.push({path:copy,sha256:sha(bytes)});
    }
  }
  store.reviews[p.id]=saved;store.events.push({...saved});writeStore(file,store);
  return reviewState(definitions,file,p.id);
}
export function deploymentQueue(definitions,file){
  return Object.values(reviewStore(file).reviews).filter(r=>r.decision==='approved_to_deploy').map(r=>{
    try{
      const state=reviewState(definitions,file,r.id);
      const intact=!!r.snapshot&&fs.existsSync(r.snapshot)&&sha(fs.readFileSync(r.snapshot))===r.page_sha256;
      return {...state,slug:r.slug,snapshot:r.snapshot,source:pfile(definitions,r.id),deployable:['queued','deployed','deployment_failed'].includes(state.stage)&&intact,
        reason:!state.current?'Page changed after approval.':!state.can_approve?'This company is on hold.':!intact?'Approved snapshot is missing or damaged.':null};
    }catch{return {id:r.id,company:r.company,stage:'approval_expired',deployable:false,reason:'Page is no longer available.'};}
  });
}
function pfile(definitions,id){return pageFor(definitions,id).file;}
export async function handlePageReview(req,res,{definitions,file,deploy}={}){
  const url=new URL(req.url,'http://localhost');
  if(!['/api/page-reviews','/api/deployment-queue'].includes(url.pathname))return false;
  const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
  try{
    if(req.method==='GET'){
      if(url.pathname==='/api/deployment-queue')send(200,{items:deploymentQueue(definitions,file)});
      else send(200,reviewState(definitions,file,url.searchParams.get('id')));
    }else if(req.method==='POST'&&url.pathname==='/api/page-reviews'){
      let sameOrigin=false;try{sameOrigin=!!req.headers.origin&&new URL(req.headers.origin).host===req.headers.host;}catch{}
      if(!sameOrigin)throw failure('Use the private gallery to save your review.',403);
      if(!String(req.headers['content-type']||'').startsWith('application/json'))throw failure('Expected JSON.',415);
      let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>20000)throw failure('Review is too long.',413);}
      const input=JSON.parse(raw);
      const state=reviewState(definitions,file,input.id);
      if(['running','queued'].includes(state.deployment?.status))throw failure('Deployment is in progress. Wait for it to finish.',409);
      await saveReview(definitions,file,input);
      if(input.decision==='approved_to_deploy'&&deploy)deploy(input.id);
      send(200,reviewState(definitions,file,input.id));
    }else send(405,{error:'Method not allowed.'});
  }catch(error){send(error.status||400,{error:error.message});}
  return true;
}
