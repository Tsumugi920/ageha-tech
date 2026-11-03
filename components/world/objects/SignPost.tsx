"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Color, Group, InstancedMesh, Object3D, Vector3 } from "three";
import { site } from "@/lib/site";
import { PROJECT_ISLES, SIGN_POST, TRAIL_BEACONS, TRAILS, mainIslandSurfaceY } from "@/lib/world/layout";
import { WORLD_COLORS } from "@/lib/world/constants";
import { MOTION } from "../systems/worldMotion";
import { usePrefersReducedMotion } from "../systems/usePrefersReducedMotion";
import { createWingPairGeometry } from "./butterflyShape";
import { CrystalGlowMaterial, DeepMetalMaterial, FrostRockMaterial } from "../terrain/materials";

const PLATE_HEIGHT = 3;

/**
 * 主岛导览碑 + 三径路标（R2 重做）。
 *
 * 问题定位：截图右前方那块巨大深色物 = 旧版 SignPost 的磨砂深蓝六棱碑
 * （半径 1.0 / 高 2.6 / 距出生点仅 4 米），在初始视角里远比项目屿抢眼，
 * 且碑面文字牌与左上品牌角标形成第二处品牌标识。
 *
 * 处理：保留「石碑 + 品牌句」的功能与数据，但改成低矮的冰石基座 +
 * 三片浅色导览鳍 + 小尺寸蝶标，体量从 2.6m 深色柱降为 1.6m 浅色结构；
 * 品牌句仍在世界内可读，但不再占据画面前景中心。
 * 路标同步改为细柱 + 目标色浮晶，成为「路的起点」而不是散落石头。
 */
