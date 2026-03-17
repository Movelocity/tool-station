import { state, infoPanel, viewport } from './state.js';
import { formatSize } from './utils.js';

export function openPanel(id) {
  const data = state.cards.get(id);
  if (!data) return;

  document.getElementById('panelPreview').src          = data.dataUrl;
  document.getElementById('panelFileName').textContent = data.name;
  document.getElementById('panelOrigSize').textContent = `${data.origW} × ${data.origH}`;
  document.getElementById('panelFileSize').textContent = formatSize(data.fileSize);
  document.getElementById('panelMimeType').textContent = data.mimeType;

  updatePanelFields(data);

  infoPanel.classList.add('open');
  viewport.classList.add('panel-open');
}

export function updatePanelFields(data) {
  document.getElementById('panelWidth').value  = data.origW;
  document.getElementById('panelHeight').value = data.origH;
}

export function closePanel() {
  infoPanel.classList.remove('open');
  viewport.classList.remove('panel-open');
}
