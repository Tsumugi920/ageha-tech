"use client";

import { useEffect, useMemo } from "react";
import { MAIN_ISLAND, SPAWN_POINT } from "@/lib/world/layout";
import { WORLD_COLORS } from "@/lib/world/constants";
import { createFloatingRockGeometry } from "./FloatingRock";

/**
 * 苏醒环礁（主岛）：倒锥浮石 + 椭圆雪面 + 出生点光环（蓝图 §2.2）。
 * 主岛面为解析可行走面（layout.getGroundHeight 椭圆方程），不做 raycast。
 */
export function MainIsland() {
  const rockGeometry = useMemo(
    () => createFloatingRockGeometry(1, MAIN_ISLAND.coneDepth, 56),
    [],
  );
  useEffect(() => () => rockGeometry.dispose(), [rockGeometry]);

  return (
    <group>
      {/* 岩体：剖面 lathe，椭圆缩放（半轴 18 / 13） */}
      <mesh geometry={rockGeometry} scale={[MAIN_ISLAND.semiAxisX, 1, MAIN_ISLAND.semiAxisZ]} receiveShadow>
        <meshStandardMaterial color={WORLD_COLORS.rockMid} roughness={0.85} flatShading />
      </mesh>
      {/* 雪面：可行走盘面（顶面 y=0），微反光冰雪层 */}
      <mesh
        position={[0, -0.13, 0]}
        scale={[MAIN_ISLAND.semiAxisX * 0.99, 1, MAIN_ISLAND.semiAxisZ * 0.99]}
        receiveShadow
      >
        <cylinderGeometry args={[1, 1, 0.26, 56]} />
        <meshStandardMaterial color={WORLD_COLORS.snow} roughness={0.4} metalness={0.05} />
      </mesh>
      {/* 出生点光环（初始构图前景锚点） */}
      <mesh position={[SPAWN_POINT.x, 0.04, SPAWN_POINT.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.05, 1.35, 48]} />
        <meshBasicMaterial color={WORLD_COLORS.trailGlow} transparent opacity={0.75} />
      </mesh>
    </group>
  );
}
