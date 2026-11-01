"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  Points,
} from "three";
import { SPAWN_POINT, getGroundHeight } from "@/lib/world/layout";
import { usePrefersReducedMotion } from "../systems/usePrefersReducedMotion";
import type { PlayerApi } from "../systems/usePlayerController";

/**
 * 浮游信灯 The Drift Lantern（P1 样板角色）：
 *
 * 旧版是「白色水晶核 + 四片发光平面」——在雪面上是一团白雾，远景里
 * 与蝶枢 / 引导蝶难以区分。P1 重做为「暖色灯芯 + 深蓝骨架 + 四片有
 * 轮廓的冰翼」：
 * - 暖琥珀灯芯与深蓝八角骨架形成明暗对比，在冰蓝世界里一眼可读；
 * - 垂直桅杆与顶部信标拉高剪影，和巨型蝶枢地标区分；
 * - 贴地柔光 + 深色接触影让角色落地，不再像漂在雪上的光斑；
 * - 移动时翼面后掠、尾迹变暖色鳞粉；reduced-motion 下所有自饰静止。
 *
 * 全部高频动画只写 refs / geometry 属性，零 React 状态更新。
 */
const TRAIL_COUNT = 24;
const WARM = "#FFD9A0";
const WARM_CORE = "#FFB36B";
const COLD = "#A8EEFF";
const NAVY = "#173B5E";

function createWingGeometry(): ShapeGeometry {
  const shape = new Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.2, 0.24, 0.56, 0.34, 0.82, 0.16);
  shape.bezierCurveTo(0.68, 0.02, 0.44, -0.08, 0.2, -0.03);
  shape.quadraticCurveTo(0.05, -0.015, 0, 0);
  return new ShapeGeometry(shape, 12);
}

