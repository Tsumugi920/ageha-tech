"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  Material,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PointLight,
  SRGBColorSpace,
} from "three";
import { BUTTERFLY_CORE } from "@/lib/world/layout";
import { WORLD_COLORS } from "@/lib/world/constants";
import { MOTION } from "../systems/worldMotion";
import { usePrefersReducedMotion } from "../systems/usePrefersReducedMotion";
import { createWingPairGeometry } from "./butterflyShape";

/**
 * 蝶枢万花筒（蓝图 §5.1，主岛视觉焦点与品牌图腾）：
 * - 四翼 = ButterflyLogo 翼形的三色水晶（顶点色渐变），左右各一片
 *   翼对网格，绕竖直身体轴缓慢开合（周期 24s）+ 整体自转（同周期）；
 * - transmission 名额 ×2（全场景 ≤3 的管控内，Moss 穹舱占第 3 个），
 *   非高档降级为 vertexColors 半透明 Standard；
 * - 晨光下翼面在主岛雪面投出旋转光影（castShadow），下方另有一圈
 *   程序化柔光池缓慢反向旋转（emissive + 加法混合模拟辉光）；
 * - reduced-motion：开合 / 自转 / 升沉全部静止在张开姿态。
 * 全程只写 refs，零逐帧 React 状态。
 */
export function ButterflyCore({ glass }: { glass: boolean }) {
  const reducedMotion = usePrefersReducedMotion();
  const groupRef = useRef<Group>(null);
  const wingLRef = useRef<Group>(null);
  const wingRRef = useRef<Group>(null);
  const poolRef = useRef<Mesh>(null);
  const lightRef = useRef<PointLight>(null);
  const spinRef = useRef(0.8);

  const wingL = useMemo(
    () => createWingPairGeometry("left", BUTTERFLY_CORE.wingspan),
    [],
  );
  const wingR = useMemo(
    () => createWingPairGeometry("right", BUTTERFLY_CORE.wingspan),
    [],
  );
  // transmission 材质双翼共享一个实例（mesh 数 2 ≤ transmissionBudget 3）
  const wingMaterial = useMemo<Material>(() => {
    if (glass) {
      return new MeshPhysicalMaterial({
        vertexColors: true,
        color: 0xffffff,
        transmission: 0.9,
        thickness: 1.5,
        ior: 1.4,
        roughness: 0.12,
        metalness: 0,
        side: DoubleSide,
      });
    }
    return new MeshStandardMaterial({
      vertexColors: true,
      color: 0xffffff,
      transparent: true,
      opacity: 0.62,
      roughness: 0.2,
      metalness: 0.05,
      side: DoubleSide,
    });
  }, [glass]);

  // 下方柔光池：程序化径向渐变（canvas 本地生成，零外部资源）
  const poolTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const gradient = ctx.createRadialGradient(128, 128, 10, 128, 128, 124);
      gradient.addColorStop(0, "rgba(143,232,255,0.55)");
      gradient.addColorStop(0.45, "rgba(84,227,255,0.22)");
      gradient.addColorStop(1, "rgba(84,227,255,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 256, 256);
    }
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    return map;
  }, []);

  const bodyColor = useMemo(() => new Color(WORLD_COLORS.crystal[1]), []);

  useEffect(
    () => () => {
      wingL.dispose();
      wingR.dispose();
      wingMaterial.dispose();
      poolTexture.dispose();
    },
    [wingL, wingR, wingMaterial, poolTexture],
  );

  useFrame((state, delta) => {
    if (reducedMotion) {
      // 静止在张开姿态（可控性优先：帧循环保留，环境动画全停，§12.3）
      if (wingLRef.current) wingLRef.current.rotation.y = -0.62;
      if (wingRRef.current) wingRRef.current.rotation.y = 0.62;
      return;
    }
    const t = state.clock.elapsedTime;
    spinRef.current += MOTION.coreSpinSpeed * delta;
    if (groupRef.current) {
      groupRef.current.rotation.y = spinRef.current;
      groupRef.current.position.y =
        BUTTERFLY_CORE.center.y +
        Math.sin((t * Math.PI * 2) / MOTION.floatPeriod) * 0.3;
    }
    // 开合：0.05 ~ 0.95 rad（周期 24s，与自转同拍读作整体呼吸）
    const open =
      0.5 + Math.sin((t * Math.PI * 2) / MOTION.coreOpenPeriod) * 0.45;
    if (wingLRef.current) wingLRef.current.rotation.y = -open;
    if (wingRRef.current) wingRRef.current.rotation.y = open;
    // 柔光池反向慢旋 + 点光呼吸（与 DOM world-breathe 同拍）
    if (poolRef.current) poolRef.current.rotation.z = -t * 0.12;
    if (lightRef.current) {
      lightRef.current.intensity =
        5 + Math.sin((t * Math.PI * 2) / MOTION.breathePeriod) * 1.4;
    }  });

  return (
    <group>
      <group ref={groupRef} position={[BUTTERFLY_CORE.center.x, BUTTERFLY_CORE.center.y, BUTTERFLY_CORE.center.z]}>
        {/* 左右翼对（铰链 x=0，绕竖直身体轴开合） */}
        <group ref={wingLRef}>
          <mesh geometry={wingL} material={wingMaterial} castShadow />
        </group>
        <group ref={wingRRef}>
          <mesh geometry={wingR} material={wingMaterial} castShadow />
        </group>
        {/* 水晶身体轴（沿 Y 的纺锤，品牌蓝柔光） */}
        <mesh scale={[0.28, 3.1, 0.28]}>
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color={bodyColor}
            emissive={WORLD_COLORS.trailGlow}
            emissiveIntensity={0.7}
            roughness={0.2}
            flatShading
          />
        </mesh>
        {/* 蝶枢点光（cyan，距离衰减 + 呼吸） */}
        <pointLight
          ref={lightRef}
          color={WORLD_COLORS.trailGlow}
          intensity={5}
          distance={26}
          decay={2}
        />
      </group>
      {/* 主岛雪面上的柔光池（世界坐标 y≈0.05，随开合明灭由点光呼吸承担） */}
      <mesh
        ref={poolRef}
        position={[0, 0.05, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[11, 11]} />
        <meshBasicMaterial
          map={poolTexture}
          transparent
          opacity={0.85}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
