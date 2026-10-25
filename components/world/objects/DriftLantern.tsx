"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  DoubleSide,
  Group,
  Points,
} from "three";
import { WORLD_COLORS } from "@/lib/world/constants";
import { getGroundHeight } from "@/lib/world/layout";
import type { PlayerApi } from "../systems/usePlayerController";

/**
 * 浮游信灯 The Drift Lantern（蓝图 §6.1，阶段 1 核心）：
 * 贴地悬浮的发光小体——水晶核 + 四片微型光翼（移动后掠收拢、悬停张开微颤）+
 * 底部柔光圈投地 + 尾迹鳞粉带（20 粒 ring buffer）。
 * 全部帧内动画只写 refs / geometry 属性，零 React 状态更新。
 */
const TRAIL_COUNT = 20;

export function DriftLantern({ player }: { player: PlayerApi }) {
  const groupRef = useRef<Group>(null);
  const coreRef = useRef<Group>(null);
  const wingFLRef = useRef<Group>(null);
  const wingFRRef = useRef<Group>(null);
  const wingBLRef = useRef<Group>(null);
  const wingBRRef = useRef<Group>(null);
  const ringRef = useRef<Group>(null);
  const pointsRef = useRef<Points>(null);

  const ringGeometry = useMemo(() => new CircleGeometry(0.55, 24), []);
  const trailGeometry = useMemo(() => {
    const geometry = new BufferGeometry();
    const positions = new Float32Array(TRAIL_COUNT * 3);
    // 初始化为出生点（禁用 NaN 初始化：NaN 会让 computeBoundingSphere 报错）
    for (let i = 0; i < TRAIL_COUNT; i += 1) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0.35;
      positions[i * 3 + 2] = 10;
    }
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    return geometry;
  }, []);

  useEffect(
    () => () => {
      ringGeometry.dispose();
      trailGeometry.dispose();
    },
    [ringGeometry, trailGeometry],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const p = player.pos.current;
    const speed = player.speed.current;

    if (groupRef.current) {
      groupRef.current.position.copy(p);
      groupRef.current.rotation.y = player.heading.current;
    }
    // 水晶核：悬停微浮 + 随速度加快自转
    if (coreRef.current) {
      coreRef.current.position.y = 0.05 + Math.sin(t * 2.1) * 0.045;
      const spin = 0.6 + Math.min(speed / 7.5, 1) * 2.2;
      coreRef.current.rotation.y += spin * 0.016;
    }
    // 光翼：移动后掠收拢、悬停张开微颤（前后两对，对称相位）
    const sweep = 0.42 + Math.min(speed / 7.5, 1) * 0.5;
    const flutter = Math.sin(t * 9) * 0.1 * (speed > 0.6 ? 1 : 0.35);
    if (wingFLRef.current) wingFLRef.current.rotation.z = sweep + flutter;
    if (wingFRRef.current) wingFRRef.current.rotation.z = -sweep - flutter;
    if (wingBLRef.current) wingBLRef.current.rotation.z = sweep * 0.8 - flutter * 0.6;
    if (wingBRRef.current) wingBRRef.current.rotation.z = -sweep * 0.8 + flutter * 0.6;
    // 底部柔光圈：贴地跟随
    if (ringRef.current) {
      const ground = getGroundHeight(p.x, p.z);
      ringRef.current.position.set(p.x, (ground ?? p.y - 0.35) + 0.03, p.z);
    }
    // 尾迹鳞粉：ring buffer 逐帧后移
    if (pointsRef.current) {
      const attribute = pointsRef.current.geometry.getAttribute("position") as BufferAttribute;
      const array = attribute.array as Float32Array;
      for (let i = TRAIL_COUNT - 1; i > 0; i -= 1) {
        array[i * 3] = array[(i - 1) * 3];
        array[i * 3 + 1] = array[(i - 1) * 3 + 1] + 0.004;
        array[i * 3 + 2] = array[(i - 1) * 3 + 2];
      }
      const back = Math.min(speed / 7.5, 1) * 0.5;
      const hx = Math.sin(player.heading.current);
      const hz = Math.cos(player.heading.current);
      array[0] = p.x + hx * back;
      array[1] = p.y + (Math.random() - 0.5) * 0.06;
      array[2] = p.z + hz * back;
      attribute.needsUpdate = true;
    }
  });

  const wingMaterialProps = {
    color: WORLD_COLORS.trailGlow,
    transparent: true,
    opacity: 0.5,
    side: DoubleSide,
    depthWrite: false,
  } as const;

  return (
    <group>
      <group ref={groupRef}>
        {/* 水晶核 + 随身点光 */}
        <group ref={coreRef}>
          <mesh castShadow>
            <icosahedronGeometry args={[0.22, 0]} />
            <meshStandardMaterial
              color={WORLD_COLORS.iceEdge}
              emissive={WORLD_COLORS.trailGlow}
              emissiveIntensity={1.4}
              roughness={0.25}
              flatShading
            />
          </mesh>
          <pointLight color={WORLD_COLORS.trailGlow} intensity={4} distance={9} decay={2} />
        </group>
        {/* 四片微型光翼（前对 + 后对） */}
        <group ref={wingFLRef} position={[0.16, 0.08, 0]}>
          <mesh>
            <planeGeometry args={[0.5, 0.16]} />
            <meshBasicMaterial {...wingMaterialProps} />
          </mesh>
        </group>
        <group ref={wingFRRef} position={[-0.16, 0.08, 0]}>
          <mesh>
            <planeGeometry args={[0.5, 0.16]} />
            <meshBasicMaterial {...wingMaterialProps} />
          </mesh>
        </group>
        <group ref={wingBLRef} position={[0.13, 0.04, -0.08]}>
          <mesh>
            <planeGeometry args={[0.34, 0.12]} />
            <meshBasicMaterial {...wingMaterialProps} />
          </mesh>
        </group>
        <group ref={wingBRRef} position={[-0.13, 0.04, -0.08]}>
          <mesh>
            <planeGeometry args={[0.34, 0.12]} />
            <meshBasicMaterial {...wingMaterialProps} />
          </mesh>
        </group>
      </group>
      {/* 底部柔光圈（贴地） */}
      <group ref={ringRef}>
        <mesh geometry={ringGeometry} rotation={[-Math.PI / 2, 0, 0]}>
          <meshBasicMaterial color={WORLD_COLORS.trailGlow} transparent opacity={0.3} depthWrite={false} />
        </mesh>
      </group>
      {/* 尾迹鳞粉带 */}
      <points ref={pointsRef} geometry={trailGeometry}>
        <pointsMaterial
          color="#9FE9FF"
          size={0.14}
          transparent
          opacity={0.8}
          depthWrite={false}
          blending={AdditiveBlending}
          sizeAttenuation
        />
      </points>
    </group>
  );
}
