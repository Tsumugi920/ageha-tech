"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, MathUtils, Object3D } from "three";
import { WORLD_COLORS } from "@/lib/world/constants";
import { CrystalGlowMaterial } from "./materials";
import { MOTION } from "../systems/worldMotion";
import { usePrefersReducedMotion } from "../systems/usePrefersReducedMotion";

/**
 * 浮晶碎屑（阶段 3 远景层次的中景层）：主岛与远景岛之间的高/低空
 * 悬浮小冰晶（instanced 八面体），给「近景主岛 → 中景三屿 → 远景浮岛」
 * 之间补上纵深参照物与前景遮挡关系——从蝶径上回望时碎屑掠过取景，
 * 空间尺度感成立。高度带避开可行走层（上带 +12~+30 / 下带 −30~−14，
 * 与三屿 / 蝶径在垂直方向天然分离，无需逐点避让）。
 * 数量随性能档缩放；reduced-motion 冻结。位置确定性伪随机（无 SSR 抖动）。
 */
const SHARD_COUNT_MAX = 34;

type ShardUnit = {
  angle: number;
  radius: number;
  y: number;
  scale: number;
  spin: number;
  bobPhase: number;
  bobAmp: number;
};

export function AmbientShards({ count }: { count: number }) {
  const reducedMotion = usePrefersReducedMotion();
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);

  const units = useMemo<ShardUnit[]>(() => {
    const list: ShardUnit[] = [];
    for (let i = 0; i < SHARD_COUNT_MAX; i += 1) {
      const angle = i * 2.399963 + 0.35;
      // 上下两条高度带（避开 −3~+8 的可行走层）；下沉带推远到 60~110
      // （阶段 3 实测：贴着主岛底会读成岛旁的暗色碎块，推远后成中景）
      const upper = i % 2 === 0;
      const radius = upper
        ? 34 + ((i * 41) % 100) / 100 * 62
        : 60 + ((i * 41) % 100) / 100 * 50;
      list.push({
        angle,
        radius,
        y: upper
          ? 12 + ((i * 23) % 100) / 100 * 18
          : -30 + ((i * 19) % 100) / 100 * 16,
        scale: 0.5 + ((i * 29) % 100) / 100 * 1.1,
        spin: 0.1 + ((i * 37) % 100) / 100 * 0.35,
        bobPhase: i * 1.13,
        bobAmp: 0.3 + ((i * 53) % 100) / 100 * 0.5,
      });
    }
    return list;
  }, []);

  const activeCount = MathUtils.clamp(Math.round(count), 0, SHARD_COUNT_MAX);

  useEffect(() => {
    // 未启用档位时收起实例数（零 draw call）
    if (meshRef.current) meshRef.current.count = activeCount;
  }, [activeCount]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh || reducedMotion || activeCount === 0) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < activeCount; i += 1) {
      const unit = units[i];
      dummy.position.set(
        Math.cos(unit.angle) * unit.radius,
        unit.y + Math.sin((t * Math.PI * 2) / MOTION.floatPeriod + unit.bobPhase) * unit.bobAmp,
        Math.sin(unit.angle) * unit.radius,
      );
      dummy.rotation.set(unit.bobPhase, t * unit.spin, unit.bobPhase * 0.7);
      dummy.scale.setScalar(unit.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (activeCount === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, activeCount]}>
      <octahedronGeometry args={[1, 0]} />
      <CrystalGlowMaterial
        color={WORLD_COLORS.iceEdge}
        glow="#8FD4FF"
        intensity={0.3}
        roughness={0.2}
      />
    </instancedMesh>
  );
}
