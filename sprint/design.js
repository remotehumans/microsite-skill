// ABOUTME: Reveal-on-scroll for pages whose company site animates content into view (company.json design.motion.reveal).
// ABOUTME: Also opens the phone Menu button (design.header.phone_menu). Reveal does nothing with reduced motion or when off.
(() => {
  const menu = document.querySelector('.rf-menu');
  if (menu) menu.addEventListener('click', () => {
    const open = menu.closest('.rf-header').classList.toggle('rf-open');
    menu.setAttribute('aria-expanded', String(open));
  });
})();
(() => {
  if (document.body.dataset.reveal !== 'fade-up' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const items = [...document.querySelectorAll('main > section:not(#intro) .rf-wrap > *, main > section:not(#intro) .rf-card')];
  // Show anything that has reached the lower part of the screen, including items passed in a fast scroll
  // and items at the very bottom that can never scroll higher.
  let pending = items;
  const check = () => {
    const bottom = scrollY + innerHeight >= document.documentElement.scrollHeight - 4;
    pending = pending.filter(item => {
      const show = bottom || item.getBoundingClientRect().top < innerHeight * 0.92;
      if (show) item.classList.add('is-in');
      return !show;
    });
    if (!pending.length) removeEventListener('scroll', onScroll);
  };
  let queued = false;
  const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; check(); }); } };
  items.forEach(item => item.classList.add('rf-reveal'));
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  check();
  // Printing and PDF export never scroll, so show everything first.
  addEventListener('beforeprint', () => items.forEach(item => item.classList.add('is-in')));
})();
