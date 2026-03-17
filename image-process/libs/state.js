export const state = {
  cards: new Map(),   // id → { id, name, file, origW, origH, fileSize, mimeType, dataUrl, x, y, w, h, zIndex }
  selectedId: null,
  idSeq: 0,
  topZ: 100,
  aspectLocked: true,
  exportFormat: 'png',
  exportQuality: 0.92,
};

export const canvas   = document.getElementById('canvas');
export const viewport = document.getElementById('canvasViewport');
export const infoPanel = document.getElementById('infoPanel');
