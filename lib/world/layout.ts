/**
 * 世界空间布局（蓝图 §2.2 坐标表的数据化落地）。
 *
 * 坐标系：three.js 右手系，Y 向上，1 unit ≈ 1m；原点 (0,0,0) = 主岛地面中心，
 * 北 = −Z。施工数据以本文件为准；区域坐标表见 docs/3d-world-blueprint.md §2.2。
 *
 * 本文件为纯 TS（无 JSX、无 three 依赖，向量运算自实现），
 * node --test 直接 import 做数据级校验（tests/world-layout.test.mjs）。
 */
import { CAMERA_LIMITS, PLAYER_PHYSICS, WORLD_COLORS } from "./constants.ts";

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
  /**
   * 中央结构碰撞圆柱（相对岛心偏移 + 半径，§6.4）：
   * Moss 屿穹舱较大且相对岛心偏东北——蝶径 M 终点（西北侧到达区）必须
   * 留在碰撞体外（阶段 2 实测调整，蓝图 §2.2 名义值为岛心居中）。
   */
  readonly collider: { readonly offsetX: number; readonly offsetZ: number; readonly radius: number };
  /** 交互锚点偏移（相对岛心；缺省 = 岛心。Moss = 舱外观景台监测屏处） */
  readonly anchor?: { readonly offsetX: number; readonly offsetZ: number };
  /** 传送落点距离（沿岛心→主岛方向外推，须在盘面内且碰撞体外） */
  readonly landingDistance: number;
};

