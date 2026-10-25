// ABOUTME: Measures a page's design system from computed styles: type, palette by area, buttons, header layers, hero, cards, section bands and motion.
// ABOUTME: Runs in the browser (agent-browser eval, or any browser tool's JS runner) on their site and on our page, so both are measured the same way.
(() => {
  scrollTo(0, 0);
  const cs = e => getComputedStyle(e);
  const W = innerWidth, H = innerHeight;
  const visible = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && cs(e).visibility !== 'hidden' && cs(e).display !== 'none'; };
  const all = [...document.querySelectorAll('body *')].filter(visible);
  const top = e => e.getBoundingClientRect().top + scrollY;
  const rgb = c => { const m = c.match(/[\d.]+/g); return m ? m.slice(0, 4).map(Number) : null; };
  const opaque = c => { const v = rgb(c); return v && (v.length < 4 || v[3] > 0.5); };
  const hex = c => { const v = rgb(c); return v ? '#' + v.slice(0, 3).map(n => Math.round(n).toString(16).padStart(2, '0')).join('') : null; };
  const family = e => cs(e).fontFamily.split(',')[0].replace(/["']/g, '').trim();
  const type = sel => { const e = [...document.querySelectorAll(sel)].find(visible); if (!e) return null; const s = cs(e);
    return { family: family(e), size: parseFloat(s.fontSize), weight: +s.fontWeight, transform: s.textTransform, color: hex(s.color),
             spacing: s.letterSpacing, accent: (() => { const a = e.querySelector('span,em,strong,b'); return a && cs(a).color !== s.color ? hex(cs(a).color) : null; })() }; };
  // Palette weighted by the area each opaque background covers, which is what the eye sees.
  const paras = [...document.querySelectorAll('p,li')].filter(e => visible(e) && e.innerText.trim().length > 40 && parseFloat(cs(e).fontSize) <= 22);
  const tally = a => Object.entries(a.reduce((m, v) => (m[v] = (m[v] || 0) + 1, m), {})).sort((x, y) => y[1] - x[1]);
  const bodyFamily = tally(paras.map(family))[0]?.[0] || null;
  const bodyEl = paras.find(e => family(e) === bodyFamily);
  // Display type: the largest text in the first screen, whatever its tag.
  const firstScreen = all.filter(e => top(e) < H && e.childNodes.length && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 3));
  const displayEl = firstScreen.sort((a, b) => parseFloat(cs(b).fontSize) - parseFloat(cs(a).fontSize))[0];
  const typeOf = e => { if (!e) return null; const s = cs(e); const a = e.querySelector('span,em,strong,b');
    return { family: family(e), size: parseFloat(s.fontSize), weight: +s.fontWeight, transform: s.textTransform, color: hex(s.color), spacing: s.letterSpacing,
             align: s.textAlign, accent: a && cs(a).color !== s.color ? hex(cs(a).color) : null }; };
  const area = {};
  for (const e of all) { const s = cs(e); if (!opaque(s.backgroundColor)) continue; const r = e.getBoundingClientRect();
    const k = hex(s.backgroundColor); area[k] = (area[k] || 0) + Math.min(r.width, W) * Math.min(r.height, 4000); }
  const totalArea = Object.values(area).reduce((a, b) => a + b, 0) || 1;
  const palette = Object.entries(area).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c, a]) => ({ color: c, share: +(a / totalArea).toFixed(3) }));
  const radiusKind = r => { const v = parseFloat(r) || 0; return v >= 40 ? 'pill' : v >= 10 ? 'round' : v >= 2 ? 'soft' : 'square'; };
  const buttons = all.filter(e => (e.matches('a,button') && top(e) > 120 && (/btn|button|cta/i.test(e.className) || opaque(cs(e).backgroundColor)) && e.innerText.trim().length < 40
    && e.getBoundingClientRect().height < 80 && e.getBoundingClientRect().height > 28)).slice(0, 12).map(e => { const s = cs(e);
    return { text: e.innerText.trim().slice(0, 30), bg: opaque(s.backgroundColor) ? hex(s.backgroundColor) : 'transparent', color: hex(s.color),
             radius: radiusKind(s.borderRadius), border: s.borderWidth !== '0px' ? s.borderWidth + ' ' + hex(s.borderColor) : null,
             padding: s.padding, family: family(e), transform: s.textTransform, underline: s.textDecorationLine.includes('underline') }; });
  // What is painted at a point: the nearest ancestor with an opaque background, plus any photo layer.
  const paintAt = (x, y) => { const stack = document.elementsFromPoint(x, y);
    const photo = stack.some(e => { const r = e.getBoundingClientRect(); return (e.tagName === 'IMG' || e.tagName === 'VIDEO' || cs(e).backgroundImage.includes('url(')) && r.width >= W * 0.6 && r.height >= 180; });
    const tint = stack.find(e => { const v = rgb(cs(e).backgroundColor); return v && v.length === 4 && v[3] > 0.12 && v[3] < 0.95; });
    const solid = stack.find(e => opaque(cs(e).backgroundColor));
    return { bg: solid ? hex(cs(solid).backgroundColor) : '#ffffff', photo, tint: !!tint }; };
  // Header: distinct horizontal bars from the top, sampled down the right half where menus and buttons sit.
  // Stop at a photo or at the first band too tall to be a bar (a plain hero or page body).
  const strips = []; for (let y = 2; y < 420; y += 4) { const p = paintAt(W * 0.62, y); const last = strips[strips.length - 1];
    if (p.photo || (last && last.height > 180)) break; if (last && last.bg === p.bg) last.height += 4; else strips.push({ top: y, height: 4, bg: p.bg }); }
  const bars = strips.filter(b => b.height >= 20 && b.height <= 180);
  const headerEl = document.querySelector('header,[class*=header],nav');
  const header = { layers: bars.length, bars: bars.slice(0, 3), height: bars.length ? bars[bars.length - 1].top + bars[bars.length - 1].height : 0,
                   position: headerEl ? cs(headerEl).position : null, nav_links: headerEl ? [...headerEl.querySelectorAll('a')].filter(visible).length : 0 };
  // Hero: sample the first screen below the header.
  const heroY = Math.min(H - 60, header.height + (H - header.height) / 2);
  const centre = paintAt(W / 2, heroY), edge = paintAt(W * 0.04, heroY);
  const framed = all.some(e => { const s = cs(e); const r = e.getBoundingClientRect();
    return r.top < H && r.bottom > header.height && parseFloat(s.borderTopWidth) >= 1 && parseFloat(s.borderLeftWidth) >= 1 && parseFloat(s.borderRightWidth) >= 1
      && r.width > W * 0.3 && r.height > 150 && !opaque(s.backgroundColor); });
  // How the hero photo is framed (shown shape against its own shape) and what shades it, so both can be copied exactly.
  const heroImg = document.elementsFromPoint(W / 2, heroY).find(e => (e.tagName === 'IMG' || e.tagName === 'VIDEO' || cs(e).backgroundImage.includes('url(')) && e.getBoundingClientRect().width >= W * 0.6);
  const heroRect = heroImg ? heroImg.getBoundingClientRect() : null;
  const shades = document.elementsFromPoint(W / 2, heroY).filter(e => { const v = rgb(cs(e).backgroundColor); return (v && v.length === 4 && v[3] > 0.05 && v[3] < 0.95) || /gradient/.test(cs(e).backgroundImage); })
    .map(e => ({ color: cs(e).backgroundColor, gradient: (cs(e).backgroundImage.match(/(linear|radial)-gradient\(.*\)/) || [null])[0] }));
  const hero = { photo: centre.photo, full_bleed: centre.photo && edge.photo, overlay: centre.tint || shades.length > 0, framed,
                 align: displayEl ? cs(displayEl).textAlign : null, text_color: displayEl ? hex(cs(displayEl).color) : null,
                 top: heroRect ? Math.round(heroRect.top + scrollY) : null, bottom: heroRect ? Math.round(heroRect.bottom + scrollY) : null,
                 shown_ratio: heroRect ? +(heroRect.width / heroRect.height).toFixed(2) : null,
                 natural_ratio: heroImg && heroImg.naturalWidth ? +(heroImg.naturalWidth / heroImg.naturalHeight).toFixed(2) : null,
                 position: heroImg ? cs(heroImg).objectPosition : null, shades };
  const buttonKinds = tally(buttons.map(b => b.radius));
  // Cards: repeated sibling blocks of similar size.
  const groups = {};
  for (const e of all) { const r = e.getBoundingClientRect(); if (r.width < 160 || r.width > W * 0.5 || r.height < 120) continue;
    const k = e.parentElement; if (!k) continue; (groups[k.dataset.probeId ||= Math.random().toString(36).slice(2)] ||= []).push(e); }
  const cardSet = Object.values(groups).filter(g => g.length >= 3).sort((a, b) => top(a[0]) - top(b[0]))[0] || [];
  const card = cardSet[0] ? (() => { const s = cs(cardSet[0]); const img = cardSet[0].querySelector('img');
    return { count: cardSet.length, radius: radiusKind(s.borderRadius), shadow: s.boxShadow !== 'none', bg: opaque(s.backgroundColor) ? hex(s.backgroundColor) : 'transparent',
             border: s.borderWidth !== '0px', image: !!img, image_ratio: img ? +(img.getBoundingClientRect().width / Math.max(1, img.getBoundingClientRect().height)).toFixed(2) : null }; })() : null;
  // Section bands down the page: alternating dark and light rhythm.
  const lum = c => { const v = rgb(c); return v ? (0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]) / 255 : 1; };
  const bands = all.filter(e => e.getBoundingClientRect().width >= W * 0.95 && e.getBoundingClientRect().height >= 200 && opaque(cs(e).backgroundColor))
    .map(e => ({ top: Math.round(top(e)), bg: hex(cs(e).backgroundColor), dark: lum(cs(e).backgroundColor) < 0.35 }))
    .sort((a, b) => a.top - b.top).filter((b, i, a) => !i || b.top - a[i - 1].top > 150).slice(0, 14);
  // Motion: transitions, keyframes, running animations, libraries and scroll behaviour.
  const durations = all.map(e => cs(e).transitionDuration.split(',').map(parseFloat)).flat().filter(d => d > 0);
  const easings = {}; for (const e of all) { const s = cs(e); if (parseFloat(s.transitionDuration) > 0) { const k = s.transitionTimingFunction.split(',')[0]; easings[k] = (easings[k] || 0) + 1; } }
  let keyframes = []; for (const sheet of document.styleSheets) { try { keyframes.push(...[...sheet.cssRules].filter(r => r.type === 7).map(r => r.name)); } catch (e) {} }
  const libs = ['lenis', 'gsap', 'ScrollTrigger', 'Swiper', 'Splide', 'AOS', 'jQuery', 'LocomotiveScroll', 'Flickity', 'barba'].filter(k => window[k] || document.querySelector(`[class*=${k.toLowerCase()}],[data-${k.toLowerCase()}]`));
  const motion = { transitions: durations.length, median_duration: durations.length ? durations.sort((a, b) => a - b)[Math.floor(durations.length / 2)] : 0,
                   easing: Object.entries(easings).sort((a, b) => b[1] - a[1])[0]?.[0] || null, keyframes: [...new Set(keyframes)].slice(0, 20),
                   animations: document.getAnimations().length, libraries: libs, smooth_scroll: cs(document.documentElement).scrollBehavior === 'smooth' || libs.includes('lenis'),
                   reveal_on_scroll: all.some(e => /reveal|fade|animate|aos|in-view|slide/i.test(e.className) && typeof e.className === 'string') };
  return { url: location.href, title: document.title, viewport: [W, H], height: document.documentElement.scrollHeight,
           type: { display: typeOf(displayEl), h1: type('h1'), h2: type('h2'), h3: type('h3'), body: typeOf(bodyEl), nav: type('nav a, header a') },
           palette, buttons, button_shape: buttonKinds[0]?.[0] || null, header, hero, card, bands, motion };
})()
