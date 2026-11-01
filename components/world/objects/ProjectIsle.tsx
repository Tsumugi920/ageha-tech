"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, useTexture } from "@react-three/drei";
import {
  AdditiveBlending,
  BufferAttribute,
  CanvasTexture,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
  type Texture,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { projects } from "@/lib/projects";
import {
  findIsleScreen,
  type ProjectIsle as ProjectIsleData,
} from "@/lib/world/layout";
import { INTERACTION, WORLD_COLORS } from "@/lib/world/constants";
import {
  createCrystalSprayGeometry,
  createIslandTopGeometry,
  createLayeredIslandGeometry,
  createMossGroundGeometry,
} from "../terrain/islandGeometry";
import {
  CrystalGlowMaterial,
  DeepMetalMaterial,
  GlassPaneMaterial,
} from "../terrain/materials";
import { inputState } from "../systems/inputState";
import { interactionState } from "../systems/interactionState";
import { TextureBoundary } from "../systems/TextureBoundary";
import { MOTION } from "../systems/worldMotion";
import { useNearPlayer } from "../systems/useNearPlayer";
import { usePrefersReducedMotion } from "../systems/usePrefersReducedMotion";
import type { PlayerApi } from "../systems/usePlayerController";
import { useWorldUI } from "../WorldUIContext";
import { createAgehaosGeometry } from "./agehaosGeometry";
import { getExperienceOptions, type ExperienceProjectSlug } from "@/lib/world/experiences";
import { createDemoScreenCanvas } from "./demoScreenTextures";

/**
 * 项目屿（R2 重做）：三座地标从「基础几何占位」升级为有主轮廓的构筑物。
 *
 * - 底座：与主岛同源的分层浮岛几何（岩层 / 雪原 / 岩脊 / 嵌入晶体）；
 * - AgehaOS：错高折面舱壳 + 开放计算核心 + 一体终端操作舱；
 * - CS：抬高行情环 + 24 根真实数据柱 + 中央价格针 + 环形刻度 +
 *   侧翼仪表 + 前置竖屏；
 * - Moss：带经线骨架和两道环箍的玻璃生态穹舱 + 分层苔丘 + 植物群落 +
 *   舱顶通风冠 + 舱外观景台监测屏。
 *
 * 功能契约保持不变：交互代理、高亮环、名牌、真实截图屏幕、
 * transmission 名额（Moss 穹舱）与低档降级全部沿用。
 */
/**
 * P3 演示屏纹理：只在项目屿接近时生成，离开即释放；低画质也能看到体验结果。
 */
function useDemoScreenTextures(
  slug: ExperienceProjectSlug | null,
  enabled: boolean,
): Record<string, Texture> | null {
  const textures = useMemo(() => {
    if (!enabled || !slug) return null;
    if (slug !== "agehaos" && slug !== "cs-skin-invest") return null;
    const options = getExperienceOptions(slug);
    if (!options) return null;
    return Object.fromEntries(
      options.map((option) => {
        const texture = new CanvasTexture(
          createDemoScreenCanvas(slug, option.id),
        );
        texture.colorSpace = SRGBColorSpace;
        texture.anisotropy = 4;
        texture.needsUpdate = true;
        return [option.id, texture];
      }),
    ) as Record<string, Texture>;
  }, [enabled, slug]);

  useEffect(() => {
    if (!textures) return;
    return () => {
      Object.values(textures).forEach((texture) => texture.dispose());
    };
  }, [textures]);

  return textures;
}

export function ProjectIsle({
  isle,
  player,
  screenTextures,
  glass,
  mistCount,
}: {
  isle: ProjectIsleData;
  player: PlayerApi;
  screenTextures: boolean;
  glass: boolean;
  mistCount: number;
}) {
  const project = projects.find((item) => item.slug === isle.slug);
  const screen = findIsleScreen(isle.slug);
  const { openDetail, isMobileLike, experiences } = useWorldUI();
  const { gl } = useThree();

  const radiusScale = isMobileLike ? INTERACTION.mobileRadiusScale : 1;
  const nameplateDistance = INTERACTION.nameplateDistance * radiusScale;
  const promptDistance = INTERACTION.promptDistance * radiusScale;

  const rockGeometry = useMemo(
    () =>
      createLayeredIslandGeometry({
        radiusX: isle.radius,
        radiusZ: isle.radius,
        depth:
          isle.radius *
          (isle.slug === "agehaos" ? 0.6 : isle.slug === "moss-world" ? 0.84 : 0.78),
        seed: isle.center.x * 0.13 + isle.center.z * 0.07 + 3.1,
        jaggedness:
          isle.slug === "agehaos" ? 0.12 : isle.slug === "moss-world" ? 0.1 : 0.095,
        segments: 56,
        profile:
          isle.slug === "agehaos"
            ? "mesa"
            : isle.slug === "cs-skin-invest"
              ? "shard"
              : "rooted",
        // R12.0-B（G5/G6）：三屿屿体 organic 化——此前未开 strataTilt/
        // buttress，屿体是无轮廓波、无沟槽、无岩檐雪的「光滑叠板/松饼」，
        // AgehaOS 屿侧视读成深色浮板堆。开启后与主岛同一套风化语言，
        // 剖面（mesa/shard/rooted）保持各自体量性格不变。
        // agehaos 的 mesa 层理平直、叠板感最强，四项参数单独加档
        strataTilt:
          isle.slug === "agehaos" ? 0.075 : isle.slug === "cs-skin-invest" ? 0.065 : 0.06,
        buttressCount: 5,
        buttressDepth:
          isle.slug === "moss-world" ? 0.055 : 0.06,
        layerJitter: isle.slug === "agehaos" ? 0.026 : 0.02,
        breachCount: 2,
        breachDepth:
          isle.slug === "agehaos" ? 0.16 : isle.slug === "cs-skin-invest" ? 0.1 : 0.09,
      }),
    [isle.radius, isle.center.x, isle.center.z, isle.slug],
  );
  const topGeometry = useMemo(
    () =>
      createIslandTopGeometry({
        radiusX: isle.radius,
        radiusZ: isle.radius,
        depth: isle.radius * 0.78,
        seed: isle.center.x * 0.11 + isle.center.z * 0.05 + 5.7,
        segments: 80,
        rings: 20,
        heightAt: (theta, r) =>
          0.1 *
          Math.pow(r, 2.4) *
          (0.55 + 0.45 * Math.sin(theta * 3 + isle.center.x * 0.2)),
        // R10：三屿顶面与主岛同口径的坡度染色（只影响顶点色，
        // 檐口形状保持原样）——屿顶不再是一片均匀白盘
        slopeTint: 0.4,
      }),
    [isle.radius, isle.center.x, isle.center.z],
  );
  const rimCrystals = useMemo(
    () =>
      createCrystalSprayGeometry(
        Array.from({ length: 3 }, (_, i) => {
          const angle = (i / 3) * Math.PI * 2 + isle.center.x * 0.05 + 0.6;
          return {
            x: Math.cos(angle) * isle.radius * 0.87,
            y: -0.72 - (i % 2) * 0.32,
            z: Math.sin(angle) * isle.radius * 0.87,
            height: 0.82 + (i % 2) * 0.22,
            radius: 0.19 + (i % 2) * 0.03,
            tiltZ: 0.14 - i * 0.08,
            spin: -angle,
          };
        }),
      ),
    [isle.radius, isle.center.x],
  );
  useEffect(
    () => () => {
      rockGeometry.dispose();
      topGeometry.dispose();
      rimCrystals.dispose();
    },
    [rockGeometry, topGeometry, rimCrystals],
  );

  const near = useNearPlayer(player, isle.center, screen?.mountDistance ?? 60);
  const experienceOption = experiences[isle.slug] ?? null;
  const demoSlug: ExperienceProjectSlug | null =
    isle.slug === "agehaos" || isle.slug === "cs-skin-invest" ? isle.slug : null;
  const demoScreens = useDemoScreenTextures(demoSlug, near);

  // 开发态体验探针：验收脚本核对选项/演示纹理是否真的挂到这屿
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const registry =
      (window as unknown as {
        __AGEHA_ISLE_EXPERIENCE__?: Record<string, () => unknown>;
      }).__AGEHA_ISLE_EXPERIENCE__ ?? {};
    registry[isle.slug] = () => ({
      slug: isle.slug,
      option: experienceOption,
      near,
      demos: demoScreens ? Object.keys(demoScreens) : [],
    });
    (window as unknown as { __AGEHA_ISLE_EXPERIENCE__?: unknown }).__AGEHA_ISLE_EXPERIENCE__ =
      registry;
    return () => {
      const current =
        (window as unknown as { __AGEHA_ISLE_EXPERIENCE__?: Record<string, () => unknown> })
          .__AGEHA_ISLE_EXPERIENCE__;
      if (current) delete current[isle.slug];
    };
  }, [demoScreens, experienceOption, isle.slug, near]);
  const nameplateRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<Group>(null);
  const uiFrameRef = useRef(0);

  const anchorX = isle.anchor?.offsetX ?? 0;
  const anchorZ = isle.anchor?.offsetZ ?? 0;
  const isMoss = isle.slug === "moss-world";
  const domeX = isle.collider.offsetX * 0.72;
  const domeZ = isle.collider.offsetZ * 0.72;
  const nameplateX = isMoss ? domeX : isle.collider.offsetX;
  const nameplateZ = isMoss ? domeZ : isle.collider.offsetZ;
  const nameplateY = isMoss ? 10.2 : isle.slug === "cs-skin-invest" ? 10.8 : 10.6;

  useFrame((state) => {
    // 名牌 / 高亮是低频反馈：每 4 帧更新一次，避免逐帧写 DOM style
    uiFrameRef.current += 1;
    if (uiFrameRef.current % 4 !== 0) return;
    const p = player.pos.current as Vector3;
    const d = Math.hypot(p.x - isle.center.x, p.y - isle.center.y, p.z - isle.center.z);

    if (nameplateRef.current) {
      // 远距名牌在接近时让位给 HUD 区域名 / 交互提示，避免传送落地后
      // 场景名牌与顶部导航、区域名重复堆叠。
      const fadeIn = Math.max(0, Math.min(1, (d - 12) / 5));
      const fadeOut = 1 - Math.max(0, Math.min(1, (d - (nameplateDistance + 18)) / 8));
      const opacity = fadeIn * fadeOut;
      nameplateRef.current.style.opacity = opacity.toFixed(3);
      // 不可见时彻底退出合成：名牌带 backdrop-filter，透明状态下
      // 浏览器仍可能为它维护模糊图层（移动端合成成本）。
      nameplateRef.current.style.visibility =
        opacity < 0.02 ? "hidden" : "visible";
    }

    if (ringRef.current) {
      const active = d < promptDistance || interactionState.hoverId === isle.id;
      ringRef.current.visible = active;
      if (active) {
        const s = 1 + Math.sin((state.clock.elapsedTime * Math.PI * 2) / MOTION.pulsePeriod) * 0.045;
        ringRef.current.scale.setScalar(s);
      }
    }
  });

  const handleOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    interactionState.hoverId = isle.id;
    setCanvasCursor(gl.domElement, "pointer");
  };
  const handleOut = () => {
    if (interactionState.hoverId === isle.id) {
      interactionState.hoverId = null;
      setCanvasCursor(gl.domElement, "");
    }
  };
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (inputState.pointerDragged) return;
    interactionState.suppressSceneClose = true;
    openDetail(isle.slug);
  };

  return (
    <group position={[isle.center.x, isle.center.y, isle.center.z]}>
      {/* 分层浮岛底座 */}
      <mesh geometry={rockGeometry} receiveShadow castShadow>
        <meshStandardMaterial vertexColors flatShading roughness={0.9} metalness={0.02} />
      </mesh>
      <mesh geometry={topGeometry} receiveShadow>
        {/* R10：与主岛顶面同口径压哑光（0.55→0.68），三屿雪盘不再比主岛亮一档 */}
        <meshStandardMaterial vertexColors roughness={0.68} metalness={0.03} />
      </mesh>

      {/* 项目屿基础结构：同一条世界语言下，三座平台有不同机械 / 生态性格 */}
      <IsleFoundation isle={isle} />

      {/* 岛缘主题晶簇：3 根晶柱合并为 1 个 draw call，只保留轮廓需要的一组 */}
      <mesh geometry={rimCrystals} castShadow>
        <CrystalGlowMaterial
          color={WORLD_COLORS.iceEdge}
          glow={isle.accentColor}
          intensity={0.34}
          roughness={0.18}
        />
      </mesh>

      <IsleStructure
        isle={isle}
        showScreen={near && screenTextures}
        screenAspect={screen?.aspect ?? 16 / 10}
        screenPath={screen?.path ?? null}
        glass={glass}
        mistCount={mistCount}
        domeX={domeX}
        domeZ={domeZ}
        experienceOption={experienceOption}
        demoScreens={demoScreens}
      />

      {/* 交互代理圆柱 */}
      <mesh
        position={[isle.collider.offsetX, 9, isle.collider.offsetZ]}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
        onClick={handleClick}
      >
        <cylinderGeometry
          args={[
            isle.collider.radius + (isMobileLike ? 2.5 : 1.5),
            isle.collider.radius + (isMobileLike ? 2.5 : 1.5),
            18,
            12,
          ]}
        />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* 高亮光圈 */}
      <group ref={ringRef} visible={false} position={[anchorX, 0.1, anchorZ]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[4.1, 4.65, 48]} />
          <meshBasicMaterial
            color={WORLD_COLORS.trailGlow}
            transparent
            opacity={0.5}
            side={DoubleSide}
            depthWrite={false}
          />
        </mesh>
        {[0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2].map((angle) => (
          <mesh key={angle} position={[Math.cos(angle) * 4.35, 0.02, Math.sin(angle) * 4.35]}>
            <octahedronGeometry args={[0.12, 0]} />
            <meshBasicMaterial color={isle.accentColor} transparent opacity={0.7} depthWrite={false} />
          </mesh>
        ))}
      </group>

      {/* 名牌 */}
      <Html
        position={[nameplateX, nameplateY, nameplateZ]}
        center
        distanceFactor={21}
        zIndexRange={[20, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div className="world-nameplate world-nameplate--isle" ref={nameplateRef} style={{ opacity: 0, visibility: "hidden" }}>
          <span className="world-nameplate__name">{project?.name ?? isle.name}</span>
          {project ? (
            <span
              className={
                project.status === "已上线"
                  ? "world-nameplate__status world-nameplate__status--live"
                  : "world-nameplate__status"
              }
            >
              {project.status}
            </span>
          ) : null}
        </div>
      </Html>
    </group>
  );
}

