// ── Global state ──────────────────────────────────────────────────────────────
let canvasData    = null;
let nodePositions = {};   // id → { x, y }
let nodeEls       = {};   // id → DOM element
let edgeRegistry  = [];   // [{ edge, path, srcId, tgtId }]
let selectedNodeId = null;

// node drag
let isDraggingNode = false, dragNodeId = null, nodeDragMoved = false;
let nodeDragStart  = {};
const DRAG_THRESHOLD = 5;

// canvas pan
let isPanning    = false;
let panStart     = { x: 0, y: 0 };
let viewTransform = { x: 0, y: 0, scale: 1 };

// interaction mode
let inputMode = 'mouse'; // 'mouse' | 'touchpad'

// ── Node type config ──────────────────────────────────────────────────────────
const NODE_CFG = {
  '1':  { label: 'START', color: '#22c55e' },
  '2':  { label: 'END',   color: '#f97316' },
  '5':  { label: 'CODE',  color: '#06b6d4' },
  '21': { label: 'LOOP',  color: '#a855f7' },
};
