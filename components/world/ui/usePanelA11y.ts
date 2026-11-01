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
  returnFocusSelector,
}: {
  open: boolean;
  onClose: () => void;
  panelRef: RefObject<HTMLElement | null>;
  /**
   * 触发按钮在面板打开期间被 HUD 淡出（visibility:hidden）时，
   * activeElement 会退回 body；关闭后按此选择器把焦点还给入口。
   */
  returnFocusSelector?: string;
}) {
  // 打开面板时记录触发者，关闭后归还焦点
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    // 清掉可能的陈旧守卫（无面板时点击 3D 交互体遗留）
    interactionState.suppressSceneClose = false;
    openerRef.current = document.activeElement;
    // #world-root 是 fixed + overflow:hidden，但浏览器仍可能因焦点 / Tab
    // 把它的 scrollLeft 改掉，导致画布与 HUD 整体左移。面板打开期间锁在原点，
    // 关闭后再复位一次，避免进度按钮的可达性操作留下错位。
    const root = document.getElementById("world-root");
    const keepRootAtOrigin = () => {
      if (!root) return;
      if (root.scrollTop !== 0) root.scrollTop = 0;
      if (root.scrollLeft !== 0) root.scrollLeft = 0;
    };
    keepRootAtOrigin();
    root?.addEventListener("scroll", keepRootAtOrigin, { passive: true });
    // 焦点移入面板（优先关闭按钮，其次面板容器）。
    // 必须 preventScroll：面板此刻仍在视口外（translate 100%），浏览器
    // 默认会把 overflow:hidden 的 #world-root 滚动到焦点处，导致整个
    // 面板/画布错位（R3 移动端详情顶部被裁掉、关闭键消失的根因）。
    const panel = panelRef.current;
    if (panel) {
      const focusable = panel.querySelector<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
      );
      (focusable ?? panel).focus({ preventScroll: true });
      keepRootAtOrigin();
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
          last.focus({ preventScroll: true });
        } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
          event.preventDefault();
          first.focus({ preventScroll: true });
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
      root?.removeEventListener("scroll", keepRootAtOrigin);
      keepRootAtOrigin();
      // 归还焦点：触发者仍可用时优先还给它；被 HUD 淡出隐藏时回退到入口按钮。
      // HUD 的 visibility 有 0.18s 过渡，cleanup 时可能仍不可聚焦——先尝试，
      // 若焦点落到 body 且入口随后可见，再补一次（不打断用户新的焦点）。
      const opener = openerRef.current;
      const target =
        opener instanceof HTMLElement &&
        opener !== document.body &&
        document.contains(opener)
          ? opener
          : returnFocusSelector
            ? document.querySelector<HTMLElement>(returnFocusSelector)
            : null;
      const restore = () => {
        if (!target?.isConnected) return false;
        if (panel?.getAttribute("aria-hidden") !== "true") return false;
        target.focus({ preventScroll: true });
        return document.activeElement === target;
      };
      if (!restore()) {
        window.setTimeout(() => {
          if (document.activeElement === document.body) restore();
        }, 240);
      }
    };
  }, [open, onClose, panelRef, returnFocusSelector]);
}
