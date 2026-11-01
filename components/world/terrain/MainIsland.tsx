"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  type BufferGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  DoubleSide,
  InstancedMesh,
  Object3D,
  RingGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  MAIN_ISLAND,
  PLAZA_MOUTHS,
  SPAWN_POINT,
  TRAIL_BEACONS,
  TRAILS,
  mainIslandSurfaceY,
} from "@/lib/world/layout";
import { WORLD_COLORS } from "@/lib/world/constants";
import {
  createBoulderGeometry,
  createCrystalSprayGeometry,
  createIslandTopGeometry,
  createLayeredIslandGeometry,
} from "./islandGeometry";
import { ISLAND_PATH_POLYLINES } from "./Trails";
import {
  CrystalGlowMaterial,
  DeepMetalMaterial,
  FrostRockMaterial,
  SnowFieldMaterial,
} from "./materials";

/**
 * 苏醒环礁（主岛）：分层浮岛 + 起伏雪原 + 中央蝶枢广场 + 南缘观景台。
 *
 * 勘察结论（R2）：
 * - 旧版 = 倒锥 lathe + 一枚圆柱雪盘，侧面只有一圈轮廓线，顶面纯平；
 * - 新版把视觉体量拆成「雪原 / 雪檐 / 岩缘 / 中层岩壁 / 深部尖脊」五层，
 *   岩体逐段角度扰动 + 竖向错层，顶面加入 ≤0.25 的装饰性起伏；
 * - 可行走面仍以 lib/world/layout 的解析平面为准（y=0），起伏只影响视觉，
 *   浮游信灯的悬浮高度足以覆盖 —— 不动碰撞 / 相机 / 传送数据。
 * - 中央广场与南缘观景台重新给出「空间组织」，而不是靠散落小物件填空。
 */

/** 视觉地表高度（与贴地碰撞同源：lib/world/layout 的雪原高度场） */
function reliefAt(x: number, z: number): number {
  return mainIslandSurfaceY(x, z);
}

/**
 * 物件落点（R7）：取足迹范围内的最低地表，避免岩石 / 树根 / 雪丘
 * 在坡面上单侧悬空；视觉贴地，不参与碰撞。
 */
function supportAt(x: number, z: number, radius: number): number {
  const r = Math.max(0, radius);
  const d = r * 0.72;
  return Math.min(
    reliefAt(x, z),
    reliefAt(x + r, z),
    reliefAt(x - r, z),
    reliefAt(x, z + r),
    reliefAt(x, z - r),
    reliefAt(x + d, z + d),
    reliefAt(x - d, z + d),
    reliefAt(x + d, z - d),
    reliefAt(x - d, z - d),
  );
}

/* ------------------------------ 布点（确定性） ------------------------------ */

/**
 * 布点原则（R9）：四组岩簇各守一个区域边缘，簇内允许一块主石 + 一块伴石，
 * 簇与簇之间留出雪面；不再沿岛缘均匀撒点。
 * - 西岭岩簇（C 径以北）/ 东北花园岩簇（冰池北岸）/ 北径东侧岩簇 /
 *   A 径外侧与西南观景位各一块；
 * - 每块岩的足迹与旁边树干、灌木、径带至少留 0.4m 净距（R8 西岭的
 *   「树干插进岩石」在此修正）；
 * - 体量大的岩块压到中景，初始画面前景只保留低伏小石。
 */
type BoulderSpot = {
  x: number;
  z: number;
  scale: number;
  squash: number;
  rot: number;
  shade: number;
  /** 五种种子几何：主岩 / 宽扁岩 / 斜棱岩 / 小卵石 / 风蚀岩 */
  variant: 0 | 1 | 2 | 3 | 4;
  /** 水平两轴各自的拉伸，避免所有石头只是整体放大 */
  stretchX?: number;
  stretchZ?: number;
  tiltX?: number;
  tiltZ?: number;
};

const BOULDERS: readonly BoulderSpot[] = [
  // 西岭岩簇：主岩 + 两块不同轮廓的伴石，与西侧林留出净距
  { x: -12.8, z: -3.7, scale: 1.05, squash: 0.74, rot: 0.4, shade: 0, variant: 0, stretchX: 1.12, stretchZ: 0.88, tiltX: 0.03, tiltZ: -0.04 },
  { x: -11.4, z: -4.9, scale: 0.55, squash: 0.66, rot: 2.1, shade: 1, variant: 3, stretchX: 0.88, stretchZ: 1.08, tiltX: -0.06, tiltZ: 0.05 },
  { x: -14.0, z: -2.0, scale: 0.62, squash: 0.78, rot: 4.2, shade: 2, variant: 4, stretchX: 0.94, stretchZ: 0.82, tiltX: 0.04, tiltZ: 0.03 },
  // 东北花园岩簇：冰池北岸的两块低石，与东侧林共同框住水景
  { x: 11.6, z: 0.1, scale: 0.68, squash: 0.62, rot: 1.1, shade: 1, variant: 2, stretchX: 1.16, stretchZ: 0.9, tiltX: -0.02, tiltZ: 0.05 },
  { x: 13.1, z: 1.3, scale: 0.42, squash: 0.64, rot: 5.1, shade: 0, variant: 3, stretchX: 1.0, stretchZ: 0.86, tiltX: -0.04, tiltZ: 0.02 },
  // 北径东侧岩簇：主石 + 低伏伴石，和两株针叶树一起夹出北径门洞
  { x: 3.2, z: -9.2, scale: 0.68, squash: 0.62, rot: 0.8, shade: 2, variant: 4, stretchX: 1.1, stretchZ: 0.9, tiltX: 0.03, tiltZ: -0.05 },
  { x: 4.6, z: -10.4, scale: 0.4, squash: 0.56, rot: 2.7, shade: 1, variant: 1, stretchX: 0.86, stretchZ: 1.06, tiltX: -0.03, tiltZ: 0.04 },
  // A 径西侧的低伏石，压住路肩转折
  { x: -8.4, z: -9.1, scale: 0.5, squash: 0.58, rot: 4.6, shade: 2, variant: 1, stretchX: 0.92, stretchZ: 1.1, tiltX: 0.04, tiltZ: -0.03 },
  // 西南观景位低伏岩块（与冰冠乔木 / 晶簇成组）
  { x: -7.4, z: 9.7, scale: 0.4, squash: 0.54, rot: 1.9, shade: 1, variant: 2, stretchX: 0.92, stretchZ: 1.1, tiltX: 0.05, tiltZ: -0.02 },
  // ---- R11 地貌组合扩补：岩石跟随新高地落位（背风面 / 坡折 / 脊下） ----
  // 西岭露岩丘南麓：主石坐露岩丘 (−8.6,−0.6) 背风侧
  { x: -8.9, z: -2.1, scale: 0.74, squash: 0.68, rot: 3.4, shade: 0, variant: 1, stretchX: 1.14, stretchZ: 0.9, tiltX: -0.05, tiltZ: 0.04 },
  // 西岭肩脊东坡：中石压坡折
  { x: -12.9, z: 0.6, scale: 0.58, squash: 0.62, rot: 5.2, shade: 2, variant: 3, stretchX: 1.05, stretchZ: 0.95, tiltX: 0.04, tiltZ: -0.05 },
  // 东北圆丘凹地：低伏石收住丘缘
  { x: -2.6, z: -9.9, scale: 0.55, squash: 0.6, rot: 1.5, shade: 1, variant: 2, stretchX: 0.95, stretchZ: 1.08, tiltX: 0.03, tiltZ: 0.04 },
  // 冰碛带脊线两侧：一主一伴顺碛脊走向排布
  { x: 12.6, z: -6.4, scale: 0.66, squash: 0.64, rot: 0.6, shade: 0, variant: 4, stretchX: 1.18, stretchZ: 0.88, tiltX: -0.04, tiltZ: 0.05 },
  { x: 9.6, z: -7.7, scale: 0.46, squash: 0.58, rot: 4.0, shade: 2, variant: 0, stretchX: 0.9, stretchZ: 1.1, tiltX: 0.05, tiltZ: -0.03 },
  // 西南洼地东缘：洼地边缘的低界石
  { x: -4.6, z: 9.9, scale: 0.44, squash: 0.56, rot: 2.4, shade: 1, variant: 3, stretchX: 1.02, stretchZ: 0.96, tiltX: -0.03, tiltZ: 0.03 },
];

/**
 * 西南观景雪台：冰冠乔木 / 晶簇 / 岩块的共同基座。
 * R8 移除东池与北径旁两块没有承载物的空雪台——它们只留下两个
 * 与地形脱节的浅色平盘，是「重复装饰」的主要来源。
 */
const SHELVES = [
  { x: -10.2, z: 6.2, radius: 2.1, height: 0.2, rot: 0.3 },
] as const;

/** 崖壁内嵌晶体：只保留 5 处，亮度压低，避免像随机霓虹贴片 */
const CLIFF_CRYSTALS = [
  { angle: 0.72, y: -2.6, r: 0.966, scale: 0.7 },
  { angle: 1.65, y: -4.1, r: 0.955, scale: 0.8 },
  { angle: 3.4, y: -5.0, r: 0.925, scale: 0.72 },
  { angle: 4.25, y: -2.4, r: 0.972, scale: 0.62 },
  { angle: 5.5, y: -3.4, r: 0.956, scale: 0.78 },
] as const;

/**
 * 岛缘冰棱（R7）：数量略增但角度不等距，粗细 / 长度 / 入岩深度错开。
 * 旧版 18 根等距冰棱本身会读成一圈规则齿，和岩层圆盘感叠加在一起。
 */
const RIM_ICICLES = Array.from({ length: 21 }, (_, i) => {
  const angle =
    (i / 21) * Math.PI * 2 +
    0.12 +
    0.17 * Math.sin(i * 2.17 + 0.4) +
    0.05 * Math.sin(i * 5.3 - 1.1);
  const rimRadius = 0.988 + 0.007 * Math.sin(i * 3.1 + 0.8);
  const depthSeed = ((i * 37) % 100) / 100;
  return {
    angle,
    x: Math.cos(angle) * MAIN_ISLAND.semiAxisX * rimRadius,
    z: Math.sin(angle) * MAIN_ISLAND.semiAxisZ * rimRadius,
    y: -0.5 - depthSeed * 0.34,
    length: 0.45 + depthSeed * 1.55,
    radius: 0.1 + ((i * 19) % 100) / 100 * 0.2,
    tilt: ((i % 5) - 2) * 0.06,
  };
});

