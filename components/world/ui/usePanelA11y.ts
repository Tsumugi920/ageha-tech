"use client";

import { useEffect, useRef, type RefObject } from "react";
import { inputState } from "../systems/inputState";
import { interactionState } from "../systems/interactionState";

/**
 * 世界面板无障碍基座（阶段 2 键盘可达要求）：
 * - 挂载即把焦点移入面板（对话框语义），Tab 循环困在面板内；
 * - Esc 关闭；卸载时把焦点还给打开它的元素（HUD 按钮 / 画布）；
 * - 「点击场景空白关闭」（蓝图 §8）：canvas 上的非拖拽 pointerup 关闭面板；
 *   3D 交互体的点击会先置 interactionState.suppressSceneClose（同一事件
 *   冒泡序：canvas 目标段先于 document 冒泡段），避免「换开面板被秒关」。
 */
export function usePanelA11y({
  open,
  onClose,
  panelRef,
}: {
  open: boolean;
  onClose: () => void;
  panelRef: RefObject<HTMLElement | null>;
}) {
  // 打开面板时记录触发者，关闭后归还焦点
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    // 清掉可能的陈旧守卫（无面板时点击 3D 交互体遗留）
    interactionState.suppressSceneClose = false;
    openerRef.current = document.activeElement;
    // 焦点移入面板（优先关闭按钮，其次面板容器）
    const panel = panelRef.current;
    if (panel) {
      const focusable = panel.querySelector<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
      );
      (focusable ?? panel).focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      // Tab 焦点陷阱：循环困在面板内（aria-modal 的键盘等价物）
      if (event.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;
        const focusables = Array.from(
          panel.querySelectorAll<HTMLElement>(
            "button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
          ),
        ).filter((el) => el.offsetParent !== null);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && (active === first || !panel.contains(active))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    // 点击场景空白（canvas）关闭面板——拖拽观察不触发
    const onPointerUp = (event: PointerEvent) => {
      if (interactionState.suppressSceneClose) {
        interactionState.suppressSceneClose = false;
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest("canvas") && !inputState.pointerDragged) {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerup", onPointerUp);
      // 归还焦点（触发者已随路由/卸载消失时安全失败）
      const opener = openerRef.current;
      if (opener instanceof HTMLElement && document.contains(opener)) {
        opener.focus();
      }
    };
  }, [open, onClose, panelRef]);
}