export function SignPost() {
  const reducedMotion = usePrefersReducedMotion();
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const plateProjection = useMemo(() => new Vector3(), []);
  const markRef = useRef<Group>(null);
  const plateRef = useRef<HTMLDivElement>(null);
  const beaconBaseRef = useRef<InstancedMesh>(null);
  const beaconShaftRef = useRef<InstancedMesh>(null);
  const beaconRingRef = useRef<InstancedMesh>(null);
  const beaconWingRef = useRef<InstancedMesh>(null);
  const beaconCrystalRef = useRef<InstancedMesh>(null);
  const beaconDummy = useMemo(() => new Object3D(), []);
  const uiFrameRef = useRef(0);

  const wingL = useMemo(() => createWingPairGeometry("left", 0.8, 8), []);
  const wingR = useMemo(() => createWingPairGeometry("right", 0.8, 8), []);
  useEffect(
    () => () => {
      wingL.dispose();
      wingR.dispose();
    },
    [wingL, wingR],
  );

  const beacons = useMemo(
    () =>
      TRAIL_BEACONS.map((beacon, i) => {
        const trail = TRAILS.find((item) => item.id === beacon.trailId);
        // 方向：从路标指向径头，做一片贴地的指示翅
        const start = trail?.controlPoints[0];
        const dx = (start?.x ?? beacon.x) - beacon.x;
        const dz = (start?.z ?? beacon.z) - beacon.z;
        const len = Math.hypot(dx, dz) || 1;
        return {
          ...beacon,
          accent:
            PROJECT_ISLES.find((isle) => isle.slug === beacon.accentSlug)
              ?.accentColor ?? WORLD_COLORS.trailGlow,
          phase: i * 1.9,
          direction: Math.atan2(dx / len, dz / len),
          // R11：信标贴地高度取解析地表（径带外缘收窄后地面不再恒为 0）
          groundY: mainIslandSurfaceY(beacon.x, beacon.z),
        };
      }),
    [],
  );

  useLayoutEffect(() => {
    const dummy = beaconDummy;
    const accent = new Color();
    beacons.forEach((beacon, i) => {
      const g = beacon.groundY;
      dummy.position.set(beacon.x, g + 0.12, beacon.z);
      dummy.rotation.set(0, beacon.direction, 0);
      dummy.scale.set(1.1, 0.62, 1);
      dummy.updateMatrix();
      beaconBaseRef.current?.setMatrixAt(i, dummy.matrix);

      dummy.position.set(beacon.x, g + 0.48, beacon.z);
      dummy.rotation.set(0.03, beacon.direction + 0.3, 0.015);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      beaconShaftRef.current?.setMatrixAt(i, dummy.matrix);

      dummy.position.set(beacon.x, g + 0.84, beacon.z);
      dummy.rotation.set(Math.PI / 2, beacon.direction, 0);
      dummy.updateMatrix();
      beaconRingRef.current?.setMatrixAt(i, dummy.matrix);

      dummy.position.set(
        beacon.x + Math.sin(beacon.direction) * 0.68,
        g + 0.065,
        beacon.z + Math.cos(beacon.direction) * 0.68,
      );
      dummy.rotation.set(-0.04, beacon.direction, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      beaconWingRef.current?.setMatrixAt(i, dummy.matrix);
      beaconWingRef.current?.setColorAt(i, accent.set(beacon.accent));

      dummy.position.set(beacon.x, g + 1.05, beacon.z);
      dummy.rotation.set(0, beacon.phase, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      beaconCrystalRef.current?.setMatrixAt(i, dummy.matrix);
    });
    [
      beaconBaseRef.current,
      beaconShaftRef.current,
      beaconRingRef.current,
      beaconWingRef.current,
      beaconCrystalRef.current,
    ].forEach((mesh) => {
      if (!mesh) return;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
  }, [beacons, beaconDummy]);

  useFrame((state) => {
    uiFrameRef.current += 1;
    const distance = Math.hypot(
      camera.position.x - SIGN_POST.x,
      camera.position.y - SIGN_POST.y - PLATE_HEIGHT,
      camera.position.z - SIGN_POST.z,
    );
    // 品牌说明牌只在走近导览碑时出现：初始远景由顶部导航承担品牌识别，
    // 避免画面中心同时出现导航品牌、世界名牌与蝶枢三个焦点。
    // DOM 写入降到 ~10Hz，避免逐帧 style 计算。
    if (plateRef.current && uiFrameRef.current % 6 === 0) {
      // 世界锚点出界时收起辅助名牌，避免回望时只剩半截文字。
      plateProjection.set(SIGN_POST.x, SIGN_POST.y + PLATE_HEIGHT, SIGN_POST.z).project(camera);
      const x = (plateProjection.x + 1) * size.width / 2;
      const y = (1 - plateProjection.y) * size.height / 2;
      const halfWidth = plateRef.current.offsetWidth / 2;
      const halfHeight = plateRef.current.offsetHeight / 2;
      const inFrame = plateProjection.z > -1 && plateProjection.z < 1 &&
        x - halfWidth >= 16 && x + halfWidth <= size.width - 16 &&
        y - halfHeight >= 94 && y + halfHeight <= size.height - 16;
      const opacity = inFrame ? Math.max(0, Math.min(1, (13 - distance) / 4)) : 0;
      plateRef.current.style.opacity = opacity.toFixed(3);
      plateRef.current.style.visibility =
        opacity < 0.02 ? "hidden" : "visible";
    }
    if (reducedMotion) return;
    const t = state.clock.elapsedTime;
    if (markRef.current) markRef.current.rotation.y = t * 0.26;
    for (let i = 0; i < beacons.length; i += 1) {
      const beacon = beacons[i];
      const y =
        1.05 +
        Math.sin((t * Math.PI * 2) / MOTION.floatPeriod + beacon.phase) * 0.09;
      const breathe =
        0.94 +
        Math.sin((t * Math.PI * 2) / MOTION.breathePeriod + beacon.phase) * 0.06;
      beaconDummy.position.set(beacon.x, y, beacon.z);
      beaconDummy.rotation.set(0, t * 0.35 + beacon.phase, 0);
      beaconDummy.scale.setScalar(breathe);
      beaconDummy.updateMatrix();
      beaconCrystalRef.current?.setMatrixAt(i, beaconDummy.matrix);
    }
    if (beaconCrystalRef.current) {
      beaconCrystalRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* 导览碑：低矮冰石基座 + 三片导览鳍 + 悬浮蝶标 */}
      <group position={[SIGN_POST.x, SIGN_POST.y, SIGN_POST.z]} rotation={[0, SIGN_POST.facing, 0]}>
        <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.86, 1.0, 0.3, 6, 1]} />
          <FrostRockMaterial color="#8FAFC7" />
        </mesh>
        <mesh position={[0, 0.33, 0]} rotation={[0, 0.26, 0]}>
          <cylinderGeometry args={[0.76, 0.84, 0.05, 6, 1]} />
          <DeepMetalMaterial color="#5B7E9C" roughness={0.4} />
        </mesh>
        {[-0.36, 0.02, 0.4].map((offset, i) => (
          <mesh
            key={offset}
            position={[offset, 0.64 + i * 0.06, -0.14 + i * 0.13]}
            rotation={[0.05 - i * 0.03, 0, -0.12 + i * 0.12]}
            castShadow
          >
            <boxGeometry args={[0.12, 0.84, 0.42]} />
            <meshStandardMaterial
              color="#EAF6FF"
              roughness={0.38}
              metalness={0.12}
              emissive="#BFE8FF"
              emissiveIntensity={0.14}
            />
          </mesh>
        ))}
        {/* 导览鳍的青色边缘：给浅色结构一点识别度 */}
        {[-0.36, 0.02, 0.4].map((offset, i) => (
          <mesh
            key={`edge-${offset}`}
            position={[offset, 0.64 + i * 0.06, 0.08 + i * 0.13]}
            rotation={[0.05 - i * 0.03, 0, -0.12 + i * 0.12]}
          >
            <boxGeometry args={[0.03, 0.8, 0.04]} />
            <meshBasicMaterial color={WORLD_COLORS.trailGlow} transparent opacity={0.66} depthWrite={false} />
          </mesh>
        ))}
        <group ref={markRef} position={[0, 1.62, 0]}>
          <group rotation={[-Math.PI / 2, 0, 0]}>
            <group rotation={[0, 0, 0.5]}>
              <mesh geometry={wingL} />
            </group>
            <group rotation={[0, 0, -0.5]}>
              <mesh geometry={wingR} />
            </group>
          </group>
        </group>
        {/* 品牌句：世界内单点品牌表达（DOM 层，系统字体） */}
        <Html
          position={[0, PLATE_HEIGHT, 0]}
          center
          zIndexRange={[20, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div className="world-nameplate world-nameplate--quiet" ref={plateRef} style={{ opacity: 0, visibility: "hidden" }}>
            <span className="world-nameplate__name">{site.name}</span>
            <span className="world-nameplate__status">{site.tagline}</span>
          </div>
        </Html>
      </group>

      {/* 三径路标：5 个 instanced draw call 覆盖全部 3 座（基座 / 柱 / 环 / 指向翅 / 浮晶） */}
      <instancedMesh ref={beaconBaseRef} args={[undefined, undefined, beacons.length]} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.4, 0]} />
        <FrostRockMaterial color="#86A4BE" />
      </instancedMesh>
      <instancedMesh ref={beaconShaftRef} args={[undefined, undefined, beacons.length]} castShadow>
        <cylinderGeometry args={[0.12, 0.2, 0.72, 6, 1]} />
        <meshStandardMaterial color="#8DB0C8" roughness={0.44} metalness={0.12} flatShading />
      </instancedMesh>
      <instancedMesh ref={beaconRingRef} args={[undefined, undefined, beacons.length]}>
        <torusGeometry args={[0.15, 0.026, 5, 16]} />
        <DeepMetalMaterial color="#6E93B2" roughness={0.32} />
      </instancedMesh>
      <instancedMesh ref={beaconWingRef} args={[undefined, undefined, beacons.length]}>
        <boxGeometry args={[0.14, 0.02, 0.9]} />
        <meshBasicMaterial transparent opacity={0.48} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={beaconCrystalRef} args={[undefined, undefined, beacons.length]} castShadow>
        <octahedronGeometry args={[0.2, 0]} />
        <CrystalGlowMaterial
          color={WORLD_COLORS.iceEdge}
          glow={WORLD_COLORS.trailGlow}
          intensity={0.8}
          roughness={0.16}
        />
      </instancedMesh>
    </group>
  );
}