/** 南缘观景台弧（theta 弧度，椭圆参数角） */
const DECK_START = Math.PI / 2 - 0.58;
const DECK_LENGTH = 1.16;

/** 雪丘布点：低矮风积雪，制造地形起伏与长阴影（不参与碰撞，高度 < 0.3） */
const DRIFTS: ReadonlyArray<{
  x: number;
  z: number;
  rot: number;
  scale: [number, number, number];
  offset: [number, number, number];
  sub: [number, number, number];
}> = [
  // 西南雪埂：放在 C 径与迎宾步道之间，不再横穿任何入口
  { x: -6.0, z: 5.0, rot: 0.35, scale: [2.35, 0.13, 1.05], offset: [1.1, -0.05, 0.4], sub: [1.0, 0.09, 0.5] },
  // 西岭林脚低雪堆，收住 C 径北侧的坡脚
  { x: -10.6, z: 0.4, rot: -0.2, scale: [1.95, 0.12, 0.95], offset: [0.8, -0.05, 0.35], sub: [0.85, 0.09, 0.46] },
  // ---- R11：跟随新地貌补两处——东北丘原凹地的背风积雪 + 观景台内侧浅雪盆的盆缘雪埂 ----
  { x: -4.4, z: -9.4, rot: 0.7, scale: [1.8, 0.11, 0.9], offset: [0.7, -0.04, 0.3], sub: [0.78, 0.08, 0.42] },
  { x: 7.6, z: 9.4, rot: -0.5, scale: [1.7, 0.1, 0.85], offset: [-0.6, -0.04, 0.35], sub: [0.72, 0.08, 0.4] },
];

/**
 * 针叶树三种形态（R5.1）：
 * - spire 霜松：4 层窄锥，顶端积雪，做林地竖向主调；
 * - broad 雪杉：3 层宽锥，压住林地外缘；
 * - wind 斜冠松：5 层逐层偏移的窄冠，给同种树一组不一样的风蚀轮廓。
 * 每株在形态之外再叠加独立的宽/高比例与轻微倾斜，避免同形树只靠等比
 * 缩放区分；顶端雪色直接烘进冠层几何，不再外挂会「悬空」的雪帽。
 */
type PineForm = "spire" | "broad" | "wind";
type PineSpot = {
  x: number;
  z: number;
  scale: number;
  rot: number;
  form: PineForm;
  /** 横向比例（<1 更瘦，>1 更宽） */
  width?: number;
  /** 纵向比例（高度变化，同时带动树干） */
  height?: number;
  /** 轻微根部倾斜（弧度），避免所有树都垂直站成一排 */
  lean?: number;
};

/**
 * R9 布点：三组林，各自与一组岩石 / 水景 / 道路入口成组。
 * - 西岭林：退到 C 径以北的岛脊，树冠不再与西岭岩石穿插；
 * - 东池林：退到冰池北岸，作为花园背景，不压住广场与 M 径；
 * - 北径林：两株分列北径东侧，与两块岩石一起形成门洞，不占道路中线。
 */
const PINES: readonly PineSpot[] = [
  { x: -14.6, z: -0.6, scale: 1.05, rot: 0.2, form: "spire", height: 1.1, width: 0.94, lean: 0.02 },
  { x: -13.5, z: 1.6, scale: 0.78, rot: 1.7, form: "broad", height: 0.94, width: 1.05, lean: -0.03 },
  { x: -15.1, z: 2.5, scale: 0.62, rot: 2.9, form: "wind", height: 0.98, width: 0.9, lean: 0.06 },
  { x: 12.6, z: -4.4, scale: 0.95, rot: -0.4, form: "spire", height: 0.96, width: 1.02, lean: -0.025 },
  { x: 13.8, z: -2.7, scale: 0.78, rot: 1.2, form: "broad", height: 0.94, width: 1.04, lean: 0.02 },
  { x: 12.9, z: -0.8, scale: 0.64, rot: 2.6, form: "wind", height: 1.04, width: 0.88, lean: 0.04 },
  { x: 0.6, z: -10.2, scale: 0.8, rot: 0.9, form: "spire", height: 1.12, width: 0.9, lean: -0.02 },
  { x: -3.2, z: -11.2, scale: 0.68, rot: 2.2, form: "broad", height: 0.92, width: 1.08, lean: 0.01 },
  // ---- R11：植被跟随四区地貌补植（背风凹地成簇，不排成行） ----
  // 西岭露岩丘背风侧（东南麓）：一高一矮压住坡折
  { x: -8.2, z: -3.4, scale: 0.88, rot: 3.8, form: "spire", height: 1.04, width: 0.92, lean: 0.03 },
  { x: -7.6, z: -4.3, scale: 0.6, rot: 5.0, form: "wind", height: 0.96, width: 0.9, lean: -0.04 },
  // 西岭肩脊南洼：单株 broad 收边
  { x: -12.2, z: 2.1, scale: 0.7, rot: 0.7, form: "broad", height: 0.9, width: 1.06, lean: 0.02 },
  // 东北丘原与冰碛带各补一株，接住两片高地的林线
  { x: 2.6, z: -10.6, scale: 0.74, rot: 1.9, form: "spire", height: 1.06, width: 0.94, lean: -0.03 },
  { x: 10.2, z: -8.4, scale: 0.66, rot: 4.4, form: "wind", height: 1.0, width: 0.9, lean: 0.05 },
  // ---- R12.0-C（G11）：南麓补植——此前南/东南开阔雪原完全没有树，
  // 分布南北失衡。两株落在浅雪盆缘与东南凹谷（背风凹地成簇的延续），
  // 避开出生视线走廊 / 观景台铺装带 / 迎宾步道与 M 径接近段
  { x: 1.4, z: 10.9, scale: 0.62, rot: 2.1, form: "wind", height: 1.0, width: 0.9, lean: 0.05 },
  { x: 9.4, z: 8.4, scale: 0.78, rot: 0.8, form: "broad", height: 0.94, width: 1.05, lean: -0.02 },
] as const;

type PineTier = {
  radius: number;
  height: number;
  y: number;
  dx: number;
  dz: number;
  sides: number;
  color: string;
  /** 各层绕自身轴的旋转，打散同形冠层的棱线对齐 */
  twist?: number;
};

const PINE_FORMS: Record<PineForm, { tiers: readonly PineTier[] }> = {
  // R12.0-C（G11）：冠层色整体提亮半档并向青灰-冰绿偏移——远处树冠
  // 不再读成一排深青剪影，与雪原的明度关系更近
  spire: {
    tiers: [
      { radius: 0.66, height: 1.36, y: 0.93, dx: 0.02, dz: 0.01, sides: 7, color: "#457788", twist: 0.15 },
      { radius: 0.53, height: 1.12, y: 1.62, dx: -0.03, dz: 0.02, sides: 7, color: "#56909F", twist: 0.55 },
      { radius: 0.4, height: 0.92, y: 2.24, dx: 0.03, dz: -0.01, sides: 6, color: "#6AA8B4", twist: 0.95 },
      { radius: 0.26, height: 0.66, y: 2.79, dx: -0.01, dz: 0.01, sides: 6, color: "#93C6CE", twist: 1.2 },
    ],
  },
  broad: {
    tiers: [
      { radius: 0.94, height: 1.16, y: 0.78, dx: 0.02, dz: 0, sides: 8, color: "#518294", twist: 0.2 },
      { radius: 0.75, height: 0.96, y: 1.43, dx: -0.03, dz: 0.02, sides: 7, color: "#649DA9", twist: 0.7 },
      { radius: 0.53, height: 0.78, y: 1.99, dx: 0.01, dz: -0.01, sides: 6, color: "#9FCED7", twist: 1.1 },
    ],
  },
  wind: {
    tiers: [
      { radius: 0.56, height: 1.18, y: 0.94, dx: 0.06, dz: 0.01, sides: 6, color: "#44798B", twist: 0.1 },
      { radius: 0.46, height: 1.0, y: 1.6, dx: 0.13, dz: -0.02, sides: 6, color: "#5794A3", twist: 0.6 },
      { radius: 0.36, height: 0.88, y: 2.18, dx: 0.22, dz: 0.02, sides: 5, color: "#6FACB8", twist: 1.0 },
      { radius: 0.25, height: 0.66, y: 2.72, dx: 0.3, dz: -0.01, sides: 5, color: "#8AC0C8", twist: 1.4 },
      { radius: 0.14, height: 0.42, y: 3.12, dx: 0.36, dz: 0.01, sides: 5, color: "#A0CCD4", twist: 1.7 },
    ],
  },
};

/**
 * 同一形态的层叠锥冠烘成一份几何（顶点色区分层高），单次实例化。
 * R12.0-C（G11）：积雪从「只有顶层」扩到上两层——顶层全强度、
 * 次顶层半强度，中距离树冠也能读出积雪层次，不再只是深色锥体。
 */
function buildPineFoliage(form: (typeof PINE_FORMS)[PineForm]): BufferGeometry {
  const snow = new Color("#EDF8FE");
  const parts = form.tiers.map((tier, tierIndex) => {
    const cone = new ConeGeometry(tier.radius, tier.height, tier.sides, 1).toNonIndexed();
    cone.rotateY(tier.twist ?? 0);
    cone.translate(tier.dx, tier.y, tier.dz);
    const base = new Color(tier.color);
    const tierFromTop = form.tiers.length - 1 - tierIndex;
    const frostStrength = tierFromTop === 0 ? 0.82 : tierFromTop === 1 ? 0.4 : 0;
    const count = cone.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      let color = base;
      if (frostStrength > 0) {
        const y = cone.getAttribute("position").getY(i) - tier.y;
        const t = Math.max(0, Math.min(1, y / tier.height + 0.5));
        const frost = t < 0.55 ? 0 : (t - 0.55) / 0.45;
        color = base
          .clone()
          .lerp(snow, frost * frost * (3 - 2 * frost) * frostStrength);
      }
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    cone.setAttribute("color", new BufferAttribute(colors, 3));
    return cone;
  });
  const merged = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  if (!merged) throw new Error("针叶树冠几何合并失败");
  merged.computeVertexNormals();
  merged.computeBoundingSphere();
  return merged;
}

type ArborBlob = readonly [number, number, number, number];
type ArborSpot = {
  x: number;
  z: number;
  scale: number;
  rot: number;
  lean?: number;
  blobs: readonly ArborBlob[];
};

