// ABOUTME: App shell: switches between Today, Companies, People and Dashboard, and drives the shared campaign picker.
// ABOUTME: Remembers the last view per browser; every view re-renders when the campaign changes.

let view='today';
const VIEWS={today:'#today-view',companies:'#companies-view',people:'#people-view',dashboard:'#funnel-view'};
function setView(next){
  if(!VIEWS[next])next='today';
  view=next;document.body.className=document.body.className.replace(/\bview-\S+/g,'').trim()+' view-'+view;
  Object.entries(VIEWS).forEach(([id,sel])=>$(sel).hidden=id!==view);
  document.querySelectorAll('#views [data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
  try{localStorage.setItem('rh-outreach-view',view);}catch{}
  refreshView();
}
function refreshView(){
  if(view==='companies')ensurePeople(true).then(()=>data&&render());else if(view==='today')renderToday();else if(view==='people')renderPeople();else if(view==='dashboard')renderFunnel();
}
$('#views').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)setView(b.dataset.view);});
$('#campaign-select').addEventListener('change',e=>{
  const b=document.querySelector(`#collections [data-collection="${CSS.escape(e.target.value)}"]`);
  if(b)b.click();refreshView();
});
let saved='today';try{saved=localStorage.getItem('rh-outreach-view')||'today';}catch{}
setView(saved);
fetch('/api/brand').then(r=>r.json()).then(b=>{$('#brand-name').textContent=b.business;document.title=b.business+' · Microsite gallery';}).catch(()=>{});
