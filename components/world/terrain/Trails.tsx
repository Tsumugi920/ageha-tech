"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BoxGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  InstancedMesh,
  Object3D,
  OctahedronGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  PLAZA_MOUTHS,
  PROJECT_ISLES,
  TRAILS,
  mainIslandSurfaceY,
  type Trail,
} from "@/lib/world/layout";
import {
  DECK_CURB_PAD,
  DECK_INLAY,
  DECK_SLAB,
  DECK_TOP_LIFT,
  TRAIL_DECK_IDS,
  buildTrailDeck,
} from "@/lib/world/trailDeck";
import { WORLD_COLORS } from "@/lib/world/constants";
import { createButterflyGlyphGeometry } from "../objects/butterflyShape";
import { CrystalGlowMaterial, DeepMetalMaterial, GlassPaneMaterial } from "./materials";
import { addApproachSnowColor, buildRibbonGeometry } from "./ribbonGeometry";

/**
 * 鳞粉蝶径（R2 重做）：从「等距小方块 + 贴地光带」改为
 * 「深蓝路缘 + 冰石铺面 + 发光中线 + 横向铺装缝 + 两侧低灯 + 径头门架」。
 *
 * 设计意图：
 * - 道路是主岛的空间骨架：起点有门架、终点能看到项目屿；
 * - 铺装连续、有厚度和路缘，不再像一排悬浮台阶；
 * - 灯与门架只用低亮度 emissive，不做大范围辉光，避免抢过建筑。
 *
 * R11.6 分段踏板：跨海的 C 径不再用连续半透明丝带（低机位仰视读作
 * 横跨天空的巨带），改为离散石板踏步——位姿数据来自 lib/world/trailDeck
 * （纯 TS 可测），石板/基石/嵌条以 InstancedMesh 渲染，对象名沿用
 * trail-c-pavement / trail-c-curb / trail-c-line。A/M 径维持丝带视觉。
 *
 * 可行走面仍来自 lib/world/layout 的蝶径带，几何只负责视觉。
 */

const JOINT_STRIDE = 3;

/** 每径主题色（与目标屿 accent 同源） */
function accentFor(trail: Trail): string {
  return (
    PROJECT_ISLES.find((isle) => isle.id === trail.targetIsleId)?.accentColor ??
    WORLD_COLORS.trailGlow
  );
}

/** 径头点 / 前向（门架定位） */
function gateFrame(trail: Trail) {
  const start = trail.controlPoints[0];
  const next = trail.controlPoints[1];
  const dx = next.x - start.x;
  const dz = next.z - start.z;
  const len = Math.hypot(dx, dz) || 1;
  return {
    x: start.x + (dx / len) * 1.1,
    y: start.y,
    z: start.z + (dz / len) * 1.1,
    angle: Math.atan2(dx / len, dz / len),
    nx: dz / len,
    nz: -dx / len,
  };
}

/**
 * 广场 → 三条蝶径的接近铺装（R9）：起点与中央广场的四向扇面入口共用
 * PLAZA_MOUTHS 坐标，路面加暗色路缘与双细边线，不再是「白铺装消失在
 * 白雪里」的一条隐约细线。M 径入口从 22° 移到 12°，与 43° 的出生点
 * 迎宾步道分开，东南侧不再出现两条铺装贴在一起。
 */
const APPROACHES = [
  {
    id: "approach-a",
    trailId: "trail-a",
    controls: [
      [PLAZA_MOUTHS[0].x, PLAZA_MOUTHS[0].z],
      [-5.1, -7.2],
      [-6.0, -12.0],
    ],
  },
  {
    id: "approach-c",
    trailId: "trail-c",
    controls: [
      [PLAZA_MOUTHS[1].x, PLAZA_MOUTHS[1].z],
      [-9.0, 3.3],
      [-15.0, 6.0],
    ],
  },
  {
    id: "approach-m",
    trailId: "trail-m",
    controls: [
      [PLAZA_MOUTHS[2].x, PLAZA_MOUTHS[2].z],
      [8.9, 3.0],
      [14.0, 7.0],
    ],
  },
] as const;

/** 出生点 → 广场迎宾步道：短而宽，接在扇面入口与八边形石台之间 */
const SPAWN_WALK = {
  id: "spawn-walk",
  controls: [
    [PLAZA_MOUTHS[3].x, PLAZA_MOUTHS[3].z],
    [5.15, 5.05],
    [6.15, 6.3],
  ],
} as const;

