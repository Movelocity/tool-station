import { state, canvas, viewport } from './state.js';

export function normalizeSize(origW, origH) {
  const vpW = viewport.clientWidth;
  const vpH = viewport.clientHeight;
  const maxRenderW = Math.min(vpW * 0.45, 600);
  const maxRenderH = Math.min(vpH * 0.55, 500);
  const minRender  = 120;

  let w = origW, h = origH;
  if (w > maxRenderW || h > maxRenderH) {
    const scale = Math.min(maxRenderW / w, maxRenderH / h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  if (w < minRender && h < minRender) {
    const scale = minRender / Math.min(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  return { w, h };
}

export function nextPosition() {
  const count   = state.cards.size;
  const scrollX = viewport.scrollLeft;
  const scrollY = viewport.scrollTop;
  const vpW     = viewport.clientWidth;
  const baseX   = scrollX + Math.max(40, (vpW - 400) / 2 - 100);
  const baseY   = scrollY + 40;
  const offset  = (count % 8) * 40;
  return { x: baseX + offset, y: baseY + offset };
}

export function expandCanvas(cardEl) {
  const right  = (parseInt(cardEl.style.left, 10) || 0) + cardEl.offsetWidth  + 80;
  const bottom = (parseInt(cardEl.style.top,  10) || 0) + cardEl.offsetHeight + 80;
  if (right  > canvas.scrollWidth)  canvas.style.width     = right  + 'px';
  if (bottom > canvas.offsetHeight) canvas.style.minHeight = bottom + 'px';
}
