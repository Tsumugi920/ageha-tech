"use client";

import { useEffect, useState } from "react";

/**
 * prefers-reduced-motion 探测（蓝图 §12.3）：
 * globals.css 的兜底只覆盖 CSS 动画，不覆盖 r3f 帧循环内的程序化动画——
 * 场景组件（曲线柱滚动 / 传送运镜等）读本钩子自行静止或瞬时完成。
 * SSR 首帧返回 false（世界 Canvas 本身 ssr:false，实际不会在服务端执行）。
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}
