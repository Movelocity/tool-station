// ── Detail Drawer ─────────────────────────────────────────────────────────────
function selectNode(id) {
  if (selectedNodeId === id) { closeDrawer(); return; }
  if (selectedNodeId && nodeEls[selectedNodeId])
    nodeEls[selectedNodeId].classList.remove('selected');
  selectedNodeId = id;
  if (nodeEls[id]) nodeEls[id].classList.add('selected');

  const node = (canvasData.nodes || []).find(n => n.id === id);
  if (node) { renderDrawer(node); document.getElementById('detail-drawer').classList.add('open'); }
}

function closeDrawer() {
  document.getElementById('detail-drawer').classList.remove('open');
  if (selectedNodeId && nodeEls[selectedNodeId])
    nodeEls[selectedNodeId].classList.remove('selected');
  selectedNodeId = null;
}

function renderDrawer(node) {
  const { id, type, data, blocks } = node;
  const nm  = data?.nodeMeta || {};
  const cfg = NODE_CFG[type] || { label: 'NODE', color: '#6b7280' };
  const color = (type === '5' && nm.mainColor) ? nm.mainColor : cfg.color;

  let h = '';

  // ── Header ──
  h += `<div class="drawer-section" style="background:#162032">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px">
      <span class="node-badge" style="background:${color}1a;color:${color}">${cfg.label}</span>
      <button class="drawer-close" onclick="closeDrawer()">×</button>
    </div>
    <h2 style="font-size:15px;font-weight:700;color:#f1f5f9;margin-bottom:${nm.subTitle?'4':'0'}px">${esc(nm.title || id)}</h2>
  </div>`;

  // ${nm.subTitle ? `<p style="font-size:12px;color:#64748b">${esc(nm.subTitle)}</p>` : ''}

  // ── Description ──
  if (nm.description) {
    h += `<div class="drawer-section">
      <div class="section-label">Description</div>
      <p style="font-size:12px;color:#94a3b8;line-height:1.6">${esc(nm.description)}</p>
    </div>`;
  }

  // ── Input parameters ──
  const inputParams = data?.inputs?.inputParameters;
  if (Array.isArray(inputParams) && inputParams.length) {
    h += `<div class="drawer-section"><div class="section-label">Inputs</div>`;
    for (const p of inputParams) {
      const val = p.input?.value;
      let extra = '';
      if (val?.type === 'ref' && val.content) {
        const c = val.content;
        extra = `<span class="param-ref">↳ ${esc(c.blockID || '')}.${esc(c.name || '')}</span>`;
      } else if (val?.type === 'literal') {
        extra = `<span class="param-val">"${esc(String(val.content ?? ''))}"</span>`;
      }
      h += `<div class="param-row">
        <span class="param-name">${esc(p.name)}</span>
        <span class="param-type">${esc(p.input?.type || '')}</span>
        ${extra}
      </div>`;
    }
    h += `</div>`;
  }

  // ── Start-node parameters (data.outputs = workflow inputs) ──
  if (type === '1') {
    const wfInputs = data?.outputs;
    if (Array.isArray(wfInputs) && wfInputs.length) {
      h += `<div class="drawer-section"><div class="section-label">Workflow Parameters</div>`;
      for (const o of wfInputs) {
        const reqLabel = o.required
          ? `<span style="font-size:10px;color:#fbbf24">required</span>`
          : `<span style="font-size:10px;color:#475569">optional</span>`;
        const defVal = o.defaultValue !== undefined
          ? `<span class="param-val">default: ${esc(String(o.defaultValue))}</span>` : '';
        h += `<div class="param-row">
          <span class="param-name">${esc(o.name)}</span>
          <span class="param-type">${esc(o.type || '')}</span>
          ${reqLabel}${defVal}
        </div>`;
      }
      h += `</div>`;
    }
  }

  // ── Outputs ──
  const outputs = data?.outputs;
  if (type !== '1' && Array.isArray(outputs) && outputs.length) {
    h += `<div class="drawer-section"><div class="section-label">Outputs</div>`;
    for (const o of outputs) {
      const name = o.name || o.input?.value?.content?.name || '?';
      h += `<div class="param-row">
        <span class="param-name">${esc(name)}</span>
        <span class="param-type">${esc(o.type || o.input?.type || '')}</span>
      </div>`;
    }
    h += `</div>`;
  }

  // ── End-node terminal plan ──
  if (type === '2' && data?.inputs?.terminatePlan) {
    h += `<div class="drawer-section">
      <div class="section-label">Terminal Plan</div>
      <p style="font-size:11px;color:#94a3b8;font-family:monospace">${esc(data.inputs.terminatePlan)}</p>
    </div>`;
  }

  // ── Loop config ──
  if (type === '21' && data?.inputs) {
    const li = data.inputs;
    h += `<div class="drawer-section">
      <div class="section-label">Loop Config</div>
      <div class="param-row"><span class="param-name">type</span><span class="param-type">${esc(li.loopType || '')}</span></div>
      ${li.loopCount ? `<div class="param-row"><span class="param-name">count</span><span class="param-val">${esc(String(li.loopCount?.value?.content ?? ''))}</span></div>` : ''}
    </div>`;
  }

  // ── Code ──
  if (data?.inputs?.code) {
    const lang = data.inputs.language === 3 ? 'python' : '';
    h += `<div class="drawer-section">
      <div class="section-label" style="display:flex;align-items:center;justify-content:space-between">
        <span>Code</span>
        ${lang ? `<span style="font-size:9px;color:#64748b;background:#0f172a;padding:1px 5px;border-radius:3px;font-family:monospace">${lang}</span>` : ''}
      </div>
      <pre class="code-block">${esc(data.inputs.code)}</pre>
    </div>`;
  }

  // ── Inner blocks (Loop) ──
  if (Array.isArray(blocks) && blocks.length) {
    h += `<div class="drawer-section"><div class="section-label">Inner Blocks (${blocks.length})</div>`;
    for (const b of blocks) {
      const bnm  = b.data?.nodeMeta || {};
      const bcfg = NODE_CFG[b.type] || { label: 'NODE', color: '#6b7280' };
      const bc   = (b.type === '5' && bnm.mainColor) ? bnm.mainColor : bcfg.color;
      h += `<div style="margin-bottom:10px;padding:8px;background:#0f172a;border-radius:6px;border:1px solid #1e293b">
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:${bnm.description?'6':'0'}px">
          <span class="node-badge" style="background:${bc}1a;color:${bc}">${bcfg.label}</span>
          <span style="font-size:12px;font-weight:600;color:#f1f5f9">${esc(bnm.title || b.id)}</span>
        </div>
        ${bnm.description ? `<p style="font-size:11px;color:#64748b;margin-bottom:6px;line-height:1.4">${esc(bnm.description)}</p>` : ''}
        ${b.data?.inputs?.code ? `<pre class="code-block" style="max-height:160px">${esc(b.data.inputs.code)}</pre>` : ''}
      </div>`;
    }
    h += `</div>`;
  }

  // ── Node ID ──
  h += `<div class="drawer-section">
    <span style="font-size:10px;color:#334155;font-family:monospace">node id: ${esc(id)}</span>
  </div>`;

  document.getElementById('drawer-content').innerHTML = h;
}
