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

/**
 * 出生点：主岛东南观景位（R3）。从这里向西北出发，视线正对蝶枢—
 * 北径—CS MAJOR ARCHIVE 的纵深关系；镜头 yaw=0.3 时按 W 会沿主路径前进，
 * 不再出现「初始 3/4 构图、一动就偏离主路」的断层。
 */
export const SPAWN_POINT = { x: 6.5, y: 0.35, z: 7 } as const;

/**
 * 蝶枢（世界核心）：主岛中心上空 (0,7,0)。
 * R3：核心抬到 7m——玩家可从正下方穿过中央广场，不再被地面碰撞柱堵死
 * 北径；碰撞/相机遮挡只作用于悬空装置本体（见 colliders.ts）。
 */
export const BUTTERFLY_CORE = {
  id: "butterfly-core",
  name: "蝶枢",
  center: { x: 0, y: 7, z: 0 },
  height: 7,
  /** R4：翼展 7.6（R3 为 9.2）——仍是主视觉，但不再遮住后方终端塔与岛体 */
  wingspan: 7.6,
} as const;

/* ------------------------------ 项目屿 ------------------------------ */

export type ProjectIsle = {
  readonly id: string;
  /** 对应 lib/projects.ts 的 slug（交互入口与数据渲染的关联键） */
  readonly slug: "cs-major-archive" | "calendar" | "blog-cms";
  readonly name: string;
  readonly center: Vec3;
  /** 岛半径（可行走盘面半径，视觉边缘再外扩 ~1） */
  readonly radius: number;
  readonly accentColor: string;
  /**
   * 中央结构碰撞圆柱（相对岛心偏移 + 半径，§6.4）：
   * 写作穹舱较大且相对岛心偏东北——蝶径 M 终点（西北侧到达区）必须
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
    id: "isle-cs-major",
    slug: "cs-major-archive",
    name: "CS MAJOR ARCHIVE · 冠军档案塔",
    center: { x: -22, y: 4, z: -58 },
    radius: 12,
    accentColor: "#269DFF",
    collider: { offsetX: 0, offsetZ: 0, radius: 2.6 },
    /** R3：塔身左移后，交互锚点仍在南侧到达平台（塔前观景位） */
    anchor: { offsetX: 1, offsetZ: 5.2 },
    landingDistance: 10.5,
  },
  {
    id: "isle-calendar",
    slug: "calendar",
    name: "calendar · 日程观测环",
    center: { x: -64, y: 8, z: 34 },
    radius: 13,
    accentColor: "#54E3FF",
    collider: { offsetX: 0, offsetZ: 0, radius: 2.8 },
    /** R2：锚点移向东北到达侧（观测环入口），保证传送落地即出现查看入口 */
    anchor: { offsetX: 4.6, offsetZ: -2.3 },
    landingDistance: 10.2,
  },
  {
    id: "isle-blog",
    slug: "blog-cms",
    name: "blog-cms · 写作穹舱",
    center: { x: 48, y: -3, z: 30 },
    radius: 11,
    accentColor: WORLD_COLORS.mossGreen,
    collider: { offsetX: 4.5, offsetZ: 4.5, radius: 7.5 },
    anchor: { offsetX: -4, offsetZ: -2 },
    landingDistance: 8.6,
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
    "isle-cs-major",
    3.2,
    [
      { x: -6, y: 0, z: -12 },
      { x: -10.6, y: 1.2, z: -27 },
      { x: -15, y: 2.6, z: -42 },
      { x: -20, y: 4, z: -52 },
    ],
  ),
  buildTrail(
    "trail-c",
    "蝶径 · 西南径",
    "isle-calendar",
    3.2,
    [
      { x: -15, y: 0, z: 6 },
      // R11.4 重排：旧路径 (-27,1.2,4)→(-44,4.2,17) 在离岛即爬升，
      // 从西侧低机位（b0：(-40,-3.5,8)）仰视时采样点 0-20 全部投影在
      // 岛上方 NDC y 0.19→0.95（最近 7.55m），读作横跨主岛的高架巨带。
      // 新走向前段贴海低走（y ≤ 2）远离主岛轮廓，爬升段 (x −45 以远)
      // 处于该机位视锥之外——连接功能与起终点不变。
      { x: -24, y: 0.8, z: 10 },
      { x: -38, y: 2.0, z: 17 },
      // 终点在观测环结构碰撞体之外，落在日程屿西侧到达平台
      { x: -50, y: 5.5, z: 25 },
      { x: -58, y: 8, z: 31 },
    ],
  ),
  buildTrail(
    "trail-m",
    "蝶径 · 东南径",
    "isle-blog",
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
 * 引导蝶（§5.2，导航角色）：沿「当前未探索」的蝶径往返巡飞；
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
    // R3：入口移到主岛西北缘并绕到岛身外侧——北径不再与旋径上下重叠，
    // 从北径滑落不会被旋径接住（软边界会把玩家推回径面）
    { x: -16.2, y: -0.2, z: -4.5 },
    { x: -19.6, y: -2.4, z: -10 },
    { x: -21.5, y: -7, z: -15.5 },
    { x: -21, y: -12, z: -19.5 },
    { x: -16, y: -16, z: -22 },
    { x: -8, y: -17.5, z: -23 },
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
  /**
   * 朝向：面向出生点的来客。R8 从 −0.72 转到 0.68——旧角度下三片导览鳍
   * 与初始视线几乎平行，叠成一块高对比白片；转正后鳍片分开，碑体回到
   * 「入口导览」的尺度，不再与中央广场争夺前景。
   */
  facing: 0.68,
} as const;

