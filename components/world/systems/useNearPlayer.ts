"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Vector3 } from "three";
import type { PlayerApi } from "./usePlayerController";

/**
 * 玩家邻近检测（低频采样，蓝图 §11.2 按需加载的挂载判据）：
 * 每隔 N 帧计算玩家到指定点的三维距离，跨越阈值时才更新 React 状态
 * （一次挂载/卸载，绝不逐帧 setState）。阈值带 2 单位滞回防抖动。
 */
export function useNearPlayer(
  player: PlayerApi,
  center: { x: number; y: number; z: number },
  distance: number,
  sampleEveryNFrames = 24,
): boolean {
  const [near, setNear] = useState(false);
  const nearRef = useRef(false);
  const frameCounter = useRef(0);

  useFrame(() => {
    frameCounter.current += 1;
    if (frameCounter.current % sampleEveryNFrames !== 0) return;
    const p = player.pos.current as Vector3;
    const d = Math.hypot(p.x - center.x, p.y - center.y, p.z - center.z);
    // 滞回：进入 distance，退出需退到 distance + 2 以外
    const now = nearRef.current ? d < distance + 2 : d < distance;
    if (now !== nearRef.current) {
      nearRef.current = now;
      setNear(now);
    }
  });

  return near;
}
