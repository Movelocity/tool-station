/**
 * json-v-drag.js
 * 窗格拖拽移动（通过标题栏）+ z-order 层叠管理。
 *
 * 用法：
 *   const drag = JsonVDrag.attach(paneEl, titleBarEl, {
 *     canvas:  canvasElement,        // 画布容器
 *     onMoved: (x, y) => { ... },    // 拖拽结束回调
 *     onFocus: () => { ... },        // 窗格被聚焦（点击 / 拖拽）
 *   });
 *   drag.moveTo(x, y);              // 编程式移动
 *   drag.detach();                   // 解绑
 *
 * Z-order 管理（静态方法）：
 *   JsonVDrag.bringToFront(paneEl);  // 将指定窗格提到最上层
 */

const JsonVDrag = (() => {
  let _topZ = 100;

  /** 将窗格的 z-index 提到最上层，返回新 z-index */
  function bringToFront(paneEl) {
    _topZ++;
    paneEl.style.zIndex = _topZ;
    return _topZ;
  }

  /** 设置初始最大层级（从存储恢复时使用） */
  function setBaseZ(z) {
    if (z > _topZ) _topZ = z;
  }

  function getTopZ() { return _topZ; }

  /**
   * 绑定拖拽到一个窗格
   * @param {HTMLElement} paneEl      窗格根元素（position: absolute）
   * @param {HTMLElement} handleEl    可拖拽区域（标题栏）
   * @param {Object}      opts
   */
  function attach(paneEl, handleEl, opts = {}) {
    const canvas = opts.canvas || paneEl.parentElement;
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;
    let dragging = false;

    function onDown(e) {
      // 不拦截 input / button / svg 上的交互
      const tag = e.target.tagName.toLowerCase();
      if (['input', 'button', 'svg', 'path', 'textarea', 'select', 'option'].includes(tag)) return;
      if (e.target.closest('button, select')) return;

      e.preventDefault();
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseInt(paneEl.style.left, 10) || 0;
      startTop = parseInt(paneEl.style.top, 10) || 0;

      bringToFront(paneEl);
      if (typeof opts.onFocus === 'function') opts.onFocus();
      minimizeTriggered = false;

      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }

    const topBarHeight = opts.topBarHeight ?? 48;
    let minimizeTriggered = false;

    function setTopBarHighlight(on) {
      const bar = document.getElementById('topBar');
      if (bar) bar.classList.toggle('drag-minimize-ready', on);
    }

    function onMove(e) {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newLeft = Math.max(0, startLeft + dx);
      const newTop = Math.max(0, startTop + dy);
      paneEl.style.left = newLeft + 'px';
      paneEl.style.top = newTop + 'px';
      expandCanvas(canvas, paneEl);

      // Collision with top banner: highlight when near, minimize when crossed
      if (e.clientY < topBarHeight) {
        setTopBarHighlight(true);
        if (!minimizeTriggered) {
          minimizeTriggered = true;
          stopDrag();
          if (typeof opts.onMinimize === 'function') opts.onMinimize();
        }
      } else {
        setTopBarHighlight(false);
      }
    }

    function stopDrag() {
      dragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setTopBarHighlight(false);
    }

    function onUp() {
      if (!dragging) return;
      stopDrag();
      expandCanvas(canvas, paneEl);
      if (typeof opts.onMoved === 'function') {
        opts.onMoved(parseInt(paneEl.style.left, 10), parseInt(paneEl.style.top, 10));
      }
    }

    // 点击窗格任意位置也置顶
    paneEl.addEventListener('mousedown', () => {
      bringToFront(paneEl);
      if (typeof opts.onFocus === 'function') opts.onFocus();
    });

    handleEl.addEventListener('mousedown', onDown);

    function moveTo(x, y) {
      paneEl.style.left = x + 'px';
      paneEl.style.top = y + 'px';
      expandCanvas(canvas, paneEl);
    }

    function detach() {
      handleEl.removeEventListener('mousedown', onDown);
    }

    return { moveTo, detach };
  }

  /** 确保画布足够大以容纳所有窗格 */
  function expandCanvas(canvas, paneEl) {
    const right = (parseInt(paneEl.style.left, 10) || 0) + paneEl.offsetWidth + 80;
    const bottom = (parseInt(paneEl.style.top, 10) || 0) + paneEl.offsetHeight + 80;
    if (right > canvas.scrollWidth) canvas.style.width = right + 'px';
    if (bottom > canvas.offsetHeight) canvas.style.minHeight = bottom + 'px';
  }

  return { attach, bringToFront, setBaseZ, getTopZ };
})();
