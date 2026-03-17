import { expandCanvas } from './canvas.js';
// card.js / index-bar.js are circular peers — only called inside event handlers
import { bringToFront, selectCard } from './card.js';
import { setActiveChip } from './index-bar.js';

const CLICK_THRESHOLD = 5;

export function attachDrag(cardEl, cardData) {
  let startX, startY, startLeft, startTop, dragging = false, peakDist = 0;

  cardEl.addEventListener('mousedown', (e) => {
    if (e.target.closest('button') || e.target.closest('.resize-handle')) return;
    e.preventDefault();
    dragging  = true;
    peakDist  = 0;
    startX    = e.clientX;
    startY    = e.clientY;
    startLeft = parseInt(cardEl.style.left, 10) || 0;
    startTop  = parseInt(cardEl.style.top,  10) || 0;

    bringToFront(cardEl, cardData);
    setActiveChip(cardData.id);

    document.body.style.cursor     = 'grabbing';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });

  function onMove(e) {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    peakDist = Math.max(peakDist, Math.abs(dx) + Math.abs(dy));
    cardEl.style.left = Math.max(0, startLeft + dx) + 'px';
    cardEl.style.top  = Math.max(0, startTop  + dy) + 'px';
    expandCanvas(cardEl);
  }

  function onUp() {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor     = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup',   onUp);
    expandCanvas(cardEl);

    cardData.x = parseInt(cardEl.style.left, 10) || 0;
    cardData.y = parseInt(cardEl.style.top,  10) || 0;

    if (peakDist < CLICK_THRESHOLD) selectCard(cardData.id);
  }
}
