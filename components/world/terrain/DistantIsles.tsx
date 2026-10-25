"use client";

import { useEffect, useMemo } from "react";
import { DISTANT_ISLES } from "@/lib/world/layout";
import { WORLD_COLORS } from "@/lib/world/constants";
import type { TierParams } from "@/lib/world/performance";
import { createFloatingRockGeometry } from "./FloatingRock";
import { FrostRockMaterial, SnowFieldMaterial } from "./materials";

/**
 * 远景浮岛群（蓝图 §2.2：半径 120~220 环带，5~7 座不可达剪影）。
 * 共享一份 lathe 几何按座缩放；线性雾负责半雾剪影层次；
 * 顶面雪帽用冰雪色（与主岛 / 三屿同语言，读出「同一片群岛」，
 * 且比岩色更亮——远景第三层在雾中仍可辨天际线）。
 * 座数随性能档位（高 7 / 中 5 / 低 3）。
 */
export function DistantIsles({ tier }: { tier: TierParams }) {
  const geometry = useMemo(() => createFloatingRockGeometry(10, 9, 28), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const isles = DISTANT_ISLES.slice(0, tier.distantIsles);

  return (
    <group>
      {isles.map((isle) => (
        <group key={`${isle.x}-${isle.z}`} position={[isle.x, isle.y, isle.z]}>
          <mesh geometry={geometry} scale={[isle.scale, isle.scale * 0.9, isle.scale]}>
            <FrostRockMaterial color={WORLD_COLORS.rockDeep} />
          </mesh>
          {/* 顶面雪帽剪影（与主岛语言一致，读出「同一片群岛」） */}
          <mesh position={[0, 0.1, 0]} scale={[isle.scale, 1, isle.scale]}>
            <cylinderGeometry args={[9.4, 9.4, 0.4, 24]} />
            <SnowFieldMaterial color={WORLD_COLORS.rockMid} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
