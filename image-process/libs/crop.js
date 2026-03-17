import { state } from './state.js';
import { createImageCard } from './card.js';
import { showToast } from './utils.js';

// ── Module-level crop state ──
let cropCardId = null;
let scaleX = 1, scaleY = 1;
let imgLeft = 0, imgTop = 0;
let renderedW = 0, renderedH = 0;
let lockedRatio = null; // null = free, number = w/h

// Selection in rendered-image space (origin = top-left of image)
let sel = { x: 0, y: 0, w: 0, h: 0 };

// ── Public API ──

export function openCropModal(id) {
  const data = state.cards.get(id);
  if (!data) return;
  cropCardId = id;

  // Reset ratio to free on each open
  lockedRatio = null;
  document.querySelectorAll('.ratio-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.ratio === 'free');
  });

  const modal   = document.getElementById('cropModal');
  const cropImg = document.getElementById('cropImg');
  modal.classList.add('open');

  cropImg.onload = () => {
    const stage = document.getElementById('cropStage');
    const sw    = stage.clientWidth;
    const sh    = stage.clientHeight;
    const pad   = 32;
    const scale = Math.min((sw - pad * 2) / data.origW, (sh - pad * 2) / data.origH, 1);

    renderedW = Math.round(data.origW * scale);
    renderedH = Math.round(data.origH * scale);
    scaleX    = data.origW / renderedW;
    scaleY    = data.origH / renderedH;
    imgLeft   = Math.round((sw - renderedW) / 2);
    imgTop    = Math.round((sh - renderedH) / 2);

    cropImg.style.left   = imgLeft + 'px';
    cropImg.style.top    = imgTop  + 'px';
    cropImg.style.width  = renderedW + 'px';
    cropImg.style.height = renderedH + 'px';

    sel = { x: 0, y: 0, w: renderedW, h: renderedH };
    syncSelectionEl();
    syncControls();
  };

  cropImg.src = data.dataUrl;
}

export function setupCropModal() {
  [document.getElementById('cropCancelBtn'),
   document.getElementById('cropCancelBtn2')].forEach(btn =>
    btn.addEventListener('click', closeCropModal));

  document.getElementById('cropModal').addEventListener('mousedown', (e) => {
    if (e.target === document.getElementById('cropModal')) closeCropModal();
  });

  document.getElementById('cropApplyBtn').addEventListener('click', applyCrop);

  // Ratio preset buttons
  document.querySelectorAll('.ratio-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const raw = btn.dataset.ratio;
      lockedRatio = raw === 'free' ? null : parseRatio(raw);
      if (lockedRatio !== null) applyRatioToSel();
    });
  });

  // W / H pixel inputs
  document.getElementById('cropInputW').addEventListener('change', function () {
    const px = parseInt(this.value, 10);
    if (isNaN(px) || px < 1) return syncControls();
    let w = Math.min(Math.round(px / scaleX), renderedW);
    let h = lockedRatio !== null ? w / lockedRatio : sel.h;
    h = Math.min(Math.round(h), renderedH);
    w = Math.min(w, renderedW);
    sel.w = w;
    sel.h = h;
    sel.x = Math.max(0, Math.min(sel.x, renderedW - w));
    sel.y = Math.max(0, Math.min(sel.y, renderedH - h));
    syncSelectionEl();
    syncControls();
  });

  document.getElementById('cropInputH').addEventListener('change', function () {
    const px = parseInt(this.value, 10);
    if (isNaN(px) || px < 1) return syncControls();
    let h = Math.min(Math.round(px / scaleY), renderedH);
    let w = lockedRatio !== null ? h * lockedRatio : sel.w;
    w = Math.min(Math.round(w), renderedW);
    h = Math.min(h, renderedH);
    sel.w = w;
    sel.h = h;
    sel.x = Math.max(0, Math.min(sel.x, renderedW - w));
    sel.y = Math.max(0, Math.min(sel.y, renderedH - h));
    syncSelectionEl();
    syncControls();
  });

  const selection = document.getElementById('cropSelection');
  attachSelectionDrag(selection);
  selection.querySelectorAll('.crop-handle').forEach(h => attachSelectionResize(h));
}

// ── Internal helpers ──

function closeCropModal() {
  document.getElementById('cropModal').classList.remove('open');
  cropCardId = null;
}

function parseRatio(str) {
  const [a, b] = str.split(':').map(Number);
  return a / b;
}

