/**
 * 世界空间布局（蓝图 §2.2 坐标表的数据化落地）。
 *
 * 坐标系：three.js 右手系，Y 向上，1 unit ≈ 1m；原点 (0,0,0) = 主岛地面中心，
 * 北 = −Z。施工数据以本文件为准；区域坐标表见 docs/3d-world-blueprint.md §2.2。
 *
 * 本文件为纯 TS（无 JSX、无 three 依赖，向量运算自实现），
 * node --test 直接 import 做数据级校验（tests/world-layout.test.mjs）。
 */
import { WORLD_COLORS } from "./constants.ts";

/* ------------------------------ 基础向量 ------------------------------ */

export type Vec3 = { readonly x: number; y: number; z: number };

const dist2D = (ax: number, az: number, bx: number, bz: number) =>
  Math.hypot(ax - bx, az - bz);

const dist3D = (a: Vec3, b: Vec3) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/**
 * Catmull-Rom 样条采样（uniform，张力 0.5）：控制点 → 采样折线。
 * 自实现而不用 three 的 CatmullRomCurve3，保持本模块 node 可测。
 */
function sampleCatmullRom(points: readonly Vec3[], samplesPerSegment: number): Vec3[] {
  if (points.length < 2) return [...points];
  const pts: Vec3[] = [];
  const p = [points[0], ...points, points[points.length - 1]];
  for (let i = 1; i < p.length - 2; i += 1) {
    const [p0, p1, p2, p3] = [p[i - 1], p[i], p[i + 1], p[i + 2]];
    const last = i === p.length - 3;
    const steps = last ? samplesPerSegment + 1 : samplesPerSegment;
    for (let s = 0; s < steps; s += 1) {
      const t = s / samplesPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      pts.push({
        x:
          0.5 *
          (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
        z:
          0.5 *
          (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
      });
    }
  }
  return pts;
}

/* ------------------------------ 主岛 ------------------------------ */

/** 苏醒环礁（主岛）：椭圆 36×28（半轴 18/13），地面 y=0，岛体下延倒锥至 y=−14 */
export const MAIN_ISLAND = {
  id: "main-island",
  name: "苏醒环礁",
  center: { x: 0, y: 0, z: 0 },
  semiAxisX: 18,
  semiAxisZ: 13,
  groundY: 0,
  coneDepth: 14,
} as const;

/** 出生点：主岛南缘，面北（§7 初始构图） */
export const SPAWN_POINT = { x: 0, y: 0.35, z: 10 } as const;

/** 蝶枢（世界核心）：主岛中心上空 (0,6,0)，环绕观赏不可进入（碰撞见 colliders.ts） */
export const BUTTERFLY_CORE = {
  id: "butterfly-core",
  name: "蝶枢",
  center: { x: 0, y: 6, z: 0 },
  height: 7,
  wingspan: 10,
} as const;

/* ------------------------------ 项目屿 ------------------------------ */

export type ProjectIsle = {
  readonly id: string;
  /** 对应 lib/projects.ts 的 slug（交互入口与数据渲染的关联键） */
  readonly slug: "agehaos" | "cs-skin-invest" | "moss-world";
  readonly name: string;
  readonly center: Vec3;
  /** 岛半径（可行走盘面半径，视觉边缘再外扩 ~1） */
  readonly radius: number;
  readonly accentColor: string;
};

/** 三座作品之屿（§2.2 / §4；造型在阶段 2 落地，阶段 1 为占位体量） */
export const PROJECT_ISLES: readonly ProjectIsle[] = [
  {
    id: "isle-agehaos",
    slug: "agehaos",
    name: "AgehaOS · 悬浮终端塔",
    center: { x: 0, y: 4, z: -64 },
    radius: 12,
    accentColor: "#269DFF",
  },
  {
    id: "isle-cs",
    slug: "cs-skin-invest",
    name: "CS 模拟器 · 行情观测环",
    center: { x: -52, y: 8, z: 26 },
    radius: 13,
    accentColor: "#54E3FF",
  },
  {
    id: "isle-moss",
    slug: "moss-world",
    name: "Moss World · 生态穹舱",
    center: { x: 48, y: -3, z: 30 },
    radius: 11,
    accentColor: WORLD_COLORS.mossGreen,
  },
] as const;

/* ------------------------------ 蝶径 ------------------------------ */

export type Trail = {
  readonly id: string;
  readonly zoneName: string;
  readonly targetIsleId: string;
  readonly width: number;
  /** Catmull-Rom 控制点（起点在主岛边缘内，终点落在目标屿盘面内） */
  readonly controlPoints: readonly Vec3[];
  /** 采样折线（模块加载时一次生成，运行时零分配） */
  readonly samples: readonly Vec3[];
  /**
   * 名义长度：样条弧长（蓝图 §2.2 的 52/50/48 指沿样条的实际路程，
   * 大于起终点直线距离——评审意见：两数口径为样条弧长，非直线距离）。
   */
  readonly arcLength: number;
  /** 起终点直线距离（供数据自洽校验：arcLength ≥ straightDistance） */
  readonly straightDistance: number;
};

function buildTrail(
  id: string,
  zoneName: string,
  targetIsleId: string,
  width: number,
  controlPoints: readonly Vec3[],
): Trail {
  const samples = sampleCatmullRom(controlPoints, 16);
  let arc = 0;
  for (let i = 1; i < samples.length; i += 1) arc += dist3D(samples[i - 1], samples[i]);
  const first = controlPoints[0];
  const last = controlPoints[controlPoints.length - 1];
  return {
    id,
    zoneName,
    targetIsleId,
    width,
    controlPoints,
    samples,
    arcLength: Math.round(arc * 10) / 10,
    straightDistance: Math.round(dist3D(first, last) * 10) / 10,
  };
}

/**
 * 三条鳞粉蝶径（§2.2：三屿方位刻意去对称，高度 0→+4 / 0→+8 / 0→−3）。
 *
 * 长度口径说明（评审遗留意见）：蓝图 §2.2 表中的 52 / 50 / 48 为名义长度，
 * 指沿 Catmull-Rom 样条的实际弧长，大于起终点直线距离（47.2 / 40.2 / 38.4）；
 * `arcLength` 为本模块采样折线的实测弧长，`straightDistance` 为起终点直线
 * 距离，world-layout.test.mjs 断言 arcLength ≥ straightDistance 自洽。
 */
export const TRAILS: readonly Trail[] = [
  buildTrail(
    "trail-a",
    "蝶径 · 北径",
    "isle-agehaos",
    3.2,
    [
      { x: 0, y: 0, z: -13 },
      { x: 5, y: 1, z: -27 },
      { x: -5, y: 2.5, z: -43 },
      { x: 0, y: 4, z: -60 },
    ],
  ),
  buildTrail(
    "trail-c",
    "蝶径 · 西南径",
    "isle-cs",
    3.2,
    [
      { x: -15, y: 0, z: 6 },
      { x: -24, y: 1, z: 0 },
      { x: -38, y: 4.5, z: 14 },
      { x: -50, y: 8, z: 24 },
    ],
  ),
  buildTrail(
    "trail-m",
    "蝶径 · 东南径",
    "isle-moss",
    3.2,
    [
      { x: 14, y: 0, z: 7 },
      { x: 26, y: -1, z: 4 },
      { x: 37, y: -2, z: 15 },
      { x: 46, y: -3, z: 28 },
    ],
  ),
] as const;

/* ------------------------------ 茧居所（彩蛋，阶段 2） ------------------------------ */

/** 茧居所：主岛下方北侧 (0,−18,−22)，阶段 2 开放旋梯；阶段 1 仅登记数据 */
export const CHRYSALIS_NOOK = {
  id: "chrysalis-nook",
  name: "茧居所",
  center: { x: 0, y: -18, z: -22 },
  platformSize: { x: 10, z: 8 },
  /** 阶段 1 不可达（旋梯未建），软边界视其为空域 */
  reachable: false,
} as const;

/* ------------------------------ 远景 ------------------------------ */

/** 远景浮岛群：半径 120~220 环带，扇形分布避开工位，不可达剪影（§2.2） */
export const DISTANT_ISLES: readonly { x: number; y: number; z: number; scale: number }[] = [
  { x: -96, y: 14, z: -150, scale: 2.4 },
  { x: 46, y: 26, z: -196, scale: 3.0 },
  { x: 168, y: 6, z: -104, scale: 1.8 },
  { x: 186, y: 18, z: 58, scale: 2.6 },
  { x: 128, y: -8, z: 168, scale: 1.6 },
  { x: -88, y: 8, z: 190, scale: 2.2 },
  { x: -198, y: 22, z: -28, scale: 2.8 },
] as const;

/* ------------------------------ 可行走表面查询 ------------------------------ */

/** 点到折线的最近信息（距离 / 高度插值）；折线为蝶径采样 */
function nearestOnPolyline(
  x: number,
  z: number,
  samples: readonly Vec3[],
): { distance: number; y: number } | null {
  let best: { distance: number; y: number } | null = null;
  for (let i = 1; i < samples.length; i += 1) {
    const a = samples[i - 1];
    const b = samples[i];
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const lenSq = abx * abx + abz * abz;
    if (lenSq === 0) continue;
    let t = ((x - a.x) * abx + (z - a.z) * abz) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + abx * t;
    const pz = a.z + abz * t;
    const d = Math.hypot(x - px, z - pz);
    if (best === null || d < best.distance) {
      best = { distance: d, y: a.y + (b.y - a.y) * t };
    }
  }
  return best;
}

/**
 * 可行走表面查询（§6.4：解析面求高，避免全场景 raycast）。
 * 返回脚下地面高度；不在任何可行走表面（主岛 / 蝶径 / 三屿）则返回 null
 * —— 由控制器按软边界气流推回处理。
 *
 * 优先级：项目屿盘面 > 蝶径带 > 主岛椭圆面（径头在岛缘内重叠时取更高者，
 * 保证上坡无缝）。
 */
export function getGroundHeight(x: number, z: number): number | null {
  let best: number | null = null;
  for (const isle of PROJECT_ISLES) {
    const d = dist2D(x, z, isle.center.x, isle.center.z);
    if (d <= isle.radius) {
      const y = isle.center.y;
      if (best === null || y > best) best = y;
    }
  }
  for (const trail of TRAILS) {
    const near = nearestOnPolyline(x, z, trail.samples);
    if (near && near.distance <= trail.width / 2) {
      if (best === null || near.y > best) best = near.y;
    }
  }
  const ex = x / MAIN_ISLAND.semiAxisX;
  const ez = z / MAIN_ISLAND.semiAxisZ;
  if (ex * ex + ez * ez <= 1 && (best === null || MAIN_ISLAND.groundY > best)) {
    best = MAIN_ISLAND.groundY;
  }
  return best;
}

/** 当前区域名（HUD 顶中名牌，§13.3）；不可达空域返回 null */
export function getZoneName(x: number, z: number): string | null {
  for (const isle of PROJECT_ISLES) {
    if (dist2D(x, z, isle.center.x, isle.center.z) <= isle.radius + 2) {
      return isle.name;
    }
  }
  for (const trail of TRAILS) {
    const near = nearestOnPolyline(x, z, trail.samples);
    if (near && near.distance <= trail.width / 2 + 1.5) return trail.zoneName;
  }
  const ex = x / MAIN_ISLAND.semiAxisX;
  const ez = z / MAIN_ISLAND.semiAxisZ;
  if (ex * ex + ez * ez <= 1) return MAIN_ISLAND.name;
  return null;
}

/**
 * 软边界推回方向：给定位移出可行走区域的坐标，返回指向最近可行走点的
 * 单位向量（无最近点时指回主岛中心）。§2.3：浮游信灯遇气流推回，永不坠落。
 */
export function softBoundaryPush(x: number, z: number): { x: number; z: number } {
  // 最近可行走候选：主岛边缘沿 (x,z) 方向的椭圆点 + 三屿盘面边缘投影
  const candidates: Array<{ x: number; z: number }> = [];
  const ex = x / MAIN_ISLAND.semiAxisX;
  const ez = z / MAIN_ISLAND.semiAxisZ;
  const r = Math.hypot(ex, ez);
  if (r > 0) {
    candidates.push({
      x: (ex / r) * MAIN_ISLAND.semiAxisX,
      z: (ez / r) * MAIN_ISLAND.semiAxisZ,
    });
  }
  for (const isle of PROJECT_ISLES) {
    const d = dist2D(x, z, isle.center.x, isle.center.z);
    if (d > 0) {
      candidates.push({
        x: isle.center.x + ((x - isle.center.x) / d) * isle.radius,
        z: isle.center.z + ((z - isle.center.z) / d) * isle.radius,
      });
    }
  }
  let bestDist = Infinity;
  let best = candidates[0] ?? { x: 0, z: 0 };
  for (const c of candidates) {
    const d = Math.hypot(x - c.x, z - c.z);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  const len = Math.hypot(best.x - x, best.z - z) || 1;
  return { x: (best.x - x) / len, z: (best.z - z) / len };
}
