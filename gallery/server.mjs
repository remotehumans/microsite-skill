import {handlePageReview,campaignRows,campaignCards} from './page-review.mjs';
import {createPublisher} from './page-deploy.mjs';
import http from 'node:http';
import {Worker} from 'node:worker_threads';
import {priorityQueue,deadEnds} from './priority.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileContacts } from './build-contacts.mjs';
import { mergeContactResearch, researchSummary } from './contact-research.mjs';
import { readTracker, writeTracker, decorateContact, initialContact, changeContact, updateMonitor, recordViews } from './contact-tracker.mjs';
import { funnelReport, funnelPeople, funnelMarks, campaignOf as campaignOfId } from './funnel.mjs';
import { addManualContact, importCSV, manualDirectory } from './manual-contacts.mjs';
import { pageChecks } from './checks.mjs';
import { discoverCampaigns, workspace, dataDir, brand } from './config.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
export const source = workspace();
const data = dataDir(source);
const port = Number(option('--port', '4347'));
const allowedHosts = new Set(['127.0.0.1', 'localhost', '[::1]', option('--allowed-host', '').toLowerCase().replace(/\.$/, '')].filter(Boolean));
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const optional = (root, name) => fs.existsSync(path.join(root,name)) ? read(path.join(root,name)) : {};
export const collections = discoverCampaigns(source);
export const rowKey = (collection,id) => collection+'~'+id;
function collectionInputs(c) {
  const rows=campaignRows(c);
  const saved=optional(c.gallery,'contacts.json');
  const candidates=Object.fromEntries(Object.entries(saved).map(([id,v])=>[id,(v.people||[]).filter(p=>p.linkedin).map(p=>({url:p.linkedin,file:p.linkedin_source}))]));
  const contacts=compileContacts(rows,optional(c.gallery,'contact-seeds.json'),optional(c.gallery,'contact-profile-overrides.json'),candidates);
  for(const r of rows){
    const report=optional(path.join(c.source,'microsites',r.page_slug||r.id,'enrichment'),'contact-research.json');
    contacts[r.id]=mergeContactResearch(contacts[r.id],Object.keys(report).length?report:null,r.name);
  }
  return {rows,contacts};
}
export function within(root, name) {
  const target = path.resolve(root, name);
  if (target !== root && !target.startsWith(root + path.sep)) throw new Error('Path outside collection');
  const real = fs.realpathSync(target), base = fs.realpathSync(root);
  if (real !== base && !real.startsWith(base + path.sep)) throw new Error('Link outside collection');
  return real;
}
function walk(dir, depth = 2) {
  if (depth < 0 || !fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    if (/history|archive|node_modules|\.git/.test(e.name) || e.isSymbolicLink()) return [];
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p, depth - 1) : [p];
  });
}
const imageScore = p => {
  const n = path.basename(p).toLowerCase();
  if (!/\.(png|jpe?g|webp)$/.test(n) || /mobile|phone|original|company|source|side.by.side|brand|logo/.test(n)) return -1;
  if (/desktop-top|desktop-hero|hero-desktop/.test(n)) return 100;
  if (/page0-desktop/.test(n)) return 95;
  if (/desktop-viewport|desktop-home/.test(n)) return 90;
  if (/microsite-desktop/.test(n)) return 85;
  if (/desktop/.test(n) && /top|hero|cover|full/.test(n)) return 70;
  return -1;
};
const OUTREACH=path.join(data,'outreach-log.json');
const TRACKER=path.join(data,'contact-tracker.json');
export function contactDirectory(definitions=collections){
  return definitions.flatMap(c=>{
    try {
      const {rows,contacts}=collectionInputs(c);
      return rows.flatMap(r=>(contacts[r.id]?.people||[]).filter(p=>p.name).map(p=>({...initialContact(rowKey(c.id,r.id),p),company:r.name,role:p.role,email:p.email||'',email_status:p.email_status||'',email_source:p.email_source||'',phone:p.phone||'',phone_source:p.phone_source||'',collection_id:c.id})));
    } catch(error) { console.error(`Contact collection ${c.id} unavailable:`,error.message); return []; }
  });
}
export const OUTREACH_STATUSES=['to_contact','contacted','replied','call_booked','not_now','skip'];
const readOutreach=()=>fs.existsSync(OUTREACH)?read(OUTREACH):{};
export function saveOutreach(ids,body){
  if(!ids.has(body.id))throw new Error('Unknown company');
  if(!OUTREACH_STATUSES.includes(body.status))throw new Error('Unknown status');
  const log=readOutreach();
  galleryCache.at=0;
  log[body.id]={status:body.status,note:String(body.note||'').slice(0,2000),updated:new Date().toISOString()};
  fs.mkdirSync(data,{recursive:true});fs.writeFileSync(OUTREACH+'.tmp',JSON.stringify(log,null,1));fs.renameSync(OUTREACH+'.tmp',OUTREACH);
  return log[body.id];
}
let galleryCache={at:0,body:''},rebuilding=null;
// Parse growing campaign HTML in a worker so signing/payment requests stay responsive.
function rebuildGallery(){
  if(rebuilding)return rebuilding;
  rebuilding=new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./gallery-cache.mjs',import.meta.url),{argv:['--workspace',source]});
    worker.once('message',body=>{galleryCache={at:Date.now(),body};resolve(body);});
    worker.once('error',reject);
    worker.once('exit',code=>{if(code)reject(new Error('Gallery cache worker exited '+code));});
  }).finally(()=>{rebuilding=null;});
  return rebuilding;
}
const refreshGallery=()=>rebuildGallery().catch(e=>console.error('Gallery rebuild failed:',e.message));
async function cachedGallery(){if(!galleryCache.body)return rebuildGallery();if(Date.now()-galleryCache.at>60000)setImmediate(refreshGallery);return galleryCache.body;}
function collectionGallery(c,tracker,outreach) {
  const source=c.source;
  const rel=p=>path.relative(source,p).split(path.sep).join('/');
  const exists=p=>{try{return fs.statSync(within(source,p)).isFile();}catch{return false;}};
  const {rows,contacts}=collectionInputs(c);
  const campaign=read(path.join(source,'data/campaign.json'));
  const audits=optional(path.join(source,'data'),'verification-register.json');
  const summaries=optional(c.gallery,'card-summaries.json'),cards=campaignCards(c,optional(c.gallery,'outreach-cards.json')),shares=optional(c.gallery,'share-links.json');
  const enriched = rows.map(r => {
    const folder = path.join(source, 'microsites', r.page_slug || r.id);
    const conventional = `microsites/${r.page_slug || r.id}/build/${r.page_slug || r.id}.html`;
    const page = r.page && exists(r.page) ? r.page : exists(conventional) ? conventional : null;
    const files = page ? [...walk(path.join(folder, 'qa')), ...walk(path.join(folder, 'design'))] : [];
    const previews = files.filter(p => imageScore(p) >= 0).sort((a,b) => imageScore(b) - imageScore(a) || fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    const thumb = path.join(c.gallery, 'thumbs', (r.page_slug || r.id) + '.png');
    const freshThumb = page && fs.existsSync(thumb) && fs.statSync(thumb).mtimeMs >= fs.statSync(path.join(source, page)).mtimeMs;
    const preview = previews[0];
    const id=rowKey(c.id,r.id);
    const contactRecord=contacts[r.id];contactRecord.people=contactRecord.people.map(p=>decorateContact(id,p,tracker));
    return { ...r, id, source_id:r.id, collection_id:c.id, collection_name:c.name, thread:c.thread, asset_base:'/collections/'+c.id+'/',
      card:cards[r.id]||null, card_signal:summaries[r.id]?.[0]||'Signal not checked', card_summary:summaries[r.id]?.[1]||'Read the research to check the signal, goal and people before sharing.', published:shares[r.id]||null, contact_review:researchSummary(contactRecord), contacts:contactRecord, page,  outreach: outreach[id] || null, preview: freshThumb ? null : preview ? rel(preview) : null, thumb: freshThumb ? ('collections/'+c.id+'/gallery/thumbs/') + path.basename(thumb) : null,
      preview_saved: preview ? fs.statSync(preview).mtime.toISOString() : null,
      page_modified: page ? fs.statSync(path.join(source, page)).mtime.toISOString() : null,
      checks: pageChecks(folder, page ? path.join(source, page) : null),
      audit: audits[r.page_slug || r.id] || null,
      files: page ? [...new Set([
        r.research,
        ...['research/brief.html', 'research/research.json', 'company.json', 'team-map.json', 'design/brief.md', 'design/fidelity.json', 'qa/results.json', 'enrichment/cost-ledger.json', 'README.md', 'config.json', 'theme.css', 'page.src.html'].map(n => rel(path.join(folder,n))),
        ...(audits[r.page_slug || r.id]?.evidence || []),
        ...files.filter(p => /\.(png|jpe?g|webp)$/.test(p)).map(rel)
      ].filter(p => p && exists(p)))] : [r.research].filter(p => p && exists(p)) };
  });
  return {campaign,rows:enriched};
}
export function gallery(definitions=collections) {
  const tracker=readTracker(TRACKER),outreach=readOutreach();
  const result=definitions.map(c=>{
    try {const g=collectionGallery(c,tracker,outreach);return {...c,...g};}
    catch(error){console.error(`Gallery collection ${c.id} unavailable:`,error.message);return {...c,rows:[],error:'This collection is being updated or is unavailable. Try Refresh shortly.'};}
  });
  const counts={};
  for(const c of result)for(const [key,value] of Object.entries(c.campaign?.counts||{}))if(typeof value==='number')counts[key]=(counts[key]||0)+value;
  const campaign={counts,last_updated_utc:result.map(c=>c.campaign?.last_updated_utc||'').sort().at(-1)};
  return {campaign,rows:result.flatMap(c=>c.rows),collections:result.map(c=>({id:c.id,name:c.name,thread:c.thread,counts:c.campaign?.counts||{},built:c.rows.filter(r=>r.page).length,records:c.rows.length,error:c.error||null})),monitor:tracker.monitor,refreshed:new Date().toISOString(),thread:definitions[0]?.thread};
}
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.md':'text/plain; charset=utf-8', '.txt':'text/plain; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.gif':'image/gif', '.woff2':'font/woff2', '.pdf':'application/pdf', '.mp4':'video/mp4' };
export function createServer({trackerFile=TRACKER,definitions=collections,directory=()=>contactDirectory(definitions),publisher:providedPublisher}={}) {
  const reviewFile=path.join(data,'page-reviews.json');
  const publisher=providedPublisher||createPublisher({definitions,file:reviewFile});
  // Campaign people plus anyone added by hand or CSV, each merged with their saved tracker state.
  const everyone=data=>[...directory().map(c=>({...c,...data.contacts[c.key]})),...manualDirectory(data)];
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (!allowedHosts.has((req.headers.host || '').toLowerCase().replace(/:\d+$/, '').replace(/\.$/, ''))) { res.writeHead(403); res.end(); return; }
    if(await handlePageReview(req,res,{definitions,file:reviewFile,deploy:id=>publisher.start(id)}))return;
    if(req.method==='POST'&&['/api/contact-tracker','/api/contact-monitor','/api/contacts'].includes(req.url)){
      if(!String(req.headers['content-type']||'').startsWith('application/json')){res.writeHead(415);res.end();return;}
      let validOrigin=true;try{validOrigin=!req.headers.origin||new URL(req.headers.origin).host===req.headers.host;}catch{validOrigin=false;}
      if(!validOrigin){res.writeHead(403);res.end();return;}
      const limit=req.url==='/api/contacts'?2000000:65000;let raw='';req.on('data',d=>{raw+=d;if(raw.length>limit)req.destroy();});
      req.on('end',()=>{try{
        const body=JSON.parse(raw),data=readTracker(trackerFile);
        const saved=req.url==='/api/contact-monitor'?updateMonitor(data,body)
          :req.url==='/api/contacts'?(body.action==='import'?importCSV(data,directory(),String(body.csv||'')):body.action==='add'?addManualContact(data,directory(),body):(()=>{throw new Error('Unknown contacts action');})())
          :changeContact([...directory(),...manualDirectory(data)],data,body);
        writeTracker(trackerFile,data);galleryCache.at=0;res.writeHead(200,{'Content-Type':types['.json'],'Cache-Control':'no-store'});res.end(JSON.stringify(saved));
      }catch(error){res.writeHead(error.status||400,{'Content-Type':types['.json']});res.end(JSON.stringify({error:error.message}));}});return;
    }
    if (req.method === 'POST' && req.url === '/api/outreach') {
      let body = '';
      req.on('data', d => { body += d; if (body.length > 10000) req.destroy(); });
      req.on('end', () => {
        try {
          const ids = new Set(definitions.flatMap(c=>campaignRows(c).map(r=>rowKey(c.id,r.id))));
          const saved = saveOutreach(ids, JSON.parse(body));
          res.writeHead(200, {'Content-Type': types['.json']}); res.end(JSON.stringify(saved));
        } catch (e) { res.writeHead(400, {'Content-Type': types['.json']}); res.end(JSON.stringify({error: e.message})); }
      });
      return;
    }
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    try {
      const u = new URL(req.url, 'http://localhost');
      if(u.pathname==='/api/priority'){
        const all=priorityQueue((definitions===collections?JSON.parse(await cachedGallery()):gallery(definitions)).rows);
        res.writeHead(200,{'Content-Type':types['.json']});res.end(JSON.stringify({items:all,deadEnds:deadEnds(all)}));return;
      }
      if(u.pathname==='/api/workspace'){res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8'});res.end(source);return;}
      if(u.pathname==='/api/brand'){res.writeHead(200,{'Content-Type':types['.json']});res.end(JSON.stringify(brand()));return;}
      if(decodeURIComponent(u.pathname).split('/').some(n=>n.startsWith('.'))){res.writeHead(404);res.end();return;}
      if(u.pathname==='/api/contact-tracker'){
        const data=readTracker(trackerFile);const contacts=everyone(data);
        res.writeHead(200,{'Content-Type':types['.json'],'Cache-Control':'no-store'});res.end(JSON.stringify({contacts,monitor:data.monitor}));return;
      }
      if(u.pathname==='/api/people'){
        const data=readTracker(trackerFile);
        const people=everyone(data).map(c=>{const marks=funnelMarks(c);return {key:c.key,manual:!!c.manual,name:c.name,company:c.company||c.company_id,role:c.role||'',email:c.email||'',email_status:c.email_status||'',email_source:c.email_source||'',phone:c.phone||'',phone_source:c.phone_source||'',profile_url:c.profile_url||'',company_id:c.company_id,campaign:c.campaign||campaignOfId(c.company_id),
          stage:c.stage||null,connection:c.connection,next_follow_up:c.next_follow_up||'',revision:c.revision||0,marks,reached:['D','C','B','MS','A'].find(id=>marks[id])||null,
          last_at:[...(c.events||[])].map(e=>e.at).sort().at(-1)||c.connection_checked_at||null,draft:c.draft||'',notes:c.notes||'',source:c.source||'',source_url:c.source_url||'',reason:c.reason||'',next_step:c.next_step||'',thread:c.thread||'',events:[...(c.events||[])].sort((a,b)=>b.at.localeCompare(a.at)),view_ref:c.view_ref||null,kinds:[...new Set((c.events||[]).map(e=>e.kind))],last_kind:[...(c.events||[])].sort((a,b)=>a.at.localeCompare(b.at)).at(-1)?.kind||null}});
        res.writeHead(200,{'Content-Type':types['.json'],'Cache-Control':'no-store'});res.end(JSON.stringify({people,campaigns:definitions.map(c=>({id:c.id,name:c.name}))}));return;
      }
      if(u.pathname==='/api/funnel'){
        const data=readTracker(trackerFile);const contacts=everyone(data);
        const report=funnelReport(contacts,Object.fromEntries(definitions.map(c=>[c.id,c.name])));
        const page_views=Object.fromEntries(Object.entries(data.page_views||{}).map(([slug,v])=>[slug,{count:v.count,last_at:v.last_at}]));
        res.writeHead(200,{'Content-Type':types['.json'],'Cache-Control':'no-store'});res.end(JSON.stringify({...report,people:funnelPeople(contacts),page_views,views_sync:data.views_sync||null}));return;
      }
      if (u.pathname === '/api/gallery') {
        res.setHeader('Content-Type', types['.json']);
        const body = definitions===collections?await cachedGallery():JSON.stringify(gallery(definitions));
        res.end(req.method === 'HEAD' ? undefined : body); return;
      }
      if (u.pathname === '/api/document') {
        const c=definitions.find(c=>c.id===u.searchParams.get('collection'));
        if(!c)throw new Error('Unknown collection');
        const f = within(c.source, u.searchParams.get('path') || '');
        if (!fs.statSync(f).isFile() || fs.statSync(f).size > 1500000) throw new Error('Document too large');
        const text = fs.readFileSync(f, 'utf8');
        res.setHeader('Content-Type', types['.json']);
        res.end(JSON.stringify({path: u.searchParams.get('path'), text})); return;
      }
      let root=here,relative=u.pathname==='/'?'index.html':decodeURIComponent(u.pathname.slice(1));
      if(u.pathname.startsWith('/collections/')){
        const match=u.pathname.match(/^\/collections\/([^/]+)\/(.*)$/);
        const c=definitions.find(c=>c.id===match?.[1]);
        if(!c)throw new Error('Unknown collection');
        root=c.source;relative=decodeURIComponent(match[2]);
      }
      const f=within(root,relative);
      if (!fs.statSync(f).isFile()) throw new Error('Not a file');
      res.setHeader('Content-Type', types[path.extname(f).toLowerCase()] || 'application/octet-stream');
      if (req.method === 'HEAD') { res.end(); return; }
      const stream = fs.createReadStream(f);
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    } catch (e) {
      res.writeHead(404, {'Content-Type':'application/json'});
      res.end(JSON.stringify({error: req.url.startsWith('/api/gallery') ? 'The campaign files are unavailable or being updated. Try Refresh shortly.' : 'File unavailable in this collection.'}));
    }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const publisher=createPublisher({definitions:collections,file:path.join(data,'page-reviews.json')});
  publisher.resume();
  createServer({publisher}).listen(port, '127.0.0.1', () => { console.log(`Microsite gallery: http://127.0.0.1:${port}\nWorkspace: ${source}\nCampaigns: ${collections.map(c=>c.name).join(', ')||'none yet (python3 scripts/campaign.py new NAME)'}`); setImmediate(refreshGallery); setInterval(refreshGallery, 60000); });
}
