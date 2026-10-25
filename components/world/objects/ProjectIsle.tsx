"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, useTexture } from "@react-three/drei";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Object3D,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  type Texture,
} from "three";
import { projects } from "@/lib/projects";
import {
  findIsleScreen,
  type ProjectIsle as ProjectIsleData,
} from "@/lib/world/layout";
import { INTERACTION, WORLD_COLORS } from "@/lib/world/constants";
import { createFloatingRockGeometry } from "../terrain/FloatingRock";
import { DeepMetalMaterial, FrostRockMaterial, GlassPaneMaterial, SnowFieldMaterial } from "../terrain/materials";
import { inputState } from "../systems/inputState";
import { interactionState } from "../systems/interactionState";
import { MOTION } from "../systems/worldMotion";
import { useNearPlayer } from "../systems/useNearPlayer";
import { usePrefersReducedMotion } from "../systems/usePrefersReducedMotion";
import type { PlayerApi } from "../systems/usePlayerController";
import { useWorldUI } from "../WorldUIContext";

/**
 * 项目屿（蓝图 §4 正式造型 + §8 交互，阶段 3 材质精修）：
 * - 三屿差异化结构：AgehaOS 悬浮终端塔（三层盘 + OS Core + 窗口环轨 + 主屏）、
 *   CS 行情观测环（半环拱 + 24 根滚动行情柱 + 观测台主屏）、
 *   Moss 生态穹舱（玻璃穹 + 程序化苔丘 + 舱外生态监测屏 + 舱内水雾）；
 * - 材质走 materials.tsx 分层体系（岩体磨砂 / 盘面冰雪 / 构架深蓝金属 /
 *   玻璃构件半透明）；Moss 穹舱为 transmission 第 3 个名额（高档渲染，
 *   降级档回落 opacity 版，由 glass 开关门控）；
 * - 真实封面截图的场景内贴图：玩家距屿 <60 才挂载（§11.2 按需加载），
 *   低性能档不加载（程序化暗屏替代）；
 * - 交互：名牌 <10 淡入、<6 或悬停高亮光圈脉冲（MOTION.pulsePeriod
 *   统一节奏）、点击 / E 打开详情面板（数据全部来自 lib/projects.ts）。
 * 全程零逐帧 React 状态（refs / 共享态 / 直接 style 写入）。
 */
