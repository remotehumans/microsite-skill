// ABOUTME: Shared behaviour for microsite components: sliders, wipes, carousel, lenses and tower reveals.
// ABOUTME: Every component is optional; each block checks its element exists before wiring up.
(()=>{
  // time-of-day crossfade slider
  const day = document.getElementById('day');
  if (day) {
    const imgs = [...day.querySelectorAll('img')], r = document.getElementById('dayR'), clock = document.getElementById('clock');
    const times = [6, 12.5, 19, 22.5];
    const set = v => {
      imgs.forEach((im, k) => { im.style.opacity = Math.max(0, 1 - Math.abs(v - k)); });
      const i = Math.min(2, Math.floor(v)), f = v - i, h = times[i] + (times[i + 1] - times[i]) * f;
      clock.textContent = String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.round((h % 1) * 60 / 5) * 5 % 60).padStart(2, '0');
    };
    r.addEventListener('input', () => set(+r.value)); set(+r.value);
  }
  // seasons switcher
  const se = document.getElementById('season');
  document.querySelectorAll('.seasons button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.seasons button').forEach(x => x.classList.toggle('on', x === b));
    se.querySelectorAll('img').forEach(im => im.classList.toggle('on', im.dataset.k === b.dataset.s));
  }));
  // drag-to-compare wipes (sketch/render and before/after)
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  [['wipe','wipeTop','handle'],['wipe2','wipeTop2','handle2']].forEach(([wid, tid, hid]) => {
    const w = document.getElementById(wid);
    if (!w) return;
    const top = document.getElementById(tid), h = document.getElementById(hid);
    const set = p => { p = Math.max(0, Math.min(100, p)); top.style.clipPath = `inset(0 ${100 - p}% 0 0)`; h.style.left = p + '%'; };
    const move = e => { const b = w.getBoundingClientRect(); set((e.clientX - b.left) / b.width * 100); };
    let drag = false;
    w.addEventListener('pointerdown', e => { drag = true; w.setPointerCapture(e.pointerId); move(e); });
    w.addEventListener('pointermove', e => drag && move(e));
    w.addEventListener('pointerup', () => drag = false);
    if (!reduce) {
      new IntersectionObserver((es, o) => es.forEach(e => { if (!e.isIntersecting) return; o.disconnect();
        const t0 = performance.now(); const step = t => { const p = Math.min(1, (t - t0) / 2200);
          set(50 + Math.sin(p * Math.PI * 2) * 38 * (1 - p)); if (p < 1) requestAnimationFrame(step); }; requestAnimationFrame(step);
      }), {threshold: .5}).observe(w);
    }
  });

  // things I've built carousel: tabs, arrows, dots, keyboard and swipe
  const car = document.getElementById('car');
  if (car) {
    const slides = [...car.querySelectorAll('.slide')], tabs = [...car.querySelectorAll('.car-tabs button')], dots = document.getElementById('carDots');
    slides.forEach((_, k) => { const d = document.createElement('span'); d.addEventListener('click', () => go(k)); dots.appendChild(d); });
    let cur = 0;
    const go = k => {
      k = (k + slides.length) % slides.length;
      slides.forEach((sl, i) => { sl.classList.toggle('on', i === k); sl.classList.toggle('left', i < k); });
      tabs.forEach((t, i) => t.classList.toggle('on', i === k));
      [...dots.children].forEach((d, i) => d.classList.toggle('on', i === k));
      cur = k;
    };
    tabs.forEach((t, i) => t.addEventListener('click', () => go(i)));
    document.getElementById('carPrev').addEventListener('click', () => go(cur - 1));
    document.getElementById('carNext').addEventListener('click', () => go(cur + 1));
    car.addEventListener('keydown', e => { if (e.key === 'ArrowRight') go(cur + 1); if (e.key === 'ArrowLeft') go(cur - 1); });
    let x0 = null; const track = document.getElementById('carTrack');
    track.addEventListener('pointerdown', e => x0 = e.clientX);
    track.addEventListener('pointerup', e => { if (x0 === null) return; const dx = e.clientX - x0; if (Math.abs(dx) > 50) go(cur + (dx < 0 ? 1 : -1)); x0 = null; });
    go(0);
  }
  // the three lenses slide together when they scroll into view
  const lenses = document.getElementById('lenses');
  if (lenses) new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { lenses.classList.add('in'); o.disconnect(); } }), {threshold: .4}).observe(lenses);
  // building blocks stack up when the tower scrolls into view
  const tower = document.getElementById('tower');
  if (tower) new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { tower.classList.add('in'); o.disconnect(); } }), {threshold: .3}).observe(tower);
})();
// photo-led hero: gentle crossfade between the company's photos, with clickable dots
(()=>{
  const h = document.getElementById('phero');
  if (!h) return;
  const imgs = [...h.querySelectorAll('.ph-img')], dots = [...h.querySelectorAll('.ph-dots span')];
  let k = 0;
  const show = n => { k = (n + imgs.length) % imgs.length; imgs.forEach((im, i) => im.classList.toggle('on', i === k)); dots.forEach((d, i) => d.classList.toggle('on', i === k)); };
  dots.forEach((d, i) => d.addEventListener('click', () => show(i)));
  if (imgs.length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) setInterval(() => show(k + 1), 6000);
})();
