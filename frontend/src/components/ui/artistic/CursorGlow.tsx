import React, { useEffect, useRef } from 'react';

/**
 * CursorGlow
 * Linear/Vercel-style ambience: a soft light that trails the cursor with eased
 * interpolation, plus an interactive "spotlight" — any element carrying the
 * `card`, `stat-card`, or `data-spotlight` class receives live --mx/--my CSS
 * variables so a radial highlight sweeps across its surface toward the pointer.
 *
 * Automatically disabled on touch devices and for reduced-motion users.
 */
const CursorGlow: React.FC = () => {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    if (reduceMotion || !finePointer) return;

    const glow = glowRef.current;
    if (!glow) return;

    let raf = 0;
    let running = false;
    let x = -600;
    let y = -600;
    let targetX = x;
    let targetY = y;

    const render = () => {
      // Ease toward the pointer for a fluid trailing feel
      x += (targetX - x) * 0.16;
      y += (targetY - y) * 0.16;
      glow.style.transform = `translate3d(${x - 260}px, ${y - 260}px, 0)`;

      if (Math.abs(targetX - x) > 0.1 || Math.abs(targetY - y) > 0.1) {
        raf = requestAnimationFrame(render);
      } else {
        running = false;
      }
    };

    const onMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;

      // Drive the card spotlight via event delegation — no per-page wiring
      const target = e.target as Element | null;
      const card = target?.closest?.('.card, .stat-card, [data-spotlight]') as HTMLElement | null;
      if (card) {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
        card.style.setProperty('--my', `${e.clientY - rect.top}px`);
      }

      if (!running) {
        running = true;
        raf = requestAnimationFrame(render);
      }
    };

    const onLeave = () => {
      targetX = -600;
      targetY = -600;
      if (!running) {
        running = true;
        raf = requestAnimationFrame(render);
      }
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return <div ref={glowRef} aria-hidden="true" className="cursor-glow" />;
};

export default CursorGlow;
