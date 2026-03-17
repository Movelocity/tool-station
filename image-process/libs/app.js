import { state, canvas } from './state.js';
import { deselectAll } from './card.js';
import { closePanel } from './panel.js';
import { refreshIndex } from './index-bar.js';
import { exportImage } from './export.js';
import { setupFileInput, setupDragDrop, setupPaste } from './input.js';

// ── Input sources ──
setupFileInput();
setupDragDrop();
setupPaste();

// ── Canvas background click → deselect ──
canvas.addEventListener('mousedown', (e) => {
  if (e.target === canvas) deselectAll();
});

// ── Panel close button ──
document.getElementById('panelCloseBtn').addEventListener('click', () => deselectAll());

// ── Aspect ratio lock toggle ──
document.getElementById('lockAspect').addEventListener('click', function () {
  state.aspectLocked = !state.aspectLocked;
  this.classList.toggle('active', state.aspectLocked);
});

// ── Width / height linked inputs ──
document.getElementById('panelWidth').addEventListener('input', function () {
  if (!state.selectedId) return;
  const data = state.cards.get(state.selectedId);
  if (!data) return;
  const w = parseInt(this.value, 10);
  if (isNaN(w) || w < 1) return;
  if (state.aspectLocked) {
    document.getElementById('panelHeight').value = Math.round(w / (data.origW / data.origH));
  }
});

document.getElementById('panelHeight').addEventListener('input', function () {
  if (!state.selectedId) return;
  const data = state.cards.get(state.selectedId);
  if (!data) return;
  const h = parseInt(this.value, 10);
  if (isNaN(h) || h < 1) return;
  if (state.aspectLocked) {
    document.getElementById('panelWidth').value = Math.round(h * (data.origW / data.origH));
  }
});

// ── Export format buttons ──
document.querySelectorAll('.format-option').forEach(btn => {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.format-option').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    state.exportFormat = this.dataset.format;
    const qualitySection = document.getElementById('qualitySection');
    qualitySection.style.display =
      (state.exportFormat === 'png' || state.exportFormat === 'ico') ? 'none' : '';
  });
});

// ── Quality slider ──
document.getElementById('qualitySlider').addEventListener('input', function () {
  state.exportQuality = parseInt(this.value, 10) / 100;
  document.getElementById('qualityValue').textContent = this.value;
});

// ── Download button ──
document.getElementById('downloadBtn').addEventListener('click', exportImage);

// ── Keyboard shortcuts ──
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    deselectAll();
    return;
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedId) {
    if (document.activeElement.tagName === 'INPUT') return;
    const card = document.querySelector(`.img-card[data-card-id="${state.selectedId}"]`);
    if (card) {
      card.remove();
      state.cards.delete(state.selectedId);
      state.selectedId = null;
      closePanel();
      refreshIndex();
    }
  }
});
