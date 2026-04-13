// ── Canvas rendering ──────────────────────────────────────────────────────────
function renderCanvas() {
  const world = document.getElementById('canvas-world');
  world.innerHTML = '';
  nodePositions = {}; nodeEls = {}; edgeRegistry = [];
  viewTransform = { x: 0, y: 0, scale: 1 };
  applyTransform();
  closeDrawer();

  const nodes = canvasData.nodes || [];
  const edges = canvasData.edges || [];
  if (!nodes.length) return;

  const xs = nodes.map(n => n.meta?.position?.x ?? 0);
  const ys = nodes.map(n => n.meta?.position?.y ?? 0);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const PAD = 80;

  for (const node of nodes) {
    const x = (node.meta?.position?.x ?? 0) - minX + PAD;
    const y = (node.meta?.position?.y ?? 0) - minY + PAD;
    nodePositions[node.id] = { x, y };
    const el = buildNodeCard(node);
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    world.appendChild(el);
    nodeEls[node.id] = el;
  }

  requestAnimationFrame(() => requestAnimationFrame(() => {
    initEdges(world, edges);
    fitView();
  }));
}

function buildNodeCard(node) {
  const { id, type, data } = node;
  const nm  = data?.nodeMeta || {};
  const cfg = NODE_CFG[type] || { label: 'NODE', color: '#6b7280' };
  const color = (type === '5' && nm.mainColor) ? nm.mainColor : cfg.color;

  const div = document.createElement('div');
  div.id = `node-${id}`;
  div.className = 'node-card';
  div.dataset.id = id;
  div.innerHTML = `
    <div class="node-header" style="border-left-color:${color}">
      <span class="node-badge" style="background:${color}1a;color:${color}">${cfg.label}</span>
      <span class="node-title">${esc(nm.title || id)}</span>
    </div>`;

  div.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    isDraggingNode = true;
    dragNodeId     = id;
    nodeDragMoved  = false;
    nodeDragStart  = {
      mouseX: e.clientX, mouseY: e.clientY,
      nodeX: nodePositions[id].x, nodeY: nodePositions[id].y,
    };
  });

  return div;
}

// ── Edges ─────────────────────────────────────────────────────────────────────
function initEdges(world, edges) {
  const NS  = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  const positions = Object.values(nodePositions);
  const svgW = positions.length ? Math.max(...positions.map(p => p.x)) + 400 : 2000;
  const svgH = positions.length ? Math.max(...positions.map(p => p.y)) + 300 : 1000;
  svg.setAttribute('width', svgW);
  svg.setAttribute('height', svgH);
  svg.style.cssText = 'position:absolute;top:0;left:0;overflow:visible;pointer-events:none;';

  const defs = document.createElementNS(NS, 'defs');
  defs.appendChild(mkMarker(NS, 'arr',      '#475569'));
  defs.appendChild(mkMarker(NS, 'arr-loop', '#7c3aed'));
  svg.appendChild(defs);

  edgeRegistry = [];
  for (const edge of edges) {
    const srcEl = nodeEls[edge.sourceNodeID];
    const tgtEl = nodeEls[edge.targetNodeID];
    if (!srcEl || !tgtEl) {
      console.warn('[edges] missing node el for edge', edge.sourceNodeID, '→', edge.targetNodeID,
        '| srcEl:', !!srcEl, 'tgtEl:', !!tgtEl);
      continue;
    }

    console.debug('[edges]', edge.sourceNodeID, '→', edge.targetNodeID,
      '| srcW:', srcEl.offsetWidth, 'srcH:', srcEl.offsetHeight,
      '| tgtW:', tgtEl.offsetWidth, 'tgtH:', tgtEl.offsetHeight);

    const isLoop = edge.sourcePortID === 'loop-output';
    const path   = document.createElementNS(NS, 'path');
    path.setAttribute('stroke',       isLoop ? '#7c3aed' : '#475569');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('fill',         'none');
    path.setAttribute('marker-end',   `url(#${isLoop ? 'arr-loop' : 'arr'})`);
    if (isLoop) path.setAttribute('stroke-dasharray', '5,3');
    const d = edgeD(srcEl, tgtEl);
    console.debug('[edges] path d:', d);
    path.setAttribute('d', d);
    svg.appendChild(path);
    edgeRegistry.push({ edge, path, srcId: edge.sourceNodeID, tgtId: edge.targetNodeID });
  }
  console.debug('[edges] SVG appended, registry length:', edgeRegistry.length, '| svg:', svg);

  world.insertBefore(svg, world.firstChild);
}

function edgeD(srcEl, tgtEl) {
  const sx = parseFloat(srcEl.style.left) + srcEl.offsetWidth;
  const sy = parseFloat(srcEl.style.top)  + srcEl.offsetHeight / 2;
  const tx = parseFloat(tgtEl.style.left);
  const ty = parseFloat(tgtEl.style.top)  + tgtEl.offsetHeight / 2;

  if (sx <= tx + 10) {
    const dx = Math.max(60, Math.abs(tx - sx) * .45);
    return `M${sx},${sy} C${sx+dx},${sy} ${tx-dx},${ty} ${tx},${ty}`;
  }
  // backward — route below
  const floor = Math.max(sy, ty) + 50, mx = (sx + tx) / 2;
  return `M${sx},${sy} C${sx+50},${sy} ${sx+50},${floor} ${mx},${floor}` +
         ` S${tx-50},${floor} ${tx-50},${ty} L${tx},${ty}`;
}

function updateNodeEdges(id) {
  for (const { srcId, tgtId, path } of edgeRegistry) {
    if (srcId === id || tgtId === id)
      path.setAttribute('d', edgeD(nodeEls[srcId], nodeEls[tgtId]));
  }
}

function redrawAllEdges() {
  for (const { srcId, tgtId, path } of edgeRegistry)
    path.setAttribute('d', edgeD(nodeEls[srcId], nodeEls[tgtId]));
}

function mkMarker(NS, id, color) {
  const m = document.createElementNS(NS, 'marker');
  m.setAttribute('id', id); m.setAttribute('markerWidth','8'); m.setAttribute('markerHeight','6');
  m.setAttribute('refX','7'); m.setAttribute('refY','3'); m.setAttribute('orient','auto');
  const p = document.createElementNS(NS, 'polygon');
  p.setAttribute('points','0 0, 8 3, 0 6'); p.setAttribute('fill', color);
  m.appendChild(p); return m;
}
