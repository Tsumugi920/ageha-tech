"use client";

import { useCallback, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { ACESFilmicToneMapping } from "three";
import {
  CAMERA_LIMITS,
  WORLD_COLORS,
  WORLD_FOG,
} from "@/lib/world/constants";
import { PROJECT_ISLES } from "@/lib/world/layout";
import { MOBILE_MODIFIERS, pickInitialTier } from "@/lib/world/performance";
import { MainIsland } from "./terrain/MainIsland";
import { Trails } from "./terrain/Trails";
import { SkyDome } from "./terrain/SkyDome";
import { CloudLayer } from "./terrain/CloudLayer";
import { IceSea } from "./terrain/IceSea";
import { DistantIsles } from "./terrain/DistantIsles";
import { ProjectIsle } from "./objects/ProjectIsle";
import { DriftLantern } from "./objects/DriftLantern";
import { usePlayerController } from "./systems/usePlayerController";
import { FollowCamera } from "./systems/FollowCamera";
import { InteractionSystem } from "./systems/InteractionSystem";
import { resetInputState } from "./systems/inputState";
import type { ResizeObserverCtor } from "./systems/resizePolyfill";

/**
 * 3D 世界 Canvas 根（蓝图 §10）：dpr / 阴影 / 相机初始 / 场景组装。
 * 由 WorldShell 以 next/dynamic ssr:false 装载（Next 16 SSR 安全）。
 * 卸载时复位共享输入态；几何 / 纹理清理在各组件 useEffect 内完成。
 * resizePolyfill：原生 ResizeObserver 失效的 WebView 下注入测量兜底。
 */
export default function WorldCanvas({
  isMobileLike,
  onReady,
  resizePolyfill,
}: {
  isMobileLike: boolean;
  onReady: () => void;
  resizePolyfill?: ResizeObserverCtor;
}) {
  const tier = pickInitialTier(isMobileLike);
  const fov = isMobileLike ? CAMERA_LIMITS.fovMobile : CAMERA_LIMITS.fovDesktop;

  // 卸载时复位共享输入 / 相机状态，防止跨会话残留
  useEffect(() => () => resetInputState(), []);

  const handleCreated = useCallback(() => {
    onReady();
  }, [onReady]);

  return (
    <Canvas
      className="world-canvas"
      shadows={tier.shadows !== false ? true : false}
      dpr={[1, tier.dprMax]}
      resize={resizePolyfill ? { polyfill: resizePolyfill } : undefined}
      camera={{
        fov,
        near: CAMERA_LIMITS.near,
        far: CAMERA_LIMITS.far,
        position: [
          CAMERA_LIMITS.initialPosition.x,
          CAMERA_LIMITS.initialPosition.y,
          CAMERA_LIMITS.initialPosition.z,
        ],
      }}
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        toneMapping: ACESFilmicToneMapping,
      }}
      onCreated={handleCreated}
    >
      <WorldScene isMobileLike={isMobileLike} shadowsEnabled={tier.shadows !== false} />
    </Canvas>
  );
}

/** 场景组装（Canvas 内）：雾 / 光 / 地形 / 三屿 / 信灯 / 相机 / 交互 */
function WorldScene({
  isMobileLike,
  shadowsEnabled,
}: {
  isMobileLike: boolean;
  shadowsEnabled: boolean;
}) {
  const player = usePlayerController(isMobileLike);
  const tier = pickInitialTier(isMobileLike);

  return (
    <>
      {/* 线性雾（§2.3：near 70 / far 260，色 #CFEBFF） */}
      <fog attach="fog" args={[WORLD_FOG.color, WORLD_FOG.near, WORLD_FOG.far]} />

      {/* 光照（§3.3）：晨光平行光（投影只罩主岛+蝶枢）+ 半球光 */}
      <hemisphereLight
        color={WORLD_COLORS.hemiSky}
        groundColor={WORLD_COLORS.hemiGround}
        intensity={0.55}
      />
      <directionalLight
        color={WORLD_COLORS.sunLight}
        intensity={1.25}
        position={[46, 58, -34]}
        castShadow={shadowsEnabled}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-42}
        shadow-camera-right={42}
        shadow-camera-top={36}
        shadow-camera-bottom={-36}
        shadow-camera-near={8}
        shadow-camera-far={180}
        shadow-bias={-0.0004}
      />

      {/* 环境：天空穹 / 云层 / 冰海 / 远景浮岛 */}
      <SkyDome />
      <CloudLayer tier={tier} />
      <IceSea />
      <DistantIsles tier={tier} />

      {/* 近景：主岛 / 三条蝶径 / 三座项目屿 */}
      <MainIsland />
      <Trails />
      {PROJECT_ISLES.map((isle) => (
        <ProjectIsle key={isle.id} isle={isle} />
      ))}

      {/* 蝶枢占位光环（正式水晶蝶枢在阶段 3；先立视觉焦点位置） */}
      <mesh position={[0, 6, 0]}>
        <torusGeometry args={[3.1, 0.14, 10, 48]} />
        <meshStandardMaterial
          color={WORLD_COLORS.iceEdge}
          emissive={WORLD_COLORS.trailGlow}
          emissiveIntensity={0.9}
          roughness={0.3}
        />
      </mesh>
      <pointLight color={WORLD_COLORS.trailGlow} intensity={6} distance={26} decay={2} position={[0, 6, 0]} />

      {/* 角色 / 相机 / 交互 */}
      <DriftLantern player={player} />
      <FollowCamera
        player={player}
        distanceOffset={isMobileLike ? MOBILE_MODIFIERS.cameraDistanceOffset : 0}
      />
      <InteractionSystem player={player} />
    </>
  );
}
