"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { PlayerApi } from "./usePlayerController";

/**
 * 玩家静止计时（refs 累计，零 React 状态更新）：
 * 速度 > 0.5 视为移动并清零，否则累计秒数（delta 截断 0.1 防切页跳变）。
 * 引导蝶（静止 >8s 飞回示意方向，§5.2）与星尘蝶群彩蛋
 * （静止 >20s 聚舞，§9.2）共用同一判据，两处节奏天然一致。
 */
export function useIdleSeconds(player: PlayerApi): React.RefObject<number> {
  const idle = useRef(0);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    if (player.speed.current > 0.5) {
      idle.current = 0;
    } else {
      idle.current += delta;
    }
  });

  return idle;
}