/**
 * 中央广场的四个入口（R9）：三条蝶径的接近铺装 + 出生点迎宾步道。
 *
 * 这些点是「广场扇面铺装 → 接近铺装 → 径头门架」的共同 seam：
 * - 半径约 5.9，位于广场压平区内（R9：r ≤ 6.4 全平，6.4–8.4 起坡），铺装与雪面同高过渡；
 * - 四个方位刻意不等分：M 径（12°）与出生点（43°）在东南侧分开，
 *   避免「入口与迎宾步道叠在一起」；A 径在西北、C 径在西南；
 * - 仅作视觉铺装定位，不参与碰撞 / 可行走面查询（广场地面仍为解析 y=0）。
 */
export const PLAZA_MOUTHS = [
  { id: "trail-a", x: -4.55, z: -3.76 },
  { id: "trail-c", x: -5.51, z: 2.1 },
  { id: "trail-m", x: 5.75, z: 1.22 },
  { id: "spawn", x: 4.35, z: 4.05 },
] as const;

/**
 * 北径触发信标（P1）：径头东侧的低矮基座 + 暖色晶石。
 * 位于可行走带之外，但仍是实体——碰撞体登记在 colliders.ts。
 */
export const NORTH_RELAY = {
  id: "north-relay",
  x: TRAILS[0].samples[0].x + 3.4,
  z: TRAILS[0].samples[0].z + 0.4,
  radius: 0.75,
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
  // 蝶径 A 起点 (−6,−12)：沿内侧垂直偏移 2.8 → (−8.68,−11.2)
  { id: "beacon-trail-a", trailId: "trail-a", accentSlug: "cs-major-archive", x: -8.68, z: -11.2 },
  // 蝶径 C 起点 (−15,6)：径向 (−0.834,−0.556)，内侧垂直偏移 → (−13.67,4.0)
  { id: "beacon-trail-c", trailId: "trail-c", accentSlug: "calendar", x: -13.67, z: 4.0 },
  // 蝶径 M 起点 (14,7)：径向 (0.970,−0.243)，内侧垂直偏移 → (13.42,4.67)
  { id: "beacon-trail-m", trailId: "trail-m", accentSlug: "blog-cms", x: 13.42, z: 4.67 },
] as const;

