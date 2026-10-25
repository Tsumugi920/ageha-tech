"use client";

import { useEffect, useRef } from "react";
import { inputState } from "../systems/inputState";

/**
 * 移动端虚拟摇杆（蓝图 §6.3）：左下 96px 玻璃圆盘，触摸拖动矢量 → 移动。
 * 指针事件直接写 inputState.joystick（共享可变态），摇杆头位置用 ref 直改
 * style——全程零 React 状态更新，无逐帧重渲。
 */
const STICK_RANGE = 34;

export function Joystick() {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLSpanElement>(null);
  const activeId = useRef<number | null>(null);

  useEffect(() => {
    const base = baseRef.current;
    const knob = knobRef.current;
    if (!base || !knob) return;

    const rect = () => base.getBoundingClientRect();

    const setKnob = (x: number, y: number) => {
      knob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    };

    const update = (clientX: number, clientY: number) => {
      const r = rect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len > STICK_RANGE) {
        dx = (dx / len) * STICK_RANGE;
        dy = (dy / len) * STICK_RANGE;
      }
      setKnob(dx, dy);
      inputState.joystick.x = dx / STICK_RANGE;
      inputState.joystick.y = -dy / STICK_RANGE; // 屏幕向上 = 前进
    };

    const reset = () => {
      setKnob(0, 0);
      inputState.joystick.x = 0;
      inputState.joystick.y = 0;
      activeId.current = null;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (activeId.current !== null) return;
      activeId.current = event.pointerId;
      base.setPointerCapture(event.pointerId);
      update(event.clientX, event.clientY);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (activeId.current !== event.pointerId) return;
      update(event.clientX, event.clientY);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (activeId.current !== event.pointerId) return;
      reset();
    };

    base.addEventListener("pointerdown", onPointerDown);
    base.addEventListener("pointermove", onPointerMove);
    base.addEventListener("pointerup", onPointerUp);
    base.addEventListener("pointercancel", onPointerUp);
    return () => {
      base.removeEventListener("pointerdown", onPointerDown);
      base.removeEventListener("pointermove", onPointerMove);
      base.removeEventListener("pointerup", onPointerUp);
      base.removeEventListener("pointercancel", onPointerUp);
      inputState.joystick.x = 0;
      inputState.joystick.y = 0;
    };
  }, []);

  return (
    <div
      ref={baseRef}
      className="world-joystick"
      role="application"
      aria-label="移动摇杆：拖动控制前进方向"
      touch-action="none"
    >
      <span ref={knobRef} className="world-joystick__knob" aria-hidden="true" />
    </div>
  );
}
