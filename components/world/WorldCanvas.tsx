"use client";

import { Suspense, useCallback, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
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
import { AmbientShards } from "./terrain/AmbientShards";
import { SceneEnvironment } from "./terrain/SceneEnvironment";
import { ProjectIsle } from "./objects/ProjectIsle";
import { GalleryNook } from "./objects/GalleryNook";
import { ButterflyCore } from "./objects/ButterflyCore";
import { GuideButterfly } from "./objects/GuideButterfly";
import { ButterflyFlock } from "./objects/ButterflyFlock";
import { SignPost } from "./objects/SignPost";
import { DriftLantern } from "./objects/DriftLantern";
import { usePlayerController } from "./systems/usePlayerController";
import { FollowCamera } from "./systems/FollowCamera";
import { InteractionSystem } from "./systems/InteractionSystem";
import { TeleportSystem } from "./systems/TeleportSystem";
import {
  AdaptiveQuality,
  QualityProvider,
  useQuality,
} from "./systems/AdaptiveQuality";
import { ContextGuard } from "./systems/ContextGuard";
import { resetInputState } from "./systems/inputState";
import type { ResizeObserverCtor } from "./systems/resizePolyfill";

/**
 * 3D 世界 Canvas 根（蓝图 §10）：dpr / 阴影 / 相机初始 / 场景组装。
 * 由 WorldShell 以 next/dynamic ssr:false 装载（Next 16 SSR 安全）。
 * 卸载时复位共享输入态；几何 / 纹理清理在各组件 useEffect 内完成。
 * resizePolyfill：原生 ResizeObserver 失效的 WebView 下注入测量兜底。
 *
 * 阶段 4：场景组装改为 QualityProvider 内消费动态档位（初始档由设备形态
 * 静态选择，此后 AdaptiveQuality 按实测帧时间升降——DPR setDpr 即时生效、
 * 粒子/远景/贴图随重渲生效、阴影由 ShadowToggle effect 动态开关）。
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
  const initialTier = pickInitialTier(isMobileLike);
  const fov = isMobileLike ? CAMERA_LIMITS.fovMobile : CAMERA_LIMITS.fovDesktop;

  // 卸载时复位共享输入 / 相机状态，防止跨会话残留
  useEffect(() => () => resetInputState(), []);

  const handleCreated = useCallback(() => {
    onReady();
  }, [onReady]);

  return (
    <Canvas
      className="world-canvas"
      shadows={initialTier.shadows !== false}
      dpr={[1, initialTier.dprMax]}
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
      <QualityProvider isMobileLike={isMobileLike}>
        <WorldScene isMobileLike={isMobileLike} />
      </QualityProvider>
    </Canvas>
  );
}

/**
 * 阴影管线动态开关（模块级命令式入口：gl/scene 来自 useThree 的派生值，
 * 组件内直接成员赋值触发 react-hooks/immutability，同 TeleportSystem 模式）。
 * 关档释放阴影贴图显存；开关都改变 shader 定义，需标记材质重编译。
 */
function applyShadowPipeline(
  gl: { shadowMap: { enabled: boolean } },
  scene: { traverse(callback: (object: unknown) => void): void },
  enabled: boolean,
): void {
  gl.shadowMap.enabled = enabled;
  if (!enabled) {
    scene.traverse((object) => {
      const light = object as {
        isLight?: boolean;
        shadow?: { map?: { dispose(): void } | null } | null;
      };
      if (light.isLight && light.shadow?.map) {
        light.shadow.map.dispose();
        light.shadow.map = null;
      }
    });
  }
  scene.traverse((object) => {
    const material = (object as { material?: unknown }).material;
    if (!material) return;
    const list = Array.isArray(material) ? material : [material];
    for (const item of list) {
      (item as { needsUpdate?: boolean }).needsUpdate = true;
    }
  });
}

/**
 * 阴影动态开关（阶段 4）：档位切换时同步 renderer 阴影管线。
 * 低频运行（仅在升降档时执行一次 traverse）。
 */
function ShadowToggle() {
  const { tier } = useQuality();
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);

  useEffect(() => {
    const enabled = tier.shadows !== false;
    if (gl.shadowMap.enabled === enabled) return;
    applyShadowPipeline(gl, scene, enabled);
  }, [tier, gl, scene]);

  return null;
}

