"use client";

import { useEffect, useMemo } from "react";
import { DISTANT_ISLES } from "@/lib/world/layout";
import type { TierParams } from "@/lib/world/performance";
import {
  createIslandTopGeometry,
  createLayeredIslandGeometry,
  type IslandProfile,
} from "./islandGeometry";
import { FrostRockMaterial } from "./materials";

/**
 * 远景浮岛群（R3 重做）。
 *
 * R2 的问题：所有远景共用一份「宽雪盘 + 细长漏斗」几何，在低角度看像
 * 一排相同的餐桌/旋转陀螺。R3 改为三种体量剖面（平台 / 碎裂 / 根须），
 * 缩小到主岛的 1/6~1/4，并主动移出主视线中轴——远景只提供纵深，
 * 不与蝶枢或三座项目地标争夺剪影。
 */
const VARIANTS: ReadonlyArray<{
  profile: IslandProfile;
  seed: number;
  depth: number;
  scaleY: number;
  drift: number;
}> = [
  { profile: "mesa", seed: 4.6, depth: 9.5, scaleY: 0.72, drift: 0.8 },
  { profile: "shard", seed: 8.3, depth: 12, scaleY: 0.92, drift: -0.6 },
  { profile: "rooted", seed: 2.1, depth: 8.5, scaleY: 0.68, drift: 0.45 },
];

export function DistantIsles({ tier }: { tier: TierParams }) {
  const geos = useMemo(
    () =>
      VARIANTS.map((variant) => ({
        rock: createLayeredIslandGeometry({
          radiusX: 10,
          radiusZ: 10,
          depth: variant.depth,
          seed: variant.seed,
          jaggedness: variant.profile === "shard" ? 0.11 : 0.085,
          segments: 40,
          profile: variant.profile,
          // R12.0-D（G1）：大气透视烘焙——远景岛在 145~160m 处真实雾只有
          // ~12%，此前直接复用主岛深色岩带，侧影读成深海军蓝「飞碟」；
          // 现把 42% 雾色调烘进顶点色，远景从深色剪影变成雾中淡影
          atmosphereFade: 0.42,
        }),
        top: createIslandTopGeometry({
          radiusX: 10,
          radiusZ: 10,
          depth: variant.depth,
          seed: variant.seed,
          segments: 40,
          rings: 12,
          heightAt: (theta, r) =>
            0.14 * Math.pow(r, 2.1) * (0.5 + 0.5 * Math.sin(theta * 3 + variant.seed)),
          atmosphereFade: 0.38,
        }),
      })),
    [],
  );

  useEffect(
    () => () => {
      geos.forEach((g) => {
        g.rock.dispose();
        g.top.dispose();
      });
    },
    [geos],
  );

  const isles = DISTANT_ISLES.slice(0, tier.distantIsles);

  return (
    <group>
      {isles.map((isle, index) => {
        const variant = VARIANTS[index % VARIANTS.length];
        const geo = geos[index % geos.length];
        // R4：远景岛放大到主岛的 1/3 左右，成为可读的地平线剪影
        const displayScale = isle.scale * 0.44;
        return (
          <group
            key={`${isle.x}-${isle.z}`}
            position={[isle.x, isle.y - 9, isle.z]}
            rotation={[0, index * 0.9 + 0.3, variant.drift * 0.02]}
            scale={[displayScale, displayScale * variant.scaleY, displayScale]}
          >
            <mesh geometry={geo.rock}>
              <meshStandardMaterial vertexColors flatShading roughness={0.95} />
            </mesh>
            <mesh geometry={geo.top} position={[0, 0.02, 0]}>
              <meshStandardMaterial vertexColors roughness={0.72} />
            </mesh>
            {/* 少量远景植被/晶体：只作为「同一片世界」的尺度提示 */}
            {index % 2 === 0 ? (
              <mesh position={[-0.6, 0.55, 0.5]} rotation={[0.2, 0.4, 0.1]} scale={[0.7, 1.4, 0.7]}>
                <octahedronGeometry args={[0.55, 0]} />
                <meshStandardMaterial
                  color="#BFE9FF"
                  emissive="#6CC8F2"
                  emissiveIntensity={0.22}
                  roughness={0.4}
                  flatShading
                />
              </mesh>
            ) : (
              <mesh position={[0.3, 0.35, -0.4]} rotation={[0.4, 0, 0.2]} scale={[0.9, 0.4, 0.8]}>
                <dodecahedronGeometry args={[0.8, 0]} />
                <FrostRockMaterial color="#93AFC4" />
              </mesh>
            )}
            {/* 细灯塔只在高档档位出现，且比地标光柱暗一个量级 */}
            {tier.tier === "high" && index % 3 === 0 ? (
              <mesh position={[0, 8, 0]}>
                <cylinderGeometry args={[0.035, 0.09, 14, 5, 1, true]} />
                <meshBasicMaterial color="#BFE9FF" transparent opacity={0.12} depthWrite={false} />
              </mesh>
            ) : null}
            {/* R12.0-D（G1）：NW 岛竖向剪影从「细杆伞刺」换成冰晶尖塔——
                锥形塔身 + 顶端发光晶尖，与岛缘晶簇同语言 */}
            {index === 0 ? (
              <group position={[0, 13, 0]}>
                <mesh>
                  <cylinderGeometry args={[0.05, 0.52, 20, 5]} />
                  <meshStandardMaterial color="#C2DCEC" roughness={0.8} flatShading />
                </mesh>
                <mesh position={[0, 11.2, 0]} scale={[0.32, 0.85, 0.32]}>
                  <octahedronGeometry args={[1, 0]} />
                  <meshStandardMaterial
                    color="#D6EFFB"
                    emissive="#8FD4FF"
                    emissiveIntensity={0.3}
                    roughness={0.3}
                    flatShading
                  />
                </mesh>
              </group>
            ) : null}
          </group>
        );
      })}
    </group>
  );
}
