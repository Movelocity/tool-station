// ── File handling ─────────────────────────────────────────────────────────────
function handleFileInput(e) { loadFile(e.target.files[0]); }
function handleDrop(e) { e.preventDefault(); loadFile(e.dataTransfer.files[0]); }

function loadFile(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = ev => {
    try { processWorkflow(JSON.parse(ev.target.result), file.name); }
    catch (err) { showToast('Invalid JSON: ' + err.message); }
  };
  r.readAsText(file);
}

function processWorkflow(raw, fileName) {
  if (raw.type === 'coze_workflow_export' && typeof raw.canvas === 'string') {
    canvasData = JSON.parse(raw.canvas);
    populateMeta(raw.metadata, raw.exported_at, canvasData);
  } else if (raw.nodes) {
    canvasData = raw;
    populateMeta(null, null, canvasData);
  } else {
    showToast('Unrecognized format — expected nodes/edges or coze_workflow_export');
    return;
  }

  document.getElementById('upload-zone').classList.add('hidden');
  const wv = document.getElementById('workflow-view');
  wv.classList.remove('hidden'); wv.classList.add('flex');
  const fi = document.getElementById('file-info');
  fi.classList.remove('hidden'); fi.classList.add('flex');
  document.getElementById('file-name').textContent = fileName || '';

  renderCanvas();
}

function populateMeta(meta, exportedAt, canvas) {
  document.getElementById('meta-nodes').textContent = (canvas.nodes || []).length;
  document.getElementById('meta-edges').textContent = (canvas.edges || []).length;
  if (meta) {
    document.getElementById('meta-name').textContent = meta.name || '-';
    document.getElementById('meta-desc').textContent = meta.desc || '-';
    document.getElementById('meta-time').textContent = exportedAt ? new Date(exportedAt).toLocaleString() : '-';
  } else {
    document.getElementById('meta-name').textContent = 'Canvas JSON';
    document.getElementById('meta-desc').textContent = '';
    document.getElementById('meta-time').textContent = '-';
  }
}

function resetToUpload() {
  canvasData = null; nodePositions = {}; nodeEls = {}; edgeRegistry = [];
  closeDrawer();
  document.getElementById('canvas-world').innerHTML = '';
  const wv = document.getElementById('workflow-view');
  wv.classList.add('hidden'); wv.classList.remove('flex');
  document.getElementById('upload-zone').classList.remove('hidden');
  const fi = document.getElementById('file-info');
  fi.classList.add('hidden'); fi.classList.remove('flex');
}