/* ------------------------------ 项目屿基础结构 ------------------------------ */

/* ------------------------------ 项目屿基础结构 ------------------------------ */

/**
 * 三座项目屿的「人工/生态基础」：同一世界观、不同功能语言。
 * AgehaOS = 冰白机库甲板；CS = 观测台铺面；Moss = 苔石护环。
 * 主建筑仍由各自地标承担，基础层只负责「这块地属于谁」。
 */
function IsleFoundation({ isle }: { isle: ProjectIsleData }) {
  if (isle.slug === "agehaos") return <AgehaosFoundation accent={isle.accentColor} />;
  if (isle.slug === "cs-skin-invest") return <CsFoundation accent={isle.accentColor} />;
  return <MossFoundation accent={isle.accentColor} />;
}

function AgehaosFoundation({ accent }: { accent: string }) {
  return (
    <group>
      {/* 机库铺面：一块完整的 20 边形冰白甲板，嵌线只保留一条主环 */}
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <cylinderGeometry args={[8.15, 8.4, 0.08, 20]} />
        <meshStandardMaterial color="#ABC4D5" roughness={0.56} metalness={0.16} />
      </mesh>
      <mesh position={[0, 0.082, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[6.55, 6.72, 64]} />
        <meshBasicMaterial color={accent} transparent opacity={0.55} depthWrite={false} />
      </mesh>
      {/* 到达铺装：蝶径进入机库台的接驳面，三条内嵌导向线 */}
      <mesh position={[2.9, 0.075, 6.15]} rotation={[0, 0.36, 0]} receiveShadow>
        <boxGeometry args={[4.4, 0.06, 3.7]} />
        <meshStandardMaterial color="#B9D0DF" roughness={0.52} metalness={0.12} />
      </mesh>
      {[-0.7, 0, 0.7].map((offset) => (
        <mesh
          key={offset}
          position={[2.9 + offset, 0.11, 5.45]}
          rotation={[0, 0.36, 0]}
        >
          <boxGeometry args={[0.05, 0.012, 2.1]} />
          <meshBasicMaterial color={accent} transparent opacity={0.48} depthWrite={false} />
        </mesh>
      ))}
      {/* 外环机箍：在甲板下方切开「地基 / 岩层」，但不再扩成 11m 大盘 */}
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[8.6, 8.9, 0.3, 20, 1, true]} />
        <meshStandardMaterial color="#4B6B84" roughness={0.4} metalness={0.52} side={DoubleSide} />
      </mesh>
      <mesh position={[0, -0.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[8.55, 0.05, 5, 64]} />
        <meshBasicMaterial color={accent} transparent opacity={0.42} depthWrite={false} />
      </mesh>
      {/* 四根悬挂锚桩 + 低环：悬浮工程的配重，而不是机械脚手架 */}
      {[0.7, 2.2, 4.0, 5.5].map((angle) => (
        <group key={angle} position={[Math.cos(angle) * 7.7, 0, Math.sin(angle) * 7.7]} rotation={[0, -angle, 0]}>
          <mesh position={[0, -2.15, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.4, 4.0, 6]} />
            <meshStandardMaterial color="#3A5F7E" roughness={0.38} metalness={0.6} />
          </mesh>
          <mesh position={[0, -4.1, 0]}>
            <octahedronGeometry args={[0.28, 0]} />
            <meshBasicMaterial color={accent} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, -3.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[4.35, 0.09, 5, 40]} />
        <meshStandardMaterial color="#466A86" roughness={0.34} metalness={0.66} />
      </mesh>
    </group>
  );
}

function CsFoundation({ accent }: { accent: string }) {
  return (
    <group>
      {/* 观测台铺面：16 边 + 放射刻度，和三径的弧度有明确对位 */}
      <mesh position={[0, 0.035, 0]} receiveShadow>
        <cylinderGeometry args={[8.0, 8.3, 0.08, 16]} />
        <meshStandardMaterial color="#8FA9BD" roughness={0.58} metalness={0.22} />
      </mesh>
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return (
          <mesh key={a} position={[Math.cos(a) * 5.8, 0.085, Math.sin(a) * 5.8]} rotation={[0, -a, 0]}>
            <boxGeometry args={[2.6, 0.012, 0.085]} />
            <meshBasicMaterial color={i % 4 === 0 ? "#FFB36B" : accent} transparent opacity={0.5} depthWrite={false} />
          </mesh>
        );
      })}
      {/* 倾斜桁架环 + 三组楔形支撑：技术上「托住」观测环 */}
      <group rotation={[0.16, 0.4, 0.08]}>
        <mesh position={[0, -2.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[9.7, 0.15, 6, 64]} />
          <meshStandardMaterial color="#4E718F" roughness={0.33} metalness={0.7} />
        </mesh>
        <mesh position={[0, -2.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[9.42, 0.035, 5, 64]} />
          <meshBasicMaterial color={accent} transparent opacity={0.42} depthWrite={false} />
        </mesh>
      </group>
      {[0.4, 2.5, 4.5].map((a) => (
        <group key={a} position={[Math.cos(a) * 8.0, 0, Math.sin(a) * 8.0]} rotation={[0, -a, 0]}>
          <mesh position={[0, -1.15, 0]} castShadow>
            <boxGeometry args={[0.72, 2.4, 1.3]} />
            <meshStandardMaterial color="#4A6E8E" roughness={0.4} metalness={0.62} />
          </mesh>
          <mesh position={[0, -0.45, 0]}>
            <boxGeometry args={[1.35, 0.1, 2.1]} />
            <meshBasicMaterial color={accent} transparent opacity={0.35} depthWrite={false} />
          </mesh>
        </group>
      ))}
      {/* 岛缘数据鳍：像风中的温度计，给圆盘剪影一个尖点 */}
      {[1.4, 3.6].map((a, i) => (
        <group key={a} position={[Math.cos(a) * 9.4, 0.3, Math.sin(a) * 9.4]} rotation={[0, -a, 0]}>
          <mesh position={[0, 1.35 + i * 0.3, 0]} castShadow>
            <boxGeometry args={[0.12, 2.7 + i * 0.6, 0.5]} />
            <meshStandardMaterial color="#2C4B67" roughness={0.38} metalness={0.6} />
          </mesh>
          <mesh position={[0.36, 2.1 + i * 0.4, 0]}>
            <boxGeometry args={[0.62, 0.28, 0.06]} />
            <meshBasicMaterial color="#FFB36B" transparent opacity={0.7} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function MossFoundation({ accent }: { accent: string }) {
  const stoneRef = useRef<InstancedMesh>(null);
  const moundRef = useRef<InstancedMesh>(null);
  const rootRef = useRef<InstancedMesh>(null);
  const budRef = useRef<InstancedMesh>(null);
  const tuftRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const stoneColors = useMemo(
    () => [new Color("#627F76"), new Color("#58756E"), new Color("#71927F")],
    [],
  );

  useLayoutEffect(() => {
    for (let i = 0; i < 10; i += 1) {
      const angle = (i / 10) * Math.PI * 2 + 0.2;
      const radius = 7.0 + ((i * 13) % 100) / 100 * 0.9;
      const scale = 0.48 + ((i * 17) % 100) / 100 * 0.38;
      dummy.position.set(
        Math.cos(angle) * radius,
        0.06,
        Math.sin(angle) * radius,
      );
      dummy.rotation.set(0.16 * (i % 2), -angle, 0.1);
      dummy.scale.set(scale, scale * 0.52, scale * 0.82);
      dummy.updateMatrix();
      if (stoneRef.current) {
        stoneRef.current.setMatrixAt(i, dummy.matrix);
        stoneRef.current.setColorAt(i, stoneColors[i % stoneColors.length]);
      }
    }
    if (stoneRef.current) {
      stoneRef.current.instanceMatrix.needsUpdate = true;
      if (stoneRef.current.instanceColor) stoneRef.current.instanceColor.needsUpdate = true;
    }

    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2 + 0.55;
      const radius = 7.2 + ((i * 11) % 100) / 100 * 0.55;
      const scale = 0.62 + ((i * 19) % 100) / 100 * 0.5;
      dummy.position.set(
        Math.cos(angle) * radius,
        0.03,
        Math.sin(angle) * radius,
      );
      dummy.rotation.set(0.1 * (i % 3), -angle, 0.08);
      dummy.scale.set(scale * 0.9, scale * 0.36, scale * 0.8);
      dummy.updateMatrix();
      moundRef.current?.setMatrixAt(i, dummy.matrix);
    }
    if (moundRef.current) moundRef.current.instanceMatrix.needsUpdate = true;

    [0.35, 1.95, 3.45, 5.05].forEach((angle, i) => {
      dummy.position.set(
        Math.cos(angle) * 7.5,
        -1.9,
        Math.sin(angle) * 7.5,
      );
      dummy.rotation.set(Math.PI, -angle, 0.06 * (i - 2));
      dummy.scale.set(0.55, 0.9, 0.5);
      dummy.updateMatrix();
      rootRef.current?.setMatrixAt(i, dummy.matrix);
      dummy.position.set(
        Math.cos(angle) * 7.5,
        -3.55,
        Math.sin(angle) * 7.5,
      );
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      budRef.current?.setMatrixAt(i, dummy.matrix);
    });
    if (rootRef.current) rootRef.current.instanceMatrix.needsUpdate = true;
    if (budRef.current) budRef.current.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2 + 0.9;
      const radius = 8.1 + (i % 2) * 0.35;
      dummy.position.set(
        Math.cos(angle) * radius,
        0.16,
        Math.sin(angle) * radius,
      );
      dummy.rotation.set(0.18 * (i % 2), -angle, 0.12);
      dummy.scale.set(0.5, 0.75 + (i % 3) * 0.18, 0.5);
      dummy.updateMatrix();
      tuftRef.current?.setMatrixAt(i, dummy.matrix);
    }
    if (tuftRef.current) tuftRef.current.instanceMatrix.needsUpdate = true;
  }, [dummy, stoneColors]);

  return (
    <group>
      {/* 苔石护环：围绕生态舱的一圈低矮苔石，不再是均匀的绿色圆环 */}
      <instancedMesh ref={stoneRef} args={[undefined, undefined, 10]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#ffffff" roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={moundRef} args={[undefined, undefined, 8]} receiveShadow>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#5A8178" roughness={1} flatShading />
      </instancedMesh>
      {/* 向下生长的根须：4 根粗根 + 根尖微光 */}
      <instancedMesh ref={rootRef} args={[undefined, undefined, 4]} castShadow>
        <coneGeometry args={[1, 3.6, 5]} />
        <meshStandardMaterial color="#2D5760" roughness={0.96} flatShading />
      </instancedMesh>
      <instancedMesh ref={budRef} args={[undefined, undefined, 4]}>
        <octahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial
          color="#8FE7BD"
          emissive={accent}
          emissiveIntensity={0.55}
          roughness={0.3}
        />
      </instancedMesh>
      {/* 岛缘苔草簇：只在几处成组出现 */}
      <instancedMesh ref={tuftRef} args={[undefined, undefined, 6]}>
        <coneGeometry args={[0.18, 0.7, 5]} />
        <meshStandardMaterial color="#6FBE97" roughness={1} flatShading />
      </instancedMesh>
    </group>
  );
}
/* ------------------------------ 场景内屏幕 ------------------------------ */

function setCanvasCursor(canvas: HTMLCanvasElement, cursor: string): void {
  canvas.style.cursor = cursor;
}

function configureScreenTexture(texture: Texture): void {
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
}

function DimScreen({ width, height }: { width: number; height: number }) {
  return (
    <mesh position={[0, 0, 0.12]}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial
        color="#0B2038"
        emissive={WORLD_COLORS.trailGlow}
        emissiveIntensity={0.16}
        roughness={0.35}
      />
    </mesh>
  );
}

function ScreenFace({ path, width, height }: { path: string; width: number; height: number }) {
  const texture = useTexture(path);
  useEffect(() => {
    configureScreenTexture(texture);
  }, [texture]);
  return (
    <mesh position={[0, 0, 0.12]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

function ScreenTextureFace({
  texture,
  width,
  height,
}: {
  texture: Texture;
  width: number;
  height: number;
}) {
  useEffect(() => {
    configureScreenTexture(texture);
  }, [texture]);
  return (
    <mesh position={[0, 0, 0.12]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

/** 屏幕控制台：深蓝金属外框 + 双层灯带 + 侧翼鳍 + 贴图面 / 暗屏 */
function ScreenConsole({
  position,
  rotationY,
  tilt,
  width,
  height,
  path,
  show,
  demoTexture,
}: {
  position: [number, number, number];
  rotationY: number;
  tilt: number;
  width: number;
  height: number;
  path: string | null;
  show: boolean;
  demoTexture?: Texture | null;
}) {
  return (
    <group position={position} rotation={[tilt, rotationY, 0]}>
      <mesh castShadow>
        <boxGeometry args={[width + 0.42, height + 0.42, 0.2]} />
        <DeepMetalMaterial color="#24476C" roughness={0.34} />
      </mesh>
      <mesh position={[0, 0, 0.1]}>
        <boxGeometry args={[width + 0.18, height + 0.18, 0.03]} />
        <meshBasicMaterial color="#9FE9FF" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      {demoTexture ? (
        <ScreenTextureFace texture={demoTexture} width={width} height={height} />
      ) : show && path ? (
        <TextureBoundary fallback={<DimScreen width={width} height={height} />}>
          <Suspense fallback={<DimScreen width={width} height={height} />}>
            <ScreenFace path={path} width={width} height={height} />
          </Suspense>
        </TextureBoundary>
      ) : (
        <DimScreen width={width} height={height} />
      )}
      {/* 两侧短鳍与底部灯条：让屏幕成为「装置」而不是一块贴图 */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (width / 2 + 0.3), -0.1, -0.02]} rotation={[0, side * 0.28, 0]} castShadow>
          <boxGeometry args={[0.34, height * 0.62, 0.07]} />
          <DeepMetalMaterial color="#2D547A" roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, -height / 2 - 0.3, 0.04]}>
        <boxGeometry args={[width * 0.62, 0.035, 0.02]} />
        <meshBasicMaterial color={WORLD_COLORS.trailGlow} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ------------------------------ 三屿正式造型 ------------------------------ */

function IsleStructure({
  isle,
  showScreen,
  screenAspect,
  screenPath,
  glass,
  mistCount,
  domeX,
  domeZ,
  experienceOption,
  demoScreens,
}: {
  isle: ProjectIsleData;
  showScreen: boolean;
  screenAspect: number;
  screenPath: string | null;
  glass: boolean;
  mistCount: number;
  domeX: number;
  domeZ: number;
  experienceOption: string | null;
  demoScreens: Record<string, Texture> | null;
}) {
  if (isle.slug === "agehaos") {
    return (
      <AgehaosTerminal
        showScreen={showScreen}
        screenAspect={screenAspect}
        screenPath={screenPath}
        experienceOption={experienceOption}
        demoScreens={demoScreens}
      />
    );
  }
  if (isle.slug === "cs-skin-invest") {
    return (
      <CsObservatory
        showScreen={showScreen}
        screenAspect={screenAspect}
        screenPath={screenPath}
        experienceOption={experienceOption}
        demoScreens={demoScreens}
      />
    );
  }
  return (
    <MossTerrarium
      isle={isle}
      showScreen={showScreen}
      screenAspect={screenAspect}
      screenPath={screenPath}
      glass={glass}
      mistCount={mistCount}
      domeX={domeX}
      domeZ={domeZ}
      experienceOption={experienceOption}
    />
  );
}

function AgehaosTerminal({
  showScreen,
  screenAspect,
  screenPath,
  experienceOption,
  demoScreens,
}: {
  showScreen: boolean;
  screenAspect: number;
  screenPath: string | null;
  experienceOption: string | null;
  demoScreens: Record<string, Texture> | null;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const demoTexture =
    experienceOption && demoScreens ? demoScreens[experienceOption] ?? null : null;
  const kernelRef = useRef<Group>(null);
  const asset = useMemo(() => createAgehaosGeometry(), []);
  const materials = useMemo(() => ({
    chassis: new MeshStandardMaterial({ color: "#204760", roughness: 0.36, metalness: 0.48 }),
    ceramic: new MeshPhysicalMaterial({ color: "#D7EAF2", roughness: 0.32, metalness: 0.16, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
    rim: new MeshStandardMaterial({ color: "#142F48", roughness: 0.3, metalness: 0.4 }),
    pearl: new MeshStandardMaterial({ color: "#A9D6E6", roughness: 0.28, metalness: 0.35 }),
    lens: new MeshPhysicalMaterial({ color: "#4EACC7", roughness: 0.16, metalness: 0.24, clearcoat: 1, clearcoatRoughness: 0.12, emissive: "#28768F", emissiveIntensity: 0.28 }),
    energy: new MeshStandardMaterial({ color: "#A5E8F3", roughness: 0.26, metalness: 0.2, emissive: "#53BCD5", emissiveIntensity: 0.48 }),
  }), []);
  useEffect(() => () => Object.values(asset).forEach((geometry) => geometry.dispose()), [asset]);
  useEffect(() => () => Object.values(materials).forEach((material) => material.dispose()), [materials]);

  useFrame(({ clock }) => {
    if (!kernelRef.current) return;
    const t = reducedMotion ? 0 : clock.elapsedTime;
    kernelRef.current.position.y = 6.42 + Math.sin(t * 0.7) * 0.07;
    kernelRef.current.rotation.y = 0.16 + Math.sin(t * 0.35) * 0.12;
  });

  return (
    <group name="agehaos-control-station">
      <group position={[2.0, 0, 6.55]} rotation={[0, 0.2, 0]}>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 1.9, 0, 0]}>
            <mesh position={[0, 0.08, 0]} receiveShadow>
              <cylinderGeometry args={[0.3, 0.4, 0.16, 6]} />
              <meshStandardMaterial color="#C3D6E3" roughness={0.5} metalness={0.12} />
            </mesh>
            <mesh position={[0, 1.2, 0]} castShadow>
              <cylinderGeometry args={[0.1, 0.16, 2.25, 6]} />
              <meshStandardMaterial color="#E1EDF6" roughness={0.38} metalness={0.16} />
            </mesh>
            <mesh position={[0, 2.36, 0]}>
              <octahedronGeometry args={[0.1, 0]} />
              <meshBasicMaterial color={WORLD_COLORS.crystal[1]} toneMapped={false} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 2.3, 0]} castShadow>
          <boxGeometry args={[4.0, 0.1, 0.14]} />
          <DeepMetalMaterial color="#3A5F7E" roughness={0.32} />
        </mesh>
        <mesh position={[0, 2.24, 0]}>
          <boxGeometry args={[3.2, 0.016, 0.04]} />
          <meshBasicMaterial color={WORLD_COLORS.crystal[1]} transparent opacity={0.55} depthWrite={false} />
        </mesh>
      </group>

      <mesh position={[0, 0.09, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[5.6, 5.85, 0.18, 8, 1, false, Math.PI / 8]} />
        <meshStandardMaterial color="#A9C2D3" roughness={0.56} metalness={0.16} />
      </mesh>
      <mesh position={[0, 0.26, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[4.45, 4.72, 0.18, 8, 1, false, Math.PI / 8]} />
        <meshStandardMaterial color="#C4D7E4" roughness={0.46} metalness={0.14} />
      </mesh>
      <mesh position={[0, 0.41, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[3.45, 3.7, 0.14, 8, 1, false, Math.PI / 8]} />
        <DeepMetalMaterial color="#2E526F" roughness={0.34} />
      </mesh>
      <mesh position={[0, 0.49, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.82, 2.96, 8, 1, Math.PI / 8]} />
        <meshBasicMaterial color={WORLD_COLORS.crystal[1]} transparent opacity={0.65} depthWrite={false} />
      </mesh>

      <mesh name="agehaos-chassis" geometry={asset.chassis} material={materials.chassis} castShadow receiveShadow />
      <mesh name="agehaos-ceramic-shell" geometry={asset.ceramic} material={materials.ceramic} castShadow receiveShadow />
      <mesh name="agehaos-console-housing" geometry={asset.consoleBody} material={materials.ceramic} castShadow receiveShadow />
      <mesh geometry={asset.consoleRim} material={materials.rim} castShadow />
      <mesh geometry={asset.saddle} material={materials.chassis} castShadow receiveShadow />
      <mesh geometry={asset.channels} material={materials.energy} />
      <mesh position={[0, 4.54, 0]} material={materials.energy}>
        <boxGeometry args={[0.82, 0.05, 0.7]} />
      </mesh>

      <group name="agehaos-compute-core" ref={kernelRef} position={[0, 6.42, 0]} rotation={[0, 0.16, Math.PI / 4]}>
        <mesh geometry={asset.kernel} material={materials.chassis} castShadow />
        {[0, Math.PI].map((angle) => (
          <group key={angle} rotation={[0, angle, 0]}>
            <mesh geometry={asset.bezel} material={materials.pearl} castShadow />
            <mesh geometry={asset.lens} material={materials.lens} />
            <group position={[0, 0, 0.5]} rotation={[0, 0, angle === 0 ? -Math.PI / 4 : Math.PI / 4]}>
              {[-1, 1].map((side) => (
                <mesh key={side} position={[-0.12, side * 0.105, 0]} rotation={[0, 0, -side * Math.PI / 4]} material={materials.energy}>
                  <boxGeometry args={[0.3, 0.045, 0.02]} />
                </mesh>
              ))}
              <mesh position={[0.23, -0.18, 0]} material={materials.energy}>
                <boxGeometry args={[0.22, 0.045, 0.02]} />
              </mesh>
            </group>
          </group>
        ))}
      </group>

      <group name="agehaos-display" position={[0, 2.67, 1.94]}>
        {demoTexture ? (
          <ScreenTextureFace
            texture={demoTexture}
            width={3.15}
            height={3.15 / screenAspect}
          />
        ) : showScreen && screenPath ? (
          <TextureBoundary
            fallback={<DimScreen width={3.15} height={3.15 / screenAspect} />}
          >
            <Suspense fallback={<DimScreen width={3.15} height={3.15 / screenAspect} />}>
              <ScreenFace path={screenPath} width={3.15} height={3.15 / screenAspect} />
            </Suspense>
          </TextureBoundary>
        ) : (
          <DimScreen width={3.15} height={3.15 / screenAspect} />
        )}
      </group>
      <mesh position={[0, 1.42, 1.79]} rotation={[-0.25, 0, 0]} material={materials.rim}>
        <boxGeometry args={[2.45, 0.08, 0.25]} />
      </mesh>
      <mesh position={[0, 1.46, 1.93]} material={materials.energy}>
        <boxGeometry args={[1.52, 0.026, 0.035]} />
      </mesh>
    </group>
  );
}
/** CS · 行情观测环：抬升圆环 + 数据柱阵 + 中央价格针 + 竖屏终端 */
function tickBars(
  mesh: InstancedMesh,
  dummy: Object3D,
  heights: Float32Array,
  seeds: Float32Array,
  slots: Array<[number, number]>,
  colorRising: Color,
  colorIce: Color,
  reducedMotion: boolean,
  t: number,
): void {
  let colorDirty = false;
  for (let i = 0; i < 24; i += 1) {
    if (!reducedMotion) {
      const target =
        0.9 + Math.sin(t * 0.65 + seeds[i]) * 0.48 + Math.sin(t * 1.8 + seeds[i] * 2.1) * 0.24;
      const rising = target > heights[i];
      heights[i] += (target - heights[i]) * 0.07;
      mesh.setColorAt(i, rising ? colorRising : colorIce);
      colorDirty = true;
    }
    const [x, z] = slots[i];
    dummy.position.set(x, 0.1 + heights[i] / 2, z);
    dummy.scale.set(1, heights[i], 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (colorDirty && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

function CsObservatory({
  showScreen,
  screenAspect,
  screenPath,
  experienceOption,
  demoScreens,
}: {
  showScreen: boolean;
  screenAspect: number;
  screenPath: string | null;
  experienceOption: string | null;
  demoScreens: Record<string, Texture> | null;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const barsRef = useRef<InstancedMesh>(null);
  const ringRef = useRef<Group>(null);
  const groundTickRef = useRef<InstancedMesh>(null);
  const ringTickRef = useRef<InstancedMesh>(null);
  const dataFrameRef = useRef(0);
  const dummy = useMemo(() => new Object3D(), []);
  const demoTexture =
    experienceOption && demoScreens ? demoScreens[experienceOption] ?? null : null;
  const mood = useMemo(() => {
    if (experienceOption === "holdings") {
      return {
        rising: "#8FE8FF",
        ice: "#54E3FF",
        accent: "#FFB36B",
        yaw: 0.58,
        speed: 0.02,
        tiltX: 0.48,
        tiltZ: -0.16,
      };
    }
    if (experienceOption === "trades") {
      return {
        rising: "#FFB36B",
        ice: "#EAFBFF",
        accent: "#FFB36B",
        yaw: -0.62,
        speed: 0.085,
        tiltX: 0.24,
        tiltZ: 0.28,
      };
    }
    if (experienceOption === "portfolio") {
      return {
        rising: "#FFB36B",
        ice: "#8FE8FF",
        accent: "#54E3FF",
        yaw: 0,
        speed: 0.045,
        tiltX: 0.34,
        tiltZ: 0.12,
      };
    }
    return {
      rising: "#FFB36B",
      ice: "#54E3FF",
      accent: "#54E3FF",
      yaw: 0,
      speed: 0.045,
      tiltX: 0.34,
      tiltZ: 0.12,
    };
  }, [experienceOption]);
  const colorRising = useMemo(() => new Color(mood.rising), [mood.rising]);
  const colorIce = useMemo(() => new Color(mood.ice), [mood.ice]);
  const tickWarm = useMemo(() => new Color("#FFB36B"), []);
  const tickIce = useMemo(() => new Color("#8FD7F2"), []);
  const tickWhite = useMemo(() => new Color("#EAFBFF"), []);
  const heights = useMemo(() => {
    const arr = new Float32Array(24);
    for (let i = 0; i < 24; i += 1) arr[i] = 0.8 + ((i * 7) % 5) * 0.18;
    return arr;
  }, []);
  const seeds = useMemo(() => {
    const arr = new Float32Array(24);
    for (let i = 0; i < 24; i += 1) arr[i] = (i * 2.399) % (Math.PI * 2);
    return arr;
  }, []);
  const slots = useMemo(() => {
    const list: Array<[number, number]> = [];
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      list.push([Math.cos(a) * 2.05, Math.sin(a) * 2.05]);
    }
    for (let i = 0; i < 12; i += 1) {
      const a = ((i + 0.5) / 12) * Math.PI * 2;
      list.push([Math.cos(a) * 1.15, Math.sin(a) * 1.15]);
    }
    return list;
  }, []);

  useEffect(() => {
    const mesh = barsRef.current;
    if (!mesh) return;
    for (let i = 0; i < 24; i += 1) mesh.setColorAt(i, colorIce);
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [colorIce]);

  useLayoutEffect(() => {
    for (let i = 0; i < 24; i += 1) {
      const angle = (i / 24) * Math.PI * 2;
      dummy.position.set(
        Math.cos(angle) * 4.05,
        0.64,
        Math.sin(angle) * 4.05,
      );
      dummy.rotation.set(0, -angle, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      groundTickRef.current?.setMatrixAt(i, dummy.matrix);
      groundTickRef.current?.setColorAt(i, i % 6 === 0 ? tickWarm : tickIce);
    }
    if (groundTickRef.current) {
      groundTickRef.current.instanceMatrix.needsUpdate = true;
      if (groundTickRef.current.instanceColor) {
        groundTickRef.current.instanceColor.needsUpdate = true;
      }
    }
    for (let i = 0; i < 16; i += 1) {
      const angle = (i / 16) * Math.PI * 2;
      dummy.position.set(
        Math.cos(angle) * 6.35,
        0,
        Math.sin(angle) * 6.35,
      );
      dummy.rotation.set(0, -angle, 0);
      dummy.updateMatrix();
      ringTickRef.current?.setMatrixAt(i, dummy.matrix);
      ringTickRef.current?.setColorAt(i, i % 4 === 0 ? tickWarm : tickWhite);
    }
    if (ringTickRef.current) {
      ringTickRef.current.instanceMatrix.needsUpdate = true;
      if (ringTickRef.current.instanceColor) {
        ringTickRef.current.instanceColor.needsUpdate = true;
      }
    }
  }, [dummy, tickWarm, tickIce, tickWhite]);

  useFrame((state) => {
    const mesh = barsRef.current;
    // 行情柱是装饰数据：半帧率（60Hz 下约 30Hz）已足够，移动端不再逐帧写 24 组矩阵
    dataFrameRef.current += 1;
    if (mesh && dataFrameRef.current % 2 === 0) {
      tickBars(
        mesh,
        dummy,
        heights,
        seeds,
        slots,
        colorRising,
        colorIce,
        reducedMotion,
        state.clock.elapsedTime,
      );
    }
    if (ringRef.current) {
      ringRef.current.rotation.x = mood.tiltX;
      ringRef.current.rotation.z = mood.tiltZ;
      ringRef.current.rotation.y =
        mood.yaw + (reducedMotion ? 0 : state.clock.elapsedTime * mood.speed);
    }
  });

  return (
    <group>
      {/* 观测台基座：三级抬升 + 暖色测距刻度（金融终端的功能语义） */}
      <mesh position={[0, 0.13, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[6.15, 6.45, 0.26, 24]} />
        <meshStandardMaterial color="#6F8DA8" roughness={0.68} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.31, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[5.3, 5.6, 0.26, 24]} />
        <meshStandardMaterial color="#8DA9C0" roughness={0.6} metalness={0.14} />
      </mesh>
      <mesh position={[0, 0.52, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[4.5, 4.8, 0.26, 24]} />
        <meshStandardMaterial color="#B3CEE2" roughness={0.52} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.68, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[5.0, 5.16, 64]} />
        <meshBasicMaterial color="#FFB36B" transparent opacity={0.34} depthWrite={false} />
      </mesh>
      {/* 基座刻度：实例化（24 → 1 draw） */}
      <instancedMesh ref={groundTickRef} args={[undefined, undefined, 24]}>
        <boxGeometry args={[0.48, 0.035, 0.06]} />
        <meshBasicMaterial transparent opacity={0.7} depthWrite={false} toneMapped={false} />
      </instancedMesh>

      {/* 行情柱阵（instanced）：数据色直出，无白 emissive 洗色 */}
      <mesh position={[0, 0.68, 0]} receiveShadow>
        <cylinderGeometry args={[2.5, 2.6, 0.2, 24]} />
        <DeepMetalMaterial color="#2C4E72" roughness={0.4} />
      </mesh>
      <instancedMesh ref={barsRef} args={[undefined, undefined, 24]} castShadow>
        <boxGeometry args={[0.24, 1, 0.24]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* 抬升观测环：环形圈梁 + 4 根斜撑 + 刻度齿 */}
      <group ref={ringRef} position={[0, 4.9, 0]} rotation={[0.34, 0, 0.12]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[6.35, 0.16, 8, 96]} />
          <meshStandardMaterial color="#5E86A9" metalness={0.65} roughness={0.28} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[6.18, 0.035, 6, 80]} />
          <meshBasicMaterial color={WORLD_COLORS.trailGlow} transparent opacity={0.55} depthWrite={false} />
        </mesh>
        {/* 观测环刻度：实例化（16 → 1 draw） */}
        <instancedMesh ref={ringTickRef} args={[undefined, undefined, 16]}>
          <boxGeometry args={[0.5, 0.06, 0.14]} />
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
        {[0, 1, 2, 3].map((i) => {
          const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
          return (
            <group key={i} rotation={[0, -angle, 0]}>
              <mesh position={[6.0, -2.35, 0]} rotation={[0, 0, -0.12]} castShadow>
                <cylinderGeometry args={[0.17, 0.33, 4.3, 6]} />
                <DeepMetalMaterial color="#486C8D" roughness={0.32} />
              </mesh>
              <mesh position={[6.05, -4.14, 0]} rotation={[0, 0, 0]} castShadow>
                <cylinderGeometry args={[0.62, 0.82, 0.28, 6]} />
                <DeepMetalMaterial color="#4F7393" roughness={0.36} />
              </mesh>
              <mesh position={[6.0, -0.22, 0]}>
                <boxGeometry args={[0.65, 0.16, 0.65]} />
                <meshBasicMaterial color="#FFB36B" transparent opacity={0.55} depthWrite={false} />
              </mesh>
            </group>
          );
        })}
        {/* 第二道内环：不同倾角，形成陀螺仪式观测结构 */}
        <mesh rotation={[Math.PI / 2.5, 0.24, 0.5]}>
          <torusGeometry args={[4.4, 0.055, 6, 72, Math.PI * 1.55]} />
          <meshStandardMaterial color="#6D94B5" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh rotation={[Math.PI / 2.5, 0.24, 0.5]}>
          <torusGeometry args={[4.4, 0.018, 4, 72, Math.PI * 1.55]} />
          <meshBasicMaterial color="#FFB36B" transparent opacity={0.34} depthWrite={false} />
        </mesh>
      </group>

      {/* 中央分析轴：分段机身 + 计量晶 + 顶部半环天线（不是一根孤零零的针） */}
      <mesh position={[0, 1.35, 0]} castShadow>
        <cylinderGeometry args={[0.62, 0.95, 1.5, 8]} />
        <DeepMetalMaterial color="#456A8B" roughness={0.34} />
      </mesh>
      <mesh position={[0, 3.35, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.52, 3.4, 8]} />
        <meshStandardMaterial color="#5E86A8" metalness={0.7} roughness={0.3} />
      </mesh>
      {[1.4, 2.6, 3.8, 4.7].map((y, i) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, i * 0.2]}>
          <torusGeometry args={[0.52 - i * 0.05, 0.055, 5, 24]} />
          <DeepMetalMaterial color="#3D6384" roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 5.5, 0]} rotation={[0.16, 0.4, 0.08]} castShadow>
        <octahedronGeometry args={[0.46, 0]} />
        <meshStandardMaterial
          color="#FFD1A4"
          emissive="#FFB36B"
          emissiveIntensity={0.72}
          roughness={0.18}
          flatShading
        />
      </mesh>
      <mesh position={[0, 6.35, 0]} rotation={[0.3, Math.PI / 2.6, 0.1]}>
        <torusGeometry args={[1.7, 0.055, 5, 48, Math.PI * 1.35]} />
        <meshStandardMaterial color="#D4E8F6" metalness={0.45} roughness={0.36} />
      </mesh>
      <mesh position={[0, 6.35, 0]} rotation={[0.3, Math.PI / 2.6, 0.1]}>
        <torusGeometry args={[1.45, 0.018, 4, 48, Math.PI * 1.35]} />
        <meshBasicMaterial color="#FFB36B" transparent opacity={0.5} depthWrite={false} />
      </mesh>
      {/* 第二道正交观测弧：与水平环形成陀螺仪式轮廓 */}
      <mesh position={[0, 5.0, 0]} rotation={[1.32, 0.4, 0.2]}>
        <torusGeometry args={[3.0, 0.06, 5, 64, Math.PI * 1.1]} />
        <meshStandardMaterial color="#6C93B4" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.88, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.55, 0.09, 6, 32]} />
        <DeepMetalMaterial color="#3B6086" roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.91, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.35, 1.68, 32]} />
        <meshBasicMaterial color="#FFB36B" transparent opacity={0.26} depthWrite={false} />
      </mesh>

      {/* 侧翼仪表：两座倾斜的小观测屏（仅为结构辨识，不承载交互） */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 4.6, 1.35, -3.0]} rotation={[0, side * 0.4 + 1.62, 0]}>
          <mesh position={[0, -0.65, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.1, 1.3, 6]} />
            <DeepMetalMaterial color="#30567C" roughness={0.4} />
          </mesh>
          <mesh rotation={[-0.2, 0, 0]} castShadow>
            <boxGeometry args={[1.15, 0.8, 0.1]} />
            <DeepMetalMaterial color="#3B5E7E" roughness={0.36} />
          </mesh>
          <mesh position={[0, 0, 0.06]} rotation={[-0.2, 0, 0]}>
            <planeGeometry args={[0.98, 0.64]} />
            <meshBasicMaterial color={side > 0 ? "#7FDFFF" : "#FFB36B"} transparent opacity={0.35} depthWrite={false} />
          </mesh>
        </group>
      ))}

      {/* 前置竖屏（3:4 真实投资组合页；侧向布置，避免遮住中央观测轴） */}
      <group position={[5.15, 0, -3.7]} rotation={[0, 2.02, 0]}>
        <mesh position={[0, 0.75, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.32, 1.5, 8]} />
          <DeepMetalMaterial color="#3D6284" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.24, 0]} receiveShadow>
          <cylinderGeometry args={[0.7, 0.9, 0.2, 8]} />
          <meshStandardMaterial color="#7896AC" roughness={0.6} metalness={0.16} />
        </mesh>
        <mesh position={[0, 1.45, 0]} rotation={[0.08, 0, 0]}>
          <boxGeometry args={[2.0, 3.0, 0.16]} />
          <DeepMetalMaterial color="#345A7B" roughness={0.34} />
        </mesh>
        <ScreenConsole
          position={[0, 2.15, 0.14]}
          rotationY={0}
          tilt={-0.08}
          width={1.72}
          height={1.72 / screenAspect}
          path={screenPath}
          show={showScreen}
          demoTexture={demoTexture}
        />
      </group>
    </group>
  );
}

const MOSS_FERNS = [
  { x: -2.0, z: -1.6, scale: 1.0, rot: 0.4 },
  { x: -3.1, z: 0.5, scale: 0.78, rot: 2.1 },
] as const;

const MOSS_SPORES = [
  { x: 2.3, z: -2.0, scale: 1.0, rot: 0.2 },
  { x: 2.9, z: 0.4, scale: 0.82, rot: 1.7 },
] as const;

const MOSS_SHRUBS = [
  { x: -0.4, z: -3.4, scale: 0.55 },
  { x: 1.1, z: -0.4, scale: 0.42 },
  { x: -3.8, z: -1.4, scale: 0.5 },
  { x: 3.2, z: 2.4, scale: 0.44 },
  { x: -1.0, z: 3.1, scale: 0.36 },
] as const;

const MOSS_MUSHROOMS = [
  { x: -0.7, z: 1.4, cap: 0.3, h: 0.55 },
  { x: 2.2, z: 1.7, cap: 0.24, h: 0.42 },
  { x: 0.2, z: 2.9, cap: 0.2, h: 0.34 },
  { x: -1.6, z: 2.5, cap: 0.27, h: 0.48 },
  { x: 2.6, z: 0.8, cap: 0.18, h: 0.3 },
  { x: -2.7, z: 1.8, cap: 0.22, h: 0.38 },
] as const;

const MOSS_POND = { x: 0.8, z: 1.5, radius: 1.5 } as const;

/**
 * Moss World · 生态穹舱（R4 重构）。
 *
 * 保留「玻璃穹舱 + 舱外观景屏」的方向，但重做三件事：
 * 1. 穹舱玻璃只留一层，高档 transmission / 中低档极淡透明壳，
 *    骨架用合并几何（8 经线 + 2 纬环 + 底环 = 1 个 draw call）；
 * 2. 内部地从平面绿盘改为有树丘 / 池盆 / 苔色分区的起伏地表；
 *    植被分三区：宽叶蕨树、发光孢子树、低苔灌木，不再是一圈相同锥体；
 * 3. 池岸石 / 蘑菇 / 芦苇 / 踏步石全部实例化，点位成簇，不再均匀铺满。
 * 交互锚点、真实监测屏、Moss 无外链的诚实边界保持不变。
 */
const MOSS_MOODS = {
  default: { light: "#FFF1DC", intensity: 0, accent: "#9FE9C4", orb: "#9FE9C4" },
  morning: { light: "#BFEFFF", intensity: 5.2, accent: "#8FE8FF", orb: "#BFF3FF" },
  noon: { light: "#FFF1DC", intensity: 8.0, accent: "#FFD9A0", orb: "#FFE3B0" },
  dusk: { light: "#FFB36B", intensity: 6.0, accent: "#FFB36B", orb: "#FFC27A" },
} as const;

function MossTerrarium({
  isle,
  showScreen,
  screenAspect,
  screenPath,
  glass,
  mistCount,
  domeX,
  domeZ,
  experienceOption,
}: {
  isle: ProjectIsleData;
  showScreen: boolean;
  screenAspect: number;
  screenPath: string | null;
  glass: boolean;
  mistCount: number;
  domeX: number;
  domeZ: number;
  experienceOption: string | null;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const domeR = 5.6;
  const mood =
    experienceOption === "morning" ||
    experienceOption === "noon" ||
    experienceOption === "dusk"
      ? MOSS_MOODS[experienceOption]
      : MOSS_MOODS.default;
  const crownRef = useRef<Group>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const nodeRef = useRef<InstancedMesh>(null);
  const fernTrunkRef = useRef<InstancedMesh>(null);
  const frondRef = useRef<InstancedMesh>(null);
  const sporeTrunkRef = useRef<InstancedMesh>(null);
  const orbRef = useRef<InstancedMesh>(null);
  const shrubRef = useRef<InstancedMesh>(null);
  const mushroomStemRef = useRef<InstancedMesh>(null);
  const mushroomCapRef = useRef<InstancedMesh>(null);
  const reedRef = useRef<InstancedMesh>(null);
  const pondRockRef = useRef<InstancedMesh>(null);
  const steppingRef = useRef<InstancedMesh>(null);

  const groundGeometry = useMemo(
    () => createMossGroundGeometry(5.25, 1.7, 48, 14),
    [],
  );
  const frondGeometry = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.14, 0.2, 0.2, 0.58, 0.02, 1.08);
    shape.bezierCurveTo(-0.16, 0.6, -0.1, 0.22, 0, 0);
    return new ShapeGeometry(shape, 8);
  }, []);
  const frameGeometry = useMemo(() => {
    const parts: BufferGeometry[] = [];
    for (let i = 0; i < 8; i += 1) {
      const arch = new TorusGeometry(domeR, 0.045, 5, 24, Math.PI);
      arch.rotateY((i / 8) * Math.PI * 2);
      parts.push(arch);
    }
    [0.42, 0.72].forEach((heightRatio) => {
      const y = domeR * heightRatio;
      const radius = Math.sqrt(Math.max(0.01, domeR * domeR - y * y)) - 0.02;
      const ring = new TorusGeometry(radius, 0.04, 5, 48);
      ring.rotateX(Math.PI / 2);
      ring.translate(0, y, 0);
      parts.push(ring);
    });
    const base = new TorusGeometry(domeR, 0.1, 8, 64);
    base.rotateX(Math.PI / 2);
    parts.push(base);
    const merged = mergeGeometries(parts, false);
    parts.forEach((part) => part.dispose());
    if (!merged) throw new Error("Moss 穹舱骨架合并失败");
    return merged;
  }, []);

  useEffect(
    () => () => {
      groundGeometry.dispose();
      frondGeometry.dispose();
      frameGeometry.dispose();
    },
    [groundGeometry, frondGeometry, frameGeometry],
  );

  useLayoutEffect(() => {
    const set = (
      mesh: InstancedMesh | null,
      index: number,
      x: number,
      y: number,
      z: number,
      rx: number,
      ry: number,
      rz: number,
      sx: number,
      sy: number,
      sz: number,
    ) => {
      if (!mesh) return;
      dummy.position.set(x, y, z);
      dummy.rotation.set(rx, ry, rz);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    };

    [0.42, 0.72].forEach((heightRatio, ringIndex) => {
      const y = domeR * heightRatio;
      const radius = Math.sqrt(Math.max(0.01, domeR * domeR - y * y));
      for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * Math.PI * 2;
        set(
          nodeRef.current,
          ringIndex * 8 + i,
          Math.cos(angle) * radius,
          y,
          Math.sin(angle) * radius,
          0,
          0,
          0,
          1,
          1,
          1,
        );
      }
    });
    if (nodeRef.current) nodeRef.current.instanceMatrix.needsUpdate = true;

    MOSS_FERNS.forEach((fern, i) => {
      const baseY = 0.88 + fern.scale * 0.04;
      set(
        fernTrunkRef.current,
        i,
        fern.x,
        baseY + 1.0 * fern.scale,
        fern.z,
        0.03,
        fern.rot,
        0.02,
        1,
        fern.scale,
        1,
      );
      for (let j = 0; j < 5; j += 1) {
        const angle = fern.rot + (j / 5) * Math.PI * 2;
        const tilt = 0.82 + (j % 2) * 0.16;
        set(
          frondRef.current,
          i * 5 + j,
          fern.x,
          baseY + 1.9 * fern.scale,
          fern.z,
          0,
          angle,
          tilt,
          fern.scale * 0.92,
          fern.scale,
          fern.scale * 0.92,
        );
      }
    });
    if (fernTrunkRef.current) fernTrunkRef.current.instanceMatrix.needsUpdate = true;
    if (frondRef.current) frondRef.current.instanceMatrix.needsUpdate = true;

    MOSS_SPORES.forEach((tree, i) => {
      const baseY = 0.88;
      set(
        sporeTrunkRef.current,
        i,
        tree.x,
        baseY + 1.3 * tree.scale,
        tree.z,
        0.04,
        tree.rot,
        0.03,
        1,
        tree.scale,
        1,
      );
      for (let j = 0; j < 3; j += 1) {
        const size = (0.3 - j * 0.06) * tree.scale;
        set(
          orbRef.current,
          i * 3 + j,
          tree.x + Math.sin(j * 2.1 + tree.rot) * 0.16,
          baseY + (2.0 + j * 0.32) * tree.scale,
          tree.z + Math.cos(j * 1.7) * 0.12,
          0.2 * j,
          tree.rot + j,
          0.15,
          size,
          size * 0.82,
          size,
        );
      }
    });
    if (sporeTrunkRef.current) sporeTrunkRef.current.instanceMatrix.needsUpdate = true;
    if (orbRef.current) orbRef.current.instanceMatrix.needsUpdate = true;

    MOSS_SHRUBS.forEach((shrub, i) => {
      set(
        shrubRef.current,
        i,
        shrub.x,
        0.78 + shrub.scale * 0.18,
        shrub.z,
        0.1 * (i % 3),
        i * 1.7,
        0.08,
        shrub.scale,
        shrub.scale * 0.55,
        shrub.scale * 0.85,
      );
    });
    if (shrubRef.current) shrubRef.current.instanceMatrix.needsUpdate = true;

    MOSS_MUSHROOMS.forEach((mushroom, i) => {
      set(
        mushroomStemRef.current,
        i,
        mushroom.x,
        0.8 + mushroom.h / 2,
        mushroom.z,
        0,
        0,
        0,
        1,
        1,
        1,
      );
      set(
        mushroomCapRef.current,
        i,
        mushroom.x,
        0.8 + mushroom.h,
        mushroom.z,
        0.08 * (i % 2),
        i,
        0.05,
        mushroom.cap * 2.2,
        mushroom.cap * 0.9,
        mushroom.cap * 2.2,
      );
    });
    if (mushroomStemRef.current) mushroomStemRef.current.instanceMatrix.needsUpdate = true;
    if (mushroomCapRef.current) mushroomCapRef.current.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2 + 0.4;
      set(
        reedRef.current,
        i,
        MOSS_POND.x + Math.cos(angle) * (MOSS_POND.radius + 0.15),
        0.8 + 0.42,
        MOSS_POND.z + Math.sin(angle) * (MOSS_POND.radius + 0.15),
        0.08,
        -angle,
        0.16 * ((i % 3) - 1),
        0.5,
        0.8 + (i % 3) * 0.2,
        0.5,
      );
      set(
        pondRockRef.current,
        i,
        MOSS_POND.x + Math.cos(angle + 0.3) * (MOSS_POND.radius + 0.05),
        0.78,
        MOSS_POND.z + Math.sin(angle + 0.3) * (MOSS_POND.radius + 0.05),
        0.15 * i,
        -angle,
        0.1,
        0.28 + (i % 3) * 0.05,
        0.18,
        0.26,
      );
    }
    if (reedRef.current) reedRef.current.instanceMatrix.needsUpdate = true;
    if (pondRockRef.current) pondRockRef.current.instanceMatrix.needsUpdate = true;

    const steps = [
      [-4.6, 0.4],
      [-3.4, 0.8],
      [-2.2, 1.2],
      [-1.1, 1.6],
      [-0.1, 2.0],
    ] as const;
    steps.forEach(([x, z], i) => {
      set(steppingRef.current, i, x, 0.76, z, 0, i * 0.8, 0, 1, 1, 1);
    });
    if (steppingRef.current) steppingRef.current.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  useFrame((state) => {
    if (!crownRef.current) return;
    crownRef.current.position.y = reducedMotion
      ? 0.55
      : 0.55 + Math.sin(state.clock.elapsedTime * 0.8) * 0.08;
  });

  const anchorX = (isle.anchor?.offsetX ?? 0) - domeX;
  const anchorZ = (isle.anchor?.offsetZ ?? 0) - domeZ;

  return (
    <group position={[domeX, 0, domeZ]}>
      {/* 生态台：两层石台 + 维护环线 */}
      <mesh position={[0, 0.12, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[7.6, 7.9, 0.22, 32]} />
        <meshStandardMaterial color="#78969F" roughness={0.82} metalness={0.06} />
      </mesh>
      <mesh position={[0, 0.3, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[6.9, 7.2, 0.18, 32]} />
        <meshStandardMaterial color="#97B2B2" roughness={0.72} metalness={0.06} />
      </mesh>
      <mesh position={[0, 0.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[6.18, 6.42, 64]} />
        <meshBasicMaterial color={WORLD_COLORS.mossDeep} transparent opacity={0.4} depthWrite={false} />
      </mesh>

      {/* 玻璃穹舱：单层透射玻璃，降级档为极淡透明壳 */}
      <mesh position={[0, 0.58, 0]} renderOrder={3}>
        <sphereGeometry args={[domeR, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        {glass ? (
          <meshPhysicalMaterial
            color="#DDF3FF"
            transmission={0.82}
            thickness={0.3}
            ior={1.35}
            roughness={0.05}
            metalness={0}
            side={DoubleSide}
            transparent
            opacity={0.94}
            attenuationColor={mood.accent}
            attenuationDistance={8}
            emissive={mood.accent}
            emissiveIntensity={experienceOption ? 0.09 : 0}
          />
        ) : (
          <GlassPaneMaterial
            color="#DFF4FF"
            opacity={0.16}
            roughness={0.08}
            metalness={0.02}
            depthWrite={false}
            envMapIntensity={1.3}
            emissive={mood.accent}
            emissiveIntensity={experienceOption ? 0.12 : 0}
          />
        )}
      </mesh>
      {/* 玻璃底沿：给穹顶真实接地点与厚度 */}
      <mesh position={[0, 0.56, 0]}>
        <cylinderGeometry args={[domeR + 0.06, domeR + 0.14, 0.48, 40, 1, true]} />
        <DeepMetalMaterial color="#3A646B" roughness={0.34} />
      </mesh>
      {/* P3 穹舱光照体验：内部演示光源 + 可见光球 + 基座色环 */}
      <pointLight
        position={[0, 4.1, 0]}
        color={mood.light}
        intensity={mood.intensity}
        distance={12}
        decay={2}
      />
      {experienceOption ? (
        <group position={[0, 4.2, 0]}>
          <mesh>
            <sphereGeometry args={[0.3, 16, 12]} />
            <meshBasicMaterial color={mood.orb} toneMapped={false} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.78, 16, 12]} />
            <meshBasicMaterial
              color={mood.orb}
              transparent
              opacity={0.22}
              depthWrite={false}
              blending={AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        </group>
      ) : null}
      <mesh position={[0, 0.82, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[domeR - 0.06, domeR + 0.12, 64]} />
        <meshBasicMaterial
          color={mood.accent}
          transparent
          opacity={experienceOption ? 0.75 : 0.16}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0.68, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[domeR - 0.02, domeR + 0.14, 64]} />
        <meshStandardMaterial color="#A8D7C1" roughness={0.5} metalness={0.18} />
      </mesh>

      {/* 西侧入口门框：让「舱外观景台 → 舱内」有明确的接近点 */}
      <group position={[-domeR + 0.16, 0.58, 0]}>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[0, 0.92, side * 0.78]} castShadow>
            <cylinderGeometry args={[0.1, 0.16, 1.84, 6]} />
            <meshStandardMaterial color="#D8E7DC" roughness={0.42} metalness={0.12} />
          </mesh>
        ))}
        <mesh position={[0, 1.88, 0]} castShadow>
          <boxGeometry args={[0.14, 0.12, 1.85]} />
          <DeepMetalMaterial color="#4A7B80" roughness={0.34} />
        </mesh>
        <mesh position={[0, 1.8, 0]}>
          <boxGeometry args={[0.04, 0.02, 1.45]} />
          <meshBasicMaterial color={WORLD_COLORS.mossGreen} transparent opacity={0.5} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.04, 0]} receiveShadow>
          <boxGeometry args={[0.85, 0.08, 2.0]} />
          <meshStandardMaterial color="#B6CDD5" roughness={0.72} />
        </mesh>
      </group>

      {/* 穹舱骨架：8 经线 + 2 纬环 + 底环合并为 1 个 mesh */}
      <mesh geometry={frameGeometry} position={[0, 0.58, 0]}>
        <meshStandardMaterial color="#3D6B72" roughness={0.34} metalness={0.46} />
      </mesh>
      <instancedMesh ref={nodeRef} args={[undefined, undefined, 16]}>
        <sphereGeometry args={[0.07, 6, 4]} />
        <meshStandardMaterial color="#6A9792" roughness={0.4} metalness={0.35} />
      </instancedMesh>

      {/* 舱内地面：起伏苔原 + 池盆 */}
      <mesh geometry={groundGeometry} position={[0, 0.72, 0]} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.96} flatShading />
      </mesh>
      <mesh position={[MOSS_POND.x, 0.76, MOSS_POND.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[MOSS_POND.radius, 40]} />
        <meshStandardMaterial
          color="#4FBDB6"
          roughness={0.08}
          metalness={0.22}
          emissive="#247C80"
          emissiveIntensity={0.16}
          transparent
          opacity={0.9}
        />
      </mesh>
      <mesh position={[MOSS_POND.x, 0.775, MOSS_POND.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[MOSS_POND.radius - 0.12, MOSS_POND.radius + 0.05, 36]} />
        <meshBasicMaterial color="#BEF7E4" transparent opacity={0.36} depthWrite={false} />
      </mesh>
      <instancedMesh ref={pondRockRef} args={[undefined, undefined, 8]} castShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#5E7D70" roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={steppingRef} args={[undefined, undefined, 5]} receiveShadow>
        <cylinderGeometry args={[0.3, 0.34, 0.05, 7]} />
        <meshStandardMaterial color="#C5D8C8" roughness={0.8} />
      </instancedMesh>

      {/* 宽叶蕨树：细干 + 5 片放射状叶，与针叶树明确区分 */}
      <instancedMesh ref={fernTrunkRef} args={[undefined, undefined, 2]} castShadow>
        <cylinderGeometry args={[0.09, 0.16, 2.0, 6]} />
        <meshStandardMaterial color="#366B54" roughness={0.92} />
      </instancedMesh>
      <instancedMesh ref={frondRef} args={[undefined, undefined, 10]} castShadow>
        <primitive object={frondGeometry} attach="geometry" />
        <meshStandardMaterial
          color="#7FD0A4"
          emissive="#3E9E77"
          emissiveIntensity={0.05}
          roughness={0.88}
          side={DoubleSide}
        />
      </instancedMesh>

      {/* 发光孢子树：细干 + 3 枚半透明光球 */}
      <instancedMesh ref={sporeTrunkRef} args={[undefined, undefined, 2]} castShadow>
        <cylinderGeometry args={[0.06, 0.11, 2.6, 6]} />
        <meshStandardMaterial color="#4E7F68" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={orbRef} args={[undefined, undefined, 6]}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial
          color="#C8F6DE"
          emissive={WORLD_COLORS.mossGreen}
          emissiveIntensity={0.35}
          roughness={0.44}
          transparent
          opacity={0.82}
        />
      </instancedMesh>

      {/* 低苔灌木 / 蘑菇 / 芦苇 */}
      <instancedMesh ref={shrubRef} args={[undefined, undefined, 5]} receiveShadow>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#6FCF9E" roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={mushroomStemRef} args={[undefined, undefined, 6]}>
        <cylinderGeometry args={[0.045, 0.07, 0.6, 5]} />
        <meshStandardMaterial color="#D7EBDD" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={mushroomCapRef} args={[undefined, undefined, 6]} castShadow>
        <sphereGeometry args={[0.5, 8, 5]} />
        <meshStandardMaterial
          color="#A5E3C4"
          emissive="#5FCE9E"
          emissiveIntensity={0.12}
          roughness={0.9}
          flatShading
        />
      </instancedMesh>
      <instancedMesh ref={reedRef} args={[undefined, undefined, 8]}>
        <coneGeometry args={[0.1, 1, 5]} />
        <meshStandardMaterial color="#8FDDB4" roughness={1} flatShading />
      </instancedMesh>

      {/* 舱内水雾 */}
      <DomeMist count={Math.round(mistCount * 0.4)} radius={domeR} />

      {/* 顶部通风冠：轻量环 + 4 片导流鳍 + 悬浮绿晶 */}
      <group position={[0, 0.58 + domeR, 0]}>
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.55, 0.78, 0.22, 8]} />
          <DeepMetalMaterial color="#35636A" roughness={0.32} />
        </mesh>
        <mesh position={[0, 0.18, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.92, 0.08, 6, 24]} />
          <DeepMetalMaterial color="#4A7B80" roughness={0.32} />
        </mesh>
        {Array.from({ length: 4 }, (_, i) => {
          const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
          return (
            <mesh
              key={i}
              position={[Math.cos(angle) * 0.8, 0.02, Math.sin(angle) * 0.8]}
              rotation={[0.22, -angle, 0]}
            >
              <boxGeometry args={[0.07, 0.52, 0.22]} />
              <meshStandardMaterial color="#6A9A96" roughness={0.4} metalness={0.22} />
            </mesh>
          );
        })}
        <group ref={crownRef} position={[0, 0.55, 0]}>
          <mesh>
            <octahedronGeometry args={[0.32, 0]} />
            <meshStandardMaterial
              color="#A5F0CD"
              emissive={WORLD_COLORS.mossGreen}
              emissiveIntensity={0.58}
              roughness={0.2}
              flatShading
            />
          </mesh>
        </group>
        <mesh position={[0, 0.36, 0]} rotation={[Math.PI / 2.2, 0, 0.08]}>
          <torusGeometry args={[0.66, 0.018, 4, 40]} />
          <meshBasicMaterial color="#9FE9C4" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      </group>

      {/* 舱外观景台 + 监测屏（交互锚点保持 isle.anchor 数据） */}
      <group position={[anchorX, 0, anchorZ]}>
        <mesh position={[0, 0.2, 0]} receiveShadow>
          <cylinderGeometry args={[1.75, 1.95, 0.2, 8]} />
          <meshStandardMaterial color="#8FAEBE" roughness={0.6} />
        </mesh>
        <mesh position={[-1.0, 0.45, 0.5]} receiveShadow>
          <boxGeometry args={[1.2, 0.18, 0.45]} />
          <meshStandardMaterial color="#B6CDD5" roughness={0.72} />
        </mesh>
        <group position={[2.2, 0, -1.0]} rotation={[0, -1.2, 0]}>
          <mesh position={[0, 2.08, 0]} castShadow>
            <boxGeometry args={[2.45, 0.12, 1.35]} />
            <DeepMetalMaterial color="#2E5655" roughness={0.34} />
          </mesh>
          <mesh position={[0, 2.15, 0]}>
            <boxGeometry args={[2.15, 0.025, 1.05]} />
            <meshBasicMaterial color={WORLD_COLORS.mossGreen} transparent opacity={0.35} depthWrite={false} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 1.05, 1.15, 0]} castShadow>
              <cylinderGeometry args={[0.06, 0.1, 1.9, 6]} />
              <DeepMetalMaterial color="#2F5A61" roughness={0.38} />
            </mesh>
          ))}
          <mesh position={[0, 0.82, 0.1]} castShadow>
            <boxGeometry args={[1.9, 0.12, 0.52]} />
            <DeepMetalMaterial color="#2E5655" roughness={0.4} />
          </mesh>
          <ScreenConsole
            position={[0, 1.32, 0.06]}
            rotationY={0}
            tilt={-0.06}
            width={1.75}
            height={1.75 / screenAspect}
            path={screenPath}
            show={showScreen}
          />
        </group>
        {/* 观景台围栏：低矮、与舱底同色系 */}
        {[-1, 1].map((side) => (
          <mesh key={`rail-${side}`} position={[side * 1.55, 0.86, 1.2]} rotation={[0, 0.35, 0]}>
            <boxGeometry args={[0.08, 0.07, 2.2]} />
            <DeepMetalMaterial color="#5C8984" roughness={0.36} />
          </mesh>
        ))}
        {[-1.45, 1.45].map((x) => (
          <mesh key={`post-${x}`} position={[x, 0.52, 1.2]} rotation={[0, 0.35, 0]}>
            <boxGeometry args={[0.07, 0.62, 0.07]} />
            <DeepMetalMaterial color="#5C8984" roughness={0.36} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** 舱内水雾：确定性布点的 Points，整组极慢环旋（reduced-motion 冻结） */
function DomeMist({ count, radius }: { count: number; radius: number }) {
  const reducedMotion = usePrefersReducedMotion();
  const groupRef = useRef<Group>(null);
  const pointsGeometry = useMemo(() => {
    const geo = new BufferGeometry();
    const positions = new Float32Array(Math.max(count, 1) * 3);
    for (let i = 0; i < count; i += 1) {
      const a = i * 2.399963;
      const r = radius * 0.74 * Math.sqrt(((i * 41) % 100) / 100);
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = 0.8 + (((i * 29) % 100) / 100) * (radius * 0.6);
      positions[i * 3 + 2] = Math.sin(a) * r;
    }
    geo.setAttribute("position", new BufferAttribute(positions, 3));
    return geo;
  }, [count, radius]);
  useEffect(() => () => pointsGeometry.dispose(), [pointsGeometry]);

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return;
    groupRef.current.rotation.y += 0.05 * delta;
  });

  if (count <= 0) return null;
  return (
    <group ref={groupRef} position={[0, 0.6, 0]}>
      <points geometry={pointsGeometry}>
        <pointsMaterial
          color="#EAF9FF"
          size={0.16}
          transparent
          opacity={0.28}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
    </group>
  );
}