/** 冰冠乔木：圆冠轮廓；两株各守西南观景位与北径口，冠团形态不同 */
const ARBORS: readonly ArborSpot[] = [
  {
    x: -9.2,
    z: 8.6,
    scale: 0.82,
    rot: 0.3,
    lean: 0.02,
    // R12.0-C（G11）：冠团横向舒展 + 补一小团——远处不再读成
    // 「细杆顶一颗白球」的棒棒糖剪影
    blobs: [
      [0, 2.06, 0, 0.86],
      [0.52, 1.78, 0.2, 0.58],
      [-0.38, 2.34, -0.22, 0.5],
      [0.1, 2.52, -0.3, 0.34],
    ],
  },
  {
    x: 7.2,
    z: -10.1,
    scale: 0.72,
    rot: 1.6,
    lean: -0.03,
    blobs: [
      [0, 1.98, 0, 0.8],
      [-0.46, 1.76, 0.14, 0.56],
      [0.3, 2.24, 0.24, 0.48],
      [0.06, 2.52, -0.18, 0.32],
    ],
  },
];

/**
 * 低矮冰灌木：只作四组簇群的「脚边尺度参照」，每处至多一株；
 * 不再出现在广场与径带之间（R8 个别灌木陷进岩石 / 树冠）。
 */
const SHRUBS = [
  { x: -13.5, z: 0.4, scale: 0.55 },
  { x: -9.2, z: -8.0, scale: 0.38 },
  { x: 12.4, z: 2.3, scale: 0.5 },
  { x: -8.9, z: 9.5, scale: 0.44 },
  { x: 7.9, z: -10.9, scale: 0.36 },
  // ---- R11：补到新高地坡脚，保持「岩簇脚边尺度参照」的用法 ----
  { x: -12.6, z: -2.6, scale: 0.42 },
  { x: -10.4, z: 3.4, scale: 0.46 },
  { x: 6.2, z: -9.6, scale: 0.4 },
  { x: 11.6, z: -2.6, scale: 0.44 },
  // R12.0-C（G11）：南麓浅雪盆北缘补一株，接住新补植的松树
  { x: 0.2, z: 9.8, scale: 0.38 },
] as const;

/**
 * 晶体收敛（R5.1）：两处地面晶簇 + 冰池两组晶簇。
 * 降低细长「发光针」的比例：晶柱更粗、更矮，并保留一段低矮伴生晶；
 * 同组晶柱合并成一份几何，材质只给一个主题色。
 */
type CrystalTone = { color: string; glow: string; intensity: number };

const GROUND_CRYSTAL_SHARDS = [
  { height: 1.48, radius: 0.32, tiltZ: 0.05 },
  { x: 0.42, z: 0.18, height: 0.98, radius: 0.23, tiltZ: -0.26, spin: 0.5 },
  { x: -0.34, z: 0.3, height: 0.7, radius: 0.17, tiltZ: 0.28, spin: -0.4 },
  { x: 0.06, z: -0.32, height: 0.52, radius: 0.12, tiltX: 0.2, spin: 0.9 },
] as const;

const BASIN_CRYSTAL_SHARDS = [
  { height: 0.8, radius: 0.25, tiltZ: 0.04 },
  { x: 0.2, z: 0.1, height: 0.54, radius: 0.17, tiltZ: -0.28, spin: 0.4 },
  { x: -0.16, z: 0.14, height: 0.38, radius: 0.11, tiltZ: 0.24, spin: -0.5 },
] as const;

// ---- R11：晶簇扩到四处，跟随西岭肩脊与冰碛脊高点（低亮度不改） ----
const CRYSTAL_CLUSTERS: readonly {
  x: number;
  z: number;
  scale: number;
  rot: number;
  /** 位于雪台上方时抬升底座，避免晶簇埋进台面 */
  lift?: number;
  tone: CrystalTone;
}[] = [
  {
    x: -10.2,
    z: 6.9,
    scale: 0.85,
    rot: 0.6,
    lift: 0.32,
    tone: { color: "#DFF7FF", glow: "#54E3FF", intensity: 0.26 },
  },
  {
    x: 6.3,
    z: -8.9,
    scale: 0.6,
    rot: 2.3,
    tone: { color: "#9CD9FF", glow: "#7CC8FF", intensity: 0.22 },
  },
  {
    x: -13.4,
    z: -0.2,
    scale: 0.66,
    rot: 1.3,
    tone: { color: "#DFF7FF", glow: "#54E3FF", intensity: 0.24 },
  },
  {
    x: 10.8,
    z: -7.0,
    scale: 0.58,
    rot: 4.1,
    tone: { color: "#9CD9FF", glow: "#7CC8FF", intensity: 0.2 },
  },
] as const;

/* ------------------------------ 贴壁岩与岛裙（R11） ------------------------------ */

/**
 * headland 剖面的半径查表（与 islandGeometry.PROFILES.headland 同步，
 * 只读用于把贴壁岩压进岩壁而不是悬在空中）。返回 0~1 的半径系数。
 */
function headlandRadiusAt(yFrac: number): number {
  const table: ReadonlyArray<readonly [number, number]> = [
    [0, 0.952], [0.022, 0.966], [0.058, 0.978], [0.1, 0.994],
    [0.152, 0.958], [0.212, 0.988], [0.318, 0.924], [0.368, 0.89],
    [0.452, 0.94], [0.545, 0.828], [0.652, 0.776], [0.72, 0.8],
    [0.802, 0.596], [0.856, 0.482], [0.918, 0.364], [0.966, 0.226],
    [1, 0.072],
  ];
  const f = Math.max(0, Math.min(1, yFrac));
  for (let i = 1; i < table.length; i += 1) {
    if (f <= table[i][0]) {
      const [t0, r0] = table[i - 1];
      const [t1, r1] = table[i];
      const k = (f - t0) / (t1 - t0 || 1);
      return r0 + (r1 - r0) * k;
    }
  }
  return 0.072;
}

/**
 * 贴壁岩布点（R11）：a=角度，f=深度比（0 顶 1 底，y = −17.5·f），
 * s=缩放，rx/rz 水平两轴拉伸，ry 纵向压扁，rot/tilt 姿态。
 * 四组群贴着西 / 东南 / 北 / 东崖的岩檐与坡折，另留 4 块散块；
 * 半径取剖面半径 × 0.99——岩块半嵌入岩壁，风化脱落的岩块感。
 */
const WALL_ROCKS: ReadonlyArray<{
  a: number;
  f: number;
  s: number;
  rx: number;
  rz: number;
  ry: number;
  rot: number;
  tilt: number;
}> = [
  // 西崖组群（侧视机位主景）
  { a: 0.38, f: 0.13, s: 1.3, rx: 1.35, rz: 1.0, ry: 0.6, rot: 0.5, tilt: 0.1 },
  { a: 0.55, f: 0.22, s: 1.0, rx: 1.2, rz: 0.9, ry: 0.55, rot: 1.4, tilt: -0.06 },
  { a: 0.68, f: 0.34, s: 1.15, rx: 1.3, rz: 1.05, ry: 0.62, rot: 2.3, tilt: 0.12 },
  { a: 0.3, f: 0.45, s: 0.9, rx: 1.15, rz: 0.95, ry: 0.5, rot: 4.1, tilt: -0.1 },
  // 东南崖组群（入口机位可见）
  { a: 5.75, f: 0.15, s: 1.2, rx: 1.25, rz: 1.0, ry: 0.58, rot: 0.9, tilt: 0.08 },
  { a: 5.95, f: 0.3, s: 0.95, rx: 1.2, rz: 0.9, ry: 0.52, rot: 3.2, tilt: -0.12 },
  { a: 6.05, f: 0.5, s: 1.1, rx: 1.3, rz: 1.0, ry: 0.6, rot: 5.0, tilt: 0.1 },
  // 北崖组群
  { a: 3.95, f: 0.18, s: 1.05, rx: 1.2, rz: 0.95, ry: 0.55, rot: 1.8, tilt: -0.05 },
  { a: 4.2, f: 0.36, s: 1.25, rx: 1.3, rz: 1.05, ry: 0.62, rot: 2.9, tilt: 0.14 },
  { a: 4.35, f: 0.55, s: 0.85, rx: 1.15, rz: 0.9, ry: 0.5, rot: 0.2, tilt: -0.08 },
  // 东崖组群
  { a: 4.95, f: 0.25, s: 0.95, rx: 1.2, rz: 0.95, ry: 0.54, rot: 3.7, tilt: 0.06 },
  { a: 5.15, f: 0.44, s: 1.15, rx: 1.28, rz: 1.0, ry: 0.6, rot: 1.1, tilt: -0.1 },
  // 散块：填空不排布
  { a: 1.6, f: 0.3, s: 0.8, rx: 1.1, rz: 0.9, ry: 0.5, rot: 2.6, tilt: 0.05 },
  { a: 2.6, f: 0.5, s: 1.0, rx: 1.2, rz: 0.95, ry: 0.55, rot: 4.4, tilt: -0.06 },
  { a: 1.15, f: 0.62, s: 0.9, rx: 1.15, rz: 0.9, ry: 0.52, rot: 5.4, tilt: 0.08 },
  { a: 3.1, f: 0.16, s: 0.85, rx: 1.1, rz: 0.9, ry: 0.5, rot: 0.7, tilt: -0.04 },
];

/**
 * 岛裙碎石（R11）：贴着深部尖脊下段的 8~10 块大碎石，低角度看主岛时
 * 给底部一圈不规则的岩裙轮廓，替代「倒锥收成一点」的几何光秃感。
 */
const APRON_ROCKS: ReadonlyArray<{ a: number; f: number; s: number; rx: number; ry: number }> = [
  { a: 0.5, f: 0.93, s: 1.6, rx: 1.3, ry: 0.7 },
  { a: 1.1, f: 0.97, s: 1.05, rx: 1.15, ry: 0.62 },
  { a: 2.2, f: 0.94, s: 1.4, rx: 1.25, ry: 0.68 },
  { a: 3.3, f: 0.96, s: 1.15, rx: 1.2, ry: 0.64 },
  { a: 4.1, f: 0.92, s: 1.65, rx: 1.3, ry: 0.72 },
  { a: 4.9, f: 0.95, s: 1.1, rx: 1.15, ry: 0.6 },
  { a: 5.7, f: 0.93, s: 1.45, rx: 1.28, ry: 0.7 },
  { a: 0.15, f: 0.97, s: 0.9, rx: 1.1, ry: 0.6 },
  { a: 2.75, f: 0.99, s: 0.8, rx: 1.05, ry: 0.58 },
];

