(function initTextCardsDataFab(global) {
  function resolveMountTarget(mountTarget) {
    if (!mountTarget) return document.body;
    if (typeof mountTarget === "string") {
      return document.querySelector(mountTarget) || document.body;
    }
    return mountTarget;
  }

  function createButton(label) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "block w-full px-2.5 py-2 text-left text-[13px] text-slate-300 transition-colors hover:bg-slate-700 hover:text-slate-100";
    btn.textContent = label;
    return btn;
  }

  function create(options) {
    const config = options || {};
    const mountEl = resolveMountTarget(config.mountTarget);
    const items = Array.isArray(config.items) ? config.items : [];

    const wrap = document.createElement("div");
    wrap.className = "fixed bottom-5 right-5 z-[1000010]";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.title = config.triggerTitle || "数据操作";
    trigger.className = "h-[46px] w-[46px] rounded-full border border-slate-700 bg-slate-800 text-xl leading-none text-slate-200 shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition-colors hover:border-slate-600 hover:bg-slate-700";
    trigger.textContent = config.triggerText || "⋯";

    const menu = document.createElement("div");
    menu.className = "absolute bottom-14 right-0 hidden min-w-[126px] rounded-lg border border-slate-700 bg-slate-800 py-1.5 shadow-xl";

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.className = "hidden";

    wrap.appendChild(trigger);
    wrap.appendChild(menu);
    wrap.appendChild(fileInput);
    mountEl.appendChild(wrap);

    let pendingFilePick = null;
    let hoverCloseTimer = null;
    const supportsHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const cancelScheduledClose = () => {
      if (!hoverCloseTimer) return;
      clearTimeout(hoverCloseTimer);
      hoverCloseTimer = null;
    };
    const scheduleClose = () => {
      cancelScheduledClose();
      hoverCloseTimer = setTimeout(() => {
        menu.classList.add("hidden");
        hoverCloseTimer = null;
      }, 500);
    };
    const close = () => {
      cancelScheduledClose();
      menu.classList.add("hidden");
    };
    const open = () => {
      cancelScheduledClose();
      menu.classList.remove("hidden");
    };

    if (supportsHover) {
      // Desktop: reveal by hover for faster access.
      wrap.addEventListener("mouseenter", open);
      wrap.addEventListener("mouseleave", scheduleClose);
    }

    trigger.addEventListener("touchstart", (event) => {
      event.stopPropagation();
    });

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      // Touch / tablet fallback: tap toggles menu.
      if (!supportsHover) {
        if (menu.classList.contains("hidden")) open();
        else close();
      }
    });

    fileInput.addEventListener("change", async (event) => {
      const file = event.target.files && event.target.files[0];
      const next = pendingFilePick;
      pendingFilePick = null;
      if (!next) return;
      await next(file, { close, open });
    });

    items.forEach((item) => {
      const button = createButton(item.label || "Action");
      button.dataset.actionId = String(item.id || "");
      button.addEventListener("click", async () => {
        close();
        if (item.pickFile && typeof item.pickFile.onPick === "function") {
          fileInput.accept = item.pickFile.accept || "";
          fileInput.value = "";
          pendingFilePick = item.pickFile.onPick;
          fileInput.click();
          return;
        }
        if (typeof item.onClick === "function") {
          await item.onClick({ close, open });
        }
      });
      menu.appendChild(button);
    });

    function eventPoint(event) {
      if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
        return { x: event.clientX, y: event.clientY };
      }
      if (event.touches && event.touches[0]) {
        return { x: event.touches[0].clientX, y: event.touches[0].clientY };
      }
      if (event.changedTouches && event.changedTouches[0]) {
        return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
      }
      return null;
    }

    function isPointInElement(element, point) {
      if (!element || !point) return false;
      const rect = element.getBoundingClientRect();
      return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
    }

    const onDocPointerLike = (event) => {
      if (menu.classList.contains("hidden")) return;
      const point = eventPoint(event);
      if (!point) {
        if (!wrap.contains(event.target)) close();
        return;
      }
      const inTrigger = isPointInElement(trigger, point);
      const inMenu = isPointInElement(menu, point);
      if (!inTrigger && !inMenu) close();
    };
    document.addEventListener("click", onDocPointerLike);
    document.addEventListener("touchstart", onDocPointerLike);

    return {
      close,
      open,
      destroy() {
        cancelScheduledClose();
        document.removeEventListener("click", onDocPointerLike);
        document.removeEventListener("touchstart", onDocPointerLike);
        wrap.remove();
      },
      elements: { wrap, trigger, menu, fileInput },
    };
  }

  global.TextCardsDataFab = { create };
})(window);
