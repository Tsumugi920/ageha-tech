"use client";

import { WORLD_COLORS } from "@/lib/world/constants";
import { WORLD_SCALE } from "@/lib/world";

/**
 * 冰海（蓝图 §2.2：海面 y=−60 大平面，雾下渐隐）。
 * 线性雾（near 70 / far 260）自然吃掉远方海面，无需额外渐变纹理。
 */
export function IceSea() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, WORLD_SCALE.seaLevelY, 0]}>
      <planeGeometry args={[WORLD_SCALE.seaSize, WORLD_SCALE.seaSize, 1, 1]} />
      <meshStandardMaterial
        color={WORLD_COLORS.sea}
        transparent
        opacity={0.92}
        roughness={0.3}
        metalness={0.08}
      />
    </mesh>
  );
}
