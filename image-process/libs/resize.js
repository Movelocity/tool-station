import { state } from './state.js';
import { expandCanvas } from './canvas.js';
import { updatePanelFields } from './panel.js';

const MIN_SIZE = 80;

export function attachResize(cardEl, handle, bodyEl, cardData) {
  let startX, startY, startW, startH, startLeft, startTop, dir;

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dir       = handle.dataset.dir;
    startX    = e.clientX;
    startY    = e.clientY;
    startW    = cardEl.offsetWidth;
    startH    = bodyEl.offsetHeight;
    startLeft = parseInt(cardEl.style.left, 10) || 0;
    startTop  = parseInt(cardEl.style.top,  10) || 0;

    document.body.style.cursor     = window.getComputedStyle(handle).cursor;
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });

  function onMove(e) {
    let dx = e.clientX - startX;
    let dy = e.clientY - startY;
    let newW = startW, newH = startH, newLeft = startLeft, newTop = startTop;
    const aspect = cardData.origW / cardData.origH;

    if (dir.includes('e')) newW = startW + dx;
    if (dir.includes('w')) { newW = startW - dx; newLeft = startLeft + dx; }
    if (dir.includes('s')) newH = startH + dy;
    if (dir.includes('n')) { newH = startH - dy; newTop  = startTop  + dy; }

    // Corner handles: lock aspect ratio
    if (dir.length === 2) {
      const candidateH = newW / aspect;
      if (dir.includes('n')) newTop = startTop + (startH - candidateH);
      newH = candidateH;
    }

    if (newW < MIN_SIZE) {
      if (dir.includes('w')) newLeft = startLeft + startW - MIN_SIZE;
      newW = MIN_SIZE;
    }
    if (newH < MIN_SIZE) {
      if (dir.includes('n')) newTop = startTop + startH - MIN_SIZE;
      newH = MIN_SIZE;
    }

    newLeft = Math.max(0, newLeft);
    newTop  = Math.max(0, newTop);

    cardEl.style.width  = newW    + 'px';
    cardEl.style.left   = newLeft + 'px';
    cardEl.style.top    = newTop  + 'px';
    bodyEl.style.height = newH    + 'px';

    expandCanvas(cardEl);
  }

  function onUp() {
    document.body.style.cursor     = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup',   onUp);

    cardData.w = cardEl.offsetWidth;
    cardData.h = bodyEl.offsetHeight;
    cardData.x = parseInt(cardEl.style.left, 10) || 0;
    cardData.y = parseInt(cardEl.style.top,  10) || 0;

    if (state.selectedId === cardData.id) updatePanelFields(cardData);
    expandCanvas(cardEl);
  }
}
