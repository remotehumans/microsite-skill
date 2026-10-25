// ABOUTME: Publishes a page only after the provider clicks Approved to deploy in the gallery, one job at a time.
// ABOUTME: Uses the skill's scripts/deploy_private.sh, then saves the verified live link as the page's share link.
import fs from 'node:fs';
import path from 'node:path';
import {skill,publicURL} from './config.mjs';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {deploymentQueue,reviewStore,writeStore} from './page-review.mjs';

const exec=promisify(execFile);
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=(file,fallback)=>fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):fallback;
const deployScript=path.join(skill,'scripts/deploy_private.sh');
const run=async(command,args,options={})=>(await exec(command,args,{timeout:20*60000,maxBuffer:256000,...options})).stdout;

// Publishes the approved snapshot with the skill's deploy_private.sh, which uses the profile's delivery settings and waits until the page is live.
export async function publishPage(job,{command=run,assertCurrent=()=>{},progress=()=>{}}={}){
  const bytes=fs.readFileSync(job.snapshot),html=bytes.toString();
  if(!/^[a-z0-9][a-z0-9-]{0,99}$/.test(job.slug))throw new Error('Invalid page address.');
  if(sha(bytes)!==job.page_sha256)throw new Error('The approved page changed. Review it again.');
  if(!/<meta\b(?=[^>]*\bname\s*=\s*["']robots["'])(?=[^>]*\bcontent\s*=\s*["'][^"']*\bnoindex\b)[^>]*>/i.test(html))
    throw new Error('Add noindex metadata to the page before publishing.');
  // Pages are self-contained. Do not publish broken local asset paths.
  const refs=[...html.matchAll(/\b(?:src|poster)\s*=\s*["']([^"']+)|url\(\s*["']?([^\s)'";]+)/gi)].map(m=>m[1]||m[2]);
  const styles=[...html.matchAll(/<link\b[^>]*>/gi)].flatMap(m=>[...m[0].matchAll(/\bhref\s*=\s*["']([^"']+)/gi)].map(m=>m[1]));
  if([...refs,...styles].some(ref=>!/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(ref)))
    throw new Error('This page uses local assets. Embed them in the page before deploying.');
  const extras=job.extra_files||[];
  for(const extra of extras)if(sha(fs.readFileSync(extra.path))!==extra.sha256)throw new Error('The approved share image changed. Review the page again.');
  const url=publicURL(job.slug);
  if(!url)throw new Error('Set delivery.public_base_url in your profile before deploying (SETUP.md, publishing).');
  assertCurrent();progress('Publishing the approved page. This can take a few minutes…');
  const out=await command('bash',[deployScript,job.slug,job.snapshot,...extras.map(e=>e.path)]);
  if(!out.includes('LIVE '+url))throw new Error('The page is not verified live yet. Retry deployment.');
  assertCurrent();
  return {url,page_sha256:job.page_sha256,verified_at:new Date().toISOString(),
    verification:{content:true,noindex:true,assets:true,sitemap_excluded:!/appears in sitemap/.test(out)}};
}

export function createPublisher({definitions,file,publish=publishPage}={}){
  const jobsFile=path.join(path.dirname(file),'.page-deployments.json');
  const sharesFile=path.join(path.dirname(file),'share-links.json');
  let running=false;
  const jobs=()=>read(jobsFile,{version:1,jobs:{}});
  function update(id,values){const store=jobs();Object.assign(store.jobs[id],values,{updated_at:new Date().toISOString()});writeStore(jobsFile,store);}
  const isCurrent=job=>{
    const saved=reviewStore(file).reviews[job.id];
    const item=deploymentQueue(definitions,file).find(r=>r.id===job.id);
    if(saved?.decision!=='approved_to_deploy'||saved.revision!==job.revision||!item?.current)
      throw new Error('The page or your decision changed. Review it again before deploying.');
  };
  async function drain(){
    if(running)return;running=true;
    try{
      for(let job;(job=Object.values(jobs().jobs).find(j=>j.status==='queued'));){
        update(job.id,{status:'running',message:'Starting deployment…'});
        try{
          isCurrent(job);
          const receipt=await publish(job,{assertCurrent:()=>isCurrent(job),progress:message=>update(job.id,{message})});
          isCurrent(job);
          const shares=read(sharesFile,{});shares[job.id]=receipt;writeStore(sharesFile,shares);
          const c=definitions.find(c=>c.id===job.collection),local=path.join(c.gallery,'share-links.json');
          if(path.resolve(local)!==path.resolve(sharesFile)){
            const links=read(local,{});links[job.source_id]=receipt;writeStore(local,links);
          }
          update(job.id,{status:'succeeded',message:'Live · page verified.'});
        }catch(error){
          const message=error.cmd?'Deployment could not finish: '+String(error.stderr||error.message).trim().split('\n').at(-1):error.message;
          update(job.id,{status:'failed',message});
        }
      }
    }finally{running=false;}
  }
  return {
    start(id){
      const store=jobs();if(['queued','running'].includes(store.jobs[id]?.status))return;
      const item=deploymentQueue(definitions,file).find(r=>r.id===id);
      if(!item?.deployable)throw new Error(item?.reason||'Review this page version before deployment.');
      const saved=reviewStore(file).reviews[id],c=definitions.find(c=>c.id===saved.collection);
      store.jobs[id]={id,source_id:id.slice(c.id.length+1),collection:saved.collection,
        slug:item.slug,page_sha256:item.page_sha256,revision:saved.revision,snapshot:item.snapshot,extra_files:saved.extra_files||[],
        status:'queued',message:'Queued for deployment…',updated_at:new Date().toISOString()};
      writeStore(jobsFile,store);void drain();
    },
    resume(){
      // An interrupted publication needs a fresh click, never an automatic repeat publish.
      const store=jobs();
      for(const job of Object.values(store.jobs))if(['queued','running'].includes(job.status)){
        job.status='failed';job.message='Deployment was interrupted. Click Retry deployment.';
      }
      writeStore(jobsFile,store);
    },
    async idle(){while(running)await new Promise(resolve=>setTimeout(resolve,10));}
  };
}
