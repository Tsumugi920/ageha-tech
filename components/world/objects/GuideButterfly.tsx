"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { DoubleSide, Group, MathUtils, Vector3 } from "three";
import {
  GUIDE_BUTTERFLY,
  PROJECT_ISLES,
  TRAILS,
} from "@/lib/world/layout";
import { useIdleSeconds } from "../systems/useIdleSeconds";
import { usePrefersReducedMotion } from "../systems/usePrefersReducedMotion";
import type { PlayerApi } from "../systems/usePlayerController";
import { createWingPairGeometry } from "./butterflyShape";

/**
 * 引导蝶 Ageha（蓝图 §5.2，导航角色）：
 * - 沿「当前未探索」的蝶径往返巡飞（到访屿后会话内记档，三径尽后绕
 *   主岛环飞）；玩家静止 >8s 时飞至玩家前方悬停示意前进方向；
 * - 翅根扇动 ±40°、8Hz，飞行幅度强 / 悬停柔（阻尼正弦）；
 * - reduced-motion：悬停待命不巡飞（§12.3）。
 * 翼形与蝶枢同源（butterflyShape），材质为半透明 Standard（transmission
 * 名额留给蝶枢与 Moss 穹舱）。全程只写 refs，零逐帧 React 状态。
 */

/** 已到访屿（会话级登记：引导蝶据此挑「未探索」蝶径） */
const visitedIsles = new Set<string>();

/** 各蝶径采样折线的累计弧长（模块加载时一次构建，运行时零分配） */
const TRAIL_ARCS = TRAILS.map((trail) => {
  const cum: number[] = [0];
  for (let i = 1; i < trail.samples.length; i += 1) {
    const a = trail.samples[i - 1];
    const b = trail.samples[i];
    cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z));
  }
  return { samples: trail.samples, cum, total: cum[cum.length - 1] };
});

/** 沿折线按弧长取点与切线朝向（facing 约定：(−sin h, 0, −cos h)） */
function sampleTrail(arc: (typeof TRAIL_ARCS)[number], dist: number): {
  x: number;
  y: number;
  z: number;
  heading: number;
} {
  const d = MathUtils.clamp(dist, 0, arc.total);
  let i = 1;
  while (i < arc.cum.length - 1 && arc.cum[i] < d) i += 1;
  const a = arc.samples[i - 1];
  const b = arc.samples[i];
  const span = arc.cum[i] - arc.cum[i - 1] || 1;
  const t = (d - arc.cum[i - 1]) / span;
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
    heading: Math.atan2(-(b.x - a.x), -(b.z - a.z)),
  };
}

/** 绕主岛环飞的椭圆参数（岛内上空，三径尽后的常态巡飞） */
const CIRCLE_A = 14;
const CIRCLE_B = 10;
const CIRCLE_Y = 7.2;