export function ProjectIsle({
  isle,
  player,
  screenTextures,
  glass,
  mistCount,
}: {
  isle: ProjectIsleData;
  player: PlayerApi;
  /** 性能档：低档不加载屏幕贴图（§12.1） */
  screenTextures: boolean;
  /** 性能档：transmission 名额（高档才渲染透射玻璃穹） */
  glass: boolean;
  /** Moss 舱内水雾粒子数（随 particleBudget，0 = 关闭） */
  mistCount: number;
}) {
  const project = projects.find((item) => item.slug === isle.slug);
  const screen = findIsleScreen(isle.slug);
  const { openDetail, isMobileLike } = useWorldUI();
  const { gl } = useThree();

  // 移动端交互距离与热区放大（§7 触屏友好：提示/高亮/名牌半径 ×1.4）
  const radiusScale = isMobileLike ? INTERACTION.mobileRadiusScale : 1;
  const nameplateDistance = INTERACTION.nameplateDistance * radiusScale;
  const promptDistance = INTERACTION.promptDistance * radiusScale;

  const rockGeometry = useMemo(
    () => createFloatingRockGeometry(isle.radius, isle.radius * 0.85, 40),
    [isle.radius],
  );
  useEffect(() => () => rockGeometry.dispose(), [rockGeometry]);

  // 屏幕贴图按需挂载（低频：跨越阈值才 set 一次）
  const near = useNearPlayer(player, isle.center, screen?.mountDistance ?? 60);

  const nameplateRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<Group>(null);

  const anchorX = isle.anchor?.offsetX ?? 0;
  const anchorZ = isle.anchor?.offsetZ ?? 0;
  // 名牌高度：塔顶 / 拱顶 / 穹顶各異
  const nameplateY =
    isle.slug === "moss-world" ? 9.0 : isle.slug === "cs-skin-invest" ? 9.4 : 9.6;

  useFrame((state) => {
    const p = player.pos.current as Vector3;
    const d = Math.hypot(
      p.x - isle.center.x,
      p.y - isle.center.y,
      p.z - isle.center.z,
    );

    // 名牌透明度随距离（淡入线随档放大，≤ 半程全显）
    if (nameplateRef.current) {
      const span = nameplateDistance - 5 * radiusScale;
      const opacity = Math.max(
        0,
        Math.min(1, (nameplateDistance - d) / span),
      );
      nameplateRef.current.style.opacity = opacity.toFixed(3);
    }

    // 高亮光圈：<提示距离或悬停时可见，脉冲缩放（MOTION.pulsePeriod 统一节奏，§8）
    if (ringRef.current) {
      const active = d < promptDistance || interactionState.hoverId === isle.id;
      ringRef.current.visible = active;
      if (active) {
        const s =
          1 + Math.sin((state.clock.elapsedTime * Math.PI * 2) / MOTION.pulsePeriod) * 0.05;
        ringRef.current.scale.setScalar(s);
      }
    }
  });

  // 场景交互：悬停 / 点击（拖拽守卫——观察视角的拖拽不触发）。
  // 悬停指针样式写入走模块级 setCanvasCursor（渲染期派生值的命令式写入口）。
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
      {/* 浮石基座 + 雪面（顶面 = 可行走盘面高度；磨砂岩 + 冰雪面分层） */}
      <mesh geometry={rockGeometry} receiveShadow castShadow>
        <FrostRockMaterial />
      </mesh>
      <mesh position={[0, -0.13, 0]} scale={[isle.radius * 0.985, 1, isle.radius * 0.985]} receiveShadow>
        <cylinderGeometry args={[1, 1, 0.26, 40]} />
        <SnowFieldMaterial />
      </mesh>

      {/* 正式造型（§4 三重差异） */}
      <IsleStructure
        isle={isle}
        player={player}
        showScreen={near && screenTextures}
        screenAspect={screen?.aspect ?? 16 / 10}
        screenPath={screen?.path ?? null}
        glass={glass}
        mistCount={mistCount}
      />

      {/* 主题色弱光（§3.3：每屿 1 点光 intensity ≤8） */}
      <pointLight
        color={isle.accentColor}
        intensity={5}
        distance={20}
        decay={2}
        position={[isle.collider.offsetX, 6, isle.collider.offsetZ]}
      />

      {/* 交互代理圆柱（隐形，仅承担 raycast；热区 ≥3 单位，触屏再外扩 1） */}
      <mesh
        position={[isle.collider.offsetX, 7, isle.collider.offsetZ]}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
        onClick={handleClick}
      >
        <cylinderGeometry
          args={[
            isle.collider.radius + (isMobileLike ? 2.5 : 1.5),
            isle.collider.radius + (isMobileLike ? 2.5 : 1.5),
            14,
            12,
          ]}
        />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* 高亮光圈（交互锚点处，cyan 脉冲） */}
      <group ref={ringRef} visible={false} position={[anchorX, 0.06, anchorZ]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[4.1, 4.65, 48]} />
          <meshBasicMaterial
            color={WORLD_COLORS.trailGlow}
            transparent
            opacity={0.55}
            side={DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* 名牌（drei Html → DOM 层，系统字体栈；透明度由距离驱动） */}
      <Html
        position={[isle.collider.offsetX, nameplateY, isle.collider.offsetZ]}
        center
        distanceFactor={16}
        zIndexRange={[20, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div className="world-nameplate" ref={nameplateRef} style={{ opacity: 0 }}>
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

/* ------------------------------ 场景内屏幕 ------------------------------ */

/** 画布指针样式写入（模块级：gl 来自 useThree，组件内赋值触发 immutability 规则） */
function setCanvasCursor(canvas: HTMLCanvasElement, cursor: string): void {
  canvas.style.cursor = cursor;
}

/**
 * 屏幕贴图色彩配置（模块级函数：three 纹理的命令式初始化，
 * 组件内直接赋值会被 react-hooks/immutability 视为渲染期值突变）。
 */
function configureScreenTexture(texture: Texture): void {
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
}

/** 未加载贴图时的程序化暗屏（低性能档 / 远距常态） */
function DimScreen({ width, height }: { width: number; height: number }) {
  return (
    <mesh position={[0, 0, 0.09]}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial
        color="#0E2240"
        emissive={WORLD_COLORS.trailGlow}
        emissiveIntensity={0.12}
        roughness={0.4}
      />
    </mesh>
  );
}

/** 真实截图屏幕面（useTexture，调用方须包 Suspense） */
function ScreenFace({ path, width, height }: { path: string; width: number; height: number }) {
  const texture = useTexture(path);
  useEffect(() => {
    configureScreenTexture(texture);
  }, [texture]);
  return (
    <mesh position={[0, 0, 0.09]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

/** 屏幕控制台：深蓝金属外框 + 贴图面 / 暗屏（贴图按 show 条件挂载） */
function ScreenConsole({
  position,
  rotationY,
  tilt,
  width,
  height,
  path,
  show,
}: {
  position: [number, number, number];
  rotationY: number;
  tilt: number;
  width: number;
  height: number;
  path: string | null;
  show: boolean;
}) {
  return (
    <group position={position} rotation={[tilt, rotationY, 0]}>
      <mesh castShadow>
        <boxGeometry args={[width + 0.3, height + 0.3, 0.18]} />
        <DeepMetalMaterial roughness={0.35} />
      </mesh>
      {show && path ? (
        <Suspense fallback={<DimScreen width={width} height={height} />}>
          <ScreenFace path={path} width={width} height={height} />
        </Suspense>
      ) : (
        <DimScreen width={width} height={height} />
      )}
    </group>
  );
}

/* ------------------------------ 三屿正式造型 ------------------------------ */

function IsleStructure({
  isle,
  player,
  showScreen,
  screenAspect,
  screenPath,
  glass,
  mistCount,
}: {
  isle: ProjectIsleData;
  player: PlayerApi;
  showScreen: boolean;
  screenAspect: number;
  screenPath: string | null;
  glass: boolean;
  mistCount: number;
}) {
  if (isle.slug === "agehaos") {
    return (
      <AgehaosTerminal
        center={isle.center}
        player={player}
        showScreen={showScreen}
        screenAspect={screenAspect}
        screenPath={screenPath}
      />
    );
  }
  if (isle.slug === "cs-skin-invest") {
    return (
      <CsObservatory
        showScreen={showScreen}
        screenAspect={screenAspect}
        screenPath={screenPath}
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
    />
  );
}

/** AgehaOS · 悬浮终端塔（§4.1）：三层玻璃盘 + OS Core 十二面体 + 窗口环轨 + 顶层主屏 */
function AgehaosTerminal({
  center,
  player,
  showScreen,
  screenAspect,
  screenPath,
}: {
  center: { x: number; y: number; z: number };
  player: PlayerApi;
  showScreen: boolean;
  screenAspect: number;
  screenPath: string | null;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const coreRef = useRef<Group>(null);
  const cardsRef = useRef<Group>(null);
  const spinRef = useRef(0.45);
  const spreadRef = useRef(0);

  useFrame((_, delta) => {
    const p = player.pos.current as Vector3;
    // 塔心世界距离（本组件位于 isle group 内）
    const d = Math.hypot(p.x - center.x, p.z - center.z);
    // 记忆点（雏形）：玩家 <10 时 OS Core 减速停转、环轨展开；离开恢复
    const near = d < 10;
    // reduced-motion：环境自转停（环轨展开是靠近反馈，瞬时完成不缓动）
    const spinTarget = reducedMotion ? 0 : near ? 0 : 0.45;
    spinRef.current += (spinTarget - spinRef.current) * Math.min(1, 2 * delta);
    if (coreRef.current) coreRef.current.rotation.y += spinRef.current * delta;
    if (cardsRef.current) {
      if (reducedMotion) {
        spreadRef.current = near ? 1 : 0;
      } else {
        spreadRef.current += ((near ? 1 : 0) - spreadRef.current) * Math.min(1, 2 * delta);
      }
      const radius = 2.2 + spreadRef.current * 1.2;
      if (!reducedMotion) cardsRef.current.rotation.y += 0.22 * delta;
      cardsRef.current.children.forEach((child, i) => {
        const angle = (i / 6) * Math.PI * 2;
        child.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      });
    }
  });

  return (
    <group>
      {/* 三层玻璃圆盘（半径 6 / 4.5 / 3，螺旋错位；半透明玻璃构件层） */}
      {[6, 4.5, 3].map((radius, i) => (
        <mesh
          key={radius}
          position={[Math.cos(i * 2.1) * 0.5, 2.2 + i * 1.8, Math.sin(i * 2.1) * 0.5]}
          castShadow
        >
          <cylinderGeometry args={[radius, radius, 0.22, 32]} />
          <GlassPaneMaterial opacity={0.5} roughness={0.25} />
        </mesh>
      ))}
      {/* 塔骨柱（深蓝金属层） */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <mesh key={i} position={[Math.cos(angle) * 2.1, 3.4, Math.sin(angle) * 2.1]} castShadow>
            <boxGeometry args={[0.16, 6.8, 0.16]} />
            <DeepMetalMaterial />
          </mesh>
        );
      })}
      {/* OS Core：缓慢自转的十二面体水晶内核 */}
      <group ref={coreRef} position={[0, 7.6, 0]}>
        <mesh castShadow>
          <dodecahedronGeometry args={[1.15, 0]} />
          <meshStandardMaterial
            color="#8FE8FF"
            emissive="#269DFF"
            emissiveIntensity={0.55}
            roughness={0.3}
            flatShading
          />
        </mesh>
        {/* 窗口管理器环轨：小玻璃卡座沿轨道排列，靠近时展开 */}
        <group ref={cardsRef} position={[0, 0, 0]}>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const angle = (i / 6) * Math.PI * 2;
            return (
              <mesh
                key={i}
                position={[Math.cos(angle) * 2.2, 0, Math.sin(angle) * 2.2]}
                rotation={[0, -angle, 0]}
              >
                <boxGeometry args={[0.62, 0.42, 0.06]} />
                <GlassPaneMaterial
                  emissive="#269DFF"
                  emissiveIntensity={0.25}
                  opacity={0.85}
                  roughness={0.2}
                />
              </mesh>
            );
          })}
        </group>
      </group>
      {/* 顶层 16:10 主屏（贴 AgehaOS 真实桌面截图，面朝南向蝶径到达区） */}
      <ScreenConsole
        position={[0, 6.95, 1.55]}
        rotationY={0}
        tilt={-0.16}
        width={2.6}
        height={2.6 / screenAspect}
        path={screenPath}
        show={showScreen}
      />
    </group>
  );
}

/** CS · 行情观测环（§4.2）：半环观测拱 + 24 根滚动行情柱 + 观测台主屏 + 比价仪表 */

/** 柱阵每帧推进（模块级：批量命令式写矩阵/颜色/高度，见 configureScreenTexture 注） */
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
      // 行情波动：双频正弦叠加（全场景唯一持续大动势装置）
      const target =
        1.2 + Math.sin(t * 0.65 + seeds[i]) * 0.55 + Math.sin(t * 1.8 + seeds[i] * 2.1) * 0.28;
      const rising = target > heights[i];
      heights[i] += (target - heights[i]) * 0.07;
      // 正增长段暖色 / 其余冰青（§4.2）
      mesh.setColorAt(i, rising ? colorRising : colorIce);
      colorDirty = true;
    }
    const [x, z] = slots[i];
    dummy.position.set(x, 0.2 + heights[i] / 2, z);
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
}: {
  showScreen: boolean;
  screenAspect: number;
  screenPath: string | null;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const barsRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  // 颜色复用实例（setColorAt 需要 Color，避免逐帧分配）
  const colorRising = useMemo(() => new Color("#FFB36B"), []);
  const colorIce = useMemo(() => new Color("#54E3FF"), []);
  const heights = useMemo(() => {
    // 确定性初始高度（免随机闪烁）
    const arr = new Float32Array(24);
    for (let i = 0; i < 24; i += 1) arr[i] = 1.1 + ((i * 7) % 5) * 0.22;
    return arr;
  }, []);
  const seeds = useMemo(() => {
    const arr = new Float32Array(24);
    for (let i = 0; i < 24; i += 1) arr[i] = (i * 2.399) % (Math.PI * 2);
    return arr;
  }, []);
  // 柱位：外环 12（r 2.05）+ 内环 12（r 1.15），均布
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
    // instanceColor 首次分配（three 需要至少一次 setColorAt 才建缓冲）
    const mesh = barsRef.current;
    if (!mesh) return;
    for (let i = 0; i < 24; i += 1) mesh.setColorAt(i, colorIce);
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [colorIce]);

  useFrame((state) => {
    const mesh = barsRef.current;
    if (!mesh) return;
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
  });

  return (
    <group>
      {/* 半环观测拱（半径 8，立式，东西走向跨过行情柱阵） */}
      <mesh position={[0, 0.3, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <torusGeometry args={[8, 0.32, 12, 56, Math.PI]} />
        <meshStandardMaterial color={WORLD_COLORS.glassEdge} metalness={0.55} roughness={0.35} />
      </mesh>
      {/* 拱脚基座（深蓝金属层） */}
      {[-8, 8].map((x) => (
        <mesh key={x} position={[0, 0.35, x]} castShadow>
          <cylinderGeometry args={[0.55, 0.75, 0.7, 10]} />
          <DeepMetalMaterial />
        </mesh>
      ))}
      {/* 资产曲线柱阵：24 根滚动方柱（instanced）。
          toneMapped=false 直出 instanceColor（阶段 3 浏览器实测修复：Standard+
          白 emissive 0.22 会把 #FFB36B/#54E3FF 洗成近白，暖橙记忆点消失；
          与主屏贴图同语言——数据装置用纯色数据色） */}
      <instancedMesh ref={barsRef} args={[undefined, undefined, 24]} castShadow>
        <boxGeometry args={[0.26, 1, 0.26]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {/* 廊外壁比价仪表（小圆盘刻度，程序化装饰） */}
      {[0, 1, 2].map((i) => {
        const angle = -Math.PI / 3 + (i * Math.PI) / 3;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * 6.4, 1.5 + i * 0.2, Math.sin(angle) * 6.4]}
            rotation={[0, -angle + Math.PI / 2, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.34, 0.34, 0.1, 16]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.3} metalness={0.2} />
          </mesh>
        );
      })}
      {/* 观测台主屏（竖版 3:4，贴线上投资组合页真实截图，面朝南向蝶径到达区） */}
      <ScreenConsole
        position={[0, 1.75, 4.6]}
        rotationY={0}
        tilt={-0.08}
        width={1.9}
        height={1.9 / screenAspect}
        path={screenPath}
        show={showScreen}
      />
    </group>
  );
}

