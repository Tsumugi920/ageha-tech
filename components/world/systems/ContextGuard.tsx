"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { useWorldUI } from "../WorldUIContext";

/**
 * WebGL 上下文守卫（蓝图 §12.3，阶段 4）：
 * - webglcontextlost → preventDefault（允许浏览器走恢复流程）+ 上报
 *   WorldUIContext，WorldShell 显示恢复遮罩（不白屏、不静默）；
 * - webglcontextrestored → 上报解除，渲染循环随 renderer 恢复继续；
 * - 监听在卸载时注销（资源清理审计项）。
 */
export function ContextGuard() {
  const gl = useThree((state) => state.gl);
  const { setContextLost } = useWorldUI();

  useEffect(() => {
    const canvas = gl.domElement;
    const onLost = (event: Event) => {
      event.preventDefault();
      setContextLost(true);
    };
    const onRestored = () => {
      setContextLost(false);
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    return () => {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
    };
  }, [gl, setContextLost]);

  return null;
}
