// ABOUTME: Draws the outreach dashboard in a flat, rounded style on paper: action pills, funnel, capsule bars, trend lines, reach area, people flow and campaigns.
// ABOUTME: Reads /api/funnel plus the gallery's loaded contacts; all charts are hand-built SVG/HTML with hover tooltips, dot legends and a table fallback.

const pct=x=>x==null?'–':Math.round(x*100)+'%';
const monthName=m=>new Date(m+'-01T12:00:00Z').toLocaleDateString(undefined,{month:'short',year:'numeric'});
const calm=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const STAGE_COPY={A:'First touch: request or message sent',MS:'They opened their microsite',B:'They wrote back',C:'Booking link is with them',D:'A call is in the diary'};
// One fixed colour per stage, checked for colour-blind separation on paper. Booked keeps the accent orange.
const COLOR={A:'#1F3FD6',MS:'#8A6FE0',B:'#2A9D84',C:'#D97BC9',D:'#E04F18'};
const INK_ON={A:'#F2F0E9',MS:'#141311',B:'#141311',C:'#141311',D:'#141311'};

const tip=(()=>{let el;return {show(e,html){el ||= Object.assign(document.body.appendChild(document.createElement('div')),{className:'viz-tip',role:'status'});el.innerHTML=html;el.hidden=false;const x=Math.min(e.clientX+14,innerWidth-el.offsetWidth-10);el.style.transform=`translate(${x}px,${e.clientY+14}px)`;},hide(){if(el)el.hidden=true;}};})();
function bindTips(root){
  root.querySelectorAll('[data-tip]').forEach(n=>{
    n.addEventListener('pointermove',e=>tip.show(e,n.dataset.tip));n.addEventListener('pointerleave',tip.hide);
    n.addEventListener('focus',()=>{const r=n.getBoundingClientRect();tip.show({clientX:r.right,clientY:r.top},n.dataset.tip);});n.addEventListener('blur',tip.hide);
  });
}
function countUp(root){
  root.querySelectorAll('[data-count]').forEach(n=>{
    const end=Number(n.dataset.count),suffix=n.dataset.suffix||'';
    if(calm()||!end){n.textContent=end+suffix;return;}
    const t0=performance.now(),dur=900;
    const step=t=>{const k=Math.min((t-t0)/dur,1);n.textContent=Math.round(end*(1-Math.pow(1-k,3)))+suffix;if(k<1)requestAnimationFrame(step);};
    requestAnimationFrame(step);
  });
}
const rand=seed=>()=>{seed=(seed*1664525+1013904223)%4294967296;return seed/4294967296;};
const legend=items=>`<div class="legend">${items.map(([label,color])=>`<span><i style="background:${color}"></i>${esc(label)}</span>`).join('')}</div>`;
const smooth=pts=>pts.map(([x,y],i)=>{if(!i)return `M${x},${y}`;const [px,py]=pts[i-1],mx=(px+x)/2;return ` C${mx},${py} ${mx},${y} ${x},${y}`;}).join('');

