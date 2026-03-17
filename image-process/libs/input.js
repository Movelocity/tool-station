import { createImageCard } from './card.js';

export function handleFiles(files) {
  [...files].forEach(file => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        createImageCard({
          name:     file.name,
          file:     file,
          origW:    img.naturalWidth,
          origH:    img.naturalHeight,
          fileSize: file.size,
          mimeType: file.type,
          dataUrl:  e.target.result,
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export function setupFileInput() {
  const fileInput = document.getElementById('fileInput');
  document.getElementById('addImgBtn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    fileInput.value = '';
  });
}

export function setupDragDrop() {
  const dropOverlay = document.getElementById('dropOverlay');
  let dragCounter   = 0;

  document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    dropOverlay.classList.add('visible');
  });
  document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      dropOverlay.classList.remove('visible');
    }
  });
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    dropOverlay.classList.remove('visible');
    const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
    if (files.length) handleFiles(files);
  });
}

export function setupPaste() {
  document.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) handleFiles([file]);
      }
    }
  });
}