/** 入口铺装的最大宽度（路面 / 路缘 / 边线） */
const APPROACH_WIDTH = 2.55;

function buildApproachSamples(controls: readonly (readonly [number, number])[]) {
  const curve = new CatmullRomCurve3(
    controls.map(([x, z]) => new Vector3(x, 0, z)),
    false,
    "catmullrom",
    0.4,
  );
  // R11.2：采样 32→48——R11 起伏增强后 hillside 坡度更陡，49 点的
  // 直线段在坡面上仍可能内切；97 点让铺装逐点贴合解析坡面（每顶点
  // 重估 mainIslandSurfaceY）。接缝/灯实例池已同步扩容。
  return curve.getPoints(48).map((point) => ({
    x: point.x,
    y: mainIslandSurfaceY(point.x, point.z) + 0.015,
    z: point.z,
  }));
}

/**
 * 主岛面上的路网折线（R10.1）：三条接近铺装 + 迎宾步道，与路面丝带
 * 用同一份 Catmull-Rom 采样——MainIsland 的「压实雪带」顶点色从这份
 * 数据求距，保证着色永远贴着道路几何走，路面挪了色带不会掉队。
 * 模块级一次生成，运行时零分配。
 */
export const ISLAND_PATH_POLYLINES: ReadonlyArray<
  ReadonlyArray<{ x: number; z: number }>
> = [...APPROACHES, { ...SPAWN_WALK, trailId: null }].map((approach) =>
  buildApproachSamples(approach.controls).map((sample) => ({
    x: sample.x,
    z: sample.z,
  })),
);

/** 改为分段踏板的蝶径集合（数据单源 lib/world/trailDeck） */
const DECK_TRAIL_SET = new Set<string>(TRAIL_DECK_IDS);

