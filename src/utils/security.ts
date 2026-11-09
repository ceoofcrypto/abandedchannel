/**
 * Anti-debugger and interaction protection utilities.
 * Blocks long-press context menus, right-clicks, and common developer tool shortcut sequences.
 */

export interface KeyboardShortcutEvent {
  key: string;
  keyCode?: number;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

/**
 * Validates whether a keyboard event is an inspection, debugger, or page source inspection shortcut.
 */
export function isDebuggerShortcut(e: KeyboardShortcutEvent): boolean {
  // F12 key
  if (e.key === 'F12' || e.keyCode === 123) {
    return true;
  }

  const isCmdOrCtrl = Boolean(e.ctrlKey || e.metaKey);
  const normalizedKey = (e.key || '').toLowerCase();

  // Ctrl+Shift+I / J / C / K (Inspect / Console / Element Selector)
  if (isCmdOrCtrl && e.shiftKey) {
    if (['i', 'j', 'c', 'k'].includes(normalizedKey)) {
      return true;
    }
  }

  // Ctrl+U / Cmd+Option+U (View Source)
  if (isCmdOrCtrl && normalizedKey === 'u') {
    return true;
  }

  // Ctrl+S / Cmd+S (Save Page Source)
  if (isCmdOrCtrl && normalizedKey === 's') {
    return true;
  }

  return false;
}

/**
 * Initializes global client-side protections against long-press inspection, context menus,
 * and debugger shortcut triggers.
 */
export function initClientSecurity(): () => void {
  if (typeof window === 'undefined') return () => {};

  // 1. Block right-click / contextmenu globally
  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  // 2. Block keyboard debugger shortcuts (F12, Ctrl+Shift+I/J/C, etc.)
  const handleKeyDown = (e: KeyboardEvent) => {
    if (isDebuggerShortcut(e)) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  };

  // 3. Block mobile long-press inspect and context callouts
  let touchHoldTimer: ReturnType<typeof setTimeout> | null = null;
  let startX = 0;
  let startY = 0;

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length > 0) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;

      // Detect long press (> 320ms hold)
      touchHoldTimer = setTimeout(() => {
        // Prevent default touch callout behavior if target is not an input
        const target = e.target as HTMLElement | null;
        const isInputField =
          target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

        if (!isInputField && e.cancelable) {
          e.preventDefault();
        }
        touchHoldTimer = null;
      }, 320);
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (touchHoldTimer && e.touches.length > 0) {
      const diffX = Math.abs(e.touches[0].clientX - startX);
      const diffY = Math.abs(e.touches[0].clientY - startY);
      // Cancel timer if finger moves
      if (diffX > 8 || diffY > 8) {
        clearTimeout(touchHoldTimer);
        touchHoldTimer = null;
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchHoldTimer) {
      clearTimeout(touchHoldTimer);
      touchHoldTimer = null;
    }
  };

  // 4. Block drag and drop of media / elements into external debugger windows
  const handleDragStart = (e: DragEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
      e.preventDefault();
    }
  };

  window.addEventListener('contextmenu', handleContextMenu, { capture: true, passive: false });
  window.addEventListener('keydown', handleKeyDown, { capture: true, passive: false });
  window.addEventListener('touchstart', handleTouchStart, { passive: false });
  window.addEventListener('touchmove', handleTouchMove, { passive: true });
  window.addEventListener('touchend', handleTouchEnd, { passive: true });
  window.addEventListener('touchcancel', handleTouchEnd, { passive: true });
  window.addEventListener('dragstart', handleDragStart, { capture: true });

  // Cleanup handler
  return () => {
    window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
    window.removeEventListener('keydown', handleKeyDown, { capture: true });
    window.removeEventListener('touchstart', handleTouchStart);
    window.removeEventListener('touchmove', handleTouchMove);
    window.removeEventListener('touchend', handleTouchEnd);
    window.removeEventListener('touchcancel', handleTouchEnd);
    window.removeEventListener('dragstart', handleDragStart, { capture: true });
    if (touchHoldTimer) clearTimeout(touchHoldTimer);
  };
}
