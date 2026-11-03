"use client";

import { Suspense, useCallback, useEffect, useLayoutEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ACESFilmicToneMapping, PCFShadowMap } from "three";
import {
  CAMERA_LIMITS,
  WORLD_COLORS,
  WORLD_FOG,
} from "@/lib/world/constants";
import { PROJECT_ISLES } from "@/lib/world/layout";
import { MOBILE_MODIFIERS, pickInitialTier, pickTierOverride } from "@/lib/world/performance";
import { MainIsland } from "./terrain/MainIsland";
import { Trails } from "./terrain/Trails";
import { NorthRouteDressing } from "./terrain/NorthRouteDressing";
import { SkyDome } from "./terrain/SkyDome";
import { CloudLayer } from "./terrain/CloudLayer";
import { IceSea } from "./terrain/IceSea";
import { DistantIsles } from "./terrain/DistantIsles";
import { AmbientShards } from "./terrain/AmbientShards";
import { SceneEnvironment } from "./terrain/SceneEnvironment";
import { ProjectIsle } from "./objects/ProjectIsle";
import { GalleryNook } from "./objects/GalleryNook";
import { MemoryRing } from "./objects/MemoryRing";
import { ButterflyCore } from "./objects/ButterflyCore";
import { GuideButterfly } from "./objects/GuideButterfly";
import { ButterflyFlock } from "./objects/ButterflyFlock";
import { TextureBoundary } from "./systems/TextureBoundary";
import { SignPost } from "./objects/SignPost";
import { DriftLantern } from "./objects/DriftLantern";
import { WorldAudioMotion } from "./systems/WorldAudio";
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
import { WorldDiagnostics } from "./systems/WorldDiagnostics";
import { trackRendererResources } from "./systems/textureLifecycle";
import { SunLight } from "./systems/SunLight";
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
  const initialTier =
    pickTierOverride(
      typeof window === "undefined"
        ? null
        : new URLSearchParams(window.location.search).get("tier"),
    ) ?? pickInitialTier(isMobileLike);
  const fov = isMobileLike ? CAMERA_LIMITS.fovMobile : CAMERA_LIMITS.fovDesktop;

  // 卸载时复位共享输入 / 相机状态，防止跨会话残留
  useEffect(() => () => resetInputState(), []);

  const handleCreated = useCallback(() => {
    onReady();
  }, [onReady]);

  return (
    <Canvas
      className="world-canvas"
      shadows={{ enabled: initialTier.shadows !== false, type: PCFShadowMap }}
      dpr={[Math.min(1, initialTier.dprMax), initialTier.dprMax]}
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
        // 手机上关闭 MSAA：1.25× 渲染分辨率 + 低多边形切面已足够干净，
        // 而 4× MSAA 在移动 GPU 上是实打实的带宽成本。
        antialias: !isMobileLike,
        precision: isMobileLike ? "mediump" : "highp",
        powerPreference: "high-performance",
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: 0.9,
      }}
      onCreated={handleCreated}
    >
      <QualityProvider isMobileLike={isMobileLike} initialTier={initialTier}>
        <WorldScene isMobileLike={isMobileLike} />
      </QualityProvider>
    </Canvas>
  );
}

/**
 * 页面不可见时暂停整条渲染循环（切后台 / 锁屏 / 切标签页）：
 * 既避免无意义的 GPU 占用，也避免把挂起时长误算进性能采样。
 */
function VisibilityPause() {
  const setFrameloop = useThree((state) => state.setFrameloop);

  useEffect(() => {
    const sync = () => {
      setFrameloop(document.visibilityState === "visible" ? "always" : "never");
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      setFrameloop("always");
    };
  }, [setFrameloop]);

  return null;
}

/** Attach before the first render so shared shader defaults are also released on exit. */
function RendererResourceCleanup() {
  const gl = useThree((state) => state.gl);
  useLayoutEffect(() => trackRendererResources(gl), [gl]);
  return null;
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
      {/* 线性雾（R2：near 105 / far 360，近景不再被雾冲淡） */}
      <fog attach="fog" args={[WORLD_FOG.color, WORLD_FOG.near, WORLD_FOG.far]} />

      {/* 阶段 4 系统：帧率自适应 / 阴影动态开关 / WebGL 上下文守卫 / 后台暂停 */}
      <AdaptiveQuality
        isMobileLike={isMobileLike}
        pinned={Boolean(
          typeof window !== "undefined" &&
            new URLSearchParams(window.location.search).has("tier"),
        )}
      />
      <ShadowToggle />
      <ContextGuard />
      <VisibilityPause />
      <RendererResourceCleanup />

      {/* 环境反射：程序化 PMREM（零外部 HDR；金属 / 玻璃的冰蓝反射来源） */}
      <SceneEnvironment />

      {/* 光照（R2）：暖色主光建立明确明暗面 + 冷色半球补暗部 + 反向冷填光。
          R12.0-D（G7）：曝光再平衡——主光 2.7→2.45（雪面向阳坡不再顶到
          近纯白），半球 / 填光各 +12%/+10% 补偿（背光面更透 气），
          总亮度量级不变、方向对比收敛 */}
      <hemisphereLight
        color={WORLD_COLORS.hemiSky}
        groundColor={WORLD_COLORS.hemiGround}
        intensity={0.47}
      />
      <SunLight player={player} shadowsEnabled={shadowsEnabled} />
      {/* 冷色反向填光：只塑形不投影，避免背光面变成死黑 */}
      <directionalLight
        color="#A9DFFF"
        intensity={0.46}
        position={[-34, 22, 34]}
      />
      {/* 冰海反照：极弱自下而上补光，托起浮岛底面（不是第二主光） */}
      <directionalLight color="#BCE4FF" intensity={0.3} position={[-12, -30, 18]} />

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
      <MemoryRing />
      <SignPost />
      <Trails />
      <NorthRouteDressing player={player} />
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
      <TextureBoundary fallback={null}>
        <Suspense fallback={null}>
          <ButterflyFlock player={player} tier={tier} />
        </Suspense>
      </TextureBoundary>

      {/* 角色 / 声音 / 相机 / 交互 / 传送 */}
      <DriftLantern player={player} />
      <WorldAudioMotion player={player} />
      <FollowCamera
        player={player}
        isMobileLike={isMobileLike}
        distanceOffset={isMobileLike ? MOBILE_MODIFIERS.cameraDistanceOffset : 0}
        alignWeight={isMobileLike ? MOBILE_MODIFIERS.cameraAlignWeight : 0.4}
      />
      <InteractionSystem player={player} />
      <TeleportSystem player={player} />
      <WorldDiagnostics player={player} />
    </>
  );
}