function createRadialTexture(
  stops: readonly (readonly [number, string])[],
): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
    for (const [offset, color] of stops) gradient.addColorStop(offset, color);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function DriftLantern({ player }: { player: PlayerApi }) {
  const reducedMotion = usePrefersReducedMotion();
  const groupRef = useRef<Group>(null);
  const coreRef = useRef<Group>(null);
  const haloRef = useRef<Group>(null);
  const wingFLRef = useRef<Group>(null);
  const wingFRRef = useRef<Group>(null);
  const wingBLRef = useRef<Group>(null);
  const wingBRRef = useRef<Group>(null);
  const ringRef = useRef<Group>(null);
  const ringHaloRef = useRef<Mesh>(null);
  const pointsRef = useRef<Points>(null);

  const wingGeometry = useMemo(() => createWingGeometry(), []);
  const trailGeometry = useMemo(() => {
    const geometry = new BufferGeometry();
    const positions = new Float32Array(TRAIL_COUNT * 3);
    for (let i = 0; i < TRAIL_COUNT; i += 1) {
      positions[i * 3] = SPAWN_POINT.x;
      positions[i * 3 + 1] = SPAWN_POINT.y;
      positions[i * 3 + 2] = SPAWN_POINT.z;
    }
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    return geometry;
  }, []);
  const glowTexture = useMemo(
    () =>
      createRadialTexture([
        [0, "rgba(255, 219, 160, 0.72)"],
        [0.35, "rgba(255, 183, 107, 0.28)"],
        [1, "rgba(255, 183, 107, 0)"],
      ]),
    [],
  );
  const shadowTexture = useMemo(
    () =>
      createRadialTexture([
        [0, "rgba(19, 48, 74, 0.42)"],
        [0.55, "rgba(19, 48, 74, 0.16)"],
        [1, "rgba(19, 48, 74, 0)"],
      ]),
    [],
  );

  useEffect(
    () => () => {
      wingGeometry.dispose();
      trailGeometry.dispose();
      glowTexture.dispose();
      shadowTexture.dispose();
    },
    [wingGeometry, trailGeometry, glowTexture, shadowTexture],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const p = player.pos.current;
    const speed = player.speed.current;

    if (groupRef.current) {
      groupRef.current.position.copy(p);
      groupRef.current.rotation.y = player.heading.current;
    }
    // 灯芯悬停微浮 + 速度自转（reduced-motion 只保留可控性所需的自转）
    if (coreRef.current) {
      coreRef.current.position.y =
        0.06 + (reducedMotion ? 0 : Math.sin(t * 2.1) * 0.04);
      const spin = (reducedMotion ? 0 : 0.35) + Math.min(speed / 7.5, 1) * 1.8;
      coreRef.current.rotation.y += spin * 0.016;
    }
    if (haloRef.current && !reducedMotion) {
      haloRef.current.rotation.z = t * 0.5;
      haloRef.current.rotation.y = Math.sin(t * 0.7) * 0.18;
    }
    // 冰翼：悬停张开，移动后掠；reduced-motion 保持稳定张开姿态
    const sweep = 0.34 + Math.min(speed / 7.5, 1) * 0.52;
    const flutter = reducedMotion
      ? 0
      : Math.sin(t * 9) * 0.08 * (speed > 0.6 ? 1 : 0.35);
    if (wingFLRef.current) wingFLRef.current.rotation.z = sweep + flutter;
    if (wingFRRef.current) wingFRRef.current.rotation.z = -sweep - flutter;
    if (wingBLRef.current) wingBLRef.current.rotation.z = sweep * 0.82 - flutter * 0.5;
    if (wingBRRef.current) wingBRRef.current.rotation.z = -sweep * 0.82 + flutter * 0.5;

    // 贴地柔光 / 接触影：跟着地面高度走，不进入地形
    if (ringRef.current) {
      const ground = getGroundHeight(p.x, p.z, p.y - 0.35);
      ringRef.current.position.set(p.x, (ground ?? p.y - 0.35) + 0.035, p.z);
    }
    if (ringHaloRef.current && !reducedMotion) {
      const breathe = 1 + Math.sin(t * 2.2) * 0.035;
      ringHaloRef.current.scale.setScalar(breathe);
    }

    // 尾迹鳞粉：暖色余烬，ring buffer 后移
    if (pointsRef.current) {
      const attribute = pointsRef.current.geometry.getAttribute("position") as BufferAttribute;
      const array = attribute.array as Float32Array;
      for (let i = TRAIL_COUNT - 1; i > 0; i -= 1) {
        array[i * 3] = array[(i - 1) * 3];
        array[i * 3 + 1] = array[(i - 1) * 3 + 1] + 0.003;
        array[i * 3 + 2] = array[(i - 1) * 3 + 2];
      }
      const back = Math.min(speed / 7.5, 1) * 0.55;
      const hx = Math.sin(player.heading.current);
      const hz = Math.cos(player.heading.current);
      array[0] = p.x + hx * back;
      array[1] = p.y + (Math.random() - 0.5) * 0.05;
      array[2] = p.z + hz * back;
      attribute.needsUpdate = true;
    }
  });

  return (
    <group>
      <group ref={groupRef}>
        {/* 灯芯 + 深蓝骨架 + 桅杆信标 */}
        <group ref={coreRef}>
          <mesh castShadow>
            <icosahedronGeometry args={[0.19, 0]} />
            <meshStandardMaterial
              color="#FFF6E4"
              emissive={WARM_CORE}
              emissiveIntensity={1.15}
              roughness={0.24}
              flatShading
            />
          </mesh>
          {/* 灯芯外晕：暖色光团只做加法混合，不遮住骨架与翼面 */}
          <mesh>
            <sphereGeometry args={[0.3, 16, 12]} />
            <meshBasicMaterial
              color={WARM}
              transparent
              opacity={0.16}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
          {/* 水平腰环 */}
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[0.33, 0.018, 6, 24]} />
            <meshStandardMaterial color={NAVY} metalness={0.82} roughness={0.28} />
          </mesh>
          {/* 竖向光环：给剪影一个明确的圆形边界 */}
          <mesh castShadow>
            <torusGeometry args={[0.43, 0.011, 6, 32]} />
            <meshStandardMaterial color="#2E638D" metalness={0.7} roughness={0.3} />
          </mesh>
          {/* 灯笼下坠 */}
          <mesh position={[0, -0.2, 0]} castShadow>
            <coneGeometry args={[0.15, 0.24, 6]} />
            <meshStandardMaterial color={NAVY} metalness={0.78} roughness={0.3} flatShading />
          </mesh>
          {/* 顶部桅杆与信标 */}
          <mesh position={[0, 0.4, 0]} castShadow>
            <cylinderGeometry args={[0.012, 0.022, 0.48, 5]} />
            <meshStandardMaterial color="#2A567C" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.68, 0]}>
            <octahedronGeometry args={[0.065, 0]} />
            <meshBasicMaterial color={WARM} toneMapped={false} />
          </mesh>
          <pointLight color={WARM} intensity={3.4} distance={8} decay={2} />
        </group>

        {/* 前翼对：深色轮廓 + 冰蓝半透翼面 */}
        <group ref={wingFLRef} position={[0.13, 0.1, 0.02]}>
          <mesh geometry={wingGeometry} position={[0, 0, -0.006]} scale={1.07}>
            <meshBasicMaterial color={NAVY} side={DoubleSide} transparent opacity={0.92} />
          </mesh>
          <mesh geometry={wingGeometry} position={[0, 0, 0.004]}>
            <meshBasicMaterial color={COLD} side={DoubleSide} transparent opacity={0.8} depthWrite={false} />
          </mesh>
        </group>
        <group ref={wingFRRef} position={[-0.13, 0.1, 0.02]} scale={[-1, 1, 1]}>
          <mesh geometry={wingGeometry} position={[0, 0, -0.006]} scale={1.07}>
            <meshBasicMaterial color={NAVY} side={DoubleSide} transparent opacity={0.92} />
          </mesh>
          <mesh geometry={wingGeometry} position={[0, 0, 0.004]}>
            <meshBasicMaterial color={COLD} side={DoubleSide} transparent opacity={0.8} depthWrite={false} />
          </mesh>
        </group>

        {/* 后翼对：小一号，增加灯笼的层次 */}
        <group ref={wingBLRef} position={[0.1, 0.02, -0.1]} scale={0.68}>
          <mesh geometry={wingGeometry} position={[0, 0, -0.006]} scale={1.07}>
            <meshBasicMaterial color={NAVY} side={DoubleSide} transparent opacity={0.85} />
          </mesh>
          <mesh geometry={wingGeometry} position={[0, 0, 0.004]}>
            <meshBasicMaterial color={COLD} side={DoubleSide} transparent opacity={0.62} depthWrite={false} />
          </mesh>
        </group>
        <group ref={wingBRRef} position={[-0.1, 0.02, -0.1]} scale={[-0.68, 0.68, 0.68]}>
          <mesh geometry={wingGeometry} position={[0, 0, -0.006]} scale={1.07}>
            <meshBasicMaterial color={NAVY} side={DoubleSide} transparent opacity={0.85} />
          </mesh>
          <mesh geometry={wingGeometry} position={[0, 0, 0.004]}>
            <meshBasicMaterial color={COLD} side={DoubleSide} transparent opacity={0.62} depthWrite={false} />
          </mesh>
        </group>
      </group>

      {/* 贴地：深色接触影 + 暖色柔光 + 一道冷色细环 */}
      <group ref={ringRef}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
          <planeGeometry args={[1.5, 1.5]} />
          <meshBasicMaterial map={shadowTexture} transparent opacity={0.8} depthWrite={false} />
        </mesh>
        <mesh ref={ringHaloRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
          <planeGeometry args={[2.5, 2.5]} />
          <meshBasicMaterial
            map={glowTexture}
            transparent
            opacity={0.62}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.6, 0.64, 32]} />
          <meshBasicMaterial color={WARM} transparent opacity={0.55} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>

      {/* 尾迹：暖色鳞粉 */}
      <points ref={pointsRef} geometry={trailGeometry}>
        <pointsMaterial
          color={WARM}
          size={0.16}
          transparent
          opacity={0.7}
          depthWrite={false}
          blending={AdditiveBlending}
          sizeAttenuation
        />
      </points>
    </group>
  );
}
