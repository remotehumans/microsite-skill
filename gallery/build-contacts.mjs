// ABOUTME: Compiles each company's people (name, role, LinkedIn, email) from a campaign's prospects and its gallery seed and override files.
// ABOUTME: The gallery runs this on every refresh; run it by hand to save gallery/contacts.json: node gallery/build-contacts.mjs --source <campaign folder>.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const argv=process.argv.slice(2);
const get=(key,fallback)=>argv.includes(key)?argv[argv.indexOf(key)+1]:fallback;
const base=path.resolve(get('--source','.'));
const norm=s=>String(s||'').normalize('NFKD').replace(/[^a-z]/gi,'').toLowerCase();
const emails=v=>[...new Set((JSON.stringify(v||'').match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[]).map(s=>s.replace(/[.,;]+$/,'')))];
export const isSharedEmail=s=>/^(info|hello|sales|contact|enquir|office|admin|group|reception|support|marketing|accounts|mail|email|pr)([.@_-]|ies@|y@)/i.test(s);
function objects(v){if(!v||typeof v!=='object')return[];return [v,...Object.values(v).flatMap(objects)];}
export function personEmail(buyer,name){
  if(!name)return null;
  const n=norm(name);
  for(const o of objects(buyer)){
    const label=o.name||o.primary||o.description||'';
    if(norm(label).includes(n)){
      const e=emails(Object.fromEntries(Object.entries(o).filter(([k])=>/email|public_business_contact/.test(k)))).find(s=>!isSharedEmail(s));
      if(e)return e;
    }
    if(typeof o.alternate==='string'&&norm(o.alternate).includes(n)){const e=emails(o.alternate).find(s=>!isSharedEmail(s));if(e)return e;}
  }
  return null;
}
function sourceUrls(v){if(typeof v==='string')return /^https?:\/\//.test(v)?[v]:[];if(!v||typeof v!=='object')return[];return Object.values(v).flatMap(sourceUrls);}
function scanLinks(rows){
  const result={};
  function walk(dir,depth=3){if(depth<0||!fs.existsSync(dir))return[];return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const p=path.join(dir,e.name);return e.isDirectory()?walk(p,depth-1):/\.(json|html|txt|md)$/.test(e.name)&&fs.statSync(p).size<3000000?[p]:[];});}
  for(const r of rows){const links=new Map();for(const f of r.research?walk(path.dirname(path.join(base,r.research))):[]){const text=fs.readFileSync(f,'utf8').replaceAll('\\/','/');for(const m of text.matchAll(/https?:\/\/(?:[a-z]+\.)?linkedin\.com\/in\/[a-zA-Z0-9%_-]+\/?/g)){const url=m[0].replace(/^https?:\/\/[^/]+/,'https://www.linkedin.com').replace(/\/$/,'');if(!links.has(url))links.set(url,{url,file:path.relative(base,f)});}}result[r.id]=[...links.values()];}
  return result;
}
function fallbackPeople(buyer){
  return objects(buyer).filter(o=>typeof o.name==='string'&&o.name.length<90).slice(0,3).map(o=>[o.name,o.title||o.own_title||o.published_role||o.role||'Published business contact','Check the current role and whether this person owns the proposed work.']);
}
export function compileContacts(rows,seeds,profiles,candidates){
  const result={};
  for(const r of rows){
    const p=seeds[r.id]||fallbackPeople(r.buyer);
    const links=candidates[r.id]||[];
    const recordUrls=sourceUrls(r.buyer);
    const people=p.map(([name,role,why])=>{
      const tokens=name.split(/\s+/).map(norm).filter(x=>x.length>2);
      const linked=links.find(x=>tokens.length>=2&&tokens.every(w=>norm(decodeURIComponent(x.url)).includes(w)));
      const profile=profiles[name];
      const linkedin=profile?.url||linked?.url||null;
      const email=profile?.email||personEmail([r.buyer,r.public_contact],name);
      const ownProfile=recordUrls.find(u=>norm(u).includes(norm(name.split(' ').at(-1)))&&!/linkedin|company-information/.test(u));
      return {name,role,why,email,linkedin,
        linkedin_kind:profile?.kind||(linked?'saved source link':null),
        linkedin_source:profile?.evidence||profile?.url||linked?.file||null,
        company_profile:ownProfile||null,
        search_url:'https://www.linkedin.com/search/results/people/?keywords='+encodeURIComponent((name||role)+' '+r.name),
        role_source:profile?.role_source||r.research,email_source:email?(profile?.evidence||r.research):null,email_note:profile?.email_note||null,checked_on:profile?.checked_on||null,
        connection_status:profile?.connection_status||null,connection_updated_on:profile?.connection_updated_on||null};
    });
    const allEmails=emails([r.public_contact,r.buyer]);
    const direct=new Set(people.map(p=>p.email).filter(Boolean));
    const companyEmails=allEmails.filter(e=>!direct.has(e)).map(email=>({email,kind:isSharedEmail(email)?'Company inbox':'Published business email; check addressee',source:r.research}));
    const contactUrls=sourceUrls(r.public_contact);
    const contactPage=contactUrls.find(u=>/contact|get-in-touch/.test(u))||null;
    result[r.id]={people,company_emails:companyEmails,contact_page:contactPage,research:r.research,
      raw_buyer:r.buyer,raw_contact:r.public_contact,prior_contact:r.prior_contact||'Earlier contact has not been checked.'};
  }
  return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
  const rows=read(path.join(base,'data/prospects.json'));
  const candidatePath=get('--candidates',null);
  const g=path.join(base,'gallery'),opt=n=>fs.existsSync(path.join(g,n))?read(path.join(g,n)):{};
  const result=compileContacts(rows,opt('contact-seeds.json'),opt('contact-profile-overrides.json'),candidatePath?read(candidatePath):scanLinks(rows));
  fs.mkdirSync(g,{recursive:true});fs.writeFileSync(path.join(g,'contacts.json'),JSON.stringify(result,null,2)+'\n');
  const built=rows.filter(r=>r.draft_file_exists).map(r=>result[r.id]);
  console.log(JSON.stringify({built:built.length,people:built.flatMap(x=>x.people).filter(p=>p.name).length,exact_linkedin:built.flatMap(x=>x.people).filter(p=>p.linkedin).length,direct_emails:built.flatMap(x=>x.people).filter(p=>p.email).length,company_inboxes:built.filter(x=>x.company_emails.length).length,without_person:built.filter(x=>!x.people.some(p=>p.name)).length},null,2));
}
