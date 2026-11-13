import React, { useEffect } from 'react';

/**
 * AutoArt
 * Progressive enhancement pass, Vite-website style: watches the DOM and
 * upgrades ordinary white cards (`bg-white … rounded… shadow…`) wherever
 * they appear — any page, current or future — tagging them for the cursor
 * spotlight and adding hover lift + brand glow. Absolutely-positioned
 * surfaces (dropdowns, popovers, map panels) are left untouched so menus
 * and Leaflet overlays keep their exact behavior.
 */
const CARD_SELECTOR =
  '[class*="bg-white"][class*="rounded"][class*="shadow"]:not(button):not(a)';

const AutoArt: React.FC = () => {
  useEffect(() => {
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const enhance = () => {
      document.querySelectorAll<HTMLElement>(CARD_SELECTOR).forEach((el) => {
        // Skip floating layers (menus/tooltips/map popups)
        if (getComputedStyle(el).position !== 'static') return;
        if (!el.hasAttribute('data-spotlight')) el.setAttribute('data-spotlight', '');
        if (!el.classList.contains('art-card-auto')) el.classList.add('art-card-auto');
      });
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!raf) raf = requestAnimationFrame(() => { raf = 0; enhance(); });
      }, 180);
    };

    enhance();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return null;
};

export default AutoArt;