/** Moss World · 生态穹舱（§4.3）：玻璃穹 + 程序化苔丘 + 小植物 + 舱内水雾 + 舱外生态监测屏 */
function MossTerrarium({
  isle,
  showScreen,
  screenAspect,
  screenPath,
  glass,
  mistCount,
}: {
  isle: ProjectIsleData;
  showScreen: boolean;
  screenAspect: number;
  screenPath: string | null;
  /** transmission 第 3 名额（蝶枢翼组 ×2 之外唯一；降级档为 opacity 玻璃） */
  glass: boolean;
  mistCount: number;
}) {
  const { collider } = isle;
  const domeX = collider.offsetX;
  const domeZ = collider.offsetZ;
  const domeR = collider.radius;

  // 苔丘：噪声位移的绿丘（舱内生态零贴图、纯程序化——呼应项目真实特性）
  const moundGeometry = useMemo(() => {
    const geometry = new SphereGeometry(domeR * 0.84, 28, 18);
    const position = geometry.getAttribute("position") as BufferAttribute;
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      const noise =
        Math.sin(x * 1.7 + y * 2.3) * 0.14 + Math.cos(z * 2.1 - y * 1.3) * 0.12;
      const s = 1 + noise;
      position.setXYZ(i, x * s, y * s * 0.45, z * s);
    }
    geometry.computeVertexNormals();
    return geometry;
  }, [domeR]);
  useEffect(() => () => moundGeometry.dispose(), [moundGeometry]);

  // 小植物：固定伪随机布点（茎 + 双叶球，纯程序化）
  const plants = useMemo(() => {
    const list: Array<{ x: number; z: number; h: number; lean: number }> = [];
    for (let i = 0; i < 7; i += 1) {
      const a = (i / 7) * Math.PI * 2 + 0.6;
      const r = domeR * (0.22 + ((i * 13) % 7) * 0.06);
      list.push({
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        h: 0.5 + ((i * 17) % 5) * 0.12,
        lean: ((i * 31) % 10) / 10 - 0.5,
      });
    }
    return list;
  }, [domeR]);

  return (
    <group>
      {/* 玻璃半圆穹舱（全场景唯一「温暖绿意」的生态孤岛；transmission
          第 3 名额——高档透射，降级档回落半透明 Standard） */}
      <mesh position={[domeX, 0.15, domeZ]} castShadow>
        <sphereGeometry args={[domeR, 30, 18, 0, Math.PI * 2, 0, Math.PI / 2]} />
        {glass ? (
          <meshPhysicalMaterial
            color={WORLD_COLORS.glass}
            transmission={0.75}
            thickness={0.8}
            ior={1.35}
            roughness={0.08}
            metalness={0}
            side={DoubleSide}
          />
        ) : (
          <meshStandardMaterial
            color={WORLD_COLORS.glass}
            transparent
            opacity={0.36}
            roughness={0.15}
            metalness={0.05}
            side={DoubleSide}
          />
        )}
      </mesh>
      {/* 穹舱基座环（深蓝金属层） */}
      <mesh position={[domeX, 0.1, domeZ]}>
        <torusGeometry args={[domeR, 0.18, 8, 48]} />
        <DeepMetalMaterial roughness={0.35} />
      </mesh>
      {/* 苔藓丘（噪声位移绿丘） */}
      <mesh geometry={moundGeometry} position={[domeX, 0.1, domeZ]} receiveShadow>
        <meshStandardMaterial color={WORLD_COLORS.mossGreen} roughness={1} flatShading />
      </mesh>
      {/* 程序化小植物（茎 + 叶） */}
      {plants.map((plant, i) => (
        <group
          key={i}
          position={[domeX + plant.x, 0.55, domeZ + plant.z]}
          rotation={[plant.lean * 0.3, plant.lean, 0]}
        >
          <mesh castShadow>
            <cylinderGeometry args={[0.035, 0.055, plant.h, 6]} />
            <meshStandardMaterial color={WORLD_COLORS.mossDeep} roughness={0.9} />
          </mesh>
          <mesh position={[0.1, plant.h * 0.55, 0]} castShadow>
            <sphereGeometry args={[0.14, 8, 6]} />
            <meshStandardMaterial color={WORLD_COLORS.mossGreen} roughness={1} flatShading />
          </mesh>
          <mesh position={[-0.09, plant.h * 0.78, 0.04]} castShadow>
            <sphereGeometry args={[0.11, 8, 6]} />
            <meshStandardMaterial color="#8FDDB4" roughness={1} flatShading />
          </mesh>
        </group>
      ))}
      {/* 中央静止蝶茧（靠近轻颤彩蛋在茧居所；此处为舱内生态成员） */}
      <mesh position={[domeX, 1.7, domeZ]}>
        <capsuleGeometry args={[0.3, 0.7, 6, 12]} />
        <meshStandardMaterial
          color={WORLD_COLORS.mossDeep}
          emissive={WORLD_COLORS.mossGreen}
          emissiveIntensity={0.3}
          roughness={0.6}
        />
      </mesh>
      {/* 舱内悬浮水雾（§4.3：区内局部粒子，极慢环旋；低档 0 粒） */}
      <DomeMist count={mistCount} x={domeX} z={domeZ} radius={domeR} />
      {/* 舱外观景台「生态监测屏」：如实展示本地运行画面，面朝蝶径到达区（西北） */}
      <group position={[(isle.anchor?.offsetX ?? 0) - 0.9, 0, (isle.anchor?.offsetZ ?? 0) + 0.6]}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.13, 1.1, 8]} />
          <DeepMetalMaterial />
        </mesh>
        <ScreenConsole
          position={[0, 1.45, 0]}
          rotationY={-Math.PI * 0.75}
          tilt={-0.14}
          width={2.2}
          height={2.2 / screenAspect}
          path={screenPath}
          show={showScreen}
        />
      </group>
    </group>
  );
}

/** 舱内水雾：确定性布点的 Points，整组极慢环旋（reduced-motion 冻结） */
function DomeMist({
  count,
  x,
  z,
  radius,
}: {
  count: number;
  x: number;
  z: number;
  radius: number;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const groupRef = useRef<Group>(null);
  const pointsGeometry = useMemo(() => {
    const geo = new BufferGeometry();
    const positions = new Float32Array(Math.max(count, 1) * 3);
    for (let i = 0; i < count; i += 1) {
      const a = i * 2.399963;
      const r = radius * 0.78 * Math.sqrt(((i * 41) % 100) / 100);
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = 0.5 + ((i * 29) % 100) / 100 * (radius * 0.62);
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
    <group ref={groupRef} position={[x, 0.15, z]}>
      <points geometry={pointsGeometry}>
        <pointsMaterial
          color="#EAF9FF"
          size={0.18}
          transparent
          opacity={0.3}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
    </group>
  );
}
