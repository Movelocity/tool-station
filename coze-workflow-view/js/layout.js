// ── Auto Layout (DAG, longest-path layering) ──────────────────────────────────
function autoLayout() {
  const nodes = canvasData.nodes || [];
  const edges = canvasData.edges || [];

  const firstEl = nodeEls[nodes[0]?.id];
  const CARD_H  = firstEl ? firstEl.offsetHeight : 52;
  const CARD_W  = 160;
  const H_GAP   = 120;
  const V_GAP   = 48;

  const inMap  = {}, outMap = {};
  for (const n of nodes) { inMap[n.id] = []; outMap[n.id] = []; }
  for (const e of edges) {
    if (nodeEls[e.sourceNodeID] && nodeEls[e.targetNodeID]) {
      outMap[e.sourceNodeID].push(e.targetNodeID);
      inMap[e.targetNodeID].push(e.sourceNodeID);
    }
  }

  // BFS longest-path layering
  const layer = {};
  const queue = [];
  for (const n of nodes) {
    if (!inMap[n.id].length) { layer[n.id] = 0; queue.push(n.id); }
  }
  for (let qi = 0; qi < queue.length; qi++) {
    const id = queue[qi];
    for (const nxt of outMap[id]) {
      const nl = layer[id] + 1;
      if (layer[nxt] === undefined || layer[nxt] < nl) {
        layer[nxt] = nl;
        queue.push(nxt);
      }
    }
  }
  for (const n of nodes) { if (layer[n.id] === undefined) layer[n.id] = 0; }

  const byLayer = {};
  for (const n of nodes) {
    const l = layer[n.id];
    (byLayer[l] = byLayer[l] || []).push(n.id);
  }
  const layerNums = Object.keys(byLayer).map(Number).sort((a, b) => a - b);

  const maxRows   = Math.max(...layerNums.map(l => byLayer[l].length));
  const maxLayerH = maxRows * (CARD_H + V_GAP) - V_GAP;

  const newPos = {};
  for (const l of layerNums) {
    const ids = byLayer[l];

    if (l > 0) {
      ids.sort((a, b) => {
        const ya = med(inMap[a].map(p => newPos[p]?.y ?? 0));
        const yb = med(inMap[b].map(p => newPos[p]?.y ?? 0));
        return ya - yb;
      });
    }

    const colH   = ids.length * (CARD_H + V_GAP) - V_GAP;
    const startY = 80 + (maxLayerH - colH) / 2;

    ids.forEach((id, i) => {
      newPos[id] = {
        x: 80 + l * (CARD_W + H_GAP),
        y: startY + i * (CARD_H + V_GAP),
      };
    });
  }

  nodePositions = newPos;
  for (const [id, pos] of Object.entries(nodePositions)) {
    if (nodeEls[id]) {
      nodeEls[id].style.left = pos.x + 'px';
      nodeEls[id].style.top  = pos.y + 'px';
    }
  }
  redrawAllEdges();
  requestAnimationFrame(fitView);
}

function med(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b), m = s.length >> 1;
  return s.length & 1 ? s[m] : (s[m-1] + s[m]) / 2;
}
