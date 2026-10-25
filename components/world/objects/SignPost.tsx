"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Group } from "three";
import { site } from "@/lib/site";
import { PROJECT_ISLES, SIGN_POST, TRAIL_BEACONS, TRAILS } from "@/lib/world/layout";
import { WORLD_COLORS } from "@/lib/world/constants";
import { MOTION } from "../systems/worldMotion";
import { usePrefersReducedMotion } from "../systems/usePrefersReducedMotion";
import { createWingPairGeometry } from "./butterflyShape";
import { CrystalGlowMaterial, DeepMetalMaterial, FrostRockMaterial } from "../terrain/materials";

/**
 * 主岛石碑 + 三径导向标（蓝图 §10 SignPost，阶段 3 名牌美术化）：
 * - 石碑：出生点旁的磨砂六棱石，顶嵌三色水晶蝶标（蝶枢同源翼形），
 *   碑面 Html 说明牌只渲染 lib/site.ts 的真实品牌句（数据单源，零编造）；
 * - 导向标：三蝶径径头内侧的位石 + 目标屿主题色浮晶（呼吸微光 +
 *   悬浮升沉，动画节奏走 MOTION 统一表），色即是路——不设文字堆砌。
 * reduced-motion：浮晶静止（微光保持常亮，不呼吸）。
 */
export function SignPost() {
  const reducedMotion = usePrefersReducedMotion();
  const markRef = useRef<Group>(null);
  const crystalRefs = useRef<Array<Group | null>>([]);

  // 蝶标翼对（翼展 1.6，顶置于碑顶缓旋）
  const wingL = useMemo(() => createWingPairGeometry("left", 1.6, 8), []);
  const wingR = useMemo(() => createWingPairGeometry("right", 1.6, 8), []);
  useEffect(
    () => () => {
      wingL.dispose();
      wingR.dispose();
    },
    [wingL, wingR],
  );

  // 导向浮晶参数（确定性；高度 / 相位按索引错开，读作同族不同步）
  const beaconCrystals = useMemo(
    () =>
      TRAIL_BEACONS.map((beacon, i) => ({
        ...beacon,
        accent:
          PROJECT_ISLES.find((isle) => isle.slug === beacon.accentSlug)
            ?.accentColor ?? WORLD_COLORS.trailGlow,
        phase: i * 1.9,
        trail: TRAILS.find((trail) => trail.id === beacon.trailId),
      })),
    [],
  );

  useFrame((state) => {
    if (reducedMotion) return;
    const t = state.clock.elapsedTime;
    if (markRef.current) markRef.current.rotation.y = t * 0.3;
    for (let i = 0; i < beaconCrystals.length; i += 1) {
      const crystal = crystalRefs.current[i];
      if (!crystal) continue;
      crystal.position.y =
        1.55 +
        Math.sin((t * Math.PI * 2) / MOTION.floatPeriod + beaconCrystals[i].phase) * 0.18;
      const breathe =
        0.9 +
        Math.sin((t * Math.PI * 2) / MOTION.breathePeriod + beaconCrystals[i].phase) * 0.35;
      crystal.scale.setScalar(breathe);
    }
  });

  return (
    <group>
      {/* 主岛石碑（出生点东侧，面朝蝶枢与出生点连线） */}
      <group position={[SIGN_POST.x, SIGN_POST.y, SIGN_POST.z]} rotation={[0, SIGN_POST.facing, 0]}>
        {/* 碑身：磨砂六棱石（上窄下宽） */}
        <mesh position={[0, 1.3, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.72, 1.0, 2.6, 6]} />
          <FrostRockMaterial color={WORLD_COLORS.rockDeep} />
        </mesh>
        {/* 碑肩金属束环 + 嵌碑品牌光线 */}
        <mesh position={[0, 2.28, 0]} castShadow>
          <torusGeometry args={[0.68, 0.07, 8, 24]} />
          <DeepMetalMaterial />
        </mesh>
        <mesh position={[0, 1.45, 0.66]}>
          <boxGeometry args={[0.5, 0.05, 0.02]} />
          <CrystalGlowMaterial
            color={WORLD_COLORS.trailGlow}
            glow={WORLD_COLORS.trailGlow}
            intensity={1.6}
          />
        </mesh>
        {/* 碑顶三色水晶蝶标（缓旋；翼形与蝶枢同源） */}
        <group ref={markRef} position={[0, 3.05, 0]} rotation={[0, 0, 0]}>
          <group rotation={[-Math.PI / 2, 0, 0]}>
            <group rotation={[0, 0, 0.5]}>
              <mesh geometry={wingL} />
            </group>
            <group rotation={[0, 0, -0.5]}>
              <mesh geometry={wingR} />
            </group>
          </group>
        </group>
        {/* 碑面说明牌：品牌句数据单源 lib/site.ts（DOM 层，系统字体栈） */}
        <Html
          position={[0, 3.95, 0]}
          center
          distanceFactor={12}
          zIndexRange={[20, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div className="world-nameplate">
            <span className="world-nameplate__name">{site.name}</span>
            <span className="world-nameplate__status">{site.tagline}</span>
          </div>
        </Html>
      </group>

      {/* 三径导向标：位石 + 目标屿主题色浮晶 */}
      {beaconCrystals.map((beacon, i) => (
        <group key={beacon.id} position={[beacon.x, 0, beacon.z]}>
          <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
            <dodecahedronGeometry args={[0.42, 0]} />
            <FrostRockMaterial color={WORLD_COLORS.rockMid} />
          </mesh>
          <mesh position={[0.16, 0.72, 0.1]} castShadow>
            <dodecahedronGeometry args={[0.26, 0]} />
            <FrostRockMaterial color={WORLD_COLORS.rockMid} />
          </mesh>
          <group
            ref={(node) => {
              crystalRefs.current[i] = node;
            }}
            position={[0, 1.55, 0]}
          >
            <mesh castShadow>
              <octahedronGeometry args={[0.3, 0]} />
              <CrystalGlowMaterial
                color={WORLD_COLORS.iceEdge}
                glow={beacon.accent}
                intensity={1.1}
              />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

