"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, useTexture } from "@react-three/drei";
import {
  AdditiveBlending,
  BoxGeometry,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  Quaternion,
  SRGBColorSpace,
  Vector3,
  Texture,
  type Group,
} from "three";
import {
  CHRYSALIS_NOOK,
  GALLERY_ARTWORKS,
  NOOK_CORRIDOR,
  NOOK_CORRIDOR_SAMPLES,
} from "@/lib/world/layout";
import { INTERACTION, WORLD_COLORS } from "@/lib/world/constants";
import { MOTION } from "../systems/worldMotion";
import type { PlayerApi } from "../systems/usePlayerController";
import { useNearPlayer } from "../systems/useNearPlayer";
import { usePrefersReducedMotion } from "../systems/usePrefersReducedMotion";
import { useWorldUI } from "../WorldUIContext";
import { buildRibbonGeometry } from "../terrain/ribbonGeometry";
import { DeepMetalMaterial, FrostRockMaterial } from "../terrain/materials";

/**
 * 茧居所 The Chrysalis Nook（蓝图 §9.1 隐藏彩蛋，阶段 3 画廊完整态）：
 * - 旋径：主岛西北缘绕岛身外侧盘旋下沉的窄径（石板 + 暗光带，可行走面
 *   在 lib/world/layout.ts 数据层）；
 * - 平台 + 封闭小穹窟：设计原稿画廊——三幅压缩版原稿画框
 *   （GALLERY_ARTWORKS 登记，距茧居所 <40 且非低档才挂载纹理，
 *   否则空框渐显）+ 每框暖光射灯 + 如实说明牌（不宣称更多）；
 * - 中央蝶茧：靠近 <4.5 轻颤（reduced-motion 静止）——世界最初的
 *   草图孵化中的隐喻，纯氛围无文案；
 * - 发现即点亮：进入发现半径 → WorldUIContext.discoverNook()，
 *   世界导航面板出现「茧居所」传送项。
 */
const SLAB_STRIDE = 2;
const SLAB_SCALE = new Vector3(1.8, 0.14, 1.3);
const UP_AXIS = new Vector3(0, 1, 0);
/** 发现判定的低频采样节流（模块级，避免重渲） */
let discoveryFrameCounter = 0;

/** 画框布局：中央概念图（近方幅）+ 两侧 hero 原稿，朝平台中心内倾 */
const FRAME_LAYOUTS = [
  { x: -2.7, ry: Math.PI / 5 },
  { x: 0, ry: 0 },
  { x: 2.7, ry: -Math.PI / 5 },
] as const;

/** 按展品宽高比定画框尺寸（宽 1.05~1.85、高随之；实测 aspect 见登记注释） */
function frameSize(aspect: number): { width: number; height: number } {
  const width = Math.min(1.85, Math.max(1.05, aspect * 0.8));
  return { width, height: width / aspect };
}

/** 纹理色彩配置（模块级命令式入口，见 ProjectIsle configureScreenTexture 注） */
function configureArtworkTexture(texture: Texture): void {
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
}

