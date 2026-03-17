import { state } from './state.js';
import { showToast } from './utils.js';

export function buildIco(pngData, w, h) {
  const headerSize   = 6;
  const dirEntrySize = 16;
  const dataOffset   = headerSize + dirEntrySize;
  const fileSize     = dataOffset + pngData.length;
  const buf  = new ArrayBuffer(fileSize);
  const view = new DataView(buf);

  // ICO header: reserved(2) + type(2, 1=ICO) + imageCount(2)
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, 1, true);

  // Directory entry
  view.setUint8(6,  w >= 256 ? 0 : w);
  view.setUint8(7,  h >= 256 ? 0 : h);
  view.setUint8(8,  0);           // color palette
  view.setUint8(9,  0);           // reserved
  view.setUint16(10, 1,  true);   // color planes
  view.setUint16(12, 32, true);   // bits per pixel
  view.setUint32(14, pngData.length, true);
  view.setUint32(18, dataOffset,     true);

  new Uint8Array(buf).set(pngData, dataOffset);
  return new Blob([buf], { type: 'image/x-icon' });
}

export function exportImage() {
  if (!state.selectedId) return;
  const data = state.cards.get(state.selectedId);
  if (!data) return;

  const exportW = parseInt(document.getElementById('panelWidth').value,  10) || data.origW;
  const exportH = parseInt(document.getElementById('panelHeight').value, 10) || data.origH;

  const offCanvas   = document.createElement('canvas');
  offCanvas.width   = exportW;
  offCanvas.height  = exportH;
  const ctx = offCanvas.getContext('2d');

  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, exportW, exportH);
    const baseName = data.name.replace(/\.[^.]+$/, '');

    if (state.exportFormat === 'ico') {
      offCanvas.toBlob((pngBlob) => {
        pngBlob.arrayBuffer().then(pngBuf => {
          const icoBlob = buildIco(new Uint8Array(pngBuf), exportW, exportH);
          const url  = URL.createObjectURL(icoBlob);
          const link = document.createElement('a');
          link.download = `${baseName}_${exportW}x${exportH}.ico`;
          link.href = url;
          link.click();
          URL.revokeObjectURL(url);
          showToast(`已导出 ${link.download}`, 'success');
        });
      }, 'image/png');
      return;
    }

    let mimeType, ext;
    switch (state.exportFormat) {
      case 'jpeg': mimeType = 'image/jpeg'; ext = 'jpg';  break;
      case 'webp': mimeType = 'image/webp'; ext = 'webp'; break;
      default:     mimeType = 'image/png';  ext = 'png';
    }

    const quality = (state.exportFormat === 'png') ? undefined : state.exportQuality;
    const dataUrl = offCanvas.toDataURL(mimeType, quality);

    const link = document.createElement('a');
    link.download = `${baseName}_${exportW}x${exportH}.${ext}`;
    link.href = dataUrl;
    link.click();
    showToast(`已导出 ${link.download}`, 'success');
  };
  img.src = data.dataUrl;
}
