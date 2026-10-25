"use client";

import { useEffect } from "react";
import { PROJECT_ISLES } from "@/lib/world/layout";
import { useWorldUI } from "../WorldUIContext";

/**
 * 世界键盘快捷键（蓝图 §6.2 / §13.5 / §13.6，DOM 层）：
 * - M：世界导航面板；H / ?：操作说明；Esc：关闭当前面板；
 * - 1 / 2 / 3：快速传送三项目屿（面板打开时不触发，防误触）；
 * - 焦点在面板内（按钮 / 链接上 Tab 导航）时快捷键让位，
 *   面板内 Esc 由各面板自身的对话框语义处理。
 * WASD / E / R / Shift 由 usePlayerController 处理（帧循环侧）。
 */
export function useWorldShortcuts(active: boolean) {
  const { phase, panel, toggleNav, toggleHelp, closePanel, requestTeleport } = useWorldUI();

  useEffect(() => {
    if (!active || phase !== "ready") return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("[data-world-panel]") ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      switch (event.code) {
        case "KeyM":
          event.preventDefault();
          toggleNav();
          break;
        case "KeyH":
          event.preventDefault();
          toggleHelp();
          break;
        case "Escape":
          if (panel) {
            event.preventDefault();
            closePanel();
          }
          break;
        case "Digit1":
        case "Digit2":
        case "Digit3": {
          if (panel) return;
          const index = Number(event.code.slice(-1)) - 1;
          const isle = PROJECT_ISLES[index];
          if (isle) {
            event.preventDefault();
            requestTeleport(isle.id);
          }
          break;
        }
        default:
          // ?（Shift+/，code=Slash）：与 H 同义打开操作说明
          if (event.key === "?") {
            event.preventDefault();
            toggleHelp();
          }
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, phase, panel, toggleNav, toggleHelp, closePanel, requestTeleport]);
}
