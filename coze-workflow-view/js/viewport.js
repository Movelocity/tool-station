// ── Viewport: pan, zoom, node drag ───────────────────────────────────────────
const vp = document.getElementById('canvas-viewport');

// ── Zoom constants ────────────────────────────────────────────────────────────
const ZOOM_MIN = 0.15;
const ZOOM_MAX = 3.0;
const MOUSE_ZOOM_FACTOR      = 1.12;   // fixed factor per wheel click (mouse)
const TOUCHPAD_ZOOM_SENS     = 0.008;  // exp(-deltaY * this) per pinch event
const TOUCHPAD_ZOOM_MAX_STEP = 0.12;   // max log-factor per pinch event (~8%)

// ── Mode toggle ───────────────────────────────────────────────────────────────
function toggleInputMode() {
  inputMode = inputMode === 'mouse' ? 'touchpad' : 'mouse';
  const btn = document.getElementById('mode-btn');
  if (btn) btn.textContent = inputMode === 'mouse' ? 'Mouse' : 'Touchpad';
}

// ── Mouse events ──────────────────────────────────────────────────────────────
vp.addEventListener('mousedown', e => {
  if (e.button !== 0 || e.target.closest('.node-card')) return;
  closeDrawer();
  isPanning = true;
  panStart  = { x: e.clientX - viewTransform.x, y: e.clientY - viewTransform.y };
  vp.classList.add('panning');
});

document.addEventListener('mousemove', e => {
  if (isDraggingNode) {
    const dx = e.clientX - nodeDragStart.mouseX;
    const dy = e.clientY - nodeDragStart.mouseY;

    if (!nodeDragMoved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      nodeDragMoved = true;
      if (nodeEls[dragNodeId]) nodeEls[dragNodeId].classList.add('node-dragging');
    }

    if (nodeDragMoved) {
      const wx = nodeDragStart.nodeX + dx / viewTransform.scale;
      const wy = nodeDragStart.nodeY + dy / viewTransform.scale;
      nodePositions[dragNodeId] = { x: wx, y: wy };
      nodeEls[dragNodeId].style.left = wx + 'px';
      nodeEls[dragNodeId].style.top  = wy + 'px';
      updateNodeEdges(dragNodeId);
    }
    return;
  }

  if (isPanning) {
    viewTransform.x = e.clientX - panStart.x;
    viewTransform.y = e.clientY - panStart.y;
    applyTransform();
  }
});

document.addEventListener('mouseup', () => {
  if (isDraggingNode) {
    if (nodeEls[dragNodeId]) nodeEls[dragNodeId].classList.remove('node-dragging');
    if (!nodeDragMoved) selectNode(dragNodeId);
    isDraggingNode = false; dragNodeId = null; nodeDragMoved = false;
    return;
  }
  isPanning = false;
  vp.classList.remove('panning');
});

// ── Wheel: zoom (mouse) or pan/pinch (touchpad) ───────────────────────────────
vp.addEventListener('wheel', e => {
  e.preventDefault();

  if (inputMode === 'touchpad' && !e.ctrlKey) {
    // two-finger scroll → pan
    viewTransform.x -= e.deltaX;
    viewTransform.y -= e.deltaY;
    applyTransform();
    return;
  }

  // zoom: mouse wheel click or touchpad pinch (ctrlKey)
  const f = inputMode === 'touchpad'
    ? touchpadZoomFactor(e.deltaY)
    : (e.deltaY < 0 ? MOUSE_ZOOM_FACTOR : 1 / MOUSE_ZOOM_FACTOR);

  zoomAt(e.clientX, e.clientY, f);
}, { passive: false });

function touchpadZoomFactor(deltaY) {
  const raw     = -deltaY * TOUCHPAD_ZOOM_SENS;
  const clamped = Math.max(-TOUCHPAD_ZOOM_MAX_STEP, Math.min(TOUCHPAD_ZOOM_MAX_STEP, raw));
  return Math.exp(clamped);
}

function zoomAt(clientX, clientY, f) {
  const r  = vp.getBoundingClientRect();
  const mx = clientX - r.left, my = clientY - r.top;
  const newScale  = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, viewTransform.scale * f));
  const actualF   = newScale / viewTransform.scale;
  viewTransform.x = mx - (mx - viewTransform.x) * actualF;
  viewTransform.y = my - (my - viewTransform.y) * actualF;
  viewTransform.scale = newScale;
  applyTransform();
}

// ── Transform helpers ─────────────────────────────────────────────────────────
function applyTransform() {
  document.getElementById('canvas-world').style.transform =
    `translate(${viewTransform.x}px,${viewTransform.y}px) scale(${viewTransform.scale})`;
}

function applyZoom(f) {
  zoomAt(vp.offsetWidth / 2 + vp.getBoundingClientRect().left,
         vp.offsetHeight / 2 + vp.getBoundingClientRect().top, f);
}

function fitView() {
  const cards = document.getElementById('canvas-world').querySelectorAll('.node-card');
  if (!cards.length) return;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  cards.forEach(c => {
    const x = parseFloat(c.style.left), y = parseFloat(c.style.top);
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + c.offsetWidth); maxY = Math.max(maxY, y + c.offsetHeight);
  });
  const PAD = 60;
  const cw = maxX - minX + PAD * 2, ch = maxY - minY + PAD * 2;
  const vw = vp.offsetWidth, vh = vp.offsetHeight;
  const scale = Math.max(ZOOM_MIN, Math.min(vw / cw, vh / ch, 1.5));
  viewTransform = {
    x: (vw - cw * scale) / 2 - (minX - PAD) * scale,
    y: (vh - ch * scale) / 2 - (minY - PAD) * scale,
    scale,
  };
  applyTransform();
}
