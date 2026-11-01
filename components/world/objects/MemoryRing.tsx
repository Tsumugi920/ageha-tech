"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Color,
  DoubleSide,
  InstancedMesh,
  Object3D,
  Shape,
  ShapeGeometry,
  type BufferGeometry,
  type MeshBasicMaterial,
} from "three";
import { EXPLORE_GOALS, countCompletedGoals } from "@/lib/world/exploration";
import { usePrefersReducedMotion } from "../systems/usePrefersReducedMotion";
import { useWorldUI } from "../WorldUIContext";

/**
 * 广场记忆环（P4 世界奖励）：中央广场内圈的五瓣石纹。
 *
 * 每完成一个探索目标点亮一瓣；全暗时只是铺装纹样，不参与碰撞、不挡路。
 * 状态来自低频 exploreProgress，逐帧只改实例颜色 / 光点与光晕强度，
 * 不引入 React 逐帧更新；reduced-motion 下不做呼吸与浮动。
 */
const PETAL_INNER_RADIUS = 1.78;
const PETAL_Y = 0.232;
const MOTE_RADIUS = 2.58;
const MOTE_Y = 0.62;

function createPetalGeometry(): BufferGeometry {
  const shape = new Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.27, 0.28, 0.31, 0.74, 0, 1.06);
  shape.bezierCurveTo(-0.31, 0.74, -0.27, 0.28, 0, 0);
  const geometry = new ShapeGeometry(shape, 20);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

export function MemoryRing() {
  const { exploreProgress } = useWorldUI();
  const reducedMotion = usePrefersReducedMotion();
  const petalRef = useRef<InstancedMesh>(null);
  const moteRef = useRef<InstancedMesh>(null);
  const haloRef = useRef<MeshBasicMaterial>(null);
  const litValues = useRef<number[]>(EXPLORE_GOALS.map(() => 0));
  const haloValue = useRef(0);
  const dummy = useMemo(() => new Object3D(), []);
  const color = useMemo(() => new Color(), []);
  const dimColor = useMemo(() => new Color("#9DB9CE"), []);
  const litColor = useMemo(() => new Color("#FFC27A"), []);
  const moteDim = useMemo(() => new Color("#8FC9E4"), []);
  const moteLit = useMemo(() => new Color("#FFE3B0"), []);

  const targetLit = useMemo(
    () => EXPLORE_GOALS.map((goal) => (exploreProgress[goal.id] ? 1 : 0)),
    [exploreProgress],
  );

  const petalGeometry = useMemo(() => createPetalGeometry(), []);
  useEffect(() => () => petalGeometry.dispose(), [petalGeometry]);

  useLayoutEffect(() => {
    const petals = petalRef.current;
    const motes = moteRef.current;
    if (!petals || !motes) return;
    EXPLORE_GOALS.forEach((_, index) => {
      const angle = (index / EXPLORE_GOALS.length) * Math.PI * 2 - Math.PI / 2;
      const ox = Math.sin(angle);
      const oz = Math.cos(angle);

      dummy.position.set(ox * PETAL_INNER_RADIUS, PETAL_Y, oz * PETAL_INNER_RADIUS);
      dummy.rotation.set(0, angle, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      petals.setMatrixAt(index, dummy.matrix);
      petals.setColorAt(index, dimColor);

      dummy.position.set(ox * MOTE_RADIUS, MOTE_Y, oz * MOTE_RADIUS);
      dummy.rotation.set(0.4 * index, angle, 0.2);
      dummy.scale.setScalar(0.35);
      dummy.updateMatrix();
      motes.setMatrixAt(index, dummy.matrix);
      motes.setColorAt(index, moteDim);
    });
    petals.instanceMatrix.needsUpdate = true;
    motes.instanceMatrix.needsUpdate = true;
    if (petals.instanceColor) petals.instanceColor.needsUpdate = true;
    if (motes.instanceColor) motes.instanceColor.needsUpdate = true;
  }, [dimColor, dummy, moteDim]);

  useFrame((state, delta) => {
    const petals = petalRef.current;
    const motes = moteRef.current;
    if (!petals || !motes) return;
    const t = reducedMotion ? 0 : state.clock.elapsedTime;
    const ease = 1 - Math.exp(-6 * Math.min(delta, 0.1));
    let litTotal = 0;

    EXPLORE_GOALS.forEach((_, index) => {
      const angle = (index / EXPLORE_GOALS.length) * Math.PI * 2 - Math.PI / 2;
      const ox = Math.sin(angle);
      const oz = Math.cos(angle);
      const values = litValues.current;
      values[index] += (targetLit[index] - values[index]) * ease;
      const lit = values[index];
      litTotal += lit;

      const breathe = lit > 0.98 && !reducedMotion
        ? 0.9 + Math.sin(t * 1.5 + index * 1.2) * 0.1
        : 1;
      color.copy(dimColor).lerp(litColor, lit).multiplyScalar(breathe);
      petals.setColorAt(index, color);

      const float = reducedMotion ? 0 : Math.sin(t * 1.2 + index) * 0.035 * lit;
      dummy.position.set(ox * MOTE_RADIUS, MOTE_Y + float, oz * MOTE_RADIUS);
      dummy.rotation.set(0.4 * index + t * 0.2 * lit, angle, 0.2);
      dummy.scale.setScalar(0.35 + lit * 0.8);
      dummy.updateMatrix();
      motes.setMatrixAt(index, dummy.matrix);
      color.copy(moteDim).lerp(moteLit, lit);
      motes.setColorAt(index, color);
    });

    if (petals.instanceColor) petals.instanceColor.needsUpdate = true;
    motes.instanceMatrix.needsUpdate = true;
    if (motes.instanceColor) motes.instanceColor.needsUpdate = true;
    const targetHalo = 0.08 + (litTotal / EXPLORE_GOALS.length) * 0.32;
    haloValue.current += (targetHalo - haloValue.current) * ease;
    if (haloRef.current) haloRef.current.opacity = haloValue.current;
  });

  // 开发态探针：验收脚本读取记忆环实际点亮瓣数（生产访问者不可见）
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (
      process.env.NODE_ENV === "production" &&
      !new URLSearchParams(window.location.search).has("debug")
    ) {
      return;
    }
    const read = () => ({
      lit: countCompletedGoals(exploreProgress),
      total: EXPLORE_GOALS.length,
    });
    (window as unknown as { __AGEHA_MEMORY_RING__?: () => unknown }).__AGEHA_MEMORY_RING__ = read;
    return () => {
      delete (window as unknown as { __AGEHA_MEMORY_RING__?: () => unknown }).__AGEHA_MEMORY_RING__;
    };
  }, [exploreProgress]);

  return (
    <group name="plaza-memory-ring">
      <mesh position={[0, 0.224, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <ringGeometry args={[2.94, 3.03, 64]} />
        <meshBasicMaterial
          ref={haloRef}
          color="#FFC27A"
          transparent
          opacity={0.08}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <instancedMesh
        ref={petalRef}
        args={[petalGeometry, undefined, EXPLORE_GOALS.length]}
        renderOrder={2}
      >
        <meshBasicMaterial
          transparent
          opacity={0.82}
          depthWrite={false}
          side={DoubleSide}
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh
        ref={moteRef}
        args={[undefined, undefined, EXPLORE_GOALS.length]}
        renderOrder={3}
      >
        <octahedronGeometry args={[0.11, 0]} />
        <meshBasicMaterial transparent opacity={0.9} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