const people=()=>collectionRows().flatMap(r=>(r.contacts?.people||[]).filter(p=>p.tracker).map(p=>({r,p,t:p.tracker})));
const daysAgo=at=>(Date.now()-new Date(at).getTime())/86400000;
function actionQueue(){
  const all=people(),has=(t,k)=>t.events.some(e=>e.kind===k);
  return [
    {id:'dm-ready',label:'ready to DM',hint:'Connected, no message yet',color:COLOR.A,n:collectionRows().flatMap(readyPeople).length},
    {id:'due',label:'follow-ups due',hint:'Date reached today or earlier',color:COLOR.D,n:collectionRows().flatMap(followUpPeople).length},
    {id:'contacted',label:'replied, no call link',hint:'Send your booking link',color:COLOR.B,n:all.filter(({t})=>has(t,'reply_received')&&!has(t,'call_link_sent')&&!['call_booked','not_now','do_not_contact'].includes(t.stage)).length},
    {id:'contacted',label:'quiet for 7+ days',hint:'DM sent, no reply yet',color:COLOR.C,n:all.filter(({t})=>t.stage==='awaiting_reply'&&t.events.filter(e=>e.kind==='dm_sent').every(e=>daysAgo(e.at)>=7)).length},
    {id:'pending',label:'requests pending',hint:'Waiting for them to accept',color:COLOR.MS,n:collectionRows().flatMap(pendingPeople).length}
  ];
}
// The biggest drop is the step that loses the most people. Seen is skipped until opens are tracked, so it cannot fake a leak.
function biggestDrop(totals,stages,seenTracked){
  let leak=null;
  stages.slice(1).forEach((s,i)=>{
    if(!seenTracked&&s.id==='MS')return;
    const from=!seenTracked&&stages[i].id==='MS'?stages[0]:stages[i],lost=totals[from.id]-totals[s.id];
    if(totals[from.id]&&lost>0&&(!leak||lost>leak.lost))leak={id:s.id,lost,from};
  });
  return leak;
}
function headline(group,leak,stages){
  const t=group.totals,name=id=>stages.find(s=>s.id===id).label.toLowerCase();
  if(!t.A)return 'No outreach recorded yet. Start with the people ready to DM.';
  if(t.D)return `${t.D} ${t.D===1?'call':'calls'} booked from ${t.A} people.${leak?` Most drop out before “${name(leak.id)}”.`:''}`;
  if(leak)return `${t.A} people reached. The gap is between ${leak.from.label.toLowerCase()} and ${name(leak.id)}.`;
  return `${t.A} people reached so far.`;
}