/** Reshape the current selection to fit lockedRatio, centered. */
function applyRatioToSel() {
  const cx = sel.x + sel.w / 2;
  const cy = sel.y + sel.h / 2;
  let w = sel.w;
  let h = w / lockedRatio;
  if (h > renderedH) { h = renderedH; w = h * lockedRatio; }
  if (w > renderedW) { w = renderedW; h = w / lockedRatio; }
  sel.w = w;
  sel.h = h;
  sel.x = Math.max(0, Math.min(cx - w / 2, renderedW - w));
  sel.y = Math.max(0, Math.min(cy - h / 2, renderedH - h));
  syncSelectionEl();
  syncControls();
}

function syncSelectionEl() {
  const el = document.getElementById('cropSelection');
  el.style.left   = (imgLeft + sel.x) + 'px';
  el.style.top    = (imgTop  + sel.y) + 'px';
  el.style.width  = sel.w + 'px';
  el.style.height = sel.h + 'px';
}

function syncControls() {
  document.getElementById('cropInputW').value = Math.round(sel.w * scaleX);
  document.getElementById('cropInputH').value = Math.round(sel.h * scaleY);
}

function applyCrop() {
  if (!cropCardId) return;
  const data = state.cards.get(cropCardId);
  if (!data) return;

  const cropX = Math.round(sel.x * scaleX);
  const cropY = Math.round(sel.y * scaleY);
  const cropW = Math.round(sel.w * scaleX);
  const cropH = Math.round(sel.h * scaleY);
  if (cropW < 1 || cropH < 1) return;

  const off = document.createElement('canvas');
  off.width  = cropW;
  off.height = cropH;
  // cropImg is already decoded (it's displayed in the modal); use it directly.
  // drawImage reads naturalWidth/naturalHeight regardless of CSS dimensions.
  const cropImg = document.getElementById('cropImg');
  off.getContext('2d').drawImage(cropImg, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  const baseName = data.name.replace(/\.[^.]+$/, '');
  createImageCard({
    name:     `${baseName}_crop.png`,
    file:     null,
    origW:    cropW,
    origH:    cropH,
    fileSize: 0,
    mimeType: 'image/png',
    dataUrl:  off.toDataURL('image/png'),
  });
  closeCropModal();
  showToast('裁剪完成', 'success');
}

// ── Drag selection to move ──

function attachSelectionDrag(el) {
  el.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('crop-handle')) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    const ox = sel.x, oy = sel.y;

    function onMove(e) {
      sel.x = Math.max(0, Math.min(ox + (e.clientX - startX), renderedW - sel.w));
      sel.y = Math.max(0, Math.min(oy + (e.clientY - startY), renderedH - sel.h));
      syncSelectionEl();
      syncControls();
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });
}

// ── Resize handles ──

function attachSelectionResize(handle) {
  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const dir     = handle.dataset.dir;
    const startX  = e.clientX, startY = e.clientY;
    const origSel = { ...sel };

    function onMove(e) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      let { x, y, w, h } = origSel;

      if (dir.includes('e')) w = origSel.w + dx;
      if (dir.includes('w')) { w = origSel.w - dx; x = origSel.x + dx; }
      if (dir.includes('s')) h = origSel.h + dy;
      if (dir.includes('n')) { h = origSel.h - dy; y = origSel.y + dy; }

      // Apply ratio lock
      if (lockedRatio !== null) {
        if (dir === 'n' || dir === 's') {
          // Height drives width; keep horizontally centered
          const newW = h * lockedRatio;
          x = origSel.x + (origSel.w - newW) / 2;
          w = newW;
        } else if (dir === 'e' || dir === 'w') {
          // Width drives height; keep vertically centered
          const newH = w / lockedRatio;
          y = origSel.y + (origSel.h - newH) / 2;
          h = newH;
        } else {
          // Corner: width drives height
          const newH = w / lockedRatio;
          if (dir.includes('n')) y = origSel.y + (origSel.h - newH);
          h = newH;
        }
      }

      // Clamp to image bounds
      if (x < 0)             { w += x; x = 0; }
      if (y < 0)             { h += y; y = 0; }
      if (x + w > renderedW) w = renderedW - x;
      if (y + h > renderedH) h = renderedH - y;
      w = Math.max(10, w);
      h = Math.max(10, h);

      sel = { x, y, w, h };
      syncSelectionEl();
      syncControls();
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });
}
