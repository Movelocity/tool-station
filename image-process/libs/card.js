import { state, canvas } from './state.js';
import { escHtml } from './utils.js';
import { normalizeSize, nextPosition, expandCanvas } from './canvas.js';
import { openPanel, closePanel } from './panel.js';
import { refreshIndex, setActiveChip } from './index-bar.js';
import { attachDrag } from './drag.js';
import { attachResize } from './resize.js';

export function bringToFront(cardEl, cardData) {
  state.topZ++;
  cardEl.style.zIndex = state.topZ;
  cardData.zIndex     = state.topZ;
}

export function selectCard(id) {
  document.querySelectorAll('.img-card').forEach(c => c.classList.remove('selected'));
  const card = document.querySelector(`.img-card[data-card-id="${id}"]`);
  if (card) card.classList.add('selected');
  state.selectedId = id;
  setActiveChip(id);
  openPanel(id);
}

export function deselectAll() {
  document.querySelectorAll('.img-card').forEach(c => c.classList.remove('selected'));
  state.selectedId = null;
  setActiveChip(null);
  closePanel();
}

export function createImageCard(imgData) {
  state.idSeq++;
  const id      = `img-${Date.now()}-${state.idSeq}`;
  const { w, h } = normalizeSize(imgData.origW, imgData.origH);
  const pos     = nextPosition();

  const cardData = {
    id,
    name:     imgData.name,
    file:     imgData.file,
    origW:    imgData.origW,
    origH:    imgData.origH,
    fileSize: imgData.fileSize,
    mimeType: imgData.mimeType,
    dataUrl:  imgData.dataUrl,
    x: pos.x,
    y: pos.y,
    w,
    h,
    zIndex: 0,
  };
  state.cards.set(id, cardData);

  const card = document.createElement('div');
  card.className      = 'img-card';
  card.dataset.cardId = id;
  card.style.left     = pos.x + 'px';
  card.style.top      = pos.y + 'px';
  card.style.width    = w     + 'px';

  card.innerHTML = `
    <div class="card-titlebar">
      <span class="card-title" title="${escHtml(imgData.name)}">${escHtml(imgData.name)}</span>
      <span class="dim-display">${imgData.origW}×${imgData.origH}</span>
      <button class="card-btn danger delete-card-btn" title="删除">✕</button>
    </div>
    <div class="card-body" style="height:${h}px;">
      <img src="${imgData.dataUrl}" alt="${escHtml(imgData.name)}" draggable="false">
    </div>
    <div class="resize-handle corner nw" data-dir="nw"></div>
    <div class="resize-handle corner ne" data-dir="ne"></div>
    <div class="resize-handle corner sw" data-dir="sw"></div>
    <div class="resize-handle corner se" data-dir="se"></div>
    <div class="resize-handle edge n" data-dir="n"></div>
    <div class="resize-handle edge s" data-dir="s"></div>
    <div class="resize-handle edge w" data-dir="w"></div>
    <div class="resize-handle edge e" data-dir="e"></div>
  `;

  canvas.appendChild(card);

  const bodyEl    = card.querySelector('.card-body');
  const deleteBtn = card.querySelector('.delete-card-btn');

  attachDrag(card, cardData);
  card.querySelectorAll('.resize-handle').forEach(handle => {
    attachResize(card, handle, bodyEl, cardData);
  });

  deleteBtn.addEventListener('click', () => {
    card.remove();
    state.cards.delete(id);
    if (state.selectedId === id) {
      state.selectedId = null;
      closePanel();
    }
    refreshIndex();
  });

  bringToFront(card, cardData);
  selectCard(id);
  refreshIndex();
  expandCanvas(card);
}