function pillsHTML(queue){
  // Packed pills: width grows with the work waiting; an empty queue is an outline.
  const max=Math.max(...queue.map(q=>q.n),1);
  return `<section class="pills" aria-label="Needs you now">${queue.map((q,i)=>`<button class="pill ${q.n?'on':''}" data-queue="${q.id}" data-tip="${esc(q.hint)}" style="--c:${q.color};--ink:${q.color===COLOR.A?'#F2F0E9':'#141311'};--w:${150+Math.sqrt(q.n/max)*230}px;--d:${i*80}ms"><b data-count="${q.n}">0</b><span>${esc(q.label)}</span></button>`).join('')}</section>`;
}
function funnelSVG(group,stages,leak){
  // Fixed funnel outline so it always reads as a funnel; counts sit on each tier and booked calls are the dot at the point.
  const tiers=stages.slice(0,-1),close=stages.at(-1),cx=300,G=20;
  const shape=[{top:600,bottom:440,h:140},{top:412,bottom:272,h:128},{top:250,bottom:122,h:118},{top:116,bottom:0,h:118}];
  let y=0;const rows=[];
  const parts=tiers.map((s,i)=>{const g=shape[i],t=y,n=group.totals[s.id];y+=g.h+G;rows.push({s,mid:t+g.h/2});
    const d=g.bottom?`M${cx-g.top/2},${t} L${cx+g.top/2},${t} L${cx+g.bottom/2},${t+g.h} L${cx-g.bottom/2},${t+g.h} Z`:`M${cx-g.top/2},${t} L${cx+g.top/2},${t} L${cx},${t+g.h} Z`;
    const tipText=`<b>${esc(s.label)}</b><br>${n} ${n===1?'person':'people'}${i?`<br>${pct(group.step[s.id])} of ${esc(stages[i-1].label.toLowerCase())}`:''}`;
    return `<g class="tier" style="--d:${i*120}ms" tabindex="0" data-tip="${esc(tipText)}"><path d="${d}" fill="${COLOR[s.id]}" stroke="${COLOR[s.id]}"/><text x="${cx}" y="${g.bottom?t+g.h/2+15:t+46}" text-anchor="middle" fill="${INK_ON[s.id]}" class="tier-count" data-count="${n}">0</text></g>`;}).join('');
  const dotY=y+10,n=group.totals[close.id];rows.push({s:close,mid:dotY});
  const dot=`<g class="close-dot" style="--d:${tiers.length*120}ms" tabindex="0" data-tip="<b>${esc(close.label)}</b><br>${n} ${n===1?'call':'calls'}"><circle cx="${cx}" cy="${dotY}" r="${n?22:12}" fill="${n?COLOR.D:'none'}" stroke="${COLOR.D}" stroke-width="3"/>${n?`<text x="${cx}" y="${dotY+7}" text-anchor="middle" class="dot-n">${n}</text>`:''}</g>`;
  const leakIdx=leak?stages.findIndex(s=>s.id===leak.id):-1;
  const leakMark=leakIdx>0&&leakIdx<tiers.length?(()=>{let yy=-G/2;for(let i=0;i<leakIdx;i++)yy+=shape[i].h+G;const half=shape[leakIdx-1].bottom/2;
    return `<g class="leak-mark"><line x1="${cx-half-80}" x2="${cx-half-12}" y1="${yy}" y2="${yy}"/><text x="${cx-half-90}" y="${yy+5}" text-anchor="end">BIGGEST DROP</text></g>`;})():'';
  const labels=rows.map(({s,mid},i)=>`<g class="tier-text" style="--d:${i*120+200}ms"><circle cx="672" cy="${mid-14}" r="9" fill="${COLOR[s.id]}"/><text x="694" y="${mid-6}" class="tt-title">${esc(s.label)}</text><text x="694" y="${mid+22}" class="tt-desc">${esc(STAGE_COPY[s.id])}${i?` · ${pct(group.step[s.id])} of previous`:''}</text></g>`).join('');
  return `<svg class="funnel-svg" viewBox="-170 -10 1270 ${dotY+44}" role="img" aria-label="Funnel: ${stages.map(s=>s.label+' '+group.totals[s.id]).join(', ')}">${parts}${dot}${leakMark}${labels}</svg>`;
}
function capsules(group,stages){
  // Capsule bars: each stage's count as a share of everyone initiated; the value sits above the capsule.
  const top=Math.max(group.totals.A,1);
  return `<div class="capsules" role="img" aria-label="${stages.map(s=>s.label+' '+group.totals[s.id]).join(', ')}">${stages.map((s,i)=>{const n=group.totals[s.id],h=n?16+84*n/top:0;
    return `<div class="capsule-col" style="--d:${i*90}ms" tabindex="0" data-tip="<b>${esc(s.label)}</b><br>${n} · ${pct(group.overall[s.id])} of initiated"><span class="capsule-n" data-count="${n}">0</span><span class="capsule" style="height:${h}%;background:${COLOR[s.id]}"></span>${n?'':'<span class="capsule capsule-empty"></span>'}<span class="capsule-l">${esc(s.label)}</span></div>`;}).join('')}</div>`;
}
const WEEKS=8;
function weekBuckets(list){
  const week=d=>{const t=new Date(d);t.setUTCHours(0,0,0,0);t.setUTCDate(t.getUTCDate()-((t.getUTCDay()+6)%7));return t.getTime();};
  const now=week(new Date()),weeks=[...Array(WEEKS)].map((_,i)=>now-(WEEKS-1-i)*7*86400000);
  const per=id=>weeks.map(w=>list.filter(p=>p.marks[id]&&week(p.marks[id])===w).length);
  return {weeks,A:per('A'),B:per('B'),D:per('D')};
}
const weekLabel=w=>new Date(w).toLocaleDateString(undefined,{day:'numeric',month:'short',timeZone:'UTC'});
function trendLines(b){
  // Thick rounded lines that fade in from the left, ending on a white dot at this week.
  const W=560,H=260,series=[['A','First touches'],['B','Replies'],['D','Calls booked']];
  const max=Math.max(...series.flatMap(([id])=>b[id]),1),x=i=>20+i*(W-60)/(WEEKS-1),y=n=>H-40-(H-80)*n/max;
  const grads=series.map(([id])=>`<linearGradient id="fade-${id}" x1="0" x2="1"><stop offset="0" stop-color="${COLOR[id]}" stop-opacity="0"/><stop offset=".35" stop-color="${COLOR[id]}"/></linearGradient>`).join('');
  const lines=series.map(([id,label],k)=>{const pts=b[id].map((n,i)=>[x(i),y(n)+k*6]);const end=pts.at(-1);
    return `<path pathLength="1" class="trend" style="--d:${k*200}ms" d="${smooth(pts)}" stroke="url(#fade-${id})"/><circle class="trend-dot" style="--d:${k*200+1300}ms" cx="${end[0]}" cy="${end[1]}" r="9"/>`;}).join('');
  const hits=b.weeks.map((w,i)=>`<rect x="${x(i)-30}" y="0" width="60" height="${H}" fill="transparent" data-tip="<b>Week of ${weekLabel(w)}</b><br>${series.map(([id,l])=>`${l}: ${b[id][i]}`).join('<br>')}"/>`).join('');
  return `<svg class="trend-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Per week: ${series.map(([id,l])=>l+' '+b[id].join(' ')).join('; ')}"><defs>${grads}</defs>${lines}<text x="${x(0)}" y="${H-8}" class="axis">${weekLabel(b.weeks[0])}</text><text x="${x(WEEKS-1)}" y="${H-8}" text-anchor="end" class="axis">This week</text>${hits}</svg>${legend(series.map(([id,l])=>[l,COLOR[id]]))}`;
}
function reachArea(b){
  // Running totals as overlapping soft areas inside a rounded frame: the gap between them is everyone still waiting on a reply.
  const W=560,H=260,run=a=>a.reduce((o,n)=>[...o,(o.at(-1)||0)+n],[]),A=run(b.A),B=run(b.B),max=Math.max(...A,1);
  const x=i=>i*W/(WEEKS-1),y=n=>H-12-(H-40)*n/max;
  const area=v=>`${smooth(v.map((n,i)=>[x(i),y(n)]))} L${W},${H} L0,${H} Z`;
  return `<svg class="area-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Running total: ${A.at(-1)} reached, ${B.at(-1)} replied"><defs><clipPath id="area-clip"><rect width="${W}" height="${H}" rx="44"/></clipPath></defs><g clip-path="url(#area-clip)"><path class="area" d="${area(A)}" fill="${COLOR.MS}"/><path class="area" style="--d:200ms" d="${area(B)}" fill="${COLOR.D}"/></g>${A.map((n,i)=>`<rect x="${x(i)-35}" y="0" width="70" height="${H}" fill="transparent" data-tip="<b>By ${weekLabel(b.weeks[i])}</b><br>${n} reached · ${B[i]} replied"/>`).join('')}</svg>${legend([['Reached, running total',COLOR.MS],['Replied, running total',COLOR.D]])}`;
}
function flowSVG(list,stages){
  // Each line is one person, coloured by the furthest stage they reached. Short loose lines have not been contacted yet.
  const W=1000,H=420,cx=250,X={A:380,MS:520,B:660,C:800,D:940},rows=list.slice(0,220);
  const r=rand(7),started=rows.filter(p=>p.reached),idle=rows.filter(p=>!p.reached);
  const lane=(i,n)=>40+(H-80)*(n<2?.5:i/(n-1));
  const drift=(y,a)=>Math.max(8,Math.min(H-8,y+(r()-.5)*a));
  const wiggle=(y,end=cx)=>{let d=`M0,${drift(y,220).toFixed(1)}`;for(let x=125;x<=end;x+=125)d+=` S${x-62},${drift(y,180*(1-x/cx)+40).toFixed(1)} ${x},${(x===cx?y:drift(y,120)).toFixed(1)}`;return d;};
  const lines=started.map((p,i)=>{const y=lane(i,started.length);
    return `<path pathLength="1" class="thread" stroke="${COLOR[p.reached]}" style="--d:${(i%40)*18}ms" d="${wiggle(y)} L${cx+30},${y} L${X[p.reached]},${H/2}" data-tip="<b>${esc(p.name)}</b><br>${esc(p.company)}<br>Reached: ${esc(stages.find(s=>s.id===p.reached).label)}"/>`;}).join('');
  const loose=idle.map((p,i)=>`<path pathLength="1" class="thread idle" style="--d:${(i%40)*18}ms" d="${wiggle(lane(i,idle.length),cx-125)}" data-tip="<b>${esc(p.name)}</b><br>${esc(p.company)}<br>Not contacted yet"/>`).join('');
  const nodes=stages.map(s=>{const past=started.filter(p=>stages.findIndex(x=>x.id===p.reached)>=stages.findIndex(x=>x.id===s.id)).length;
    return `<g class="node" transform="translate(${X[s.id]},${H/2})"><circle r="${past?11:8}" fill="${past?COLOR[s.id]:'var(--paper)'}" stroke="${COLOR[s.id]}" stroke-width="3"/><text y="-24" text-anchor="middle">${esc(s.label)}</text><text y="40" text-anchor="middle" class="node-n">${past}</text></g>`;}).join('');
  return `<svg class="flow-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${started.length} people contacted, ${idle.length} not yet">${loose}${lines}<line x1="${cx+30}" x2="${cx+30}" y1="30" y2="${H-30}" class="gate-line"/><text x="${cx+30}" y="18" text-anchor="middle" class="gate-label">Contacted</text>${nodes}</svg><p class="small">${started.length} people contacted · ${idle.length} not yet${list.length>rows.length?` · showing ${rows.length} of ${list.length}`:''}. Hover a line to see who it is.</p>`;
}
function monthPairs(group,stages){
  // Two capsules per stage: last month and this month, with the value above each.
  const months=group.months,now=months.at(-1),before=months.at(-2);
  if(!now)return '<p>No outreach recorded yet.</p>';
  const max=Math.max(...stages.flatMap(s=>[now.totals[s.id],before?.totals[s.id]||0]),1);
  const cap=(n,color,muted)=>`<span class="pair-cap"><span class="capsule-n">${n}</span><span class="capsule${muted?' muted':''}${n?'':' capsule-empty'}" style="height:${n?14+86*n/max:0}%;${n?`background:${color}`:''}"></span></span>`;
  return `<div class="pairs">${stages.map((s,i)=>{const a=before?.totals[s.id]||0,b=now.totals[s.id];
    return `<div class="pair" style="--d:${i*90}ms" tabindex="0" data-tip="<b>${esc(s.label)}</b><br>${before?esc(monthName(before.month)):'Month before'}: ${a}<br>${esc(monthName(now.month))}: ${b}"><div class="pair-bars">${cap(a,COLOR[s.id],true)}${cap(b,COLOR[s.id])}</div><span class="capsule-l">${esc(s.label)}</span></div>`;}).join('')}</div>${legend([[before?monthName(before.month):'Month before','#cfccc2'],[monthName(now.month),'#141311']])}`;
}
function campaignPills(report){
  const total=report.campaigns.reduce((n,c)=>n+c.totals.A,0)||1,palette=[COLOR.B,COLOR.C,COLOR.MS,COLOR.A];
  return `<div class="campaign-pack">${report.campaigns.map((c,i)=>{const share=c.totals.A/total;
    return `<button class="campaign-pill" data-campaign="${esc(c.id)}" style="flex-grow:${Math.max(share,.15)};background:${palette[i%palette.length]};--d:${i*90}ms" data-tip="<b>${esc(c.name)}</b><br>${c.totals.A} initiated · ${c.totals.B} replied · ${c.totals.D} booked"><b data-count="${Math.round(share*100)}" data-suffix="%">0%</b><span>${esc(c.name)}</span><small>${c.contacts} people · ${pct(c.overall.B)} reply · ${pct(c.overall.D)} booked</small></button>`;}).join('')}</div>`;
}
function funnelTable(group,stages){
  const months=group.months;
  const head=`<thead><tr><th>Stage</th>${months.map(m=>`<th>${esc(monthName(m.month))}</th>`).join('')}<th>Total</th></tr></thead>`;
  const counts=stages.map(s=>`<tr><td>${esc(s.label)} (${s.id})</td>${months.map(m=>`<td>${m.totals[s.id]}</td>`).join('')}<td class="total">${group.totals[s.id]}</td></tr>`).join('');
  const rates=stages.slice(1).map((s,i)=>`<tr class="rate"><td>${esc(stages[i].id)} → ${esc(s.id)}</td>${months.map(m=>`<td>${pct(m.step[s.id])}</td>`).join('')}<td class="total">${pct(group.step[s.id])}</td></tr>`).join('');
  return `<div class="table-wrap"><table class="funnel-table">${head}<tbody>${counts}${rates}</tbody></table></div>`;
}
async function renderFunnel(){
  const box=$('#funnel-view');
  try{
    const response=await fetch('/api/funnel',{cache:'no-store'});if(!response.ok)throw new Error('Funnel unavailable');
    const report=await response.json();
    const group=collection==='all'?report.all:report.campaigns.find(c=>c.id===collection)||{totals:{A:0,MS:0,B:0,C:0,D:0},overall:{},step:{},months:[]};
    const list=report.people.filter(p=>collection==='all'||p.campaign===collection),weeks=weekBuckets(list);
    const sync=report.views_sync,seenTracked=sync?.status==='ok',leak=biggestDrop(group.totals,report.stages,seenTracked);
    const syncLine=!sync?'Microsite opens are not tracked yet, so “seen” stays at 0 for now.':seenTracked?'Microsite opens checked '+date(sync.checked_at)+'.':'Microsite opens could not be checked ('+esc(sync.error||'error')+').';
    const title=collection==='all'?'All campaigns':(report.campaigns.find(c=>c.id===collection)?.name||collection);
    box.innerHTML=`<header class="dash-head"><p class="eyebrow">${esc(title)} · outreach at a glance</p><h2>${esc(headline(group,leak,report.stages))}</h2></header>
      ${pillsHTML(actionQueue())}
      <section class="dash-block"><h3>The funnel</h3><p class="small">${syncLine}</p>${funnelSVG(group,report.stages,leak)}</section>
      <div class="dash-grid">
        <section class="dash-block"><h3>How far they get</h3><p class="small">People at each stage.</p>${capsules(group,report.stages)}</section>
        <section class="dash-block"><h3>Week by week</h3><p class="small">New people reaching each stage, last ${WEEKS} weeks.</p>${trendLines(weeks)}</section>
        <section class="dash-block"><h3>This month</h3><p class="small">Against the month before.</p>${monthPairs(group,report.stages)}</section>
        <section class="dash-block"><h3>Reach so far</h3><p class="small">The gap is everyone still waiting on a reply.</p>${reachArea(weeks)}</section>
      </div>
      <section class="dash-block"><h3>Every person, one line</h3>${flowSVG(list,report.stages)}</section>
      ${collection==='all'&&report.campaigns.length>1?`<section class="dash-block"><h3>Campaigns</h3><p class="small">Size is share of outreach. Click one to focus on it.</p>${campaignPills(report)}</section>`:''}
      <details class="review-detail"><summary>Show the numbers as a table</summary>${group.months.length?funnelTable(group,report.stages):'<p>No outreach recorded yet.</p>'}</details>`;
    box.classList.remove('play');void box.offsetWidth;box.classList.add('play');
    bindTips(box);countUp(box);
  }catch(error){console.error('Funnel render failed:',error);box.innerHTML='<p>The funnel could not load. Try Refresh.</p>';}
}
$('#funnel-view').addEventListener('click',e=>{
  const q=e.target.closest('[data-queue]');if(q){tip.hide();setView('today');return;}
  const c=e.target.closest('[data-campaign]');if(c){const b=document.querySelector(`#collections [data-collection="${c.dataset.campaign}"]`);if(b)b.click();}
});