/** 三座作品之屿（§2.2 / §4；正式造型与交互在阶段 2 落地） */
export const PROJECT_ISLES: readonly ProjectIsle[] = [
  {
    id: "isle-agehaos",
    slug: "agehaos",
    name: "AgehaOS · 悬浮终端塔",
    center: { x: 0, y: 4, z: -64 },
    radius: 12,
    accentColor: "#269DFF",
    collider: { offsetX: 0, offsetZ: 0, radius: 2.6 },
    landingDistance: 5.5,
  },
  {
    id: "isle-cs",
    slug: "cs-skin-invest",
    name: "CS 模拟器 · 行情观测环",
    center: { x: -52, y: 8, z: 26 },
    radius: 13,
    accentColor: "#54E3FF",
    collider: { offsetX: 0, offsetZ: 0, radius: 2.8 },
    landingDistance: 5.5,
  },
  {
    id: "isle-moss",
    slug: "moss-world",
    name: "Moss World · 生态穹舱",
    center: { x: 48, y: -3, z: 30 },
    radius: 11,
    accentColor: WORLD_COLORS.mossGreen,
    collider: { offsetX: 4.5, offsetZ: 4.5, radius: 7.5 },
    anchor: { offsetX: -4, offsetZ: -2 },
    landingDistance: 6.5,
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
      // 终点外移至观测环结构碰撞体（半径 2.8）之外——阶段 1 的 (−50,8,24)
      // 距岛心仅 2.83，会被推出圆柱卡住径尾（阶段 2 实测修正）
      { x: -47, y: 8, z: 22 },
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

/* ------------------------------ 蝶枢与引导蝶（§5 品牌三件套） ------------------------------ */

/**
 * 引导蝶 Ageha（§5.2，导航角色）：沿「当前未探索」的蝶径往返巡飞；
 * 玩家静止超过 idleReturnSeconds 秒时飞至玩家前方悬停示意方向。
 * 翅根枢轴扇动 ±40°、8Hz 阻尼正弦；reduced-motion 悬停待命不巡飞。
 */
export const GUIDE_BUTTERFLY = {
  id: "guide-butterfly",
  /** 翼展（unit；蝶枢为 10，引导蝶 2.2——§5.2） */
  wingspan: 2.2,
  /** 巡飞速度（沿蝶径样条弧长，unit/s） */
  speed: 4,
  /** 玩家静止判定：超过该秒数飞回玩家前方悬停 */
  idleReturnSeconds: 8,
  /** 翅根扇动频率（Hz） */
  wingFrequency: 8,
  /** 扇动幅度（度，翼面绕身体轴 ±） */
  wingAmplitudeDeg: 40,
  /** 巡飞高度：蝶径表面之上的悬浮余量 */
  flyHeight: 1.6,
} as const;

/* ------------------------------ 茧居所（彩蛋，阶段 2 开放） ------------------------------ */

/**
 * 茧居所：主岛下方北侧 (0,−18,−22) 的封闭小穹窟（设计原稿画廊彩蛋）。
 * 阶段 2 起经「旋径」可达：从主岛西北缘绕岛身外侧盘旋下沉的窄径
 * （宽度 2.4，蓝图 §16.1 回退方案——高度插值走廊，贴合悬浮信灯的贴地方式）。
 */
export const CHRYSALIS_NOOK = {
  id: "chrysalis-nook",
  name: "茧居所",
  center: { x: 0, y: -18, z: -22 },
  platformSize: { x: 10, z: 8 },
  /** 阶段 2 起旋径建成，平台与旋径均为可行走面 */
  reachable: true,
} as const;

/**
 * 旋径（茧居所下行走廊）：主岛西北缘 → 绕岛身外侧盘旋下沉 → 茧居所平台。
 * 与蝶径同源的 Catmull-Rom 采样折线，但更窄更暗（隐藏彩蛋气质）。
 */
export const NOOK_CORRIDOR = {
  id: "nook-corridor",
  zoneName: "茧居所 · 旋径",
  width: 2.4,
  controlPoints: [
    { x: -4, y: 0, z: -11.5 },
    { x: -12, y: -1.5, z: -14.5 },
    { x: -13.5, y: -6.5, z: -18.5 },
    { x: -9.5, y: -13, z: -22 },
    { x: -3, y: -17, z: -23 },
    { x: 0, y: -18, z: -22 },
  ] as const,
} as const;

/** 旋径采样折线（模块加载时一次生成） */
export const NOOK_CORRIDOR_SAMPLES: readonly Vec3[] = sampleCatmullRom(
  NOOK_CORRIDOR.controlPoints as unknown as readonly Vec3[],
  16,
);

/** 茧居所平台矩形（可行走面，y = −18） */
function isOnNookPlatform(x: number, z: number): boolean {
  const halfX = CHRYSALIS_NOOK.platformSize.x / 2;
  const halfZ = CHRYSALIS_NOOK.platformSize.z / 2;
  return (
    Math.abs(x - CHRYSALIS_NOOK.center.x) <= halfX &&
    Math.abs(z - CHRYSALIS_NOOK.center.z) <= halfZ
  );
}

/* ------------------------------ 主岛石碑与三径导向标（§9.1 / 阶段 3 名牌美术化） ------------------------------ */

/**
 * 主岛石碑（SignPost）：出生点旁的品牌句石碑——tagline 数据单源 lib/site.ts，
 * 此处只登记空间位置（碰撞体见 colliders.ts；文案渲染在组件层取 lib/site）。
 */
export const SIGN_POST = {
  id: "sign-post",
  x: 3.4,
  y: 0,
  z: 6.5,
  /** 朝向：面向出生点与蝶枢连线方向（弧度，绕 Y） */
  facing: Math.PI * 0.86,
} as const;

/**
 * 三径导向标（径头侧方位石 + 各屿主题色浮晶）：位置为各蝶径起点沿
 * 垂直方向内偏 2.4 unit 的岛内侧（不占可行走带——径半宽 1.6，
 * 碰撞推出半径 0.5 + 体半径 0.45 = 0.95 < 2.4 − 1.6 + 径内余量）。
 * accentSlug → PROJECT_ISLES.accentColor（导向浮晶与目标屿同色）。
 */
export const TRAIL_BEACONS: readonly {
  readonly id: string;
  readonly trailId: string;
  readonly accentSlug: ProjectIsle["slug"];
  readonly x: number;
  readonly z: number;
}[] = [
  // 蝶径 A 起点 (0,−13)：径向 (0.336,−0.942)，内侧垂直偏移 → (2.26,−12.19)
  { id: "beacon-trail-a", trailId: "trail-a", accentSlug: "agehaos", x: 2.26, z: -12.19 },
  // 蝶径 C 起点 (−15,6)：径向 (−0.834,−0.556)，内侧垂直偏移 → (−13.67,4.0)
  { id: "beacon-trail-c", trailId: "trail-c", accentSlug: "cs-skin-invest", x: -13.67, z: 4.0 },
  // 蝶径 M 起点 (14,7)：径向 (0.970,−0.243)，内侧垂直偏移 → (13.42,4.67)
  { id: "beacon-trail-m", trailId: "trail-m", accentSlug: "moss-world", x: 13.42, z: 4.67 },
] as const;

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
/**
 * 可行走表面查询（§6.4：解析面求高，避免全场景 raycast）。
 *
 * 多层地形语义（阶段 2 引入）：茧居所在蝶径 A 的正下方（−18 vs +0.5），
 * 纯 2D 查询无法区分上下层——传 refY（角色/相机当前高度）时，只考虑
 * 高度 ≤ refY + 4 的候选面（允许正常坡度/台阶），取其中最高者；
 * 无候选则返回 null（软边界推回）。不传 refY 时保持最高者胜（测试 /
 * 相机初始构图等无参考高度场景）。这保证：站在茧居所不会被头顶蝶径
 * 吸上去，走蝶径也不会被脚下茧居所接住。
 *
 * 返回脚下地面高度；不在任何可行走表面（主岛 / 蝶径 / 三屿 / 旋径 /
 * 茧居所平台）则返回 null——由控制器按软边界气流推回处理。
 */
export function getGroundHeight(x: number, z: number, refY?: number): number | null {
  const candidates: number[] = [];
  for (const isle of PROJECT_ISLES) {
    const d = dist2D(x, z, isle.center.x, isle.center.z);
    if (d <= isle.radius) candidates.push(isle.center.y);
  }
  for (const trail of TRAILS) {
    const near = nearestOnPolyline(x, z, trail.samples);
    if (near && near.distance <= trail.width / 2) candidates.push(near.y);
  }
  // 茧居所旋径与平台（阶段 2 开放；主岛面在其上缘重叠时取更高者，出口无跳变）
  const corridor = nearestOnPolyline(x, z, NOOK_CORRIDOR_SAMPLES);
  if (corridor && corridor.distance <= NOOK_CORRIDOR.width / 2) {
    candidates.push(corridor.y);
  }
  if (isOnNookPlatform(x, z)) candidates.push(CHRYSALIS_NOOK.center.y);
  const ex = x / MAIN_ISLAND.semiAxisX;
  const ez = z / MAIN_ISLAND.semiAxisZ;
  if (ex * ex + ez * ez <= 1) candidates.push(MAIN_ISLAND.groundY);

  if (candidates.length === 0) return null;
  if (refY === undefined) return Math.max(...candidates);
  // 多层：只看脚下可达的层（≤ refY + 4），层中取最高
  const reachable = candidates.filter((y) => y <= refY + 4);
  if (reachable.length === 0) return null;
  return Math.max(...reachable);
}

/**
 * 当前区域名（HUD 顶中名牌，§13.3）；不可达空域返回 null。
 * refY 同 getGroundHeight 的多层语义：站在茧居所不会被头顶蝶径 A 的
 * 区域名覆盖（反之亦然）；不传 refY 时保持阶段 1 的静态优先级。
 */
export function getZoneName(x: number, z: number, refY?: number): string | null {
  /** 多层过滤：该层表面远高于参考高度（> refY + 4）则不参与 */
  const levelAllows = (surfaceY: number) =>
    refY === undefined || surfaceY <= refY + 4;

  if (isOnNookPlatform(x, z) && levelAllows(CHRYSALIS_NOOK.center.y)) {
    return CHRYSALIS_NOOK.name;
  }
  const corridor = nearestOnPolyline(x, z, NOOK_CORRIDOR_SAMPLES);
  // 旋径仍在主岛面高度（y ≥ −0.4）时区域仍报主岛；真正下行后才报旋径
  if (
    corridor &&
    corridor.distance <= NOOK_CORRIDOR.width / 2 + 1 &&
    corridor.y < -0.4 &&
    levelAllows(corridor.y)
  ) {
    return NOOK_CORRIDOR.zoneName;
  }
  for (const isle of PROJECT_ISLES) {
    if (
      dist2D(x, z, isle.center.x, isle.center.z) <= isle.radius + 2 &&
      levelAllows(isle.center.y)
    ) {
      return isle.name;
    }
  }
  for (const trail of TRAILS) {
    const near = nearestOnPolyline(x, z, trail.samples);
    if (near && near.distance <= trail.width / 2 + 1.5 && levelAllows(near.y)) {
      return trail.zoneName;
    }
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

/* ------------------------------ 传送目标（快速导航 / 1·2·3 快捷键） ------------------------------ */

export type TeleportSpot = {
  readonly id: string;
  /** 面板 / 提示条显示名 */
  readonly label: string;
  /** 落点（可行走面上，悬浮高度由控制器补上） */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /**
   * 落点相机 yaw（弧度）：相机 offset 方向 = (sin yaw, cos yaw)，
   * 取「背对目标结构」的方向，落点即朝结构构图。
   */
  readonly cameraYaw: number;
  /** 落点朝向（角色 heading，弧度；面向 = (−sin, 0, −cos)） */
  readonly heading: number;
};

/** 三屿落点：岛心向主岛方向外推（在盘面内、结构碰撞体外），面朝岛心 */
function isleTeleportSpot(isle: ProjectIsle): TeleportSpot {
  const d = Math.hypot(isle.center.x, isle.center.z) || 1;
  // dir：岛心 → 主岛方向（落点在主岛一侧，相机在其后再看回岛心）
  const dirX = -isle.center.x / d;
  const dirZ = -isle.center.z / d;
  const landing = isle.landingDistance;
  return {
    id: isle.id,
    label: isle.name,
    x: isle.center.x + dirX * landing,
    y: isle.center.y + PLAYER_PHYSICS.hoverHeight,
    z: isle.center.z + dirZ * landing,
    cameraYaw: Math.atan2(dirX, dirZ),
    heading: Math.atan2(dirX, dirZ),
  };
}

/**
 * 传送目标表（蓝图 §8 快速导航 / §6.2 数字键 1·2·3）。
 * 茧居所为目标但 UI 侧需「发现后」才展示（隐藏彩蛋纪律）。
 */
export const TELEPORT_SPOTS: readonly TeleportSpot[] = [
  {
    id: "spawn",
    label: "苏醒环礁 · 出生点",
    x: SPAWN_POINT.x,
    y: SPAWN_POINT.y,
    z: SPAWN_POINT.z,
    cameraYaw: CAMERA_LIMITS.initialYaw,
    heading: 0,
  },
  ...PROJECT_ISLES.map(isleTeleportSpot),
  {
    id: "chrysalis-nook",
    label: "茧居所",
    x: 3.2,
    y: CHRYSALIS_NOOK.center.y + PLAYER_PHYSICS.hoverHeight,
    z: CHRYSALIS_NOOK.center.z + 2,
    cameraYaw: Math.PI / 2,
    heading: Math.PI / 2,
  },
] as const;

export function findTeleportSpot(id: string): TeleportSpot | undefined {
  return TELEPORT_SPOTS.find((spot) => spot.id === id);
}

/* ------------------------------ 三屿屏幕贴图登记（§4 共同规范 / §11.2） ------------------------------ */

export type IsleScreenTexture = {
  /** 项目 slug（与 PROJECT_ISLES 关联） */
  readonly slug: ProjectIsle["slug"];
  /** prepare-world-assets.mjs 产物路径（public/world/screens/*） */
  readonly path: string;
  /** 屏幕宽高比（主屏几何按此建模） */
  readonly aspect: number;
  /** 玩家距屿小于该距离才挂载贴图（§11.2 按需加载） */
  readonly mountDistance: number;
};

/**
 * 三屿真实封面截图的场景内屏幕贴图登记（数据级可测，world-layout 断言覆盖三 slug）：
 * - AgehaOS：顶层 16:10 主屏；
 * - CS：观测廊主屏（投资组合页）；
 * - Moss：舱外观景台「生态监测屏」（舱内生态零贴图、纯程序化——呼应真实特性）。
 * 体积上限由 world-assets.test.mjs statSync 断言（§11.2 目标体积表）。
 */
export const ISLE_SCREENS: readonly IsleScreenTexture[] = [
  {
    slug: "agehaos",
    path: "/world/screens/agehaos-1600.jpg",
    aspect: 16 / 10,
    mountDistance: 60,
  },
  {
    slug: "cs-skin-invest",
    path: "/world/screens/cs-portfolio-1280.webp",
    aspect: 3 / 4,
    mountDistance: 60,
  },
  {
    slug: "moss-world",
    path: "/world/screens/moss-terrarium-1280.webp",
    aspect: 16 / 10,
    mountDistance: 60,
  },
] as const;

export function findIsleScreen(slug: string): IsleScreenTexture | undefined {
  return ISLE_SCREENS.find((screen) => screen.slug === slug);
}

/* ------------------------------ 茧居所画廊展品登记（§9.1 / §11.2） ------------------------------ */

export type GalleryArtwork = {
  readonly id: string;
  /** 展品说明牌文案（如实：原稿来源，不宣称更多） */
  readonly caption: string;
  /** prepare-world-assets.mjs 产物路径（public/world/gallery/*） */
  readonly path: string;
  /** 展品宽高比（按产物实测尺寸建模画框；实测见 scripts 输出） */
  readonly aspect: number;
  /** 玩家距茧居所小于该距离才挂载贴图（§11.2 按需加载） */
  readonly mountDistance: number;
};

/**
 * 设计原稿画廊三展品（§9.1）：hero 原稿两幅 + 3D 世界概念原图。
 * 体积上限由 world-assets.test.mjs statSync 断言；宽高比为产物实测值
 * （hero-clean 634×350 → 1.81；hero-full 794×350 → 2.27；
 * concept-art 1024×1091 → 0.94，接近方幅）。
 */
export const GALLERY_ARTWORKS: readonly GalleryArtwork[] = [
  {
    id: "gallery-hero-clean",
    caption: "明亮版整站 · Hero 原稿",
    path: "/world/gallery/hero-clean-1024.webp",
    aspect: 634 / 350,
    mountDistance: 40,
  },
  {
    id: "gallery-hero-full",
    caption: "全要素版 · Hero 原稿",
    path: "/world/gallery/hero-full-1024.webp",
    aspect: 794 / 350,
    mountDistance: 40,
  },
  {
    id: "gallery-concept-art",
    caption: "3D 世界概念原画",
    path: "/world/gallery/concept-art-1024.webp",
    aspect: 1024 / 1091,
    mountDistance: 40,
  },
] as const;

export function findGalleryArtwork(id: string): GalleryArtwork | undefined {
  return GALLERY_ARTWORKS.find((art) => art.id === id);
}