/** 场景组装（Canvas 内）：雾 / 光 / 地形 / 蝶三件套 / 三屿 / 信灯 / 相机 / 交互 */
function WorldScene({ isMobileLike }: { isMobileLike: boolean }) {
  const player = usePlayerController(isMobileLike);

  return (
    <SceneContent player={player} isMobileLike={isMobileLike} />
  );
}

function SceneContent({
  player,
  isMobileLike,
}: {
  player: ReturnType<typeof usePlayerController>;
  isMobileLike: boolean;
}) {
  const { tier } = useQuality();
  // transmission 名额（§3.2 ≤3）：高档 = 蝶枢翼组 ×2 + Moss 穹舱 ×1
  const glass = tier.transmissionBudget > 0;
  const shadowsEnabled = tier.shadows !== false;

  return (
    <>
      {/* 线性雾（§2.3：near 70 / far 260，色 #CFEBFF） */}
      <fog attach="fog" args={[WORLD_FOG.color, WORLD_FOG.near, WORLD_FOG.far]} />

      {/* 阶段 4 系统：帧率自适应 / 阴影动态开关 / WebGL 上下文守卫 */}
      <AdaptiveQuality />
      <ShadowToggle />
      <ContextGuard />

      {/* 环境反射：程序化 PMREM（零外部 HDR；金属 / 玻璃的冰蓝反射来源） */}
      <SceneEnvironment />

      {/* 光照（§3.3）：晨光平行光（东北 35° 仰角，投影只罩主岛+蝶枢）+ 半球光 */}
      <hemisphereLight
        color={WORLD_COLORS.hemiSky}
        groundColor={WORLD_COLORS.hemiGround}
        intensity={0.55}
      />
      <directionalLight
        color={WORLD_COLORS.sunLight}
        intensity={1.25}
        position={[46, 40, -34]}
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

      {/* 环境：天空穹 / 云层 / 冰海 / 远景浮岛 / 浮晶中景 */}
      <SkyDome />
      <CloudLayer tier={tier} />
      <IceSea />
      <DistantIsles tier={tier} />
      <AmbientShards
        count={Math.round((34 * tier.distantIsles) / 7)}
      />

      {/* 近景：主岛 / 石碑与导向标 / 三条蝶径 / 三座项目屿 / 茧居所旋径 */}
      <MainIsland />
      <SignPost />
      <Trails />
      {PROJECT_ISLES.map((isle) => (
        <ProjectIsle
          key={isle.id}
          isle={isle}
          player={player}
          screenTextures={tier.screenTextures}
          glass={glass}
          mistCount={Math.floor(tier.particleBudget / 5)}
        />
      ))}
      <GalleryNook player={player} screenTextures={tier.screenTextures} />

      {/* 蝶三件套：蝶枢（世界核心）/ 引导蝶（导航角色）/ 星尘蝶群（氛围+彩蛋） */}
      <ButterflyCore glass={glass} />
      <GuideButterfly player={player} />
      <Suspense fallback={null}>
        <ButterflyFlock player={player} tier={tier} />
      </Suspense>

      {/* 角色 / 相机 / 交互 / 传送 */}
      <DriftLantern player={player} />
      <FollowCamera
        player={player}
        distanceOffset={isMobileLike ? MOBILE_MODIFIERS.cameraDistanceOffset : 0}
        alignWeight={isMobileLike ? MOBILE_MODIFIERS.cameraAlignWeight : 0.4}
      />
      <InteractionSystem player={player} />
      <TeleportSystem player={player} />
    </>
  );
}