/* ------------------------------ 主岛地表形态（视觉与碰撞同源） ------------------------------ */

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smoothstep01 = (edge0: number, edge1: number, value: number) => {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/**
 * 主岛雪原高度场（R11 四区地貌，单位 m）：
 * - R7 的三层结构保留：大尺度山体 + 角度扰动的雪台 + 微风蚀面；
 * - R11 把四个区域做出可辨识的性格：
 *   「西岭高地」主峰抬到 2.4m 并加西北肩脊与两座迎风露岩丘；
 *   「东北丘原」北坡抬到 0.95m，两座连绵圆丘构成起伏的丘原地貌；
 *   「东缘冰碛带」东丘抬到 1.35m，一条斜向冰碛脊把高地体量引向冰晶池；
 *   「南麓缓坡」保持温和（初始构图 / 出生 / 南观景台不动），只加深
 *   西南风蚀洼地并在观景台内侧加一处浅雪盆；
 * - 中央蝶枢广场、出生观景位、导览碑与三条蝶径周边继续自动压平；
 *   径带过渡外缘从 5.4 收到 4.6——地形更早向道路抬升，路面不再像
 *   独立铺装带；可行走半宽 1.6m 内仍然完全压平；
 * - 顶面几何（islandGeometry.heightAt）与实际贴地碰撞（getGroundHeight）
 *   共用本函数——视觉坡面即玩家脚下的坡面，不再是「贴图起伏 + 平板碰撞」。
 * - 硬约束：全场最大高度 ≤3.0（多层 +4/−6 过滤安全余量），
 *   广场四入口 y=0（入口压平测试钉死 ≤0.05）。
 */
export function mainIslandSurfaceY(x: number, z: number): number {
  const ex = x / MAIN_ISLAND.semiAxisX;
  const ez = z / MAIN_ISLAND.semiAxisZ;
  const r = Math.hypot(ex, ez);
  if (r > 1) return 0;

  const theta = Math.atan2(ez, ex);
  // 用低频角度波扭曲环状特征的边界（不是随机噪声，SSR / 刷新稳定）
  const warp =
    (0.03 * Math.sin(theta * 2.4 + 1.1) +
      0.016 * Math.sin(theta * 4.7 - 0.6)) *
    smoothstep01(0.18, 0.55, r);
  const rw = r + warp;

  let h =
    // ---- 西岭高地：主峰 2.4m + 西北肩脊 + 两座迎风露岩丘 ----
    2.4 * Math.exp(-(((x + 11.2) / 5.0) ** 2) - (((z - 2.2) / 3.6) ** 2)) +
    0.75 * Math.exp(-(((x + 14.2) / 2.8) ** 2) - (((z + 1.2) / 2.4) ** 2)) +
    0.85 * Math.exp(-(((x + 8.6) / 1.6) ** 2) - (((z + 0.6) / 1.4) ** 2)) +
    0.6 * Math.exp(-(((x + 7.8) / 1.3) ** 2) - (((z - 3.6) / 1.1) ** 2)) +
    // ---- 东缘冰碛带：东丘 1.35m + 斜向冰碛脊（长轴指向冰晶池）----
    1.35 * Math.exp(-(((x - 10.6) / 4.6) ** 2) - (((z + 5.0) / 3.6) ** 2)) +
    0.45 *
      Math.exp(-(((x * 0.71 - z * 0.7 - 13.42) / 2.8) ** 2) - ((x * 0.7 + z * 0.71 - 3.15) / 1.2) ** 2) +
    // ---- 南麓缓坡：西南雪坡保留，风蚀洼地加深（R11.2 −0.58：随雪台/
    // 雪脊增强同步加深，保持南麓低伏走向可读）+ 观景台内侧浅雪盆 ----
    0.65 * Math.exp(-(((x + 7.4) / 3.6) ** 2) - (((z - 9.0) / 2.7) ** 2)) -
    0.58 * Math.exp(-(((x + 6.6) / 3.0) ** 2) - (((z - 8.1) / 2.5) ** 2)) -
    0.22 * Math.exp(-(((x - 2.5) / 2.6) ** 2) - (((z - 10.5) / 2.0) ** 2)) +
    // ---- 东北丘原：北坡 0.95m + 两座连绵圆丘 ----
    0.95 * Math.exp(-(((x - 0.6) / 6.4) ** 2) - (((z + 8.0) / 3.4) ** 2)) +
    0.5 * Math.exp(-(((x - 5.2) / 2.2) ** 2) - (((z + 10.2) / 1.9) ** 2)) +
    0.45 * Math.exp(-(((x + 1.5) / 1.9) ** 2) - (((z + 8.5) / 1.6) ** 2)) +
    // 广场外的局部地形：南侧雪埂 + 东侧冰丘（全部落在压平区之外）
    0.27 * Math.exp(-(((x + 0.5) / 4.4) ** 2) - (((z - 8.7) / 2.2) ** 2)) +
    0.24 * Math.exp(-(((x - 11.4) / 2.7) ** 2) - (((z + 7.4) / 2.5) ** 2)) +
    0.2 * Math.exp(-(((x - 8.5) / 2.0) ** 2) - (((z - 3.2) / 1.7) ** 2)) +
    // 两条斜向风蚀雪脊：给雪原一条可读的脊线，而不是只有圆丘
    0.2 *
      Math.exp(-(((x * 0.94 + z * 0.34 + 9.0) / 1.8) ** 2) - ((-x * 0.34 + z * 0.94 + 1.0) / 4.8) ** 2) +
    0.15 *
      Math.exp(-(((x * 0.82 - z * 0.57 - 3.7) / 1.4) ** 2) - ((x * 0.57 + z * 0.82 + 4.9) / 3.4) ** 2) +
    // 大尺度雪脊：随半径抬升；R11.2 对比再拉大（0.26→0.32）——
    // 西北侧明显隆起、东南侧压低，雪脊绕岛强弱分明
    0.32 *
      (0.5 + 0.5 * Math.sin(theta * 3.1 + 0.7 + 0.9 * Math.sin(theta * 1.3))) *
      smoothstep01(0.38, 0.82, r) +
    // 环岛雪台：R11.2 振幅 0.34→0.4、下限 0.2→0.12——四向地貌强弱
    // 对比更分明（西北厚雪台 / 南侧薄缘），摆脱圆盘均匀感
    0.4 *
      smoothstep01(0.16, 0.42, rw) *
      (1 - smoothstep01(0.7, 0.9, rw)) *
      Math.max(
        0.12,
        0.62 + 0.38 * Math.sin(theta * 2.1 - 0.8) + 0.18 * Math.sin(theta * 3.3 + 1.7),
      ) +
    // R11.1 东南浅凹谷：一条 SW→NE 走向的缓凹槽穿过东南象限
    // （r≈0.87，避开出生 3.2m / 广场 8.4 / 冰池 4.2），让南侧雪原
    // 有了低伏的走向，不再四面均匀隆起
    -0.3 *
      Math.exp(
        -((((x - 9.5) * 0.71 + (z - 9) * 0.71) / 3.4) ** 2) -
          ((((x - 9.5) * 0.71 - (z - 9) * 0.71) / 1.6) ** 2),
      ) +
    // 风蚀中尺度起伏：近景可读的雪坡与浅槽（不是高频噪声）
    0.17 *
      Math.sin(x * 0.62 + z * 0.28 + 1.2) *
      Math.sin(z * 0.55 - x * 0.2 - 0.5) *
      smoothstep01(0.22, 0.55, r) +
    0.06 * Math.cos(x * 1.35 - z * 0.8) * smoothstep01(0.3, 0.7, r) +
    // 雪面细碎风纹：只做厘米级起伏，让大面积雪坡在低角度光下也有切面
    0.042 *
      Math.sin(x * 2.3 + z * 1.1 + 0.4) *
      Math.sin(z * 1.9 - x * 0.7 - 1.2) *
      smoothstep01(0.3, 0.68, r);

  // 与道路一致：径带外缘 4.6——地形更早向路面抬升（R11 道路融合），
  // 可行走半宽 1.6m 内仍然完全压平
  let trailDistance = Infinity;
  for (const trail of TRAILS) {
    const near = nearestOnPolyline(x, z, trail.samples);
    if (near) trailDistance = Math.min(trailDistance, near.distance);
  }
  // R11.1：径带外缘 4.6→4.0——地形贴路更紧，路面不再浮在压平带中央
  const trailFlat = smoothstep01(2.0, 4.0, trailDistance);
  // R9：广场压平半径从 7.2 扩到 8.4（起坡 6.4）——四个入口扇面（外缘 6.45）
  // 与迎宾步道的前段必须坐在同一片平地上，否则铺装会被雪坡埋掉。
  const plazaFlat = smoothstep01(6.4, 8.4, Math.hypot(x, z));
  const spawnFlat = smoothstep01(1.8, 3.2, Math.hypot(x - SPAWN_POINT.x, z - SPAWN_POINT.z));
  const signFlat = smoothstep01(1.2, 2.4, Math.hypot(x - SIGN_POST.x, z - SIGN_POST.z));
  // R11.1：岛缘平台收窄（0.9-0.995 → 0.93-0.997）——外圈不再是一圈
  // 均匀平环；檐口混合 heightAt（islandGeometry）保证接缝连续
  const rimTaper = 1 - smoothstep01(0.93, 0.997, r);
  h *= Math.min(trailFlat, plazaFlat, spawnFlat, signFlat, rimTaper);

  // 冰晶池浅台：池心与池岸压平到 0.3m，便于池水 / 晶簇落地。
  // R9 移到广场压平之后——池台不再随广场外缘一起被削低，
  // 椭圆池岸四周保持同一高度，石岸不会单侧悬空。
  const basinDistance = Math.hypot(x - 8, z + 2);
  const basinBlend = 1 - smoothstep01(2.7, 4.2, basinDistance);
  h = h * (1 - basinBlend) + 0.3 * basinBlend;

  // 南缘观景台：弧段下方压平到 0，让 0.03m 的石铺面坐在雪面之上
  let deckAngle = theta - Math.PI / 2;
  while (deckAngle > Math.PI) deckAngle -= Math.PI * 2;
  while (deckAngle < -Math.PI) deckAngle += Math.PI * 2;
  const deckSector = 1 - smoothstep01(0.5, 0.68, Math.abs(deckAngle));
  const deckBand =
    smoothstep01(0.86, 0.91, r) * (1 - smoothstep01(0.995, 1, r));
  const deckBlend = deckSector * deckBand;
  h *= 1 - deckBlend;

  return Math.max(0, h);
}

/* ------------------------------ 远景 ------------------------------ */

/**
 * 远景浮岛群（R3）：5 座、半径 120~220 环带。
 * 数量从 7 收到 5，避开初始视线正后方的 档案塔主景深线；
 * 每座由 DistantIsles 使用不同剖面（mesa / shard / rooted），
 * 只做第三层空间纵深，不与三座项目地标争夺轮廓。全部不可达。
 */
export const DISTANT_ISLES: readonly { x: number; y: number; z: number; scale: number }[] = [
  // R4：远景从 200 环带收近到 145~160，让地平线真正有可读的群岛层次；
  // 仍全部落在 120~220 环带内且不可达。NW 岛框住 CS MAJOR ARCHIVE 屿，其余补足侧翼。
  { x: -110, y: 24, z: -105, scale: 2.4 },
  { x: 30, y: 30, z: -150, scale: 2.1 },
  { x: 130, y: 18, z: -90, scale: 2.3 },
  { x: 150, y: 8, z: 40, scale: 1.9 },
  { x: -150, y: 14, z: 30, scale: 2.0 },
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
  if (ex * ex + ez * ez <= 1) candidates.push(mainIslandSurfaceY(x, z));

  if (candidates.length === 0) return null;
  if (refY === undefined) return Math.max(...candidates);
  // 多层：只接受脚边可达的层（上 ≤ refY + 4 / 下 ≥ refY − 6）。
  // 下界很关键：茧居所旋径在主岛下方 15m+，没有下界时从岛面滑出会被
  // 「吸附」到深层的旋径（R3 实测：按 W 走北径会掉进茧居所）。
  const reachable = candidates.filter((y) => y <= refY + 4 && y >= refY - 6);
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
    refY === undefined || (surfaceY <= refY + 4 && surfaceY >= refY - 6);

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
  /** 落点相机俯仰（R3：抵达项目屿时略微抬高视点，配合地标取景辅助） */
  readonly cameraPitch?: number;
  /** 落点相机距离档（0 近 / 1 标准 / 2 远） */
  readonly cameraDistanceIndex?: number;
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
    cameraPitch: 0.26,
    cameraDistanceIndex: 1,
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
    cameraPitch: CAMERA_LIMITS.initialPitch,
    cameraDistanceIndex: CAMERA_LIMITS.initialDistanceIndex,
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
    cameraDistanceIndex: 0,
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
 * 三屿场景内屏幕贴图登记：本改编为空表（见上），不再引用旧截图。
 */
export const ISLE_SCREENS: readonly IsleScreenTexture[] = [
  // 本改编中三屿不挂载任何真实截图：原登记的三张截图属于原作者项目，
  // 不再作为 Momori 作品的屏幕贴图复用；屿内屏幕渲染空屏占位。
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
