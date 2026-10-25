"use client";

import { useEffect, useMemo } from "react";
import { DISTANT_ISLES } from "@/lib/world/layout";
import { WORLD_COLORS } from "@/lib/world/constants";
import type { TierParams } from "@/lib/world/performance";
import { createFloatingRockGeometry } from "./FloatingRock";

/**
 * 远景浮岛群（蓝图 §2.2：半径 120~220 环带，5~7 座不可达剪影）。
 * 共享一份 lathe 几何按座缩放；线性雾负责半雾剪影层次；
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
            <meshStandardMaterial color={WORLD_COLORS.rockDeep} roughness={0.95} />
          </mesh>
          {/* 顶面雪帽剪影（与主岛语言一致，读出「同一片群岛」） */}
          <mesh position={[0, 0.1, 0]} scale={[isle.scale, 1, isle.scale]}>
            <cylinderGeometry args={[9.4, 9.4, 0.4, 24]} />
            <meshStandardMaterial color={WORLD_COLORS.rockMid} roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
