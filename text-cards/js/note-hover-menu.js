(function initTextCardsNoteHoverMenu(global) {
  function defaultCalcPosition(toggleEl) {
    const rect = toggleEl.getBoundingClientRect();
    const menuWidth = 128;
    const menuHeight = 112;
    const viewportPadding = 8;
    const desiredLeft = rect.right - menuWidth;
    const maxLeft = window.innerWidth - menuWidth - viewportPadding;
    const left = Math.max(viewportPadding, Math.min(desiredLeft, maxLeft));
    const desiredTop = rect.bottom + 6;
    const maxTop = window.innerHeight - menuHeight - viewportPadding;
    const top = desiredTop > maxTop
      ? Math.max(viewportPadding, rect.top - menuHeight - 6)
      : desiredTop;
    return { top, left };
  }

  function create(options) {
    const config = options || {};
    const supportsHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const toggleSelector = config.toggleSelector || ".js-menu-toggle";
    const getId = typeof config.getId === "function"
      ? config.getId
      : (toggleEl) => (toggleEl?.dataset?.id || "");
    const calcPosition = typeof config.calcPosition === "function"
      ? config.calcPosition
      : defaultCalcPosition;
    const closeDelayMs = Number.isFinite(config.closeDelayMs) ? config.closeDelayMs : 420;
    const onAction = typeof config.onAction === "function" ? config.onAction : () => {};

    const menu = document.createElement("div");
    menu.id = config.menuId || "floatingNoteMenu";
    menu.className = "fixed z-[60] hidden min-w-[96px] rounded-[10px] border border-slate-600 bg-slate-900 py-1.5 shadow-xl";
    menu.innerHTML = `
      <button type="button" class="w-full cursor-pointer border-0 bg-transparent px-2.5 py-2 text-left text-[13px] text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-50" data-action="edit">Edit</button>
      <button type="button" class="w-full cursor-pointer border-0 bg-transparent px-2.5 py-2 text-left text-[13px] text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-50" data-action="copy">Copy</button>
      <button type="button" class="w-full cursor-pointer border-0 bg-transparent px-2.5 py-2 text-left text-[13px] text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300" data-action="delete">Delete</button>
    `;
    document.body.appendChild(menu);

    let openId = "";
    let openToggleEl = null;
    let closeTimer = null;

    function isOpen() {
      return !menu.classList.contains("hidden");
    }

    function cancelCloseTimer() {
      if (!closeTimer) return;
      clearTimeout(closeTimer);
      closeTimer = null;
    }

    function scheduleClose() {
      cancelCloseTimer();
      closeTimer = setTimeout(() => {
        close();
      }, closeDelayMs);
    }

    function close() {
      cancelCloseTimer();
      openId = "";
      openToggleEl = null;
      menu.dataset.menuId = "";
      menu.classList.add("hidden");
    }

    function open(toggleEl) {
      const id = getId(toggleEl);
      if (!id) return;
      cancelCloseTimer();
      openId = id;
      openToggleEl = toggleEl;
      menu.dataset.menuId = id;
      const pos = calcPosition(toggleEl);
      menu.style.top = `${pos.top}px`;
      menu.style.left = `${pos.left}px`;
      menu.classList.remove("hidden");
    }

    menu.addEventListener("mouseenter", () => {
      cancelCloseTimer();
    });
    menu.addEventListener("mouseleave", () => {
      if (!supportsHover) return;
      scheduleClose();
    });

    menu.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const action = button.dataset.action || "";
      const id = menu.dataset.menuId || openId;
      if (!action || !id) return;
      close();
      await onAction(action, id);
    });

    function bindToggle(toggleEl) {
      if (!toggleEl || toggleEl.dataset.noteHoverBound === "1") return;
      toggleEl.dataset.noteHoverBound = "1";

      if (supportsHover) {
        // Desktop: enter to open, leave with delay to allow moving into menu.
        toggleEl.addEventListener("mouseenter", () => {
          open(toggleEl);
        });
        toggleEl.addEventListener("mouseleave", () => {
          scheduleClose();
        });
      }

      toggleEl.addEventListener("click", (event) => {
        event.stopPropagation();
        if (supportsHover) return;
        if (isOpen() && openId === getId(toggleEl)) close();
        else open(toggleEl);
      });
    }

    function refresh() {
      document.querySelectorAll(toggleSelector).forEach(bindToggle);
      if (openToggleEl && !document.body.contains(openToggleEl)) {
        close();
      }
    }

    const onDocPointerDown = (event) => {
      if (!isOpen()) return;
      if (menu.contains(event.target)) return;
      if (openToggleEl && openToggleEl.contains(event.target)) return;
      close();
    };
    document.addEventListener("mousedown", onDocPointerDown);
    document.addEventListener("touchstart", onDocPointerDown);

    const onResize = () => {
      if (!isOpen() || !openToggleEl) return;
      const pos = calcPosition(openToggleEl);
      menu.style.top = `${pos.top}px`;
      menu.style.left = `${pos.left}px`;
    };
    window.addEventListener("resize", onResize);

    return {
      close,
      refresh,
      destroy() {
        cancelCloseTimer();
        document.removeEventListener("mousedown", onDocPointerDown);
        document.removeEventListener("touchstart", onDocPointerDown);
        window.removeEventListener("resize", onResize);
        menu.remove();
      },
    };
  }

  global.TextCardsNoteHoverMenu = { create };
})(window);
