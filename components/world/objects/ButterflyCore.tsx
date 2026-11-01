"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  CanvasTexture,
  DoubleSide,
  Group,
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
import {
  createSculptureAntennae,
  createSculptureBody,
  createSculptureWing,
  createWingTransmissionMap,
  WING_HINGE,
} from "./butterflySculpture";

export function ButterflyCore({ glass }: { glass: boolean }) {
  const reducedMotion = usePrefersReducedMotion();
  const groupRef = useRef<Group>(null);
  const wingLRef = useRef<Group>(null);
  const wingRRef = useRef<Group>(null);
  const poolRef = useRef<Mesh>(null);
  const lightRef = useRef<PointLight>(null);
  const orbitRef = useRef<Group>(null);
  const wingspan = BUTTERFLY_CORE.wingspan;
  const asset = useMemo(() => ({
    left: createSculptureWing("left", wingspan),
    right: createSculptureWing("right", wingspan),
    body: createSculptureBody(),
    antennae: createSculptureAntennae(),
    transmissionMap: createWingTransmissionMap(),
  }), [wingspan]);

  const materials = useMemo(() => ({
    wing: glass
      ? new MeshPhysicalMaterial({
          vertexColors: true,
          roughness: 0.32,
          metalness: 0.18,
          clearcoat: 0.62,
          clearcoatRoughness: 0.28,
          iridescence: 0.25,
          iridescenceIOR: 1.32,
          transmission: 0.34,
          transmissionMap: asset.transmissionMap,
          thickness: 0.15,
          ior: 1.38,
          envMapIntensity: 0.7,
        })
      : new MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.36,
          metalness: 0.22,
          envMapIntensity: 0.7,
        }),
    vein: new MeshStandardMaterial({ color: "#568AA5", roughness: 0.35, metalness: 0.3 }),
    pearl: new MeshStandardMaterial({ color: "#C5ECF6", roughness: 0.28, metalness: 0.35 }),
    body: new MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.4, clearcoat: 0.5 }),
    eye: new MeshPhysicalMaterial({ color: "#133853", roughness: 0.14, metalness: 0.45, clearcoat: 0.8 }),
    core: new MeshStandardMaterial({ color: "#87D7EB", emissive: "#3894AE", emissiveIntensity: 0.38, roughness: 0.24, metalness: 0.2 }),
    shard: new MeshStandardMaterial({ color: "#B4DCEB", roughness: 0.36, metalness: 0.22, flatShading: true }),
  }), [glass, asset]);

  const poolTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const gradient = ctx.createRadialGradient(64, 64, 5, 64, 64, 62);
      gradient.addColorStop(0, "rgba(143,232,255,0.34)");
      gradient.addColorStop(0.45, "rgba(84,227,255,0.12)");
      gradient.addColorStop(1, "rgba(84,227,255,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }, []);

  useEffect(() => () => {
    for (const wing of [asset.left, asset.right]) {
      Object.values(wing).forEach((geometry) => geometry.dispose());
    }
    asset.body.dispose();
    asset.antennae.dispose();
    asset.transmissionMap.dispose();
  }, [asset]);
  useEffect(() => () => Object.values(materials).forEach((material) => material.dispose()), [materials]);
  useEffect(() => () => poolTexture.dispose(), [poolTexture]);

  useFrame(({ clock }) => {
    const t = reducedMotion ? 0 : clock.elapsedTime;
    if (groupRef.current) {
      groupRef.current.rotation.set(0, 0.32 + Math.sin(t * 0.16) * 0.035, Math.sin(t * 0.27) * 0.012);
      groupRef.current.position.y = BUTTERFLY_CORE.center.y + Math.sin(t * Math.PI * 2 / MOTION.floatPeriod) * 0.16;
    }
    const flap = 0.12 + Math.sin(t * Math.PI * 2 / MOTION.coreOpenPeriod) * 0.045;
    if (wingLRef.current) wingLRef.current.rotation.y = -flap;
    if (wingRRef.current) wingRRef.current.rotation.y = flap;
    if (poolRef.current) poolRef.current.rotation.z = -t * 0.035;
    if (orbitRef.current) orbitRef.current.rotation.y = t * 0.045;
    if (lightRef.current) lightRef.current.intensity = 1.8 + Math.sin(t * Math.PI * 2 / MOTION.breathePeriod) * 0.3;
  });

  return (
    <group name="butterfly-core-asset">
      <group
        name="butterfly-sculpture"
        ref={groupRef}
        position={[BUTTERFLY_CORE.center.x, BUTTERFLY_CORE.center.y, BUTTERFLY_CORE.center.z]}
        rotation={[0, 0.32, 0]}
      >
        {([
          { name: "left", geometry: asset.left, ref: wingLRef, sign: -1 },
          { name: "right", geometry: asset.right, ref: wingRRef, sign: 1 },
        ] as const).map(({ name, geometry, ref, sign }) => (
          <group key={name} name={`butterfly-wing-${name}`} ref={ref} position={[sign * WING_HINGE * wingspan / 7.6, 0, 0]}>
            <mesh name={`${name}-wing-shell`} geometry={geometry.shell} material={materials.wing} castShadow />
            <mesh geometry={geometry.veins} material={materials.vein} />
            <mesh geometry={geometry.markings} material={materials.pearl} />
          </group>
        ))}
        <group name="butterfly-body">
          <mesh geometry={asset.body} material={materials.body} castShadow />
          <mesh geometry={asset.antennae} material={materials.vein} castShadow />
          <mesh position={[0, 0.24, 0.485]} scale={[0.06, 0.17, 0.025]} material={materials.core}>
            <sphereGeometry args={[1, 16, 20]} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.145, 0.84, 0.23]} rotation={[0, side * 0.4, side * -0.12]} scale={[0.065, 0.08, 0.045]} material={materials.eye}>
              <sphereGeometry args={[1, 16, 12]} />
            </mesh>
          ))}
        </group>
        {glass && <pointLight ref={lightRef} color={WORLD_COLORS.trailGlow} intensity={1.8} distance={12} decay={2} />}
      </group>
      <group ref={orbitRef} position={[BUTTERFLY_CORE.center.x, BUTTERFLY_CORE.center.y, BUTTERFLY_CORE.center.z]}>
        {/* P1：建筑化悬浮环——让蝶枢读成世界核心装置，而不是另一只可操控蝴蝶 */}
        <mesh position={[0, -1.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[4.85, 0.045, 6, 64]} />
          <meshStandardMaterial
            color="#2E638D"
            metalness={0.72}
            roughness={0.28}
            emissive="#54E3FF"
            emissiveIntensity={0.18}
          />
        </mesh>
        <mesh position={[0, -1.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[4.35, 0.014, 5, 64]} />
          <meshBasicMaterial color="#9FE9FF" transparent opacity={0.28} depthWrite={false} />
        </mesh>
        {[0, 1, 2].map((i) => {
          const angle = i / 3 * Math.PI * 2 + 0.4;
          return (
            <mesh key={i} position={[Math.cos(angle) * 4.5, Math.sin(angle * 2) * 0.5 - 0.2, Math.sin(angle) * 4.5]} rotation={[0.35, -angle, 0.18]} scale={[0.22, 0.07, 0.025]} material={materials.shard}>
              <octahedronGeometry args={[1, 0]} />
            </mesh>
          );
        })}
        {/* R12.0-C（G12/P2）：环上均布冰晶节点——光环随 orbit 组慢转，
            近景不再是两圈素面圆环；节点与岛缘晶簇同语言 */}
        {Array.from({ length: 8 }, (_, i) => {
          const angle = (i / 8) * Math.PI * 2;
          return (
            <mesh
              key={`node-${i}`}
              position={[Math.cos(angle) * 4.85, -1.15, Math.sin(angle) * 4.85]}
              rotation={[0.2 * (i % 3) - 0.2, angle, 0.1 * (i % 2)]}
              scale={[0.085, 0.13, 0.085]}
            >
              <octahedronGeometry args={[1, 0]} />
              <meshStandardMaterial
                color="#BFE6F5"
                emissive="#54E3FF"
                emissiveIntensity={0.42}
                roughness={0.22}
                flatShading
              />
            </mesh>
          );
        })}
      </group>
      {/* 淡光柱：把核心与广场压平区连成一处地标，不遮蔽北径视线。
          R12.0-C（G12/P2）：内芯加一层更亮的短光柱，光柱从「实心管」
          变成有内外层次的体积光 */}
      <mesh position={[0, 2.9, 0]}>
        <cylinderGeometry args={[0.1, 0.26, 5.8, 12, 1, true]} />
        <meshBasicMaterial
          color="#9FE9FF"
          transparent
          opacity={0.055}
          depthWrite={false}
          blending={AdditiveBlending}
          side={DoubleSide}
        />
      </mesh>
      <mesh position={[0, 2.35, 0]}>
        <cylinderGeometry args={[0.05, 0.14, 4.4, 10, 1, true]} />
        <meshBasicMaterial
          color="#D9F6FF"
          transparent
          opacity={0.12}
          depthWrite={false}
          blending={AdditiveBlending}
          side={DoubleSide}
        />
      </mesh>
      <mesh ref={poolRef} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8, 8]} />
        <meshBasicMaterial map={poolTexture} transparent opacity={0.3} depthWrite={false} blending={AdditiveBlending} />
      </mesh>
    </group>
  );
}