/** 贴壁岩按深度取岩层分带色（与岩体五带一致的冷蓝灰） */
const WALL_ROCK_PALETTES = [
  new Color("#8FA9BE"), // 上部风化灰
  new Color("#6B8BA6"), // 中部蓝灰
  new Color("#4A6D91"), // 深部
  new Color("#39587D"), // 深渊
] as const;

function wallRockColor(yFrac: number, seed: number): Color {
  const band =
    yFrac < 0.2 ? 0 : yFrac < 0.5 ? 1 : yFrac < 0.8 ? 2 : 3;
  const color = new Color(WALL_ROCK_PALETTES[band]);
  // 面级微差（确定性哈希），避免同一组岩块明度全同
  const jitter = (Math.sin(seed * 127.1) * 43758.5453) % 1;
  color.multiplyScalar(0.92 + Math.abs(jitter) * 0.16);
  return color;
}

/* ------------------------------ 路缘散布（R11） ------------------------------ */

/**
 * 迎宾步道 / 径头衔接段的路缘碎石与雪丘（确定性布点）：
 * 沿 ISLAND_PATH_POLYLINES 每 2 个采样取 1 处，侧向偏移 2.3~4.3m
 * （可行走半宽 1.6m 之外），避开广场 r<8.6、冰池 4.4m、导向标 1.6m
 * 与岛缘 10% 收束带。石头 / 雪丘贴地（supportAt），不参与碰撞。
 */
type PathEdgeSpot = {
  x: number;
  z: number;
  y: number;
  scale: number;
  rot: number;
  squash: number;
  shade: number;
};