export function GuideButterfly({ player }: { player: PlayerApi }) {
  const reducedMotion = usePrefersReducedMotion();
  const idle = useIdleSeconds(player);
  const groupRef = useRef<Group>(null);
  const wingLRef = useRef<Group>(null);
  const wingRRef = useRef<Group>(null);

  const wingL = useMemo(
    () => createWingPairGeometry("left", GUIDE_BUTTERFLY.wingspan, 8),
    [],
  );
  const wingR = useMemo(
    () => createWingPairGeometry("right", GUIDE_BUTTERFLY.wingspan, 8),
    [],
  );
  useEffect(
    () => () => {
      wingL.dispose();
      wingR.dispose();
    },
    [wingL, wingR],
  );

  // 运动状态（refs）：平滑位置 / 朝向 / 巡飞进度 / 环飞角
  const pos = useRef(
    new Vector3(TRAILS[0].samples[0].x, TRAILS[0].samples[0].y + GUIDE_BUTTERFLY.flyHeight, TRAILS[0].samples[0].z),
  );
  const heading = useRef(0);
  const patrolDist = useRef(0);
  const patrolDir = useRef(1);
  const circleAngle = useRef(0);
  const visitCounter = useRef(0);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 30);
    const t = state.clock.elapsedTime;
    const p = pos.current;

    // 到访登记（约 5Hz 低频采样）：踏上屿盘面外缘即记
    visitCounter.current += 1;
    if (visitCounter.current % 12 === 0) {
      const pl = player.pos.current;
      for (const isle of PROJECT_ISLES) {
        if (visitedIsles.has(isle.id)) continue;
        if (Math.hypot(pl.x - isle.center.x, pl.z - isle.center.z) < isle.radius + 2) {
          visitedIsles.add(isle.id);
        }
      }
    }

    let targetX: number;
    let targetY: number;
    let targetZ: number;
    let targetHeading: number;

    if (reducedMotion) {
      // 悬停待命（主岛上空，面向出生点方向示意）
      targetX = 2.4;
      targetY = 6.8;
      targetZ = -5.5;
      targetHeading = Math.PI;
    } else if (idle.current > GUIDE_BUTTERFLY.idleReturnSeconds) {
      // 静止示意：飞至玩家前方 3.2 unit、头上 1.5 悬停
      const pl = player.pos.current;
      const h = player.heading.current;
      targetX = pl.x - Math.sin(h) * 3.2;
      targetY = pl.y + 1.5 + Math.sin(t * 1.9) * 0.12;
      targetZ = pl.z - Math.cos(h) * 3.2;
      targetHeading = h;
    } else {
      // 巡飞：第一条「目标屿未到访」的蝶径；三径尽后绕主岛
      const arcIndex = TRAIL_ARCS.findIndex(
        (_, i) => !visitedIsles.has(TRAILS[i].targetIsleId),
      );
      if (arcIndex >= 0) {
        const arc = TRAIL_ARCS[arcIndex];
        patrolDist.current += GUIDE_BUTTERFLY.speed * delta * patrolDir.current;
        if (patrolDist.current > arc.total) {
          patrolDist.current = arc.total;
          patrolDir.current = -1;
        } else if (patrolDist.current < 0) {
          patrolDist.current = 0;
          patrolDir.current = 1;
        }
        const s = sampleTrail(arc, patrolDist.current);
        targetX = s.x;
        targetY = s.y + GUIDE_BUTTERFLY.flyHeight + Math.sin(t * 1.6) * 0.22;
        targetZ = s.z;
        targetHeading = s.heading;
      } else {
        circleAngle.current += (GUIDE_BUTTERFLY.speed / 12) * delta;
        const a = circleAngle.current;
        targetX = Math.cos(a) * CIRCLE_A;
        targetY = CIRCLE_Y + Math.sin(t * 1.6) * 0.25;
        targetZ = Math.sin(a) * CIRCLE_B;
        // 椭圆切线（逆时针推进）
        targetHeading = Math.atan2(Math.sin(a) * CIRCLE_B, -Math.cos(a) * CIRCLE_A);
      }
    }

    // 位置 / 朝向指数平滑（帧率无关；模式切换自然过渡）
    p.x = MathUtils.damp(p.x, targetX, 2.2, delta);
    p.y = MathUtils.damp(p.y, targetY, 2.2, delta);
    p.z = MathUtils.damp(p.z, targetZ, 2.2, delta);
    let diff = targetHeading - heading.current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    heading.current += diff * Math.min(1, 6 * delta);

    // 翅根扇动：±40° @8Hz 阻尼正弦（移速快则幅度足，悬停柔扇）
    const amp = (GUIDE_BUTTERFLY.wingAmplitudeDeg * Math.PI) / 180;
    const flap = reducedMotion
      ? 0
      : Math.sin(t * Math.PI * 2 * GUIDE_BUTTERFLY.wingFrequency) *
        amp *
        (idle.current > GUIDE_BUTTERFLY.idleReturnSeconds ? 0.45 : 1);

    if (groupRef.current) {
      groupRef.current.position.copy(p);
      groupRef.current.rotation.y = heading.current;
    }
    if (wingLRef.current) wingLRef.current.rotation.z = -(0.18 + flap);
    if (wingRRef.current) wingRRef.current.rotation.z = 0.18 + flap;
  });

  return (
    <group ref={groupRef}>
      {/* 翼对（飞行坐标：翼面平铺 XZ，绕身体轴 Z 扇动；几何 XY→翻转贴平） */}
      <group ref={wingLRef}>
        <mesh geometry={wingL} rotation={[-Math.PI / 2, 0, 0]}>
          <meshStandardMaterial
            vertexColors
            color="#FFFFFF"
            transparent
            opacity={0.92}
            roughness={0.25}
            side={DoubleSide}
          />
        </mesh>
      </group>
      <group ref={wingRRef}>
        <mesh geometry={wingR} rotation={[-Math.PI / 2, 0, 0]}>
          <meshStandardMaterial
            vertexColors
            color="#FFFFFF"
            transparent
            opacity={0.92}
            roughness={0.25}
            side={DoubleSide}
          />
        </mesh>
      </group>
      {/* 水晶身体（沿飞行轴 −Z） */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.07, 0.55, 4, 8]} />
        <meshStandardMaterial
          color="#10294B"
          emissive="#54E3FF"
          emissiveIntensity={0.5}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
}
