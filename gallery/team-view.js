// ABOUTME: Team tab for a company review: an interactive people map beside a person card.
// ABOUTME: Facts come from each company's microsites/<slug>/team-map.json in its campaign; LinkedIn activity scores are set by hand and kept in this browser.
(() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const store = {
    read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
    write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
  };
  const filters = {all: 'Everyone', tech: 'Mention tech', studying: 'Studying', scored: 'Scored on LinkedIn'};
  const state = {data: null, id: null, selected: null, filter: 'all', mine: {}};
  const cache = new Map();

  const mineKey = id => 'team-notes:' + id;
  const ring = score => score ? `hsl(18 ${45 + score * 5}% ${90 - score * 4.6}%)` : '';
  const matches = (p, f) => f === 'all' || (f === 'tech' && p.tech) || (f === 'studying' && p.studying) || (f === 'scored' && (state.mine[p.id]?.score || 0) > 0);

  async function load(r) {
    const id = r.id, slug = r.page_slug || r.source_id;
    if (cache.has(id)) return cache.get(id);
    const request = fetch(r.asset_base + 'microsites/' + encodeURIComponent(slug) + '/team-map.json').then(r => r.ok ? r.json() : null).catch(() => null);
    cache.set(id, request);
    return request;
  }

  // People sit inside their group's circle: one in the middle, two side by side, more on a ring.
  function place(group, members) {
    const n = members.length, ringRadius = group.r * (n === 2 ? .5 : n === 3 ? .56 : .56);
    return members.map((p, i) => {
      if (n === 1) return {p, x: group.cx, y: group.cy};
      const angle = -Math.PI / 2 + (i / n) * Math.PI * 2 + (n === 2 ? Math.PI / 2 : 0);
      return {p, x: group.cx + Math.cos(angle) * ringRadius, y: group.cy + Math.sin(angle) * ringRadius};
    });
  }

  function initials(name) { return name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase(); }

  function mapHTML(d) {
    const circles = d.groups.map(g => `<circle class="tm-group" cx="${g.cx}" cy="${g.cy}" r="${g.r}"/>`).join('');
    const labels = d.groups.map(g => `<span class="tm-glabel" style="left:${g.cx / 10}%;top:${(g.cy - g.r - 22) / 7.6}%">${esc(g.label)} <em>${d.people.filter(p => p.group === g.id).length}</em></span>`).join('');
    const firsts = d.people.map(p => p.name.split(' ')[0]);
    const shortName = p => { const f = p.name.split(' ')[0]; return firsts.filter(x => x === f).length > 1 ? f + ' ' + p.name.split(' ')[1][0] + '.' : f; };
    const bubbles = d.groups.flatMap(g => place(g, d.people.filter(p => p.group === g.id))).map(({p, x, y}) => {
      const score = state.mine[p.id]?.score || 0, on = matches(p, state.filter);
      const style = `left:${x / 10}%;top:${y / 7.6}%;${score ? `--ring:${ring(score)}` : ''}`;
      return `<button class="tm-person${state.selected === p.id ? ' is-selected' : ''}${on ? '' : ' is-dim'}${score ? ' has-score' : ''}" data-person="${esc(p.id)}" style="${style}" aria-pressed="${state.selected === p.id}" aria-label="${esc(p.name)}, ${esc(p.role)}">
        <span class="tm-photo">${p.photo?`<img src="${esc(p.photo)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`: ''}<b>${esc(initials(p.name))}</b></span>
        ${p.tech ? '<i class="tm-flag tm-tech" title="Mentions tech in their own bio"></i>' : ''}
        <span class="tm-name">${esc(shortName(p))}</span></button>`;
    }).join('');
    return `<div class="tm-map"><svg viewBox="0 0 1000 760" aria-hidden="true">${circles}</svg>${labels}${bubbles}</div>`;
  }

  function legendHTML() {
    const steps = [1, 3, 5, 7, 10].map(s => `<i style="--ring:${ring(s)}"></i>`).join('');
    return `<div class="tm-legend"><span><i class="tm-swatch tm-tech"></i> Mentions tech in their bio</span><span class="tm-scale">LinkedIn activity <span class="tm-steps"><i class="none"></i>${steps}</span> 1 quiet to 10 very active</span></div>`;
  }

  function phoneRosterHTML(d){
    return `<div class="tm-phone-roster">${d.groups.filter(g=>d.people.some(p=>p.group===g.id)).map(g=>`<section><h4>${esc(g.label)}</h4>${d.people.filter(p=>p.group===g.id).map(p=>`<button class="tm-phone-person" data-person="${esc(p.id)}"><span><b>${esc(p.name)}</b><small>${esc(p.role)}</small></span><span aria-hidden="true">→</span></button>`).join('')}</section>`).join('')}</div>`;
  }

  function stageHTML(d) {
    const chips = Object.entries(filters).filter(([k])=>!d.business_only||['all','scored'].includes(k)).map(([k, label]) => `<button data-filter="${k}" aria-pressed="${state.filter === k}">${esc(label)}</button>`).join('');
    return `${window.TeamIntelligence?.render(d.intelligence)||''}<header class="tm-head"><div><p class="tm-eyebrow">Team map</p><h3>${esc(d.company)} · ${d.people.length} people</h3><p class="small">Grouped by public job titles. Reporting lines are not confirmed.</p></div><div class="tm-chips" role="group" aria-label="Highlight">${chips}</div></header>${mapHTML(d)}${phoneRosterHTML(d)}${d.business_only?'':legendHTML()}`;
  }

  function statsHTML(d) {
    if(d.business_only)return `<p class="small">${d.people.length} public team roles · Checked ${esc(d.checked_on)}. This is a researched shortlist, not a full staff list.</p>`;
    const n = d.people.length, tech = d.people.filter(p => p.tech).length, study = d.people.filter(p => p.studying).length;
    const stat = (num, text) => `<div class="tm-stat"><b>${num}</b><span>${esc(text)}</span></div>`;
    return `<div class="tm-stats">${stat(`${tech} in ${n}`, 'mention tech in their own bio')}${stat(`${study} in ${n}`, 'are studying for a qualification')}</div>`;
  }

  function factsHTML(d) {
    return `<h4>The company</h4><ul class="tm-facts">${d.company_facts.map(f => `<li><b>${esc(f.label)}.</b> ${esc(f.value)} <span class="small">(${esc(f.source)})</span></li>`).join('')}</ul>
      <p class="tm-take">${esc(d.summary||'These are public team roles. Check who owns the work and who can approve a Sprint.')}</p>`;
  }

  function personHTML(p) {
    const mine = state.mine[p.id] || {}, score = mine.score || 0;
    const group = state.data.groups.find(g => g.id === p.group)?.label;
    const li = p.linkedin ? `<a href="${esc(p.linkedin)}" target="_blank" rel="noopener noreferrer">Open LinkedIn ↗</a>` : `<span class="small">No LinkedIn link used. ${esc(p.linkedin_note || '')}</span>`;
    return `<article class="tm-card"><div class="tm-card-top"><span class="tm-photo tm-big">${p.photo?`<img src="${esc(p.photo)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">`: ''}<b>${esc(initials(p.name))}</b></span><div><h3>${esc(p.name)}</h3><p class="small">${esc(p.role)} · ${esc(group)}</p></div></div>
      <dl class="tm-dl">
      <div><dt>Background</dt><dd>${esc(p.background)}</dd></div>
      ${(p.interests||[]).length?`<div><dt>Interests</dt><dd>${(p.interests||[]).map(i => `<span class="tm-tag">${esc(i)}</span>`).join('')}</dd></div>`:''}
      ${p.tech ? `<div><dt>On tech</dt><dd>${esc(p.tech)}</dd></div>` : ''}
      <div><dt>Possible Sprint focus</dt><dd>${esc(p.help)}</dd></div></dl>
      <div class="tm-routes">${p.email?`<a href="mailto:${esc(p.email)}">Email ${esc(p.name.split(' ')[0])}</a> <span class="small">${esc(String(p.email_status).startsWith('provider_verified')?'Provider-verified work email':'Published work email')}</span>`:''}${p.phone?`<p><a href="${esc(callLink(p.phone))}">${esc(p.phone)}</a> <span class="small">${esc(p.phone_kind||'Business phone')}</span></p>`:''}${p.role_source?docButton(p.role_source,'Role source'):''}${p.email_source?docButton(p.email_source,'Email source'):''}${p.email_verification_source?docButton(p.email_verification_source,'Mailbox check'):''}${p.email_status==='provider_verified_catchall'?'<p class="small">Accept-all domain: provider rates this address deliverable, but the exact mailbox remains uncertain.</p>':''}</div>
      <div class="tm-score"><label for="tm-score">LinkedIn activity: <b data-score-text>${score ? score + ' of 10' : 'not scored yet'}</b></label>
        <input id="tm-score" type="range" min="0" max="10" step="1" value="${score}" aria-describedby="tm-score-help"><p id="tm-score-help" class="small">0 = not scored. 1 to 3 rarely posts. 4 to 6 posts now and then. 7 to 10 posts most weeks. Set this after you read their profile.</p>
        <label for="tm-notes">Notes</label><textarea id="tm-notes" placeholder="What they share, what they care about…">${esc(mine.notes || '')}</textarea><p class="small" data-saved>${li}</p>${p.linkedin ? `<p class="small"><a href="${esc(p.linkedin.replace(/\/?$/, '/') + 'recent-activity/all/')}" target="_blank" rel="noopener noreferrer">Open their recent activity ↗</a></p>` : ''}</div>
      <div class="tm-progress"><span>${scoredCount()} of ${state.data.people.length} scored</span><button data-next-unscored>Next unscored person →</button></div></article>`;
  }

  const scoredCount = () => state.data.people.filter(p => (state.mine[p.id]?.score || 0) > 0).length;
  function sideHTML(d) {
    const p = d.people.find(x => x.id === state.selected);
    return statsHTML(d) + (p ? personHTML(p) : '<p class="tm-hint">Click a person on the map to see who they are and what they care about.</p>') + factsHTML(d);
  }

  function save(personId) {
    const root = document.querySelector('#evidence');
    const score = Number(root.querySelector('#tm-score')?.value || 0), notes = root.querySelector('#tm-notes')?.value || '';
    state.mine[personId] = {score, notes, updated: new Date().toISOString()};
    store.write(mineKey(state.id), state.mine);
    root.querySelector('[data-score-text]').textContent = score ? score + ' of 10' : 'not scored yet';
    const bubble = document.querySelector(`#team-stage [data-person="${personId}"]`);
    if (bubble) { bubble.classList.toggle('has-score', score > 0); if (score) bubble.style.setProperty('--ring', ring(score)); else bubble.style.removeProperty('--ring'); }
  }

  function draw() {
    const stage = document.querySelector('#team-stage'), side = document.querySelector('#evidence');
    if (!stage || !state.data) return;
    stage.innerHTML = stageHTML(state.data);
    side.innerHTML = sideHTML(state.data);
    const person = state.selected;
    if (person) {
      const area = side.querySelector('#tm-notes');
      side.querySelector('#tm-score')?.addEventListener('input', () => save(person));
      area?.addEventListener('input', () => save(person));
    }
  }

  function ensureStage() {
    let stage = document.querySelector('#team-stage');
    if (!stage) { stage = document.createElement('div'); stage.id = 'team-stage'; document.querySelector('.site-pane').append(stage); }
    return stage;
  }

  async function show() {
    const r = current;
    if (!r) return;
    const stage = ensureStage();
    stage.hidden = false; stage.innerHTML = '<p class="tm-hint">Loading the team…</p>';
    const id = r.id, d = await load(r);
    if (current !== r || tab !== 'team') return;
    if (!d) {
      stage.innerHTML = '<p class="tm-hint">Team research has not been gathered for this company yet.</p>';
      document.querySelector('#evidence').innerHTML = '<h3>Team</h3><p class="small">Team research has not been gathered for this company yet. It reads the public team page and notes where people are, what they care about and how active they are on LinkedIn.</p>';
      return;
    }
    state.data = d; state.id = id; state.selected = state.selected && d.people.some(p => p.id === state.selected) ? state.selected : d.people[0].id;
    state.mine = store.read(mineKey(id), {});
    draw();
  }

  function hide() { const stage = document.querySelector('#team-stage'); if (stage) stage.hidden = true; }

  const original = switchTab;
  switchTab = function (next) { document.querySelector('#reviewer').dataset.tab = next; original(next); if (next === 'team') { show(); if(innerWidth<=750)setMobilePane('page'); } else hide(); };

  document.addEventListener('click', event => {
    if (event.target.closest('[data-next-unscored]') && state.data) {
      const list = state.data.people, start = list.findIndex(p => p.id === state.selected);
      const next = [...list.slice(start + 1), ...list.slice(0, start + 1)].find(p => !(state.mine[p.id]?.score > 0));
      if (next) { state.selected = next.id; draw(); }
      return;
    }
    const stage = event.target.closest('#team-stage');
    if (!stage) return;
    const bubble = event.target.closest('[data-person]'), chip = event.target.closest('[data-filter]');
    if (bubble) { state.selected = bubble.dataset.person; draw(); document.querySelector('#evidence').scrollTop = 0;if(innerWidth<=750)setMobilePane('opportunity'); }
    if (chip) { state.filter = chip.dataset.filter; draw(); }
  });
})();