function buildPathEdgeScatter(): { stones: PathEdgeSpot[]; lumps: PathEdgeSpot[] } {
  const stones: PathEdgeSpot[] = [];
  const lumps: PathEdgeSpot[] = [];
  ISLAND_PATH_POLYLINES.forEach((polyline, lineIndex) => {
    for (let i = 2; i < polyline.length - 4; i += 2) {
      const a = polyline[i];
      const b = polyline[i + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len;
      const nz = dx / len;
      // 确定性伪随机（与全站约定一致：无 RNG，SSR 稳定）
      const h1 = ((i * 37 + lineIndex * 91) % 100) / 100;
      const h2 = ((i * 53 + lineIndex * 17) % 100) / 100;
      const h3 = ((i * 29 + lineIndex * 61) % 100) / 100;
      const side = h1 > 0.5 ? 1 : -1;
      const lateral = 2.3 + h2 * 2.0;
      const x = a.x + nx * lateral * side + dx * 0.25 * (h3 - 0.5);
      const z = a.z + nz * lateral * side + dz * 0.25 * (h3 - 0.5);
      // 避让：广场 / 冰池 / 岛缘收束带
      if (Math.hypot(x, z) < 8.6) continue;
      if (Math.hypot(x - 8, z + 2) < 4.4) continue;
      const ex = x / MAIN_ISLAND.semiAxisX;
      const ez = z / MAIN_ISLAND.semiAxisZ;
      if (Math.hypot(ex, ez) > 0.9) continue;
      // 避让导向标落点
      const nearBeacon = TRAIL_BEACONS.some(
        (beacon) => Math.hypot(beacon.x - x, beacon.z - z) < 1.6,
      );
      if (nearBeacon) continue;
      const y = supportAt(x, z, 0.3) - 0.05;
      const spot: PathEdgeSpot = {
        x,
        z,
        y,
        scale: 0.16 + h1 * 0.2,
        rot: h2 * Math.PI * 2,
        squash: 0.6 + h3 * 0.25,
        shade: i + lineIndex,
      };
      if (h3 > 0.62) lumps.push(spot);
      else stones.push(spot);
    }
  });
  return { stones, lumps };
}

/* ------------------------------ 广场扇面入口（R9） ------------------------------ */

/**
 * 四个入口扇面：从内圈石台（r≈3.6，高程 0.21）向雪面（r≈6.45，高程 0.045）
 * 缓坡收边，把广场与三条接近铺装、出生点迎宾步道接成连续地面。
 * 扇面共用一份几何，仅按入口方位旋转——不新增圆形平台，也不改变可行走面。
 */
const PLAZA_ENTRANCES = PLAZA_MOUTHS.map((mouth) => ({
  id: mouth.id,
  angle: Math.atan2(mouth.z, mouth.x),
}));
const PLAZA_FAN_HALF_ANGLE = (12 * Math.PI) / 180;

function createPlazaFanGeometry(): BufferGeometry {
  const innerRadius = 3.58;
  const outerRadius = 6.45;
  const innerY = 0.21;
  const outerY = 0.045;
  const geometry = new RingGeometry(
    innerRadius,
    outerRadius,
    22,
    5,
    -PLAZA_FAN_HALF_ANGLE,
    PLAZA_FAN_HALF_ANGLE * 2,
  );
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const r = Math.hypot(x, y);
    const t = Math.max(0, Math.min(1, (r - innerRadius) / (outerRadius - innerRadius)));
    const eased = t * t * (3 - 2 * t);
    // RingGeometry 在 XY 平面，局部 z 经 rotation.x=-90° 映射为世界高度
    position.setZ(i, innerY + (outerY - innerY) * eased);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function PlazaFans() {
  const geometry = useMemo(() => createPlazaFanGeometry(), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group>
      {PLAZA_ENTRANCES.map((entrance) => (
        <mesh
          key={entrance.id}
          geometry={geometry}
          rotation={[-Math.PI / 2, 0, -entrance.angle]}
          receiveShadow
        >
          <meshStandardMaterial
            // R12.0-C（G12）：相对雪面再拉开 ~7% 明度（同色相），扇面
            // 铺装在中距离构图里可读，不再融入雪原
            color="#A4BCD0"
            roughness={0.62}
            metalness={0.04}
            side={DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

/** 四条入口嵌线：从中心石台指向四个门洞，是广场唯一的地面导向纹样 */
function EntranceInlays() {
  const ref = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);

  useLayoutEffect(() => {
    PLAZA_ENTRANCES.forEach((entrance, i) => {
      dummy.position.set(
        Math.cos(entrance.angle) * 2.72,
        0.206,
        Math.sin(entrance.angle) * 2.72,
      );
      dummy.rotation.set(0, -entrance.angle, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      ref.current?.setMatrixAt(i, dummy.matrix);
    });
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, PLAZA_ENTRANCES.length]}>
      <boxGeometry args={[1.72, 0.012, 0.3]} />
      <meshStandardMaterial color="#8DA9BF" roughness={0.7} metalness={0.04} />
    </instancedMesh>
  );
}

/**
 * 路旁压实度场（R10.1）：对顶面每个顶点求「距最近道路折线的距离」，
 * 映射为 0~1 压实带——路缘外沿以内全压实，1.9→3.4m 平滑衰减为野雪。
 * 数据源 = Trails 的接近铺装 / 迎宾步道采样 + layout 的三条蝶径采样，
 * 与路面丝带同源，色带永远贴着道路几何走。
 */
function buildPackedField(): (x: number, z: number) => number {
  const segments: Array<{ ax: number; az: number; bx: number; bz: number }> = [];
  const pushPolyline = (polyline: ReadonlyArray<{ x: number; z: number }>) => {
    for (let i = 0; i < polyline.length - 1; i += 1) {
      segments.push({
        ax: polyline[i].x,
        az: polyline[i].z,
        bx: polyline[i + 1].x,
        bz: polyline[i + 1].z,
      });
    }
  };
  TRAILS.forEach((trail) =>
    pushPolyline(trail.samples.map((s) => ({ x: s.x, z: s.z }))),
  );
  ISLAND_PATH_POLYLINES.forEach(pushPolyline);

  return (x: number, z: number): number => {
    let nearest = Infinity;
    for (let i = 0; i < segments.length; i += 1) {
      const seg = segments[i];
      const abx = seg.bx - seg.ax;
      const abz = seg.bz - seg.az;
      const len2 = abx * abx + abz * abz || 1;
      const s = Math.max(
        0,
        Math.min(1, ((x - seg.ax) * abx + (z - seg.az) * abz) / len2),
      );
      const dx = x - (seg.ax + abx * s);
      const dz = z - (seg.az + abz * s);
      const d2 = dx * dx + dz * dz;
      if (d2 < nearest) nearest = d2;
    }
    // R11：压实雪带过渡 1.9-3.4 → 1.8-4.2——路缘雪色渐变更宽，
    // 铺装与野雪之间多一级缓冲，道路读作「雪原上踩实的路」
    const t = Math.max(0, Math.min(1, (Math.sqrt(nearest) - 1.8) / 2.4));
    return 1 - t * t * (3 - 2 * t);
  };
}

export function MainIsland() {
  const rockGeometry = useMemo(
    () =>
      createLayeredIslandGeometry({
        radiusX: MAIN_ISLAND.semiAxisX,
        radiusZ: MAIN_ISLAND.semiAxisZ,
        depth: 17.5,
        seed: 2.17,
        // R11 侧影强化：角向扰动 / 层理倾斜 / 层错 / 扶壁全部加档，
        // 配合 islandGeometry 轮廓波随深度增强——侧影读作风蚀岩壁
        // 而不是一摞规则圆环（顶环不动，雪檐接缝保持覆盖）
        jaggedness: 0.09,
        segments: 120,
        profile: "headland",
        strataTilt: 0.085,
        buttressCount: 7,
        buttressDepth: 0.075,
        layerJitter: 0.028,
        // R12.0-B（G4）：3 条宽幅竖向破口——下半部环带在 3 处被彻底打断，
        // 岩壁从「层叠圆环」变成「被撕开的浮岩」；仅作用于 depthRatio>0.3
        breachCount: 3,
        breachDepth: 0.15,
      }),
    [],
  );

  const topGeometry = useMemo(
    () =>
      createIslandTopGeometry({
        radiusX: MAIN_ISLAND.semiAxisX,
        radiusZ: MAIN_ISLAND.semiAxisZ,
        depth: 17.5,
        seed: 2.17,
        segments: 144,
        rings: 42,
        heightAt: (_theta, _r, x, z) => reliefAt(x, z),
        // 雪檐加深并随角度变化，檐底过渡到岩色；地表按坡度分区染色
        rimDepth: 0.62,
        rimScallop: 0.026,
        // R10：坡面 / 背光 / 洼地染色 0.55→0.62，配合加深的 SNOW_SCULPT
        // 让雪原的明暗分区可读，而不是一整片过曝的白
        slopeTint: 0.62,
        rimRockBlend: 0.85,
        // R10.1：沿路网的压实雪带——地表 / 道路边缘 / 野雪三档可读
        zoneAt: buildPackedField(),
      }),
    [],
  );

  useEffect(
    () => () => {
      rockGeometry.dispose();
      topGeometry.dispose();
    },
    [rockGeometry, topGeometry],
  );

  return (
    <group>
      {/* 岩体：五段岩层 + 逐段凹凸 + 深部尖脊 */}
      <mesh geometry={rockGeometry} receiveShadow castShadow>
        <meshStandardMaterial vertexColors flatShading roughness={0.88} metalness={0.03} />
      </mesh>

      {/* 雪原顶面：起伏 + 雪檐 + 岩缘过渡（视觉层，可行走面仍为解析 y=0）。
          R10：粗糙度 0.56→0.68、metalness 0.04→0.02——雪面的过曝主要来自
          强日光下的宽泛镜面高光，压哑光后顶色分层才读得出来 */}
      <mesh geometry={topGeometry} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.68} metalness={0.02} flatShading />
      </mesh>

      {/* 雪台：三块有目的的地形凸起（观景点 / 装置基座） */}
      <Shelves />

      {/* 中央蝶枢广场（R9）：三层石台 + 四向扇面入口 + 四条嵌线。
          旧版浮空深色圆环、多重环形光带与导流鳍已移除；中心只保留
          一枚低亮度导引环与低矮基座，入口方向由地面铺装本身表达。
          R10：石铺装整体压灰加深（雪顶基调同步下压后，靠色相差与
          粗糙度差区分「石材 / 雪」，而不是靠描边）。 */}
      <group>
        <mesh position={[0, 0.035, 0]} receiveShadow>
          <cylinderGeometry args={[5.38, 5.55, 0.08, 16, 1]} />
          <meshStandardMaterial color="#BACCD9" roughness={0.72} metalness={0.04} />
        </mesh>
        {/* 广场外缘的平嵌石带：给外围一圈可读的边界，不发光、不悬空 */}
        <mesh position={[0, 0.078, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <ringGeometry args={[5.04, 5.3, 16]} />
          <meshStandardMaterial color="#7E9AB3" roughness={0.68} metalness={0.06} side={DoubleSide} />
        </mesh>
        <mesh position={[0, 0.075, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[4.55, 4.78, 0.12, 12, 1]} />
          <meshStandardMaterial color="#86A3BB" roughness={0.62} metalness={0.06} />
        </mesh>
        <mesh position={[0, 0.13, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[3.58, 3.8, 0.14, 12, 1]} />
          <meshStandardMaterial color="#CFE0EE" roughness={0.52} metalness={0.04} />
        </mesh>
        <PlazaFans />
        <EntranceInlays />
        {/* 中央共振基座：低矮、可穿行（R3 起地面动线从蝶枢正下方穿过，
            悬空翼组的碰撞仍保留；R9 只收小体量并降低亮度） */}
        <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.62, 1.78, 0.08, 8]} />
          <DeepMetalMaterial color="#315577" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.245, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.25, 1.4, 48]} />
          <meshBasicMaterial color={WORLD_COLORS.trailGlow} transparent opacity={0.46} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.246, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.22, 48]} />
          <meshBasicMaterial color="#CFF6FF" transparent opacity={0.08} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.72, 0]} rotation={[0.2, 0.5, 0.1]} castShadow>
          <octahedronGeometry args={[0.2, 0]} />
          <CrystalGlowMaterial
            color={WORLD_COLORS.crystal[0]}
            glow={WORLD_COLORS.crystal[1]}
            intensity={0.52}
            roughness={0.12}
          />
        </mesh>
        <mesh name="core-plinth-corona" position={[0, 0.46, 0]}>
          <cylinderGeometry args={[0.16, 0.66, 0.48, 32, 1, true]} />
          <meshBasicMaterial
            color={WORLD_COLORS.trailGlow}
            transparent
            opacity={0.05}
            depthWrite={false}
            side={DoubleSide}
            blending={AdditiveBlending}
          />
        </mesh>
      </group>

      {/* 南缘观景台：弧形冰石铺面 + 低栏杆 + 两盏端灯，作为初始构图前景 */}
      <group>
        <mesh position={[0, 0.03, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[MAIN_ISLAND.semiAxisX, MAIN_ISLAND.semiAxisZ, 1]} receiveShadow>
          <ringGeometry args={[0.912, 0.994, 96, 1, DECK_START, DECK_LENGTH]} />
          <meshStandardMaterial color="#B9D2E4" roughness={0.64} metalness={0.05} side={DoubleSide} />
        </mesh>
        {/* 栏杆：立柱 instanced + 顶杆 Tube 弧线 */}
        <DeckRail />
      </group>

      {/* 东侧冰晶池：主岛中景的一个低矮焦点，组织晶体 / 岩石 / 冰面 */}
      <IceBasin />

      {/* 岩缘扶壁 → 冰棱檐：保留岛侧体积，不再用深色巨石堵住前景 */}
      <RimFringe />

      {/* R11 贴壁岩 + 岛裙碎石：侧影的不规则风化层（可行走面之下） */}
      <WallRocks />

      {/* 嵌入岩壁的低亮度晶体脉（实例化） */}
      <CliffCrystals />

      {/* 出生点：八边形迎宾石台 + 低亮度导引环（R9 起与迎宾步道连成一体，
          不再是雪面上的一枚孤立发光圈） */}
      <group position={[SPAWN_POINT.x, reliefAt(SPAWN_POINT.x, SPAWN_POINT.z), SPAWN_POINT.z]}>
        <mesh position={[0, 0.04, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.72, 1.88, 0.08, 8, 1]} />
          <meshStandardMaterial color="#AFC8DA" roughness={0.58} metalness={0.06} />
        </mesh>
        <mesh position={[0, 0.085, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.08, 1.3, 40]} />
          <meshBasicMaterial color={WORLD_COLORS.trailGlow} transparent opacity={0.28} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.086, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.04, 40]} />
          <meshBasicMaterial color="#DFF7FF" transparent opacity={0.1} depthWrite={false} />
        </mesh>
      </group>

      {/* 雪丘群：风积雪的低矮起伏，补足顶面地形层次与长阴影 */}
      <SnowDrifts />

      {/* R11 路缘散布：步道两侧的碎石与雪丘（可行走带之外） */}
      <PathEdgeDressing />

      {/* 岩簇 / 晶簇 / 植被：少而分组，轮廓各不相同 */}
      <BoulderField />
      <CrystalGarden />
      <FrostGroves />
    </group>
  );
}

/* ------------------------------ 南缘栏杆 ------------------------------ */

function DeckRail() {
  const postRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const count = 19;

  useEffect(() => {
    const mesh = postRef.current;
    if (!mesh) return;
    for (let i = 0; i < count; i += 1) {
      const theta = DECK_START + (i / (count - 1)) * DECK_LENGTH;
      const x = Math.cos(theta) * MAIN_ISLAND.semiAxisX * 0.966;
      const z = Math.sin(theta) * MAIN_ISLAND.semiAxisZ * 0.966;
      const scale = i === 0 || i === count - 1 ? 1.18 : 1;
      dummy.position.set(x, 0.56 * scale, z);
      dummy.rotation.set(0, -theta, 0);
      dummy.scale.set(1, scale, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  const railPoints = useMemo(() => {
    const points: Vector3[] = [];
    for (let i = 0; i <= 32; i += 1) {
      const theta = DECK_START + (i / 32) * DECK_LENGTH;
      points.push(
        new Vector3(
          Math.cos(theta) * MAIN_ISLAND.semiAxisX * 0.966,
          1.02,
          Math.sin(theta) * MAIN_ISLAND.semiAxisZ * 0.966,
        ),
      );
    }
    return points;
  }, []);

  return (
    <group>
      <instancedMesh ref={postRef} args={[undefined, undefined, count]} castShadow>
        <cylinderGeometry args={[0.028, 0.042, 1.02, 6]} />
        <DeepMetalMaterial color="#7397B4" roughness={0.34} />
      </instancedMesh>
      <mesh>
        <tubeGeometry args={[new CatmullRomCurve3(railPoints), 64, 0.04, 6, false]} />
        <DeepMetalMaterial color="#8FB2CD" roughness={0.3} />
      </mesh>
      <mesh position={[0, -0.045, 0]}>
        <tubeGeometry args={[new CatmullRomCurve3(railPoints), 64, 0.018, 5, false]} />
        <meshBasicMaterial color={WORLD_COLORS.trailGlow} transparent opacity={0.3} depthWrite={false} />
      </mesh>
      {[0, 1].map((end) => {
        const theta = DECK_START + end * DECK_LENGTH;
        const x = Math.cos(theta) * MAIN_ISLAND.semiAxisX * 0.966;
        const z = Math.sin(theta) * MAIN_ISLAND.semiAxisZ * 0.966;
        return (
          <group key={end} position={[x, 1.16, z]}>
            <mesh>
              <octahedronGeometry args={[0.16, 0]} />
              <CrystalGlowMaterial
                color={WORLD_COLORS.crystal[0]}
                glow={WORLD_COLORS.trailGlow}
                intensity={1.1}
                roughness={0.15}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/* ------------------------------ 岩脊 / 岩石 / 晶体 / 松 ------------------------------ */

function Shelves() {
  const baseRef = useRef<InstancedMesh>(null);
  const capRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const baseGeometry = useMemo(
    () => createBoulderGeometry(21.3, 1, 0.2),
    [],
  );
  const capGeometry = useMemo(
    () => createBoulderGeometry(8.8, 1, 0.16),
    [],
  );
  useEffect(
    () => () => {
      baseGeometry.dispose();
      capGeometry.dispose();
    },
    [baseGeometry, capGeometry],
  );

  useLayoutEffect(() => {
    SHELVES.forEach((shelf, i) => {
      const y = supportAt(shelf.x, shelf.z, shelf.radius * 0.5);
      dummy.position.set(shelf.x, y + shelf.height * 0.6, shelf.z);
      dummy.rotation.set(0.02, shelf.rot, 0.02);
      dummy.scale.set(shelf.radius * 1.1, shelf.height * 1.2, shelf.radius * 0.9);
      dummy.updateMatrix();
      baseRef.current?.setMatrixAt(i, dummy.matrix);
      dummy.position.set(shelf.x, y + shelf.height * 0.95, shelf.z);
      dummy.rotation.set(-0.02, shelf.rot + 0.4, 0.03);
      dummy.scale.set(shelf.radius * 0.7, 0.1, shelf.radius * 0.62);
      dummy.updateMatrix();
      capRef.current?.setMatrixAt(i, dummy.matrix);
    });
    if (baseRef.current) baseRef.current.instanceMatrix.needsUpdate = true;
    if (capRef.current) capRef.current.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  return (
    <group>
      <instancedMesh
        ref={baseRef}
        args={[baseGeometry, undefined, SHELVES.length]}
        castShadow
      >
        <meshStandardMaterial color="#8DA9C3" roughness={0.85} flatShading />
      </instancedMesh>
      <instancedMesh ref={capRef} args={[capGeometry, undefined, SHELVES.length]}>
        <SnowFieldMaterial color="#E7F4FE" />
      </instancedMesh>
    </group>
  );
}

function CliffCrystals() {
  const ref = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);

  useLayoutEffect(() => {
    CLIFF_CRYSTALS.forEach((crystal, i) => {
      const x = Math.cos(crystal.angle) * MAIN_ISLAND.semiAxisX * crystal.r;
      const z = Math.sin(crystal.angle) * MAIN_ISLAND.semiAxisZ * crystal.r;
      dummy.position.set(x, crystal.y, z);
      dummy.rotation.set(crystal.angle * 0.3, -crystal.angle, 0.35);
      dummy.scale.set(
        0.46 * crystal.scale,
        0.46 * crystal.scale * 1.8,
        0.46 * crystal.scale,
      );
      dummy.updateMatrix();
      ref.current?.setMatrixAt(i, dummy.matrix);
    });
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, CLIFF_CRYSTALS.length]}>
      <octahedronGeometry args={[1, 0]} />
      <CrystalGlowMaterial
        color={WORLD_COLORS.iceEdge}
        glow="#5FC8F2"
        intensity={0.24}
        roughness={0.2}
      />
    </instancedMesh>
  );
}

function SnowDrifts() {
  const mainRef = useRef<InstancedMesh>(null);
  const subRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const mainGeometry = useMemo(
    () => createBoulderGeometry(13.7, 1, 0.14),
    [],
  );
  const subGeometry = useMemo(
    () => createBoulderGeometry(6.2, 0, 0.12),
    [],
  );
  useEffect(
    () => () => {
      mainGeometry.dispose();
      subGeometry.dispose();
    },
    [mainGeometry, subGeometry],
  );

  useLayoutEffect(() => {
    DRIFTS.forEach((drift, i) => {
      const y = supportAt(drift.x, drift.z, Math.max(drift.scale[0], drift.scale[2]) * 0.35);
      dummy.position.set(drift.x, y - 0.02, drift.z);
      dummy.rotation.set(0, drift.rot, 0);
      dummy.scale.set(...drift.scale);
      dummy.updateMatrix();
      mainRef.current?.setMatrixAt(i, dummy.matrix);
      dummy.position.set(
        drift.x + drift.offset[0],
        y + drift.offset[1],
        drift.z + drift.offset[2],
      );
      dummy.rotation.set(0, 0.8, 0);
      dummy.scale.set(...drift.sub);
      dummy.updateMatrix();
      subRef.current?.setMatrixAt(i, dummy.matrix);
    });
    if (mainRef.current) mainRef.current.instanceMatrix.needsUpdate = true;
    if (subRef.current) subRef.current.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  return (
    <group>
      <instancedMesh
        ref={mainRef}
        args={[mainGeometry, undefined, DRIFTS.length]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#EAF5FE" roughness={0.7} flatShading />
      </instancedMesh>
      <instancedMesh
        ref={subRef}
        args={[subGeometry, undefined, DRIFTS.length]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#E1F0FB" roughness={0.74} flatShading />
      </instancedMesh>
    </group>
  );
}

/**
 * 贴壁岩 + 岛裙碎石（R11）：一份扰动岩几何 × 25 实例（1 draw call），
 * 按深度取岩层分带色。半嵌入岩壁的「风化脱落岩块」打破侧影的
 * 规则层环，岛裙给低角度轮廓补上不规则基座。全部位于可行走面
 * 之下（y ≤ −0.9），纯视觉，无碰撞登记。
 */
function WallRocks() {
  const ref = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const geometry = useMemo(() => createBoulderGeometry(33.7, 1, 0.3), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const depth = 17.5;
    let i = 0;
    WALL_ROCKS.forEach((rock) => {
      const radius = headlandRadiusAt(rock.f) * 0.99;
      dummy.position.set(
        Math.cos(rock.a) * MAIN_ISLAND.semiAxisX * radius,
        -depth * rock.f,
        Math.sin(rock.a) * MAIN_ISLAND.semiAxisZ * radius,
      );
      dummy.rotation.set(rock.tilt, rock.rot, rock.tilt * -0.6);
      dummy.scale.set(rock.s * rock.rx, rock.s * rock.ry, rock.s * rock.rz);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, wallRockColor(rock.f, rock.a * 7 + rock.s));
      i += 1;
    });
    APRON_ROCKS.forEach((rock) => {
      const radius = headlandRadiusAt(rock.f) * 1.02;
      dummy.position.set(
        Math.cos(rock.a) * MAIN_ISLAND.semiAxisX * radius,
        -depth * rock.f + rock.s * 0.2,
        Math.sin(rock.a) * MAIN_ISLAND.semiAxisZ * radius,
      );
      dummy.rotation.set(0.08, rock.a * 1.7, -0.06);
      dummy.scale.set(rock.s * rock.rx, rock.s * rock.ry, rock.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, wallRockColor(rock.f, rock.a * 5 + rock.s));
      i += 1;
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [dummy, geometry]);

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, undefined, WALL_ROCKS.length + APRON_ROCKS.length]}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color="#ffffff" roughness={0.9} flatShading />
    </instancedMesh>
  );
}

/**
 * 路缘散布（R11）：碎石 + 雪丘两组实例化（2 draw call），沿迎宾
 * 步道 / 径头衔接段的可行走带之外散布，让路面边缘读作「雪原上
 * 踩实的路」，而不是悬浮铺装。buildPathEdgeScatter 已做避让。
 */
function PathEdgeDressing() {
  const stoneRef = useRef<InstancedMesh>(null);
  const lumpRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const scatter = useMemo(() => buildPathEdgeScatter(), []);
  const stoneGeometry = useMemo(() => createBoulderGeometry(44.1, 0, 0.3), []);
  const lumpGeometry = useMemo(() => createBoulderGeometry(8.3, 0, 0.14), []);
  useEffect(
    () => () => {
      stoneGeometry.dispose();
      lumpGeometry.dispose();
    },
    [stoneGeometry, lumpGeometry],
  );
  const stonePalette = useMemo(
    () => [new Color("#8CA9C2"), new Color("#7A9BB6"), new Color("#A3BDD0")],
    [],
  );

  useLayoutEffect(() => {
    scatter.stones.forEach((spot, i) => {
      if (!stoneRef.current) return;
      dummy.position.set(spot.x, spot.y + spot.scale * 0.4, spot.z);
      dummy.rotation.set(0.05, spot.rot, -0.04);
      dummy.scale.set(spot.scale * 1.25, spot.scale * spot.squash, spot.scale);
      dummy.updateMatrix();
      stoneRef.current.setMatrixAt(i, dummy.matrix);
      stoneRef.current.setColorAt(
        i,
        stonePalette[(spot.shade + spot.scale * 10 | 0) % stonePalette.length],
      );
    });
    if (stoneRef.current) {
      stoneRef.current.instanceMatrix.needsUpdate = true;
      if (stoneRef.current.instanceColor) stoneRef.current.instanceColor.needsUpdate = true;
    }

    scatter.lumps.forEach((spot, i) => {
      if (!lumpRef.current) return;
      dummy.position.set(spot.x, spot.y + spot.scale * 0.18, spot.z);
      dummy.rotation.set(0, spot.rot + 1.1, 0);
      dummy.scale.set(spot.scale * 1.7, spot.scale * 0.52, spot.scale * 1.25);
      dummy.updateMatrix();
      lumpRef.current.setMatrixAt(i, dummy.matrix);
    });
    if (lumpRef.current) lumpRef.current.instanceMatrix.needsUpdate = true;
  }, [dummy, scatter, stonePalette]);

  return (
    <group>
      <instancedMesh
        ref={stoneRef}
        args={[stoneGeometry, undefined, scatter.stones.length]}
        castShadow
      >
        <meshStandardMaterial color="#ffffff" roughness={0.88} flatShading />
      </instancedMesh>
      <instancedMesh
        ref={lumpRef}
        args={[lumpGeometry, undefined, scatter.lumps.length]}
        castShadow
      >
        <meshStandardMaterial color="#EAF5FE" roughness={0.72} flatShading />
      </instancedMesh>
    </group>
  );
}

/**
 * 东侧冰晶池（R9 重新定位）：纯景观水景——不承载交互、不在碰撞 / 可行走
 * 面登记中。R8 前它是一块与广场等宽的高饱和蓝色圆台；R9 收成带石岸的
 * 椭圆形浅冰池，压在 0.3m 雪台上，亮度与尺度都退到中景，与广场形成
 * 「主广场 / 次花园」的层级，而不是第二个蓝色平台。
 */
function IceBasin() {
  const x = 8;
  const z = -2;
  const y = reliefAt(x, z);
  const rimStoneRef = useRef<InstancedMesh>(null);
  const rimCapRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const rim = useMemo(() => {
    const angles = [0.16, 0.92, 1.7, 2.52, 3.42, 4.38, 5.4];
    const scales = [0.24, 0.18, 0.21, 0.16, 0.26, 0.19, 0.15];
    const stretchX = [1.15, 0.9, 1.05, 0.85, 1.2, 0.95, 0.9];
    const stretchZ = [0.9, 1.1, 0.95, 1.15, 0.85, 1.05, 1.1];
    const tilts = [
      [0.02, 0.04],
      [-0.04, 0.02],
      [0.03, -0.03],
      [0.01, 0.05],
      [-0.03, -0.02],
      [0.04, 0.01],
      [-0.02, 0.03],
    ] as const;
    return angles.map((angle, i) => {
      const radius = 2.62 + ((i * 7) % 5) * 0.05;
      return {
        angle,
        // 椭圆岸线：横向略长，与广场的圆台轮廓拉开形态
        x: Math.cos(angle) * radius * 1.04,
        z: Math.sin(angle) * radius * 0.8,
        scale: scales[i],
        stretchX: stretchX[i],
        stretchZ: stretchZ[i],
        tiltX: tilts[i][0],
        tiltZ: tilts[i][1],
      };
    });
  }, []);
  const rimGeometry = useMemo(
    () => createBoulderGeometry(17.9, 0, 0.34),
    [],
  );
  const crystalGeometry = useMemo(
    () => createCrystalSprayGeometry(BASIN_CRYSTAL_SHARDS),
    [],
  );
  useEffect(
    () => () => {
      rimGeometry.dispose();
      crystalGeometry.dispose();
    },
    [rimGeometry, crystalGeometry],
  );

  useLayoutEffect(() => {
    rim.forEach((stone, i) => {
      const localGround =
        reliefAt(x + stone.x, z + stone.z) - y;
      dummy.position.set(stone.x, localGround + 0.04, stone.z);
      dummy.rotation.set(stone.tiltX, -stone.angle, stone.tiltZ);
      dummy.scale.set(
        stone.scale * stone.stretchX,
        stone.scale * 0.48,
        stone.scale * stone.stretchZ,
      );
      dummy.updateMatrix();
      rimStoneRef.current?.setMatrixAt(i, dummy.matrix);
      dummy.position.set(stone.x, localGround + 0.04 + stone.scale * 0.3, stone.z);
      dummy.rotation.set(stone.tiltX, -stone.angle + 0.3, stone.tiltZ);
      dummy.scale.set(
        stone.scale * 0.82 * stone.stretchX,
        stone.scale * 0.07,
        stone.scale * 0.62 * stone.stretchZ,
      );
      dummy.updateMatrix();
      rimCapRef.current?.setMatrixAt(i, dummy.matrix);
    });
    if (rimStoneRef.current) rimStoneRef.current.instanceMatrix.needsUpdate = true;
    if (rimCapRef.current) rimCapRef.current.instanceMatrix.needsUpdate = true;
  }, [rim, dummy, x, y, z]);

  return (
    <group position={[x, y, z]}>
      {/* 石岸：一圈低矮扁石带 + 雪帽，先读成「池塘」再读成「水」 */}
      <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.14, 0.86, 1]} receiveShadow>
        <ringGeometry args={[2.04, 2.42, 48]} />
        <meshStandardMaterial color="#7D9BB1" roughness={0.8} metalness={0.05} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0.042, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.14, 0.86, 1]}>
        <torusGeometry args={[2.42, 0.055, 6, 56]} />
        <meshStandardMaterial color="#728FA8" roughness={0.68} metalness={0.1} />
      </mesh>
      {/* 冰面：低饱和冰壳；R10 粗糙度 0.1→0.16，镜面高光收敛后
          冰面读成「哑光冰壳」而不是亮塑料片 */}
      <mesh position={[0, 0.055, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.14, 0.86, 1]} receiveShadow>
        <circleGeometry args={[2.04, 48]} />
        <meshStandardMaterial
          color="#92D2E6"
          roughness={0.16}
          metalness={0.1}
          emissive="#2E9CC8"
          emissiveIntensity={0.035}
          transparent
          opacity={0.88}
        />
      </mesh>
      {/* 冰裂纹：两条细白线，打破镜面感 */}
      {[
        { len: 2.35, rot: 0.5, x: 0.2, z: 0.1 },
        { len: 1.65, rot: -1.1, x: -0.5, z: 0.3 },
      ].map((crack, i) => (
        <mesh key={i} position={[crack.x, 0.062, crack.z]} rotation={[0, crack.rot, 0]}>
          <boxGeometry args={[crack.len, 0.006, 0.016]} />
          <meshBasicMaterial color="#EFFBFF" transparent opacity={0.32} depthWrite={false} />
        </mesh>
      ))}
      {/* 池岸的一段霜线：只留一段弧，避免再出现一圈完整发光环 */}
      <mesh position={[0, 0.061, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.14, 0.86, 1]}>
        <ringGeometry args={[1.88, 1.92, 48, 1, 0.35, 1.5]} />
        <meshBasicMaterial color={WORLD_COLORS.iceEdge} transparent opacity={0.2} depthWrite={false} />
      </mesh>
      {/* 池岸石与雪帽：同源低面数岩形，各自 1 个 instanced draw call */}
      <instancedMesh
        ref={rimStoneRef}
        args={[rimGeometry, undefined, rim.length]}
        castShadow
      >
        <meshStandardMaterial color="#86A7C0" roughness={0.85} flatShading />
      </instancedMesh>
      <instancedMesh ref={rimCapRef} args={[undefined, undefined, rim.length]}>
        <dodecahedronGeometry args={[1, 0]} />
        <SnowFieldMaterial color="#F0FAFF" />
      </instancedMesh>
      {/* 两组晶簇：北岸与西岸各一组，晶体压低亮度，不与核心建筑争亮 */}
      {[
        {
          angle: 0.42,
          radius: 1.9,
          scale: 0.78,
          tone: {
            color: WORLD_COLORS.crystal[0],
            glow: WORLD_COLORS.trailGlow,
            intensity: 0.2,
          },
        },
        {
          angle: 2.95,
          radius: 1.6,
          scale: 0.58,
          tone: {
            color: WORLD_COLORS.iceEdge,
            glow: "#7CC8FF",
            intensity: 0.17,
          },
        },
      ].map((cluster) => (
        <group
          key={cluster.angle}
          position={[
            Math.cos(cluster.angle) * cluster.radius,
            0.08,
            Math.sin(cluster.angle) * cluster.radius * 0.86,
          ]}
          rotation={[0, -cluster.angle + 0.4, 0]}
        >
          <mesh geometry={crystalGeometry} scale={cluster.scale} castShadow>
            <CrystalGlowMaterial
              color={cluster.tone.color}
              glow={cluster.tone.glow}
              intensity={cluster.tone.intensity}
              roughness={0.16}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** 岛缘冰棱檐：单次实例化，替代旧版深色扶壁巨石 */
function RimFringe() {
  const ref = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    RIM_ICICLES.forEach((ice, i) => {
      dummy.position.set(ice.x, ice.y, ice.z);
      dummy.rotation.set(Math.PI + ice.tilt, -ice.angle, 0);
      dummy.scale.set(ice.radius, ice.length, ice.radius);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, RIM_ICICLES.length]}
      castShadow
    >
      <coneGeometry args={[1, 1, 6]} />
      <meshStandardMaterial
        color="#CBE9F8"
        roughness={0.42}
        metalness={0.03}
        flatShading
        transparent
        opacity={0.92}
      />
    </instancedMesh>
  );
}

/**
 * 岩簇场（R5.1）：五种种子轮廓 + 每簇一主两伴。
 * 大石保留 detail=1 的可读切面，小卵石用 detail=0，面数不升反降；
 * 每块岩石再叠加横向拉伸与双轴倾斜，10 块石头分 5 个 draw call。
 * 雪帽沿用一份低面数几何，但随岩石足迹缩放、下沉，避免「浮在顶上」。
 */
const BOULDER_VARIANTS = [
  { seed: 7.3, jaggedness: 0.28, detail: 1 },
  { seed: 2.9, jaggedness: 0.34, detail: 1 },
  { seed: 11.7, jaggedness: 0.24, detail: 1 },
  { seed: 4.6, jaggedness: 0.32, detail: 0 },
  { seed: 15.2, jaggedness: 0.26, detail: 0 },
] as const;

function BoulderField() {
  const rockRefs = useRef<Array<InstancedMesh | null>>([]);
  const capRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const rockGeometries = useMemo(
    () =>
      BOULDER_VARIANTS.map((variant) =>
        createBoulderGeometry(variant.seed, variant.detail, variant.jaggedness),
      ),
    [],
  );
  const capGeometry = useMemo(
    () => createBoulderGeometry(2.1, 0, 0.16),
    [],
  );
  const palette = useMemo(
    () =>
      // R10：明度档差拉开（中档→最亮档跨两阶），色相统一在冷灰蓝——
      // 旧五色挤在一档窄带里，石头彼此只差一点明度
      // R12.0-C（G8）：最深两档再提亮半档——flatShading 背光面在雪面
      // 上不再读成黑色碎块，最深色留给金属框架类
      [
        new Color("#8CA9C2"),
        new Color("#7B9CB8"),
        new Color("#A3BDD0"),
        new Color("#86A5BF"),
        new Color("#B4CBDB"),
      ],
    [],
  );
  const capPalette = useMemo(
    () => [new Color("#ECF7FF"), new Color("#DDEFFC"), new Color("#F2FAFF")],
    [],
  );

  useEffect(
    () => () => {
      rockGeometries.forEach((geometry) => geometry.dispose());
      capGeometry.dispose();
    },
    [rockGeometries, capGeometry],
  );

  useLayoutEffect(() => {
    const caps = capRef.current;
    const counters = [0, 0, 0, 0, 0];
    BOULDERS.forEach((spot, i) => {
      const y = supportAt(spot.x, spot.z, spot.scale * 0.5);
      const rocks = rockRefs.current[spot.variant];
      const index = counters[spot.variant];
      const stretchX = spot.stretchX ?? 1;
      const stretchZ = spot.stretchZ ?? 1;
      const tiltX = spot.tiltX ?? 0;
      const tiltZ = spot.tiltZ ?? 0;
      counters[spot.variant] += 1;
      dummy.position.set(spot.x, y + 0.16 * spot.scale, spot.z);
      dummy.rotation.set(tiltX, spot.rot, tiltZ);
      dummy.scale.set(
        spot.scale * stretchX,
        spot.scale * spot.squash,
        spot.scale * 0.94 * stretchZ,
      );
      dummy.updateMatrix();
      if (rocks) {
        rocks.setMatrixAt(index, dummy.matrix);
        rocks.setColorAt(index, palette[(spot.shade + spot.variant) % palette.length]);
      }
      if (caps) {
        dummy.position.set(spot.x, y + spot.scale * spot.squash * 0.55, spot.z);
        dummy.rotation.set(tiltX, spot.rot, tiltZ);
        dummy.scale.set(
          spot.scale * 0.7 * stretchX,
          spot.scale * 0.12,
          spot.scale * 0.6 * stretchZ,
        );
        dummy.updateMatrix();
        caps.setMatrixAt(i, dummy.matrix);
        caps.setColorAt(i, capPalette[i % capPalette.length]);
      }
    });
    rockRefs.current.forEach((rocks) => {
      if (!rocks) return;
      rocks.instanceMatrix.needsUpdate = true;
      if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
    });
    if (caps) {
      caps.instanceMatrix.needsUpdate = true;
      if (caps.instanceColor) caps.instanceColor.needsUpdate = true;
    }
  }, [dummy, palette, capPalette]);

  return (
    <group>
      {rockGeometries.map((geometry, variant) => {
        const count = BOULDERS.filter((spot) => spot.variant === variant).length;
        return (
          <instancedMesh
            key={variant}
            ref={(node) => {
              rockRefs.current[variant] = node;
            }}
            args={[geometry, undefined, count]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color="#ffffff" roughness={0.9} flatShading />
          </instancedMesh>
        );
      })}
      <instancedMesh ref={capRef} args={[capGeometry, undefined, BOULDERS.length]}>
        <meshStandardMaterial color="#ffffff" roughness={0.64} flatShading />
      </instancedMesh>
    </group>
  );
}

/** 地面晶簇（R5.1）：共享一份晶柱几何，底座加宽并压进雪面 */
function CrystalCluster({
  x,
  z,
  scale,
  rot,
  lift = 0,
  tone,
  geometry,
}: {
  x: number;
  z: number;
  scale: number;
  rot: number;
  lift?: number;
  tone: CrystalTone;
  geometry: BufferGeometry;
}) {
  const y = supportAt(x, z, 0.5 * scale) + lift;
  return (
    <group position={[x, y, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.1, 0]} scale={[0.9, 0.34, 0.8]} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.7 * scale, 0]} />
        <FrostRockMaterial color="#7C9CB6" />
      </mesh>
      <mesh geometry={geometry} position={[0, 0.08, 0]} scale={scale} castShadow>
        <CrystalGlowMaterial
          color={tone.color}
          glow={tone.glow}
          intensity={tone.intensity}
          roughness={0.16}
        />
      </mesh>
    </group>
  );
}

function CrystalGarden() {
  const geometry = useMemo(
    () => createCrystalSprayGeometry(GROUND_CRYSTAL_SHARDS),
    [],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group>
      {CRYSTAL_CLUSTERS.map((spot) => (
        <CrystalCluster key={`${spot.x}-${spot.z}`} {...spot} geometry={geometry} />
      ))}
    </group>
  );
}

/**
 * 植被三语言（R5.1）：
 * - 霜松 / 雪杉 / 斜冠松：三种冠形，株间再叠加宽高比例与根部倾斜；
 * - 冰冠乔木：细干 + 数量/位置各异的冰白云冠；
 * - 冰灌木：低矮球冠，只压在岩簇脚边做尺度参照。
 * 树顶雪色烘进冠层几何，不再额外挂雪帽；全场景植被共 6 draw call。
 */
function FrostGroves() {
  const foliageRefs = useRef<Record<PineForm, InstancedMesh | null>>({
    spire: null,
    broad: null,
    wind: null,
  });
  const trunkRef = useRef<InstancedMesh>(null);
  const arborTrunkRef = useRef<InstancedMesh>(null);
  const arborCanopyRef = useRef<InstancedMesh>(null);
  const shrubRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const pineCount = PINES.length;
  const formCounts = useMemo(() => {
    const counts: Record<PineForm, number> = { spire: 0, broad: 0, wind: 0 };
    PINES.forEach((tree) => {
      counts[tree.form] += 1;
    });
    return counts;
  }, []);
  const arborCount = ARBORS.length;
  const canopyCount = ARBORS.reduce((sum, tree) => sum + tree.blobs.length, 0);
  const pineTints = useMemo(
    () => [new Color("#FFFFFF"), new Color("#E9F3FA"), new Color("#F2F9FF")],
    [],
  );
  const arborPalette = useMemo(
    () => [new Color("#E8F6FE"), new Color("#D5ECF9"), new Color("#F1FBFF")],
    [],
  );
  const shrubPalette = useMemo(
    () => [new Color("#A9CBE0"), new Color("#98BFD8"), new Color("#B8D6E7")],
    [],
  );

  const pineGeometries = useMemo(
    () => ({
      spire: buildPineFoliage(PINE_FORMS.spire),
      broad: buildPineFoliage(PINE_FORMS.broad),
      wind: buildPineFoliage(PINE_FORMS.wind),
    }),
    [],
  );
  useEffect(
    () => () => {
      Object.values(pineGeometries).forEach((geometry) => geometry.dispose());
    },
    [pineGeometries],
  );

  useLayoutEffect(() => {
    const counters: Record<PineForm, number> = { spire: 0, broad: 0, wind: 0 };
    PINES.forEach((tree, i) => {
      const widthBase = tree.scale * (tree.width ?? 1);
      const y = supportAt(tree.x, tree.z, widthBase * 0.28);
      const width = widthBase;
      const height = tree.scale * (tree.height ?? 1);
      const lean = tree.lean ?? 0;
      const index = counters[tree.form];
      counters[tree.form] += 1;

      if (trunkRef.current) {
        dummy.position.set(tree.x, y + 0.575 * height, tree.z);
        dummy.rotation.set(0, tree.rot, lean);
        dummy.scale.set(width, height, width);
        dummy.updateMatrix();
        trunkRef.current.setMatrixAt(i, dummy.matrix);
      }
      const foliage = foliageRefs.current[tree.form];
      if (foliage) {
        dummy.position.set(tree.x, y, tree.z);
        dummy.rotation.set(0, tree.rot, lean);
        dummy.scale.set(width, height, width);
        dummy.updateMatrix();
        foliage.setMatrixAt(index, dummy.matrix);
        foliage.setColorAt(index, pineTints[index % pineTints.length]);
      }
    });
    if (trunkRef.current) trunkRef.current.instanceMatrix.needsUpdate = true;
    (Object.keys(foliageRefs.current) as PineForm[]).forEach((form) => {
      const foliage = foliageRefs.current[form];
      if (!foliage) return;
      foliage.instanceMatrix.needsUpdate = true;
      if (foliage.instanceColor) foliage.instanceColor.needsUpdate = true;
    });

    let canopyIndex = 0;
    ARBORS.forEach((tree, i) => {
      const y = supportAt(tree.x, tree.z, tree.scale * 0.3);
      if (arborTrunkRef.current) {
        dummy.position.set(tree.x, y + 1.05 * tree.scale, tree.z);
        dummy.rotation.set(0, tree.rot, tree.lean ?? 0);
        dummy.scale.set(tree.scale * 0.94, tree.scale, tree.scale * 0.94);
        dummy.updateMatrix();
        arborTrunkRef.current.setMatrixAt(i, dummy.matrix);
      }
      tree.blobs.forEach((blob, j) => {
        if (!arborCanopyRef.current) return;
        dummy.position.set(
          tree.x + blob[0] * tree.scale,
          y + blob[1] * tree.scale,
          tree.z + blob[2] * tree.scale,
        );
        dummy.rotation.set(0.2 * j, tree.rot + j, 0.15);
        const size = blob[3] * tree.scale;
        dummy.scale.set(size, size * 0.82, size);
        dummy.updateMatrix();
        arborCanopyRef.current.setMatrixAt(canopyIndex, dummy.matrix);
        arborCanopyRef.current.setColorAt(
          canopyIndex,
          arborPalette[(i + j) % arborPalette.length],
        );
        canopyIndex += 1;
      });
    });
    if (arborTrunkRef.current) arborTrunkRef.current.instanceMatrix.needsUpdate = true;
    if (arborCanopyRef.current) {
      arborCanopyRef.current.instanceMatrix.needsUpdate = true;
      if (arborCanopyRef.current.instanceColor) {
        arborCanopyRef.current.instanceColor.needsUpdate = true;
      }
    }

    SHRUBS.forEach((shrub, i) => {
      if (!shrubRef.current) return;
      const y = supportAt(shrub.x, shrub.z, shrub.scale * 0.5);
      dummy.position.set(shrub.x, y + 0.1 * shrub.scale, shrub.z);
      dummy.rotation.set(0.12 * (i % 3), i * 1.7, 0.08);
      dummy.scale.set(shrub.scale, shrub.scale * 0.52, shrub.scale * 0.82);
      dummy.updateMatrix();
      shrubRef.current.setMatrixAt(i, dummy.matrix);
      shrubRef.current.setColorAt(i, shrubPalette[i % shrubPalette.length]);
    });
    if (shrubRef.current) {
      shrubRef.current.instanceMatrix.needsUpdate = true;
      if (shrubRef.current.instanceColor) {
        shrubRef.current.instanceColor.needsUpdate = true;
      }
    }
  }, [dummy, pineCount, arborCount, pineTints, arborPalette, shrubPalette]);

  return (
    <group>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, pineCount]} castShadow>
        <cylinderGeometry args={[0.07, 0.13, 1.15, 5]} />
        <meshStandardMaterial color="#35566F" roughness={0.92} />
      </instancedMesh>
      {(Object.keys(PINE_FORMS) as PineForm[]).map((form) => (
        <instancedMesh
          key={form}
          ref={(node) => {
            foliageRefs.current[form] = node;
          }}
          args={[pineGeometries[form], undefined, formCounts[form]]}
          castShadow
        >
          <meshStandardMaterial vertexColors roughness={0.82} flatShading />
        </instancedMesh>
      ))}

      {/* 冰冠乔木：细干 + 数量/位置各异的冰白云冠 */}
      <instancedMesh ref={arborTrunkRef} args={[undefined, undefined, arborCount]} castShadow>
        <cylinderGeometry args={[0.06, 0.11, 2.1, 6]} />
        <meshStandardMaterial color="#5D7E90" roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={arborCanopyRef} args={[undefined, undefined, canopyCount]} castShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#ffffff" roughness={0.52} flatShading />
      </instancedMesh>

      {/* 低矮冰灌木 */}
      <instancedMesh ref={shrubRef} args={[undefined, undefined, SHRUBS.length]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} flatShading />
      </instancedMesh>
    </group>
  );
}