export function GalleryNook({
  player,
  screenTextures,
}: {
  player: PlayerApi;
  /** 性能档：低档不加载画廊纹理（空框渐显，§12.1） */
  screenTextures: boolean;
}) {
  const { nookDiscovered, discoverNook } = useWorldUI();
  const reducedMotion = usePrefersReducedMotion();
  const discoveredRef = useRef(false);
  const cocoonRef = useRef<Group>(null);

  // 画廊纹理按需挂载（距茧居所 <40；GALLERY_ARTWORKS 登记单源）
  const near = useNearPlayer(player, CHRYSALIS_NOOK.center, GALLERY_ARTWORKS[0].mountDistance);

  // 发现判定：低频采样（约 5Hz），进入半径即点亮（会话内保持）
  useFrame(() => {
    if (discoveredRef.current) return;
    discoveryFrameCounter = (discoveryFrameCounter + 1) % 12;
    if (discoveryFrameCounter !== 0) return;
    const p = player.pos.current as Vector3;
    const d = Math.hypot(
      p.x - CHRYSALIS_NOOK.center.x,
      p.y - CHRYSALIS_NOOK.center.y,
      p.z - CHRYSALIS_NOOK.center.z,
    );
    if (d < INTERACTION.nookDiscoveryRadius) {
      discoveredRef.current = true;
      discoverNook();
    }
  });

  // 旋径光带（暗于蝶径——隐藏气质）
  const ribbons = useMemo(
    () => ({
      band: buildRibbonGeometry(NOOK_CORRIDOR_SAMPLES, NOOK_CORRIDOR.width * 1.15, -0.26),
      line: buildRibbonGeometry(NOOK_CORRIDOR_SAMPLES, 0.4, -0.24),
    }),
    [],
  );

  const slabCount = useMemo(
    () => Math.floor((NOOK_CORRIDOR_SAMPLES.length - 1) / SLAB_STRIDE),
    [],
  );
  const slabGeometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const platformGeometry = useMemo(
    () => new BoxGeometry(CHRYSALIS_NOOK.platformSize.x, 0.5, CHRYSALIS_NOOK.platformSize.z),
    [],
  );

  useEffect(
    () => () => {
      ribbons.band.dispose();
      ribbons.line.dispose();
      slabGeometry.dispose();
      platformGeometry.dispose();
    },
    [ribbons, slabGeometry, platformGeometry],
  );

  const slabRef = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = slabRef.current;
    if (!mesh) return;
    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const position = new Vector3();
    let index = 0;
    for (
      let i = 1;
      i < NOOK_CORRIDOR_SAMPLES.length && index < slabCount;
      i += SLAB_STRIDE
    ) {
      const s = NOOK_CORRIDOR_SAMPLES[i];
      const prev = NOOK_CORRIDOR_SAMPLES[i - 1];
      quaternion.setFromAxisAngle(UP_AXIS, Math.atan2(s.x - prev.x, s.z - prev.z));
      position.set(s.x, s.y - 0.08, s.z);
      matrix.compose(position, quaternion, SLAB_SCALE);
      mesh.setMatrixAt(index, matrix);
      index += 1;
    }
    mesh.count = index;
    mesh.instanceMatrix.needsUpdate = true;
  }, [slabCount]);

  // 蝶茧轻颤：玩家靠近 <4.5 时高频微颤 + 微光呼吸（reduced-motion 静止）
  useFrame((state) => {
    const cocoon = cocoonRef.current;
    if (!cocoon) return;
    const p = player.pos.current as Vector3;
    const cocoonWorldX = CHRYSALIS_NOOK.center.x;
    const cocoonWorldZ = CHRYSALIS_NOOK.center.z + 0.6;
    const d = Math.hypot(p.x - cocoonWorldX, p.z - cocoonWorldZ);
    const proximity = Math.max(0, Math.min(1, (MOTION.cocoonTrembleDistance - d) / 2));
    if (reducedMotion) {
      cocoon.rotation.z = 0;
      return;
    }
    const t = state.clock.elapsedTime;
    cocoon.rotation.z = Math.sin(t * 26) * 0.05 * proximity;
    cocoon.rotation.x = Math.cos(t * 21) * 0.03 * proximity;
    const breathe =
      1 + Math.sin((t * Math.PI * 2) / MOTION.breathePeriod) * 0.04 * (0.4 + proximity);
    cocoon.scale.setScalar(breathe);
  });

  return (
    <group>
      {/* 旋径：暗光带 + 窄石板（比蝶径更窄更暗） */}
      <mesh geometry={ribbons.band}>
        <meshBasicMaterial
          color={WORLD_COLORS.crystal[2]}
          transparent
          opacity={0.1}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
      <mesh geometry={ribbons.line}>
        <meshBasicMaterial
          color={WORLD_COLORS.crystal[2]}
          transparent
          opacity={0.34}
          depthWrite={false}
          blending={AdditiveBlending}
          side={DoubleSide}
        />
      </mesh>
      <instancedMesh
        ref={slabRef}
        args={[slabGeometry, undefined, Math.max(1, slabCount)]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#DCE9F7" roughness={0.8} />
      </instancedMesh>

      {/* 茧居所平台 + 小穹窟 */}
      <group
        position={[CHRYSALIS_NOOK.center.x, CHRYSALIS_NOOK.center.y - 0.25, CHRYSALIS_NOOK.center.z]}
      >
        <mesh geometry={platformGeometry} receiveShadow castShadow>
          <FrostRockMaterial />
        </mesh>
        {/* 穹窟：玻璃半穹（紫水晶色微光——世界底下的秘密据点） */}
        <mesh position={[0, 0.25, 0]}>
          <sphereGeometry args={[5.6, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial
            color={WORLD_COLORS.glass}
            transparent
            opacity={0.3}
            roughness={0.2}
            side={DoubleSide}
          />
        </mesh>
        <pointLight
          color={WORLD_COLORS.crystal[2]}
          intensity={4}
          distance={16}
          decay={2}
          position={[0, 3, 0]}
        />

        {/* 设计原稿画廊：三画框 + 暖光射灯 + 如实说明牌（§9.1 完整态） */}
        {GALLERY_ARTWORKS.map((artwork, i) => {
          const layout = FRAME_LAYOUTS[i];
          const { width, height } = frameSize(artwork.aspect);
          return (
            <group
              key={artwork.id}
              position={[layout.x, 1.75, -2.9]}
              rotation={[0, layout.ry, 0]}
            >
              {/* 画框：深蓝金属框 + 空框渐显底板（纹理按需挂载） */}
              <mesh castShadow>
                <boxGeometry args={[width + 0.24, height + 0.24, 0.08]} />
                <DeepMetalMaterial roughness={0.4} />
              </mesh>
              {near && screenTextures ? (
                <Suspense fallback={<EmptyCanvas width={width} height={height} />}>
                  <ArtworkCanvas path={artwork.path} width={width} height={height} />
                </Suspense>
              ) : (
                <EmptyCanvas width={width} height={height} />
              )}
              {/* 局部射灯：暖白点光（画框上前方，局部照明） */}
              <pointLight
                color="#FFF6E8"
                intensity={4.5}
                distance={4.6}
                decay={2}
                position={[0, height / 2 + 0.9, 1.0]}
              />
              {/* 展品说明牌（近距离才挂载，DOM 层系统字体） */}
              {near ? (
                <Html
                  position={[0, -height / 2 - 0.42, 0.1]}
                  center
                  distanceFactor={9}
                  zIndexRange={[20, 0]}
                  style={{ pointerEvents: "none" }}
                >
                  <div className="world-nameplate">
                    <span className="world-nameplate__status">{artwork.caption}</span>
                  </div>
                </Html>
              ) : null}
            </group>
          );
        })}

        {/* 中央蝶茧（靠近轻颤；世界最初的草图孵化中） */}
        <group ref={cocoonRef} position={[0, 1.05, 0.6]}>
          <mesh>
            <capsuleGeometry args={[0.32, 0.8, 6, 12]} />
            <meshStandardMaterial
              color={WORLD_COLORS.crystal[0]}
              emissive={WORLD_COLORS.crystal[2]}
              emissiveIntensity={0.4}
              roughness={0.5}
            />
          </mesh>
        </group>

        {/* 画廊说明牌（文案如实：hero 原稿即来源） */}
        <Html
          position={[0, 3.1, -1.2]}
          center
          distanceFactor={12}
          zIndexRange={[20, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div className="world-nameplate">
            <span className="world-nameplate__name">设计原稿画廊</span>
            <span className="world-nameplate__status">这个世界最初的草图</span>
          </div>
        </Html>
      </group>

      {/* 发现后入口微光提示（顶侧看向主岛底的访客线索） */}
      {nookDiscovered ? (
        <mesh position={[NOOK_CORRIDOR_SAMPLES[1].x, NOOK_CORRIDOR_SAMPLES[1].y + 1.6, NOOK_CORRIDOR_SAMPLES[1].z]}>
          <sphereGeometry args={[0.22, 10, 8]} />
          <meshStandardMaterial
            color={WORLD_COLORS.crystal[0]}
            emissive={WORLD_COLORS.crystal[2]}
            emissiveIntensity={1.2}
          />
        </mesh>
      ) : null}
    </group>
  );
}

/** 空框底板（未加载纹理时的渐显态；低档常态 / 加载间隙） */
function EmptyCanvas({ width, height }: { width: number; height: number }) {
  return (
    <mesh position={[0, 0, 0.05]}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial
        color="#CFE3F5"
        emissive={WORLD_COLORS.crystal[2]}
        emissiveIntensity={0.08}
        roughness={0.9}
      />
    </mesh>
  );
}

/** 画框展品面：真实原稿压缩版纹理（useTexture，调用方须包 Suspense） */
function ArtworkCanvas({
  path,
  width,
  height,
}: {
  path: string;
  width: number;
  height: number;
}) {
  const texture = useTexture(path);
  useEffect(() => {
    configureArtworkTexture(texture);
  }, [texture]);
  return (
    <mesh position={[0, 0, 0.05]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}
