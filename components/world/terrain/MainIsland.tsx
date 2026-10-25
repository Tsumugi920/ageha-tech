"use client";

import { useEffect, useMemo } from "react";
import { MAIN_ISLAND, SPAWN_POINT } from "@/lib/world/layout";
import { WORLD_COLORS } from "@/lib/world/constants";
import { createFloatingRockGeometry } from "./FloatingRock";
import { CrystalGlowMaterial, FrostRockMaterial, SnowFieldMaterial } from "./materials";

/**
 * 苏醒环礁（主岛）：倒锥浮石 + 椭圆雪面 + 出生点光环 + 冰晶簇（§3.2）。
 * 主岛面为解析可行走面（layout.getGroundHeight 椭圆方程），不做 raycast。
 * 冰晶簇为装饰层（instanced），布点避开出生环 / 三径头 / 石碑——
 * 确定性位置，无 SSR 抖动。材质走 materials.tsx 分层体系
 * （岩体磨砂 / 盘面冰雪 / 晶簇柔光）。
 */

/** 冰晶簇布点（手选，避开出生点与蝶径头；簇 = 1 大 2 小三枚八面体） */
const CRYSTAL_SPOTS: ReadonlyArray<{ x: number; z: number; scale: number; rot: number }> = [
  { x: 7.5, z: -4, scale: 1.15, rot: 0.4 },
  { x: -8.2, z: -2.5, scale: 0.9, rot: 1.2 },
  { x: 11.2, z: 3.8, scale: 1.0, rot: 2.1 },
  { x: -5.6, z: 6.8, scale: 0.75, rot: 0.8 },
  { x: 4.6, z: -9.2, scale: 0.85, rot: 1.7 },
  { x: -11.5, z: -8.6, scale: 1.05, rot: 2.6 },
];

/** 每簇 3 枚（1 主 2 陪）；SHARD_OFFSETS 为簇内局部偏移 / 缩放 / 旋转 */
const SHARD_OFFSETS = [
  { dx: 0, dz: 0, s: 1, r: 0 },
  { dx: 0.42, dz: 0.18, s: 0.5, r: 0.9 },
  { dx: -0.3, dz: 0.4, s: 0.38, r: 1.8 },
] as const;

export function MainIsland() {
  const rockGeometry = useMemo(
    () => createFloatingRockGeometry(1, MAIN_ISLAND.coneDepth, 56),
    [],
  );
  useEffect(() => () => rockGeometry.dispose(), [rockGeometry]);

  return (
    <group>
      {/* 岩体：剖面 lathe，椭圆缩放（半轴 18 / 13），磨砂岩 */}
      <mesh geometry={rockGeometry} scale={[MAIN_ISLAND.semiAxisX, 1, MAIN_ISLAND.semiAxisZ]} receiveShadow>
        <FrostRockMaterial />
      </mesh>
      {/* 雪面：可行走盘面（顶面 y=0），冰雪微反光层 */}
      <mesh
        position={[0, -0.13, 0]}
        scale={[MAIN_ISLAND.semiAxisX * 0.99, 1, MAIN_ISLAND.semiAxisZ * 0.99]}
        receiveShadow
      >
        <cylinderGeometry args={[1, 1, 0.26, 56]} />
        <SnowFieldMaterial />
      </mesh>
      {/* 出生点光环（初始构图前景锚点） */}
      <mesh position={[SPAWN_POINT.x, 0.04, SPAWN_POINT.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.05, 1.35, 48]} />
        <meshBasicMaterial color={WORLD_COLORS.trailGlow} transparent opacity={0.75} />
      </mesh>
      {/* 冰晶簇（§3.2 少量冰晶簇：静态装饰，柔光不刺眼） */}
      {CRYSTAL_SPOTS.map((spot) => (
        <group
          key={`${spot.x}-${spot.z}`}
          position={[spot.x, 0, spot.z]}
          rotation={[0, spot.rot, 0]}
        >
          {SHARD_OFFSETS.map((shard, i) => (
            <mesh
              key={i}
              position={[shard.dx, 0.42 * shard.s + 0.1, shard.dz]}
              rotation={[0.12 * i, shard.r, 0.1 * i]}
              castShadow
            >
              <octahedronGeometry args={[0.55 * spot.scale * shard.s, 0]} />
              <CrystalGlowMaterial
                color={WORLD_COLORS.iceEdge}
                glow="#8FD4FF"
                intensity={0.28}
                roughness={0.18}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
