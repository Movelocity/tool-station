/**
 * json-v-resize.js
 * 为窗格底部的 resize-handle 提供拖拽调整高度的能力。
 *
 * 用法：
 *   JsonVResize.attach(handleElement, contentElement, {
 *     minHeight: 120,
 *     onEnd: (newHeight) => { ... }
 *   });
 */

const JsonVResize = (() => {

  /**
   * 为一个 resize handle 绑定拖拽逻辑。
   * @param {HTMLElement} handle   拖拽手柄元素
   * @param {HTMLElement} target   需要调整高度的元素（.pane-content）
   * @param {Object}      opts
   * @param {number}      opts.minHeight  最小高度（px），默认 120
   * @param {Function}    [opts.onEnd]    拖拽结束时的回调，参数为新高度
   */
  function attach(handle, target, opts = {}) {
    const minH = opts.minHeight || 120;

    let startY = 0;
    let startH = 0;
    let dragging = false;

    function onMouseDown(e) {
      e.preventDefault();
      dragging = true;
      startY = e.clientY;
      startH = target.offsetHeight;
      handle.classList.add('active');
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    }

    function onMouseMove(e) {
      if (!dragging) return;
      const newH = Math.max(minH, startH + (e.clientY - startY));
      target.style.height = newH + 'px';
    }

    function onMouseUp() {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      if (typeof opts.onEnd === 'function') {
        opts.onEnd(target.offsetHeight);
      }
    }

    handle.addEventListener('mousedown', onMouseDown);

    return function detach() {
      handle.removeEventListener('mousedown', onMouseDown);
    };
  }

  return { attach };
})();
