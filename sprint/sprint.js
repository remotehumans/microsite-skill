// ABOUTME: Runs the report book, full-size reader, example tabs and sticky story art.
// ABOUTME: Uses the shared StPageFlip vendor and honours reduced motion.
(() => {
  const book = document.getElementById('df-book');
  if (!book || !window.St) throw new Error('The report book or StPageFlip is missing');
  const pages = [...book.querySelectorAll('.pf-page')];
  const total = pages.length;
  const width = Math.min(book.parentElement.clientWidth || 900, 980);
  const single = width < 700;
  const pageWidth = Math.floor(single ? Math.min(width, 420) : width / 2);
  const flip = new St.PageFlip(book, {
    width: pageWidth,
    height: Math.round(pageWidth * 1.414),
    size: 'fixed',
    showCover: true,
    usePortrait: single,
    drawShadow: true,
    maxShadowOpacity: .4,
    flippingTime: matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 800,
    mobileScrollSupport: false,
    showPageCorners: true
  });
  window.dfReportBook = flip;
  flip.loadFromHTML(pages);
  const previous = document.getElementById('df-bkPrev');
  const next = document.getElementById('df-bkNext');
  const label = document.getElementById('df-bkLabel');
  function render() {
    const index = flip.getCurrentPageIndex();
    previous.disabled = index === 0;
    next.disabled = index >= total - 1;
    label.textContent = index === 0 ? 'Cover' : index >= total - 1 ? 'Back cover' :
      (single ? `Page ${index + 1}` : `Pages ${index + 1}–${Math.min(index + 2, total)}`) + ` of ${total}`;
  }
  previous.onclick = () => flip.flipPrev();
  next.onclick = () => flip.flipNext();
  flip.on('flip', render);
  render();

  const dialog = document.getElementById('df-report-reader');
  const host = document.getElementById('df-reader-pages');
  // Clone only content. StPageFlip's transformed outer pages stay in the book.
  pages.forEach((page, index) => {
    const frame = document.createElement('div');
    frame.className = 'df-reader-page';
    frame.setAttribute('aria-label', `Sample report page ${index + 1}`);
    const copy = page.querySelector('.pg').cloneNode(true);
    const ids = new Map();
    copy.querySelectorAll('[id]').forEach(element => {
      const old = element.id;
      element.id = `df-reader-${old}`;
      ids.set(old, element.id);
    });
    copy.querySelectorAll('*').forEach(element => {
      [...element.attributes].forEach(attribute => {
        let value = attribute.value;
        if (attribute.name === 'aria-labelledby') {
          value = value.split(' ').map(id => ids.get(id) || id).join(' ');
        } else {
          ids.forEach((fresh, old) => { value = value.replaceAll(`url(#${old})`, `url(#${fresh})`); });
        }
        if (value !== attribute.value) element.setAttribute(attribute.name, value);
      });
    });
    frame.append(copy);
    host.append(frame);
  });
  document.getElementById('df-open-reader').onclick = () => {
    dialog.showModal();
    dialog.scrollTop = 0;
  };

  function story() {
    let active = 0;
    document.querySelectorAll('[data-rf-beat]').forEach(beat => {
      if (beat.getBoundingClientRect().top < innerHeight * .65) active = Number(beat.dataset.rfBeat);
    });
    document.querySelectorAll('[data-rf-art]').forEach(art => {
      art.classList.toggle('on', Number(art.dataset.rfArt) === active);
    });
  }
  addEventListener('scroll', story, {passive: true});
  addEventListener('resize', story);
  story();

  const tabs = [...document.querySelectorAll('.rf-tab')];
  function selectTab(selected) {
    tabs.forEach(tab => {
      tab.setAttribute('aria-selected', String(tab === selected));
      tab.tabIndex = tab === selected ? 0 : -1;
    });
    document.querySelectorAll('.rf-panel').forEach(panel => {
      panel.hidden = panel.id !== selected.getAttribute('aria-controls');
    });
  }
  tabs.forEach((tab, index) => {
    tab.onclick = () => selectTab(tab);
    tab.onkeydown = event => {
      let target;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') target = (index + 1) % tabs.length;
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') target = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') target = 0;
      if (event.key === 'End') target = tabs.length - 1;
      if (target === undefined) return;
      event.preventDefault();
      selectTab(tabs[target]);
      tabs[target].focus();
    };
  });
})();