export function Trails() {
  // R11.6：跨海蝶径（trail-c）不再生成连续丝带——半透明宽丝带在低机位
  // 读作横跨天空的巨带。可行走面仍来自 layout.ts 解析蝶径带，这里只换
  // 视觉表达：离散石板 + 承托基石 + 板面嵌条（见下方 deck 渲染）。
  const ribbons = useMemo(
    () =>
      TRAILS.filter((trail) => !DECK_TRAIL_SET.has(trail.id)).map((trail) => ({
        id: trail.id,
        accent: accentFor(trail),
        curb: buildRibbonGeometry(trail.samples, trail.width * 1.16, 0.012),
        pavement: buildRibbonGeometry(trail.samples, trail.width * 0.86, 0.045),
        line: buildRibbonGeometry(trail.samples, Math.min(0.24, trail.width * 0.1), 0.062),
        edgeL: buildRibbonGeometry(trail.samples, 0.07, 0.055, -(trail.width / 2 - 0.18)),
        edgeR: buildRibbonGeometry(trail.samples, 0.07, 0.055, trail.width / 2 - 0.18),
      })),
    [],
  );

  const deck = useMemo(() => {
    const trail = TRAILS.find((item) => DECK_TRAIL_SET.has(item.id));
    if (!trail) return null;
    return { trail, built: buildTrailDeck(trail.samples) };
  }, []);

  const deckGeometries = useMemo(() => {
    if (!deck) return null;
    return {
      slab: new BoxGeometry(DECK_SLAB.width, DECK_SLAB.thickness, DECK_SLAB.length),
      curbPad: new BoxGeometry(DECK_CURB_PAD.width, DECK_CURB_PAD.thickness, DECK_CURB_PAD.length),
      inlay: new BoxGeometry(DECK_INLAY.width, DECK_INLAY.thickness, DECK_INLAY.length),
      // R12.0-C（G9）：踏板视觉层——裙边（基石下的一圈半透明薄冰檐）
      // 与冰棱（悬挂在裙边下的锥体），给踏板「有冰体质量」的读感；
      // 纯视觉实例，可行走面 / 碰撞仍完全来自 layout.ts 解析蝶径带
      skirt: new BoxGeometry(
        DECK_CURB_PAD.width + 0.24,
        0.5,
        DECK_CURB_PAD.length + 0.24,
      ),
      icicle: (() => {
        // 锥尖朝下、底部对齐实例原点：实例 y 缩放即冰棱长度
        const cone = new ConeGeometry(0.09, 1, 5).toNonIndexed();
        cone.rotateX(Math.PI);
        cone.translate(0, -0.5, 0);
        return cone;
      })(),
    };
  }, [deck]);

  const approaches = useMemo(
    () =>
      [...APPROACHES, { ...SPAWN_WALK, trailId: null }].map((approach) => {
        const trail = approach.trailId
          ? TRAILS.find((item) => item.id === approach.trailId)
          : undefined;
        const samples = buildApproachSamples(approach.controls);
        const north = approach.id === "approach-a";
        const curbL = buildRibbonGeometry(samples, 0.18, 0.058, -(APPROACH_WIDTH / 2 + 0.03), mainIslandSurfaceY);
        const curbR = buildRibbonGeometry(samples, 0.18, 0.058, APPROACH_WIDTH / 2 + 0.03, mainIslandSurfaceY);
        if (north) {
          addApproachSnowColor(curbL, 0);
          addApproachSnowColor(curbR, 1);
        }
        // 同段横缝也贴合横坡，避免路面修正后留下悬空的直杆。
        const joints = north ? (() => {
          const parts = [];
          for (let i = 2; i < samples.length - 1; i += 4) {
            const s = samples[i];
            const prev = samples[i - 1];
            const next = samples[i + 1];
            const length = Math.hypot(next.x - prev.x, next.z - prev.z);
            const dx = (next.x - prev.x) / length * 0.03;
            const dz = (next.z - prev.z) / length * 0.03;
            parts.push(buildRibbonGeometry([
              { x: s.x - dx, y: s.y, z: s.z - dz },
              { x: s.x + dx, y: s.y, z: s.z + dz },
            ], APPROACH_WIDTH * 0.82, 0.064, 0, mainIslandSurfaceY, 8));
          }
          const merged = mergeGeometries(parts, false);
          parts.forEach((part) => part.dispose());
          return merged;
        })() : null;
        return {
          id: approach.id,
          north,
          joints,
          accent: trail ? accentFor(trail) : WORLD_COLORS.trailGlow,
          samples,
          // 贴合横坡：广场 → 径头的铺装不再在坡面上悬空或切进雪里。
          // 路缘不用整幅宽垫层（在起伏地形上会盖住较窄的路面），
          // 改为两条贴外侧的窄边石，保证路面始终读得出来。
          curbL,
          curbR,
          pavement: buildRibbonGeometry(samples, APPROACH_WIDTH, 0.055, 0, mainIslandSurfaceY, north ? 8 : 1),
          line: buildRibbonGeometry(samples, 0.14, 0.07, 0, mainIslandSurfaceY),
          edgeL: buildRibbonGeometry(samples, 0.055, 0.065, -(APPROACH_WIDTH / 2 - 0.16), mainIslandSurfaceY),
          edgeR: buildRibbonGeometry(samples, 0.055, 0.065, APPROACH_WIDTH / 2 - 0.16, mainIslandSurfaceY),
        };
      }),
    [],
  );

  const slabGeometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const postGeometry = useMemo(() => new CylinderGeometry(0.04, 0.058, 0.5, 5), []);
  const capGeometry = useMemo(() => new OctahedronGeometry(0.11, 0), []);

  useEffect(
    () => () => {
      ribbons.forEach((r) => {
        r.curb.dispose();
        r.pavement.dispose();
        r.line.dispose();
        r.edgeL.dispose();
        r.edgeR.dispose();
      });
      approaches.forEach((a) => {
        a.curbL.dispose();
        a.curbR.dispose();
        a.pavement.dispose();
        a.line.dispose();
        a.edgeL.dispose();
        a.edgeR.dispose();
        a.joints?.dispose();
      });
      slabGeometry.dispose();
      postGeometry.dispose();
      capGeometry.dispose();
      deckGeometries?.slab.dispose();
      deckGeometries?.curbPad.dispose();
      deckGeometries?.inlay.dispose();
      deckGeometries?.skirt.dispose();
      deckGeometries?.icicle.dispose();
    },
    [ribbons, approaches, slabGeometry, postGeometry, capGeometry, deckGeometries],
  );

  const jointRef = useRef<InstancedMesh>(null);
  const postRef = useRef<InstancedMesh>(null);
  const capRef = useRef<InstancedMesh>(null);
  const deckSlabRef = useRef<InstancedMesh>(null);
  const deckCurbRef = useRef<InstancedMesh>(null);
  const deckInlayRef = useRef<InstancedMesh>(null);
  const deckSkirtRef = useRef<InstancedMesh>(null);
  const deckIcicleRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const color = useMemo(() => new Color(), []);

  useLayoutEffect(() => {
    // 铺装缝：每 3 个采样切一条横向浅缝（不是独立石块，避免重复方块感）
    let jointIndex = 0;
    const joints = jointRef.current;
    if (joints) {
      for (const trail of TRAILS) {
        for (let i = 1; i < trail.samples.length; i += JOINT_STRIDE) {
          const s = trail.samples[i];
          const prev = trail.samples[i - 1];
          const angle = Math.atan2(s.x - prev.x, s.z - prev.z);
          dummy.position.set(s.x, s.y + 0.056, s.z);
          dummy.rotation.set(0, angle, 0);
          dummy.scale.set(trail.width * 0.82, 0.012, 0.06);
          dummy.updateMatrix();
          joints.setMatrixAt(jointIndex, dummy.matrix);
          jointIndex += 1;
        }
      }
    }
    // 接近铺装 / 迎宾步道的横向铺装缝：与蝶径同材质，主岛上的路面
    // 读成同一条石路，而不是广场外侧一块无接缝的白板。
    for (const approach of approaches) {
      if (approach.north) continue;
      for (let i = 2; i < approach.samples.length - 1; i += 4) {
        const s = approach.samples[i];
        const prev = approach.samples[i - 1];
        const next = approach.samples[i + 1];
        const angle = Math.atan2(next.x - prev.x, next.z - prev.z);
        dummy.position.set(s.x, s.y + 0.043, s.z);
        dummy.rotation.set(0, angle, 0);
        dummy.scale.set(APPROACH_WIDTH * 0.82, 0.012, 0.06);
        dummy.updateMatrix();
        joints?.setMatrixAt(jointIndex, dummy.matrix);
        jointIndex += 1;
      }
    }
    if (joints) {
      joints.count = jointIndex;
      joints.instanceMatrix.needsUpdate = true;
    }

    // 两侧低灯：每 6 个采样一组成对出现（杆 + 头顶小晶块）
    const posts = postRef.current;
    const caps = capRef.current;
    let lightIndex = 0;
    for (const trail of TRAILS) {
      color.set(accentFor(trail));
      for (let i = 4; i < trail.samples.length - 2; i += 6) {
        const s = trail.samples[i];
        const prev = trail.samples[i - 1];
        const next = trail.samples[i + 1];
        const tx = next.x - prev.x;
        const tz = next.z - prev.z;
        const len = Math.hypot(tx, tz) || 1;
        const sx = (tz / len) * (trail.width / 2 + 0.55);
        const sz = (-tx / len) * (trail.width / 2 + 0.55);
        for (const side of [-1, 1]) {
          const x = s.x + sx * side;
          const z = s.z + sz * side;
          dummy.position.set(x, s.y + 0.24, z);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          if (posts) posts.setMatrixAt(lightIndex, dummy.matrix);
          dummy.position.set(x, s.y + 0.53, z);
          dummy.updateMatrix();
          if (caps) {
            caps.setMatrixAt(lightIndex, dummy.matrix);
            caps.setColorAt(lightIndex, color);
          }
          lightIndex += 1;
        }
      }
    }
    // 入口低灯：四个广场入口各一对，把「广场 → 道路」的门槛标出来。
    // 与径上的等距低灯分开成组，不再沿路均匀撒满。
    for (const approach of [...APPROACHES, { ...SPAWN_WALK, trailId: null }]) {
      const [mouthX, mouthZ] = approach.controls[0];
      const [nextX, nextZ] = approach.controls[1];
      const dx = nextX - mouthX;
      const dz = nextZ - mouthZ;
      const len = Math.hypot(dx, dz) || 1;
      const sideX = (dz / len) * 1.85;
      const sideZ = (-dx / len) * 1.85;
      const trail = approach.trailId
        ? TRAILS.find((item) => item.id === approach.trailId)
        : undefined;
      color.set(trail ? accentFor(trail) : WORLD_COLORS.trailGlow);
      for (const side of [-1, 1]) {
        const x = mouthX + sideX * side;
        const z = mouthZ + sideZ * side;
        const y = mainIslandSurfaceY(x, z);
        dummy.position.set(x, y + 0.24, z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        if (posts) posts.setMatrixAt(lightIndex, dummy.matrix);
        dummy.position.set(x, y + 0.53, z);
        dummy.updateMatrix();
        if (caps) {
          caps.setMatrixAt(lightIndex, dummy.matrix);
          caps.setColorAt(lightIndex, color);
        }
        lightIndex += 1;
      }
    }

    if (posts) {
      posts.count = lightIndex;
      posts.instanceMatrix.needsUpdate = true;
    }
    if (caps) {
      caps.count = lightIndex;
      caps.instanceMatrix.needsUpdate = true;
      if (caps.instanceColor) caps.instanceColor.needsUpdate = true;
    }
  }, [approaches, dummy, color]);

  // R11.6 分段踏板实例：石板（pavement）+ 承托基石（curb）+ 板面嵌条（line）。
  // 三者共享同一批 DeckStep 位姿（嵌条为隔院子集），实例矩阵在此一次写入。
  // R12.0-C（G9）：石板/基石加逐块确定性尺寸微差（±4~5%，只动视觉实例，
  // 不动 trailDeck 位姿数据），打断「等宽等距多米诺」节奏；并写入裙边
  // 与冰棱两组纯视觉实例——冰体质量读感，不注册碰撞。
  useLayoutEffect(() => {
    if (!deck || !deckGeometries) return;
    const slabMesh = deckSlabRef.current;
    const curbMesh = deckCurbRef.current;
    const inlayMesh = deckInlayRef.current;
    if (!slabMesh || !curbMesh || !inlayMesh) return;

    const frac = (value: number) => value - Math.floor(value);
    const slabTop = (s: { y: number }) => s.y + DECK_TOP_LIFT;
    const skirtMesh = deckSkirtRef.current;
    const icicleMesh = deckIcicleRef.current;
    let icicleIndex = 0;
    deck.built.steps.forEach((s, i) => {
      // 逐块尺寸微差（确定性，无 SSR 抖动）：石板与基石各自微缩放
      const slabScale = 0.95 + 0.09 * frac(Math.sin((i + 1) * 12.9898) * 43758.5453);
      const curbScale = 0.96 + 0.07 * frac(Math.sin((i + 3) * 7.3557) * 29157.317);
      dummy.rotation.set(0, s.angle, 0);
      dummy.scale.set(slabScale, 1, slabScale);
      dummy.position.set(s.x, slabTop(s) - DECK_SLAB.thickness / 2, s.z);
      dummy.updateMatrix();
      slabMesh.setMatrixAt(i, dummy.matrix);
      // 基石顶面与石板底面搭接 0.02，读成「石板坐在基石上」
      const slabBottom = slabTop(s) - DECK_SLAB.thickness;
      dummy.scale.set(curbScale, 1, curbScale);
      dummy.position.set(s.x, slabBottom + 0.02 - DECK_CURB_PAD.thickness / 2, s.z);
      dummy.updateMatrix();
      curbMesh.setMatrixAt(i, dummy.matrix);
      // 裙边：基石下的半透明冰檐，顶面插进基石底 0.07
      if (skirtMesh) {
        dummy.scale.set(curbScale, 1, curbScale);
        dummy.position.set(
          s.x,
          slabBottom + 0.02 - DECK_CURB_PAD.thickness - 0.18,
          s.z,
        );
        dummy.updateMatrix();
        skirtMesh.setMatrixAt(i, dummy.matrix);
      }
      // 冰棱：每 3 块踏板挂一对短冰棱，跨海中段两块各挂一根长冰柱
      if (icicleMesh && (i % 3 === 1 || i === 8 || i === 12)) {
        const cosA = Math.cos(s.angle);
        const sinA = Math.sin(s.angle);
        const hang = (localX: number, localZ: number, length: number, width: number) => {
          if (icicleIndex >= deck.built.steps.length * 2) return;
          dummy.rotation.set(0, s.angle, 0);
          dummy.scale.set(width, length, width);
          dummy.position.set(
            s.x + localX * cosA + localZ * sinA,
            slabBottom - 0.42,
            s.z - localX * sinA + localZ * cosA,
          );
          dummy.updateMatrix();
          icicleMesh.setMatrixAt(icicleIndex, dummy.matrix);
          icicleIndex += 1;
        };
        if (i === 8 || i === 12) {
          hang(0, 0, 3.2 + 1.1 * frac(Math.sin(i * 3.37) * 17231.7), 1.6);
        } else {
          const len = 0.45 + 0.85 * frac(Math.sin((i + 2) * 9.117) * 27731.1);
          hang(0.62, 0.3, len, 1);
          hang(-0.58, -0.34, 0.45 + 0.85 * frac(Math.sin((i + 5) * 4.519) * 9127.3), 1);
        }
      }
    });
    slabMesh.count = deck.built.steps.length;
    curbMesh.count = deck.built.steps.length;
    slabMesh.instanceMatrix.needsUpdate = true;
    curbMesh.instanceMatrix.needsUpdate = true;
    // 实例矩阵写入后刷新包围球，避免 frustum culling 用空球误剔除
    slabMesh.computeBoundingSphere();
    curbMesh.computeBoundingSphere();
    if (skirtMesh) {
      skirtMesh.count = deck.built.steps.length;
      skirtMesh.instanceMatrix.needsUpdate = true;
      skirtMesh.computeBoundingSphere();
    }
    if (icicleMesh) {
      icicleMesh.count = icicleIndex;
      icicleMesh.instanceMatrix.needsUpdate = true;
      icicleMesh.computeBoundingSphere();
    }

    deck.built.inlays.forEach((s, i) => {
      dummy.rotation.set(0, s.angle, 0);
      dummy.scale.set(1, 1, 1);
      dummy.position.set(s.x, slabTop(s) + DECK_INLAY.thickness / 2 + 0.005, s.z);
      dummy.updateMatrix();
      inlayMesh.setMatrixAt(i, dummy.matrix);
    });
    inlayMesh.count = deck.built.inlays.length;
    inlayMesh.instanceMatrix.needsUpdate = true;
    inlayMesh.computeBoundingSphere();
  }, [deck, deckGeometries, dummy]);

  return (
    <group>
      {/* 广场 → 径头的接近铺装：路缘 + 石板 + 边线三层，连续接住扇面入口 */}
      {approaches.map((approach) => (
        <group key={approach.id}>
          {[approach.curbL, approach.curbR].map((curb, side) => (
            <mesh key={`curb-${side}`} name={`${approach.id}-curb-${side}`} geometry={curb} receiveShadow>
              {/* R10：路缘从饱和深蓝（#3E6488/m0.12）改为灰蓝石材——
                  边界仍明确，但不再读成画在雪地上的深色描边。
                  R11.1：宽度 0.18→0.15、色再向石材靠一档（#5F82A0），
                  路缘只做「石路收边」而不是深色包边 */}
              <meshStandardMaterial color={approach.north ? "#FFFFFF" : "#5F82A0"} vertexColors={approach.north} roughness={approach.north ? 0.9 : 0.76} metalness={0.05} side={DoubleSide} />
            </mesh>
          ))}
          <mesh name={`${approach.id}-pavement`} geometry={approach.pavement} receiveShadow>
            <meshStandardMaterial color="#B6CEDF" roughness={approach.north ? 0.84 : 0.6} metalness={approach.north ? 0.02 : 0.04} side={DoubleSide} />
          </mesh>
          {approach.joints ? (
            <mesh name={`${approach.id}-joints`} geometry={approach.joints}>
              <meshStandardMaterial color="#9FB9CF" roughness={0.88} side={DoubleSide} />
            </mesh>
          ) : null}
          <mesh name={`${approach.id}-line`} geometry={approach.line}>
            <meshBasicMaterial
              color={approach.accent}
              transparent
              opacity={0.3}
              depthWrite={false}
              side={DoubleSide}
            />
          </mesh>
          {[approach.edgeL, approach.edgeR].map((edge, side) => (
            <mesh key={side} name={`${approach.id}-edge-${side}`} geometry={edge}>
              <meshBasicMaterial
                color="#EAF9FF"
                transparent
                opacity={approach.north ? 0.16 : 0.26}
                depthWrite={false}
                side={DoubleSide}
              />
            </mesh>
          ))}
        </group>
      ))}

      {TRAILS.map((trail) => {
        // R11.6：跨海蝶径走分段踏板（对象名保持 trail-c-pavement/curb/line，
        // R11.5 的 ?hideName= 单对象隔离与运行时枚举继续可用）
        if (DECK_TRAIL_SET.has(trail.id)) {
          if (!deck || !deckGeometries) return null;
          return (
            <group key={trail.id} name={`trail-deck-${trail.id}`}>
              <instancedMesh
                ref={deckSlabRef}
                name={`${trail.id}-pavement`}
                args={[deckGeometries.slab, undefined, deck.built.steps.length]}
                castShadow
                receiveShadow
              >
                {/* 冰石踏板：不透明实体石材——低机位仰视不再出现
                    半透明巨带；微自发光让板底仰视不读作黑幕（R11.2 口径） */}
                <meshStandardMaterial
                  color="#B9D0E0"
                  emissive="#8FB8DC"
                  emissiveIntensity={0.16}
                  roughness={0.55}
                  metalness={0.06}
                />
              </instancedMesh>
              {/* 承托基石（curb 角色）：比石板宽出一圈深色底沿，
                  给每块踏板明确的边界与支撑关系。
                  R11.6：微自发光让仰视时的基石底面保持冰蓝石材读感，
                  不至于在亮天空前变成一排深色剪影（R11.2 口径） */}
              <instancedMesh
                ref={deckCurbRef}
                name={`${trail.id}-curb`}
                args={[deckGeometries.curbPad, undefined, deck.built.steps.length]}
                receiveShadow
              >
                <meshStandardMaterial
                  color="#4E7290"
                  emissive="#4A6F92"
                  emissiveIntensity={0.3}
                  roughness={0.72}
                  metalness={0.05}
                />
              </instancedMesh>
              {/* 板面嵌条（line 角色）：主题色短条，取代跨海连续发光线 */}
              <instancedMesh
                ref={deckInlayRef}
                name={`${trail.id}-line`}
                args={[deckGeometries.inlay, undefined, deck.built.inlays.length]}
              >
                <meshBasicMaterial color={accentFor(trail)} toneMapped={false} />
              </instancedMesh>
              {/* R12.0-C（G9）：裙边——基石下的半透明冰檐，踏板读出冰体质量 */}
              <instancedMesh
                ref={deckSkirtRef}
                name={`${trail.id}-skirt`}
                args={[deckGeometries.skirt, undefined, deck.built.steps.length]}
              >
                <GlassPaneMaterial opacity={0.3} roughness={0.3} />
              </instancedMesh>
              {/* R12.0-C（G9）：冰棱——短冰棱成对悬挂、中段两根长冰柱，
                  纯视觉（可行走面与碰撞来自 layout.ts 解析蝶径带） */}
              <instancedMesh
                ref={deckIcicleRef}
                name={`${trail.id}-icicle`}
                args={[deckGeometries.icicle, undefined, deck.built.steps.length * 2]}
              >
                <meshStandardMaterial
                  color="#D8EDFA"
                  emissive="#9FD4EE"
                  emissiveIntensity={0.14}
                  roughness={0.3}
                  metalness={0.05}
                  flatShading
                />
              </instancedMesh>
              <PathGate trail={trail} />
            </group>
          );
        }
        const r = ribbons.find((item) => item.id === trail.id);
        if (!r) return null;
        return (
          /* R11.4：组与 mesh 全部命名——运行时可经 __AGEHA_SCENE__ 反向
              确认对象身份（路径 ID / 部件类型），排查不再靠文件名推测 */
          <group key={trail.id} name={`trail-ribbon-${trail.id}`}>
            {/* 深蓝路缘：给道路厚度与边界，避免光带直接漂在雪上。
                R10：从饱和深蓝调成灰蓝石材（m0.05）。
                R11.2：自发光让悬空段仰视不读作黑幕。
                R11.3：按蓝图 §2.3「径面为半透明鳞粉光带」将蝶径丝带
                改为半透明（接近铺装仍为实体石材）。
                R11.6：连续丝带只保留在 A/M 径——C 径改为分段踏板
                （见 trail-deck 组），不再有跨海半透明巨带 */}
            <mesh name={`${trail.id}-curb`} geometry={r.curb} receiveShadow>
              <meshStandardMaterial
                color="#3F6079"
                emissive="#7FB0D8"
                emissiveIntensity={0.62}
                roughness={0.74}
                metalness={0.05}
                transparent
                opacity={0.8}
                side={DoubleSide}
              />
            </mesh>
            {/* 冰石铺面：半透明鳞粉光带主体（R11.3） */}
            <mesh name={`${trail.id}-pavement`} geometry={r.pavement} receiveShadow>
              <meshStandardMaterial
                color="#9FB4C4"
                emissive="#D2E4F2"
                emissiveIntensity={0.66}
                roughness={0.6}
                metalness={0.04}
                transparent
                opacity={0.72}
                side={DoubleSide}
              />
            </mesh>
            {/* 中线：低亮度青色导引（加法混合，不做 bloom） */}
            <mesh name={`${trail.id}-line`} geometry={r.line}>
              <meshBasicMaterial
                color={r.accent}
                transparent
                opacity={0.52}
                depthWrite={false}
                blending={AdditiveBlending}
                side={DoubleSide}
              />
            </mesh>
            {/* 侧缘两细线：进一步强化道路连续性 */}
            {[0, 1].map((side) => (
              <mesh
                key={side}
                name={`${trail.id}-edge-${side === 0 ? "l" : "r"}`}
                geometry={side === 0 ? r.edgeL : r.edgeR}
              >
                <meshBasicMaterial
                  color="#EAF9FF"
                  transparent
                  opacity={0.26}
                  depthWrite={false}
                  side={DoubleSide}
                />
              </mesh>
            ))}
            <PathGate trail={trail} />
          </group>
        );
      })}

      {/* 铺装缝（instanced）：切出石材节奏但不增加 draw call。
          R11.2：迎宾步道采样 49 点后接缝总数 = 3×16 + 4×12 = 96，
          池扩到 128 留余量 */}
      <instancedMesh ref={jointRef} args={[slabGeometry, undefined, 128]}>
        <meshStandardMaterial color="#9FB9CF" roughness={0.88} />
      </instancedMesh>

      {/* 路径低灯：细金属杆 + 主题色小晶块（实例化，全场景 3 组） */}
      <instancedMesh ref={postRef} args={[postGeometry, undefined, 96]} castShadow>
        <meshStandardMaterial color="#456C8C" roughness={0.4} metalness={0.58} />
      </instancedMesh>
      <instancedMesh ref={capRef} args={[capGeometry, undefined, 96]}>
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/** 径头门架（R4）：低而轻的双柱 + 蝶形吊牌，替代杆件堆叠 */
function PathGate({ trail }: { trail: Trail }) {
  const frame = gateFrame(trail);
  const accent =
    PROJECT_ISLES.find((isle) => isle.id === trail.targetIsleId)?.accentColor ??
    WORLD_COLORS.trailGlow;
  const glyph = useMemo(() => createButterflyGlyphGeometry(1.15, 8), []);
  useEffect(() => () => glyph.dispose(), [glyph]);

  return (
    <group position={[frame.x, frame.y, frame.z]} rotation={[0, frame.angle, 0]}>
      {/* 门槛石：把门架从「浮在路面上」压回桥面，标出主岛到蝶径的交接 */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[4.2, 0.03, 1.05]} />
        <meshStandardMaterial color="#8FAABF" roughness={0.72} metalness={0.08} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * 2.15, 0.95, 0]}
          rotation={[0, 0, side * 0.03]}
          castShadow
          receiveShadow
        >
          <cylinderGeometry args={[0.09, 0.4, 1.9, 6]} />
          <meshStandardMaterial color="#DFEBF3" roughness={0.45} metalness={0.12} />
        </mesh>
      ))}
      {/* R12.0-C（G9）：柱顶冰晶帽——与导向浮晶同语言，门架远看
          不再是「两根白锥 + 一根黑杆」的工程件 */}
      {[-1, 1].map((side) => (
        <mesh
          key={`cap-${side}`}
          position={[side * 2.15, 2.02, 0]}
          rotation={[side * 0.08, side * 0.6, side * -0.06]}
          scale={[0.13, 0.2, 0.13]}
        >
          <octahedronGeometry args={[1, 0]} />
          <CrystalGlowMaterial
            color={WORLD_COLORS.iceEdge}
            glow={accent}
            intensity={0.5}
            roughness={0.2}
          />
        </mesh>
      ))}
      {/* 细横梁 + 发光内线（R12.0-C：梁体从深金属提亮为灰蓝石材档，
          背视角不再读成悬浮黑杆） */}
      <mesh position={[0, 1.9, 0]} castShadow>
        <boxGeometry args={[4.05, 0.065, 0.1]} />
        <DeepMetalMaterial color="#7BA0BC" roughness={0.32} />
      </mesh>
      <mesh position={[0, 1.85, 0]}>
        <boxGeometry args={[3.1, 0.012, 0.028]} />
        <meshBasicMaterial color={accent} transparent opacity={0.5} depthWrite={false} />
      </mesh>
      {/* 蝶形吊牌：与主蝶枢同源的品牌轮廓，作为每条径的入口标识 */}
      <mesh geometry={glyph} position={[0, 1.55, 0.01]}>
        <meshStandardMaterial
          vertexColors
          transparent
          opacity={0.92}
          roughness={0.26}
          metalness={0.08}
          emissive={accent}
          emissiveIntensity={0.2}
          side={DoubleSide}
        />
      </mesh>
      {/* 径头门槛：一条低矮发光带，脚步从此进入蝶径 */}
      <mesh position={[0, 0.075, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.8, 0.26]} />
        <meshBasicMaterial color={accent} transparent opacity={0.2} depthWrite={false} />
      </mesh>
    </group>
  );
}
