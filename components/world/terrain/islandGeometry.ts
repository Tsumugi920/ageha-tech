import {
  BufferGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  OctahedronGeometry,
  Uint32BufferAttribute,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/**
 * 分层风格化浮岛几何（程序化，零外部模型）。
 *
 * 与旧 FloatingRock 的倒锥 lathe 不同，这里把浮岛拆成：
 * - 岩体：多段不等宽岩层 + 逐段角度扰动 + 竖向错层，非三角面着色；
 * - 顶面：带起伏的径向网格，顶点色做雪层 / 冰壳 / 岩缘过渡；
 * - 岩缘裙边：顶面最后一段下折 0.4，包住岩体顶沿，避免「平盘浮在锥上」。
 *
 * 坐标约定：顶面对齐 y = 0（可行走面），岛体向下收束到 -depth。
 */

export type IslandProfile = "spire" | "mesa" | "shard" | "rooted" | "headland";

export type IslandGeometryOptions = {
  radiusX: number;
  radiusZ: number;
  depth: number;
  seed: number;
  /** 角度扰动幅度（0.03 克制 / 0.09 远景剪影） */
  jaggedness?: number;
  /** 角向分段（默认 64） */
  segments?: number;
  /** 岛体剖面：主岛尖脊 / 平台式 / 碎裂式 / 根须式 / 主岛岬角式 */
  profile?: IslandProfile;
  /**
   * R7：整层岩理沿环向的起伏幅度（相对 depth；0 = 旧的水平规则层）。
   * 同一位移场作用于所有中间岩层，因此层序不会交叉，边界从水平圆环
   * 变为随角度起伏的倾斜层理。
   */
  strataTilt?: number;
  /** R7：竖向侵蚀沟槽组数（0 = 旧轮廓；主岛用奇数避免镜像对称） */
  buttressCount?: number;
  /** R7：沟槽向内切削深度（半径比例） */
  buttressDepth?: number;
  /** R7：逐层高度抖动（相对 depth；默认 0.014，按邻层间距限幅） */
  layerJitter?: number;
  /**
   * R12.0-B：竖向破口组数（0 = 无破口）。与沟槽的区别：破口是「宽幅、
   * 贯穿多层的结构性裂口」——角向宽度大、随层位扭转、把下半部的环带
   * 在 2~3 处彻底打断；沟槽只是表面刻痕。仅作用于 depthRatio > 0.3
   * 的中下部（顶环与雪檐不受影响，上檐接缝保持覆盖）。
   */
  breachCount?: number;
  /** R12.0-B：破口向内切削深度（半径比例；默认 0.13） */
  breachDepth?: number;
  /**
   * R12.1-A：局部岩突组数（0 = 关闭，默认 4）。在确定性 (方位 × 深度带)
   * 上做宽幅外凸——岩壁读出局部岩嘴，层带不再整圈同步起伏。
   */
  outcropCount?: number;
  /** R12.1-A：窄幅断面组数（0 = 关闭，默认 3），方位与沟槽错开 */
  notchCount?: number;
  /**
   * R12.0-D（G1）：大气透视烘焙（0~1）。>0 时全部顶点色向雾色调
   * （ATMOSPHERE_TONE）过渡——远景浮岛在真实雾（near 120 / far 380）
   * 只覆盖 ~12% 的距离上仍以深色剪影出现；把「大气衰减」预烘进
   * 顶点色，远景岛从「黑色飞碟」变成「雾中淡影」。
   */
  atmosphereFade?: number;
};

export type IslandTopOptions = IslandGeometryOptions & {
  /** 顶面高度（返回 0~0.3 的装饰性起伏；不参与碰撞） */
  heightAt?: (theta: number, normalizedRadius: number, x: number, z: number) => number;
  /** 径向分段（默认 26） */
  rings?: number;
  /** R7：雪檐下折深度（m；默认 0.42。主岛用更深、随角度变化的檐口） */
  rimDepth?: number;
  /** R7：雪檐外缘的环向错动幅度（比例；0 = 旧圆形檐口） */
  rimScallop?: number;
  /** R7：地表坡度染色强度（0 = 旧均匀雪面） */
  slopeTint?: number;
  /** R7：檐口底部向岩石色过渡的强度（0 = 旧纯雪色檐口） */
  rimRockBlend?: number;
  /**
   * R10.1：地表分区函数（0~1，>0 表示靠近道路 / 活动区）。
   * 主岛传入「距路网折线的压实度」——顶点色沿路压出 SNOW_PACKED
   * 过渡带，让地表 / 道路边缘 / 野雪三种材质读得分得开。
   * 只影响颜色，不参与碰撞与高度。
   */
  zoneAt?: (x: number, z: number) => number;
  /**
   * R12.1-D（D 阶段）：陡坡露岩染色强度（0 = 关闭）。坡度 >0.5 的坡面
   * 向岩色过渡——雪原上的陡坎 / 坡折露出下伏岩层，地表分区可读性增强。
   * 只影响颜色，不改变高度与碰撞。
   */
  rockSlopeTint?: number;
  /**
   * R12.1-D（D 阶段）：洼地结冰染色强度（0 = 关闭）。凹陷处（hollow>0.06）
   * 向冰壳色过渡——低洼雪盆读作「风积雪下的冰面」，与冰池语言呼应。
   */
  hollowIceTint?: number;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/** 确定性角向噪声：多个正弦叠加，避免随机数导致 SSR / 刷新抖动 */
function angularNoise(theta: number, seed: number, ring: number): number {
  return (
    Math.sin(theta * 3 + seed + ring * 0.9) * 0.5 +
    Math.sin(theta * 5.3 + seed * 1.7 - ring * 0.4) * 0.3 +
    Math.sin(theta * 8.1 - seed * 0.6 + ring * 0.7) * 0.2
  );
}

/** 确定性伪随机（0~1），用于顶点色微差 */
function hash01(a: number, b: number, c: number): number {
  const value = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * R12.0-B：竖向破口场（0~1）。在 breachCount 个确定性方位上生成宽幅裂口，
 * 随层位向下扭转（真实破口的撕裂缝不是铅垂线），下半部环带因此被打断。
 *
 * - 方位不均分：每条破口在等分方位上做确定性偏移（±1/4 间距）；
 * - 角向包络宽（约 ±0.42~0.62 rad），两侧各留一道窄「翻缘」外凸带，
 *   破口读成撕开的岩缝而不是又一条对称沟槽；
 * - 竖向权重 smoothstep(0.3, 0.5, depthRatio)：顶环 / 上檐完全不动，
 *   中下部逐层加深，且逐层强度有节奏变化（层与层的破口深浅不同）。
 *
 * 返回 { cut, lip }：cut 为向内切削强度（乘 breachDepth 用），lip 为
 * 破口两侧翻缘的外凸强度（乘 breachDepth * 0.3 用）。
 */
export function islandBreachField(
  theta: number,
  depthRatio: number,
  seed: number,
  breachCount: number,
  ringIndex = 0,
): { cut: number; lip: number } {
  if (breachCount <= 0) return { cut: 0, lip: 0 };
  const vertical = smoothstep(0.3, 0.5, depthRatio);
  if (vertical <= 0) return { cut: 0, lip: 0 };
  let cut = 0;
  let lip = 0;
  for (let k = 0; k < breachCount; k += 1) {
    const spacing = (Math.PI * 2) / breachCount;
    // 方位确定性偏移（±1/4 间距），破口不再等分环带
    const center =
      k * spacing +
      (hash01(k + 1, seed, 5.3) - 0.5) * spacing * 0.5 +
      seed * 0.35;
    // 随层位扭转：破口向深处偏转（每层 ~0.4 rad），裂缝读成斜向撕裂
    const twist = depthRatio * 0.42 + Math.sin(k * 2.1 + seed) * 0.08;
    let offset = theta - center - twist;
    while (offset > Math.PI) offset -= Math.PI * 2;
    while (offset < -Math.PI) offset += Math.PI * 2;
    // 宽幅包络：核心全深切，边缘 0.62 rad 外归零
    const halfWidth = 0.42 + 0.2 * hash01(k + 3, seed, 2.7);
    const envelope = smoothstep(halfWidth, halfWidth * 0.22, Math.abs(offset));
    // 逐层强度节奏：同一破口在不同层的深切程度不同（0.55~1）
    const layerPulse =
      0.78 +
      0.22 * Math.sin(ringIndex * 1.9 + k * 2.4 + seed * 1.1) *
        (0.5 + 0.5 * hash01(k + 7, seed, 1.9));
    cut = Math.max(cut, envelope * layerPulse);
    // 翻缘：核心外 0.62~0.95 半宽处的一道窄外凸
    const lipBand =
      smoothstep(halfWidth * 1.55, halfWidth * 1.05, Math.abs(offset)) *
      smoothstep(halfWidth * 0.78, halfWidth * 1.02, Math.abs(offset));
    const lipPulse =
      0.5 + 0.5 * Math.sin(theta * 3.1 + k * 4.2 + seed * 0.9);
    lip = Math.max(lip, lipBand * (0.55 + 0.45 * lipPulse));
  }
  return { cut: cut * vertical, lip: lip * vertical };
}

/**
 * R12.1-A：局部岩突 / 断面场（0~1）。破口负责「把环带撕开」，本场负责
 * 「局部凸起与凹陷」——在少数确定性 (方位 × 深度带) 上放 4 处外凸岩突
 * 与 3 处窄幅断面，打破层带沿环向均匀起伏的节奏：
 *
 * - bulge：宽幅（±0.26~0.4 rad）平滑外凸，只在各自的深度带内进出——
 *   岩壁读出「局部凸出的岩嘴」，而不是整圈同步的波浪；
 * - notch：窄幅（±0.09~0.16 rad）深切，方位与沟槽错开——读出「断面」；
 * - depthRatio < 0.14 或 > 0.84 全部归零：顶环与雪檐接缝不受影响，
 *   底部尖端保持收束。
 */
export function islandOutcropField(
  theta: number,
  depthRatio: number,
  seed: number,
  ringIndex = 0,
  outcropCount = 4,
  notchCount = 3,
): { bulge: number; notch: number } {
  const vertical =
    smoothstep(0.14, 0.2, depthRatio) *
    (1 - smoothstep(0.84, 0.9, depthRatio));
  if (vertical <= 0) return { bulge: 0, notch: 0 };
  let bulge = 0;
  let notch = 0;
  for (let k = 0; k < outcropCount; k += 1) {
    const center =
      k * (Math.PI / 2) +
      (hash01(k + 11, seed, 3.9) - 0.5) * 1.1 +
      seed * 0.6;
    // 深度带：每处岩突只在一个 band 内进出（半厚 0.13~0.21）
    const bandCenter = 0.24 + 0.36 * hash01(k + 5, seed, 6.1);
    const bandHalf = 0.13 + 0.08 * hash01(k + 9, seed, 2.3);
    const depthEnv =
      smoothstep(bandCenter + bandHalf, bandCenter, depthRatio) *
      smoothstep(bandCenter - bandHalf, bandCenter, depthRatio);
    if (depthEnv <= 0) continue;
    let offset = theta - center;
    while (offset > Math.PI) offset -= Math.PI * 2;
    while (offset < -Math.PI) offset += Math.PI * 2;
    const halfWidth = 0.26 + 0.14 * hash01(k + 13, seed, 4.7);
    const angEnv = smoothstep(halfWidth, halfWidth * 0.25, Math.abs(offset));
    const pulse = 0.7 + 0.3 * Math.sin(ringIndex * 1.3 + k * 2.2 + seed);
    bulge = Math.max(bulge, angEnv * depthEnv * pulse);
  }
  for (let k = 0; k < notchCount; k += 1) {
    const center =
      (k * Math.PI * 2) / 3 +
      0.9 +
      (hash01(k + 17, seed, 7.7) - 0.5) * 1.4 +
      seed * 0.22;
    const bandCenter = 0.3 + 0.4 * hash01(k + 21, seed, 1.3);
    const bandHalf = 0.16 + 0.1 * hash01(k + 23, seed, 5.9);
    const depthEnv =
      smoothstep(bandCenter + bandHalf, bandCenter, depthRatio) *
      smoothstep(bandCenter - bandHalf, bandCenter, depthRatio);
    if (depthEnv <= 0) continue;
    let offset = theta - center;
    while (offset > Math.PI) offset -= Math.PI * 2;
    while (offset < -Math.PI) offset += Math.PI * 2;
    const halfWidth = 0.09 + 0.07 * hash01(k + 27, seed, 3.1);
    const angEnv = smoothstep(halfWidth, 0, Math.abs(offset));
    const pulse = 0.72 + 0.28 * Math.sin(ringIndex * 0.9 + k * 3.1 - seed);
    notch = Math.max(notch, angEnv * depthEnv * pulse);
  }
  return { bulge: bulge * vertical, notch: notch * vertical };
}

/**
 * 岩层剖面（高度归一化 0~1；此前按绝对 Y 写死，导致项目屿 depth 小于
 * 14 时剖面倒插回上方——这是 R2 大型深色怪物的根因之一）。
 *
 * 四种剖面给不同浮岛明确的体量语言：
 * - spire：主岛的深尖脊 + 外凸岩檐；
 * - mesa：平台式机库岛，中段留出大体积机械基座；
 * - shard：碎裂观测岛，岩层错位更明显；
 * - rooted：生态岛，下缘保留宽根须而不是收成针尖。
 */
const PROFILES: Record<
  IslandProfile,
  ReadonlyArray<{ t: number; radius: number; yFrac: number }>
> = {
  spire: [
    { t: 0.0, radius: 0.985, yFrac: 0 },
    { t: 0.03, radius: 1.015, yFrac: 0.006 },
    { t: 0.08, radius: 0.972, yFrac: 0.04 },
    { t: 0.12, radius: 1.005, yFrac: 0.07 },
    { t: 0.155, radius: 0.94, yFrac: 0.1 },
    { t: 0.22, radius: 0.885, yFrac: 0.17 },
    { t: 0.29, radius: 0.935, yFrac: 0.23 },
    { t: 0.33, radius: 0.805, yFrac: 0.27 },
    { t: 0.4, radius: 0.72, yFrac: 0.34 },
    { t: 0.5, radius: 0.78, yFrac: 0.42 },
    { t: 0.56, radius: 0.62, yFrac: 0.47 },
    { t: 0.64, radius: 0.5, yFrac: 0.55 },
    { t: 0.72, radius: 0.43, yFrac: 0.65 },
    { t: 0.8, radius: 0.31, yFrac: 0.75 },
    { t: 0.88, radius: 0.22, yFrac: 0.85 },
    { t: 0.945, radius: 0.12, yFrac: 0.95 },
    { t: 1.0, radius: 0.06, yFrac: 1 },
  ],
  mesa: [
    { t: 0.0, radius: 0.988, yFrac: 0 },
    { t: 0.04, radius: 1.018, yFrac: 0.01 },
    { t: 0.1, radius: 0.982, yFrac: 0.06 },
    { t: 0.16, radius: 1.008, yFrac: 0.11 },
    { t: 0.2, radius: 0.9, yFrac: 0.15 },
    { t: 0.27, radius: 0.94, yFrac: 0.22 },
    { t: 0.34, radius: 0.82, yFrac: 0.3 },
    { t: 0.44, radius: 0.86, yFrac: 0.4 },
    { t: 0.54, radius: 0.7, yFrac: 0.5 },
    { t: 0.66, radius: 0.62, yFrac: 0.62 },
    { t: 0.78, radius: 0.46, yFrac: 0.75 },
    { t: 0.9, radius: 0.28, yFrac: 0.88 },
    { t: 1.0, radius: 0.08, yFrac: 1 },
  ],
  shard: [
    { t: 0.0, radius: 1.0, yFrac: 0 },
    { t: 0.05, radius: 1.02, yFrac: 0.01 },
    { t: 0.09, radius: 0.9, yFrac: 0.05 },
    { t: 0.14, radius: 0.99, yFrac: 0.09 },
    { t: 0.21, radius: 0.8, yFrac: 0.16 },
    { t: 0.24, radius: 0.92, yFrac: 0.19 },
    { t: 0.33, radius: 0.7, yFrac: 0.28 },
    { t: 0.43, radius: 0.78, yFrac: 0.37 },
    { t: 0.52, radius: 0.58, yFrac: 0.46 },
    { t: 0.64, radius: 0.48, yFrac: 0.58 },
    { t: 0.76, radius: 0.32, yFrac: 0.72 },
    { t: 0.88, radius: 0.19, yFrac: 0.87 },
    { t: 1.0, radius: 0.05, yFrac: 1 },
  ],
  rooted: [
    { t: 0.0, radius: 0.985, yFrac: 0 },
    { t: 0.03, radius: 1.015, yFrac: 0.008 },
    { t: 0.1, radius: 0.97, yFrac: 0.05 },
    { t: 0.18, radius: 0.94, yFrac: 0.12 },
    { t: 0.28, radius: 0.84, yFrac: 0.2 },
    { t: 0.38, radius: 0.88, yFrac: 0.3 },
    { t: 0.48, radius: 0.72, yFrac: 0.4 },
    { t: 0.58, radius: 0.76, yFrac: 0.52 },
    { t: 0.68, radius: 0.56, yFrac: 0.64 },
    { t: 0.8, radius: 0.47, yFrac: 0.78 },
    { t: 0.9, radius: 0.3, yFrac: 0.9 },
    { t: 1.0, radius: 0.14, yFrac: 1 },
  ],
  /**
   * 主岛岬角剖面（R7）：顶部第一圈收进雪檐之下，之后是两级大岩檐
   * （而不是每层都外凸的圆盘），中段以斜面与错落层理为主，深部再收成
   * 不对称尖脊。宽度节奏刻意不等距，避免 16 层等高圆环的机械感。
   */
  headland: [
    { t: 0.0, radius: 0.952, yFrac: 0 },
    { t: 0.022, radius: 0.966, yFrac: 0.008 },
    { t: 0.058, radius: 0.978, yFrac: 0.032 },
    { t: 0.1, radius: 0.994, yFrac: 0.06 },
    { t: 0.152, radius: 0.958, yFrac: 0.087 },
    // R11.1：层厚节奏不均——上檐厚 / 中段收薄 / 中下部再放厚，
    // 打破等距层环的机械感（radius 轮廓保持两级岩檐结构）
    { t: 0.212, radius: 0.988, yFrac: 0.127 },
    { t: 0.318, radius: 0.924, yFrac: 0.19 },
    { t: 0.368, radius: 0.89, yFrac: 0.248 },
    { t: 0.452, radius: 0.94, yFrac: 0.318 },
    { t: 0.545, radius: 0.828, yFrac: 0.404 },
    { t: 0.652, radius: 0.776, yFrac: 0.492 },
    { t: 0.72, radius: 0.8, yFrac: 0.582 },
    { t: 0.802, radius: 0.596, yFrac: 0.678 },
    { t: 0.856, radius: 0.482, yFrac: 0.772 },
    { t: 0.918, radius: 0.364, yFrac: 0.862 },
    { t: 0.966, radius: 0.226, yFrac: 0.938 },
    { t: 1.0, radius: 0.072, yFrac: 1 },
  ],
};

/**
 * R10 岩层分带：此前五档全部落在同一窄蓝区间（#7E9DBB→#23445F），
 * 明度台阶小、色相无漂移，岩壁读成一摞「深蓝塑料环」。现改为
 * 上部风化灰 → 中部蓝灰 → 深部饱和冷蓝的双轴渐变：明度台阶拉开，
 * 色相随深度缓慢漂移（灰青 → 蓝 → 蓝紫），层与层之间靠色相差而非
 * 只有明度差区分。
 */
const ROCK_TOP = new Color("#B3C6D6");
const ROCK_UPPER = new Color("#87A2B6");
// R12.0-B：中段提亮 / 深部加深半档——中下部层与层之间的明度台阶
// 从 ~12% 拉到 ~18%，侧视时层理读得出「带与带」而不是连续渐变
const ROCK_MID = new Color("#6286A4");
const ROCK_DEEP = new Color("#35587D");
const ROCK_ABYSS = new Color("#27496E");
/** 主岛岩体的冷光提亮：背光侧仍能读出上部层理，而不是一整块深色 */
const ROCK_ORGANIC_LIFT = new Color("#C7DAEA");

/**
 * R12.0-D（G1）：大气透视目标色——介于雾色（#B7D6EC）与地平线色
 * （#E6F5FF）之间。远景层以 atmosphereFade 向此色过渡，剪影读成
 * 「雾中淡影」而不是深色实体。
 */
const ATMOSPHERE_TONE = new Color("#C6DCEB");

/**
 * 岩壁颜色：按竖向深度分带 + 面级微差，读得出层理而不是一整块蓝。
 * organic 开启时叠加随角度弯曲的深度偏移与细密沉积纹——颜色带不再
 * 严格水平，和起伏后的岩层边界保持一致。
 *
 * R10：gully ∈ 0~1 为侵蚀沟槽强度（与几何位移场同公式，材质跟着
 * 几何走）——沟内压暗偏冷灰，扶壁脊背保持受光，岩壁因此读出
 * 「沟壑与扶壁」而不是一摞规则塑料盘。
 */
const GROOVE_SHADOW = new Color("#3D5468");

function rockColor(
  y: number,
  depth: number,
  shade: number,
  theta: number,
  organic: boolean,
  gully = 0,
  seed = 0,
): Color {
  // R11.2：色带边界立体化——warp 从平面角向波升级为「角向 × 高度」
  // 双变量场（振幅 0.034/0.02 → 0.085/0.045 + 高度耦合项），层与层的
  // 分界线随高度起伏倾斜，不再是水平环带
  const warp = organic
    ? 0.085 * Math.sin(theta * 2.7 + 0.9) +
      0.045 * Math.sin(theta * 5.1 - 1.4) +
      0.05 * Math.sin(theta * 1.8 + y * 0.22)
    : 0;
  const t = clamp01(-y / depth + warp);
  const color = new Color();
  // R11.1：深色带下移（0.62→0.66）——中下部更多蓝灰层理可读，
  // 深渊色只留在真正深部；整体深蓝面积收小但层次保持
  if (t < 0.06) color.copy(ROCK_TOP).lerp(ROCK_UPPER, t / 0.06);
  else if (t < 0.28) color.copy(ROCK_UPPER).lerp(ROCK_MID, (t - 0.06) / 0.22);
  else if (t < 0.66) color.copy(ROCK_MID).lerp(ROCK_DEEP, (t - 0.28) / 0.38);
  else color.copy(ROCK_DEEP).lerp(ROCK_ABYSS, (t - 0.66) / 0.34);
  // 沉积纹：主波 + 次谐波，随角度弯曲且强弱不均——层理读成
  // 「起伏的岩层界线」而不是一圈圈等高亮环（R12.1-A：振幅再提半档，
  // 配合层理明度台阶，界线在远景也读得出错落）
  const band = organic
    ? Math.sin((-y * 1.05 + Math.sin(theta * 2.2) * 1.6) * 3.1) * 0.046 +
      Math.sin((-y * 2.3 + theta * 1.3) * 2.2) * 0.02
    : 0;
  // R10：面级明暗差 0.2→0.26，低多边形切面在逆光下也读得出体积
  color.multiplyScalar(0.9 + shade * 0.26 + band);
  if (organic) {
    // R12.1-A：层理明度台阶——把深度坐标按 0.055·depth 分片，每片做
    // 确定性明度 / 色相偏移（±8%），配合几何层错，相邻层的分界读出
    // 「跳变」而不是连续渐变；大面积深蓝区域因此被纵向打散
    const slabIndex = Math.floor(-y / (depth * 0.055));
    color.multiplyScalar(0.92 + 0.16 * hash01(slabIndex, seed, 8.8));
    color.offsetHSL((hash01(slabIndex, seed, 4.2) - 0.5) * 0.014, 0, 0);
  }
  if (gully > 0) {
    // R11.1：沟槽压暗 0.34→0.30，配合主岛冷光提亮 0.08→0.11——
    // 背光面读得出层理，不再整片沉进深蓝
    color.lerp(GROOVE_SHADOW, gully * 0.3);
  }
  if (organic) color.lerp(ROCK_ORGANIC_LIFT, 0.11);
  return color;
}

/**
 * 岩体网格（非索引 + 面法线）：多层收束、角向凹凸、错层岩阶。
 *
 * R7：新增 strataTilt / buttressCount。开启后：
 * - 同一角度波场作用于所有中间层 → 层理整体起伏倾斜，不再是水平圆盘；
 * - 竖向沟槽只切削部分角度，且深度随层位变化 → 岩壁有扶壁与凹槽；
 * - 顶沿半径收在雪檐以内（配合 headland 剖面），雪与岩不再相互穿插。
 */
export function createLayeredIslandGeometry({
  radiusX,
  radiusZ,
  depth,
  seed,
  jaggedness = 0.055,
  segments = 64,
  profile = "spire",
  strataTilt = 0,
  buttressCount = 0,
  buttressDepth = 0.05,
  layerJitter = 0.014,
  breachCount = 0,
  breachDepth = 0.13,
  outcropCount = 4,
  notchCount = 3,
  atmosphereFade = 0,
}: IslandGeometryOptions): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const profileLayers = PROFILES[profile];
  const layerCount = profileLayers.length;
  const organic = strataTilt > 0 || buttressCount > 0;
  const baseYs = profileLayers.map((layer) => -depth * layer.yFrac);
  // 只给「局部外凸」的岩层做积雪高光；普通收束面保持岩色，
  // 这样层理会出现在几处而不是一圈等高亮环。
  const ledgeRings = profileLayers.map((layer, index) => {
    if (!organic || index === 0 || index === layerCount - 1) return false;
    const above = profileLayers[index - 1].radius;
    const below = profileLayers[index + 1].radius;
    return layer.radius > above + 0.006 && layer.radius > below + 0.006;
  });
  const rings = profileLayers.map((layer, ringIndex) => {
    const vertices: Array<{ x: number; z: number }> = [];
    const depthRatio = ringIndex / (layerCount - 1);
    for (let i = 0; i < segments; i += 1) {
      const theta = (i / segments) * Math.PI * 2;
      // 低频轮廓波：让岛缘不再是一条标准椭圆；越深越明显。
      // R11.1：加入逐层相位（0.37/0.53/0.29）——每层岩缘的凹凸位置
      // 各不相同，深浅层不再共用同一条波浪轮廓（消除重复感）
      const lobe = organic
        ? Math.sin(theta * 2 + seed * 1.2 + 0.4 + ringIndex * 0.37) * 0.034 +
          Math.sin(theta * 3.7 - seed * 0.9 + ringIndex * 0.53) * 0.019 +
          Math.sin(theta * 5.9 + seed * 2.1 - ringIndex * 0.29) * 0.009
        : 0;
      // R12.1-A：逐层起伏节奏——每层的轮廓波振幅独立调制（约 0.55~1.45），
      // 相邻层的粗糙 / 平静交替出现，打破「每层共用同一波形」的重复感
      const layerAmp = Math.max(
        0.55,
        1 +
          0.45 * Math.sin(ringIndex * 1.13 + seed * 2.3) +
          0.25 * Math.sin(ringIndex * 0.47 - seed * 0.8),
      );
      const perturbation =
        1 +
        jaggedness *
          angularNoise(theta, seed, ringIndex) *
          (0.45 + depthRatio * 0.9) +
        // R11：轮廓波随深度加速增强（0.85→1.5）——顶部一圈保持收在雪檐
        // 之下，中深部侧影获得更明显的不规则缩进 / 外凸，摆脱圆盘轮廓
        lobe * (0.38 + depthRatio * 1.5) * layerAmp;
      // 侵蚀沟槽：奇数条、深浅交替、随深度轻微扭转
      const groove =
        buttressCount > 0
          ? Math.pow(
              0.5 +
                0.5 *
                  Math.cos(
                    theta * buttressCount + seed * 1.7 + depthRatio * 0.55,
                  ),
              2.4,
            ) *
            buttressDepth *
            (0.55 + 0.45 * Math.sin(theta * 1.9 - seed * 0.8)) *
            (0.3 + depthRatio * 0.9)
          : 0;
      // R11.2：逐层半径节奏——每层按自身序号做确定性宽窄变化（±3.5%），
      // 叠加 R11.1 的逐层轮廓相位，各层宽度与凹凸位置都不同
      const layerGauge =
        1 +
        0.035 * Math.sin(ringIndex * 2.7 + seed * 1.3) +
        0.02 * Math.sin(ringIndex * 1.3 - seed * 0.7);
      // R12.0-B：竖向破口——宽幅裂口在中下部把环带打断，两侧翻缘外凸
      const breach =
        breachCount > 0
          ? islandBreachField(theta, depthRatio, seed, breachCount, ringIndex)
          : { cut: 0, lip: 0 };
      const breachInset = breachDepth * breach.cut;
      const breachLip = breachDepth * 0.3 * breach.lip;
      // R12.1-A：局部岩突 / 断面——少数 (方位 × 深度带) 上的平滑外凸与
      // 窄幅深切（相对半径 ±6~8%），岩壁不再只有整圈同步的起伏
      const outcrop =
        organic && (outcropCount > 0 || notchCount > 0)
          ? islandOutcropField(theta, depthRatio, seed, ringIndex, outcropCount, notchCount)
          : { bulge: 0, notch: 0 };
      const outcropDelta = 0.075 * outcrop.bulge - 0.06 * outcrop.notch;
      // R12.1-A：底部收束不对称——最下 2~3 层随角向渐进内收（风蚀龙骨），
      // 底尖不再是均匀漏斗；幅度 ≤7.5%，只影响轮廓节奏不改深度
      const keel =
        smoothstep(0.86, 1, depthRatio) *
        (0.045 * (0.5 + 0.5 * Math.sin(theta * 2.3 + seed * 1.1)) +
          0.03 * Math.sin(theta * 5.1 - seed * 0.7));
      const radius =
        layer.radius *
        layerGauge *
        perturbation *
        (1 - Math.max(0, groove)) *
        (1 - breachInset + breachLip) *
        (1 + outcropDelta) *
        (1 - keel);
      vertices.push({
        x: Math.cos(theta) * radiusX * radius,
        z: Math.sin(theta) * radiusZ * radius,
      });
    }
    return { layer, vertices, ringIndex };
  });

  const ringY = (ringIndex: number, theta: number): number => {
    const base = baseYs[ringIndex];
    if (ringIndex === 0 || ringIndex === layerCount - 1) return base;
    const depthRatio = ringIndex / (layerCount - 1);
    // 顶部 / 底部锚定，中间层才允许整体倾斜，避免顶沿脱离雪檐。
    // R11.1：倾斜波加入逐层相位——各层倾斜的方位不同步，岩层错落
    const anchor =
      smoothstep(0.09, 0.3, depthRatio) *
      (1 - smoothstep(0.82, 0.985, depthRatio));
    const wave =
      0.62 * Math.sin(theta * 2.05 + seed * 1.4 + ringIndex * 0.23) +
      0.28 * Math.sin(theta * 3.4 - seed * 0.7 + ringIndex * 0.41) +
      0.1 * Math.sin(theta * 5.9 + seed * 2.3);
    const tilt = strataTilt * depth * wave * anchor;
    const gapAbove = baseYs[ringIndex - 1] - base;
    const gapBelow = base - baseYs[ringIndex + 1];
    // R11.1：层错上限 0.22→0.34 邻层间距——竖向错落更明显，
    // 层与层的间距读出厚薄变化而不是等高环带
    const jitterLimit = Math.max(
      0.001,
      Math.min(gapAbove, gapBelow) * 0.34,
    );
    const jitter =
      Math.sin(theta * 4.1 + seed * 2.3 + ringIndex * 1.7) * 0.5 +
      Math.sin(theta * 7.7 - seed + ringIndex * 0.8) * 0.5;
    // R12.0-B：层带跳变——下半部每层附加一个确定性整体错位（不随角度
    // 变化），相邻层的间距读出明显的厚薄节奏；折进既有 jitterLimit 钳制，
    // 保证层序不交叉、底部尖端不受影响
    const stepOffset =
      organic && depthRatio > 0.45
        ? (hash01(ringIndex, seed, 9.1) - 0.5) * 2 * layerJitter * depth * 0.8
        : 0;
    return (
      base +
      tilt +
      Math.max(
        -jitterLimit,
        Math.min(
          jitterLimit,
          jitter * layerJitter * depth + stepOffset,
        ),
      )
    );
  };

  const pushFace = (
    a: { x: number; y: number; z: number },
    b: { x: number; y: number; z: number },
    c: { x: number; y: number; z: number },
    shade: number,
    ledge: boolean,
  ) => {
    const avgY = (a.y + b.y + c.y) / 3;
    const avgX = (a.x + b.x + c.x) / 3;
    const avgZ = (a.z + b.z + c.z) / 3;
    const theta = Math.atan2(avgZ, avgX);
    // R10：沟槽强度场（与上方 groove 位移同公式，按面心 y 估深度比），
    // 归一化到 0~1 后交给 rockColor——侵蚀沟压暗，扶壁脊保持受光
    let gully = 0;
    if (buttressCount > 0) {
      const depthRatio = clamp01(-avgY / depth);
      gully = clamp01(
        (Math.pow(
          0.5 +
            0.5 *
              Math.cos(
                theta * buttressCount + seed * 1.7 + depthRatio * 0.55,
              ),
          2.4,
        ) *
          (0.55 + 0.45 * Math.sin(theta * 1.9 - seed * 0.8)) *
          (0.3 + depthRatio * 0.9)) /
          Math.max(0.008, buttressDepth),
      );
    }
    // 朝上的岩面（岩檐 / 平台）积一层雪：让分层剖面在逆光下仍可读
    // R12.0-B：破口内部压暗——裂缝面心命中破口场时向沟槽阴影色过渡，
    // 破口读出「深度」而不是一圈等宽的内缩（与几何位移场同公式）
    let breachCut = 0;
    if (breachCount > 0) {
      breachCut = islandBreachField(
        theta,
        clamp01(-avgY / depth),
        seed,
        breachCount,
        Math.round(clamp01(-avgY / depth) * (layerCount - 1)),
      ).cut;
    }
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const abz = b.z - a.z;
    const acx = c.x - a.x;
    const acy = c.y - a.y;
    const acz = c.z - a.z;
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    const normalY = ny / (Math.hypot(nx, ny, nz) || 1);
    const color = rockColor(avgY, depth, shade, theta, organic, gully, seed);
    if (breachCut > 0) {
      color.lerp(GROOVE_SHADOW, Math.min(0.5, breachCut * 0.45));
    }
    // R12.1-A：岩突受光 / 断面压暗——颜色跟随局部凸凹场，岩壁读出
    // 「局部岩嘴的高光与断面的阴影」，而不是等宽的层间渐变
    if (organic) {
      const relief = islandOutcropField(
        theta,
        clamp01(-avgY / depth),
        seed,
        Math.round(clamp01(-avgY / depth) * (layerCount - 1)),
        outcropCount,
        notchCount,
      );
      const outcropRelief = relief.bulge - relief.notch;
      if (outcropRelief > 0) {
        color.lerp(ROCK_ORGANIC_LIFT, Math.min(0.14, outcropRelief * 0.14));
      } else if (outcropRelief < 0) {
        color.lerp(GROOVE_SHADOW, Math.min(0.3, -outcropRelief * 0.34));
      }
    }
    // R10.1：岩檐积雪的「角向占有率」——旧版每一段外凸岩檐都均匀积雪，
    // 一圈圈亮环正是「规则塑料层」观感的来源之一；现在雪只在部分弧段
    // 保留，裸岩弧段露出层理色，环带节奏被打散
    const snowBelt =
      0.5 +
      0.28 * Math.sin(theta * 2.9 + seed * 1.3) +
      0.22 * Math.sin(theta * 5.7 - seed * 0.7);
    const snowPresence = organic
      ? Math.max(0.12, Math.min(1, snowBelt))
      : 1;
    if (normalY > 0.34) {
      color.lerp(LEDGE_SNOW, Math.min(0.86, (normalY - 0.34) / 0.55) * snowPresence);
    } else if (ledge && normalY > 0.02) {
      // 外凸岩檐的上表面：薄雪 + 冰尘，背光侧也能看出分层
      color.lerp(LEDGE_SNOW, Math.min(0.64, 0.22 + normalY * 0.9) * snowPresence);
    }
    if (normalY < -0.12) {
      // 岩檐底面：压暗，雪檐与岩壁之间才有厚度
      color.multiplyScalar(organic ? 0.86 : 0.9);
    }
    // R12.0-D（G1）：大气透视烘焙——远景层专用，顶点色向雾色调收拢
    if (atmosphereFade > 0) {
      color.lerp(ATMOSPHERE_TONE, atmosphereFade);
    }
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < 3; i += 1) colors.push(color.r, color.g, color.b);
  };

  for (let r = 0; r < rings.length - 1; r += 1) {
    const upper = rings[r];
    const lower = rings[r + 1];
    for (let i = 0; i < segments; i += 1) {
      const next = (i + 1) % segments;
      const thetaA = (i / segments) * Math.PI * 2;
      const thetaB = (next / segments) * Math.PI * 2;
      const a = { ...upper.vertices[i], y: ringY(r, thetaA) };
      const b = { ...upper.vertices[next], y: ringY(r, thetaB) };
      const c = { ...lower.vertices[next], y: ringY(r + 1, thetaB) };
      const d = { ...lower.vertices[i], y: ringY(r + 1, thetaA) };
      const shade = hash01(r + 1, i + 1, seed) - 0.5;
      // 外向绕序（a→b→c / a→c→d）：保证从岛外看是正面，不被背面剔除
      pushFace(a, b, c, shade + 0.08, ledgeRings[r]);
      pushFace(a, c, d, shade - 0.1, ledgeRings[r]);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * R10 雪顶分色：整体基调下压半档（SNOW_BASE/SHADE），给高光留出明度
 * 空间——此前大面积顶到 #F2FAFF，地表在强日光下过曝成一片平白。
 * SNOW_SCULPT 同步加深，坡面 / 背光 / 洼地的染色才有可读的对比。
 */
const SNOW_HIGH = new Color("#F2FAFF");
const SNOW_BASE = new Color("#C0D9EC");
const SNOW_SHADE = new Color("#A6C4DB");
const SNOW_RIM = new Color("#7FA2C2");
/** 地形结构的冷色阴影：雪脊背光面 / 风蚀洼地，比整体噪声阴影更深一档 */
const SNOW_SCULPT = new Color("#92B6D3");
const RIM_ROCK = new Color("#8FB0CB");
const LEDGE_SNOW = new Color("#E5F2FC");
const ICE_PATCH = new Color("#9CCEEB");
/**
 * 路旁压实雪（R10.1）：道路两侧被行人 / 信灯反复碾过的雪壳——
 * 比松雪（SNOW_BASE）更深更灰、比冰壳斑块（ICE_PATCH）更中性的
 * 一档。沿路网折线成带，把「路面 → 路缘 → 雪」的三段式衔接读出来。
 */
const SNOW_PACKED = new Color("#A5C0D6");

/**
 * 顶面网格：径向细分 + 可插入的高度函数。
 *
 * R7：雪檐不再是一圈等高直角边——下折深度随角度变化（雪舌 / 风口），
 * 外缘半径叠加环向错动，檐口底部向岩色过渡；地表按高度场坡度着色，
 * 让雪脊、背风面和近岩缘的冰壳有可读的明暗分区。
 */
export function createIslandTopGeometry({
  radiusX,
  radiusZ,
  seed,
  segments = 96,
  rings = 26,
  heightAt,
  rimDepth = 0.42,
  rimScallop = 0,
  slopeTint = 0,
  rimRockBlend = 0,
  zoneAt,
  rockSlopeTint = 0,
  hollowIceTint = 0,
  atmosphereFade = 0,
}: IslandTopOptions): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const radialCount = rings + 1;
  // R7 的檐口 / 坡度染色只作用于开启选项的岛（当前只有主岛），
  // 三屿与远景岛保持 R5.1 的既有外观。
  // R10 解耦：organicRim 只管「颜色分层」（坡度染色 / 冰壳斑块），
  // sculptedLip 才改变檐口几何形状——项目屿开启 slopeTint 时
  // 只获得着色，岛缘剪影保持原样。
  const organicRim = rimScallop > 0 || slopeTint > 0 || rimRockBlend > 0;
  const sculptedLip = rimScallop > 0 || rimRockBlend > 0;
  const rimNoise = (theta: number) =>
    1 +
    // R11.2：平面轮廓噪声 0.012/0.007 → 0.028/0.015——顶面外缘与
    // 檐口跟随同一条起伏轮廓，俯视时岛缘不再读作标准椭圆
    (Math.sin(theta * 3 + seed) * 0.028 +
      Math.sin(theta * 7 - seed * 1.7) * 0.015) +
    rimScallop *
      (Math.sin(theta * 3.1 + seed * 0.9) * 0.65 +
        Math.sin(theta * 6.3 - seed * 1.2) * 0.35);

  for (let ring = 0; ring <= radialCount; ring += 1) {
    const t = ring / radialCount;
    // 前 92% 是地表，最后 8% 是下折的雪檐
    const isLip = t > 0.92;
    for (let i = 0; i < segments; i += 1) {
      const theta = (i / segments) * Math.PI * 2;
      const rim = rimNoise(theta);
      let radius = t;
      let x = 0;
      let z = 0;
      let y: number;
      if (isLip) {
        const k = (t - 0.92) / 0.08;
        // R11.1：檐口与地表连续混合——k=0 处完全等于地表行（半径
        // t·rim、高度 heightAt），k=1 才收成雕塑檐口。顶缘轮廓跟随
        // rimNoise 起伏，顶部与侧面岩层自然衔接，不再有外凸平台或断差
        const surfaceRadius = t * rim;
        const sx = Math.cos(theta) * radiusX * surfaceRadius;
        const sz = Math.sin(theta) * radiusZ * surfaceRadius;
        const surfaceY =
          (heightAt?.(theta, surfaceRadius, sx, sz) ?? 0) *
            smoothstep(0, 0.16, t) -
          0.035;
        let lipRadius: number;
        let lipY: number;
        if (sculptedLip) {
          // 檐口上半段外凸、末端略收，形成有厚度的雪檐而不是直边
          lipRadius =
            0.998 +
            k * 0.006 -
            k * k * 0.01 +
            Math.sin(Math.min(1, k * 1.2) * Math.PI * 0.7) * rimScallop * 0.5;
          const tongue =
            0.5 + 0.5 * Math.sin(theta * 4.7 + seed * 1.3);
          const depthScale =
            0.72 +
            0.42 * tongue +
            0.18 * Math.sin(theta * 2.2 - seed * 0.9);
          lipY = -0.05 - k * rimDepth * depthScale;
        } else {
          lipRadius = 0.998 + k * 0.004;
          lipY = -0.05 - k * 0.42;
        }
        radius = surfaceRadius + (lipRadius * rim - surfaceRadius) * k;
        y = surfaceY + (lipY - surfaceY) * k;
        x = Math.cos(theta) * radiusX * radius;
        z = Math.sin(theta) * radiusZ * radius;
      } else {
        x = Math.cos(theta) * radiusX * radius * rim;
        z = Math.sin(theta) * radiusZ * radius * rim;
        y = (heightAt?.(theta, radius, x, z) ?? 0) * smoothstep(0, 0.16, t);
        y -= 0.035;
      }
      positions.push(x, y, z);
      const shadeNoise =
        Math.sin(theta * 5.2 + seed) * 0.55 +
        Math.sin(theta * 11.3 - seed * 0.7) * 0.3 +
        Math.sin(theta * 2.1 + seed * 1.9) * 0.15;
      const macroPatch =
        Math.sin(theta * 2.3 + seed * 1.7) * 0.6 +
        Math.sin(theta * 3.7 - seed * 0.9) * 0.4;
      // 坡面染色：用高度场差分估计坡度 / 迎光面 / 凹地，
      // 雪脊与风蚀洼地在柔和天光下也有可读的明暗分区
      let slope = 0;
      let sunFacing = 0;
      let hollow = 0;
      if (slopeTint > 0 || rockSlopeTint > 0 || hollowIceTint > 0) {
        if (heightAt && !isLip) {
          const eps = 0.55;
          const h0 = heightAt(theta, radius, x, z);
          const hL = heightAt(theta, radius, x - eps, z);
          const hR = heightAt(theta, radius, x + eps, z);
          const hB = heightAt(theta, radius, x, z - eps);
          const hF = heightAt(theta, radius, x, z + eps);
          const gx = (hR - hL) / (2 * eps);
          const gz = (hF - hB) / (2 * eps);
          slope = clamp01(Math.hypot(gx, gz) * 0.85);
          // 与主光水平方向 (+x, -z) 的一致度：正 = 迎光，负 = 背光
          sunFacing = Math.max(-1, Math.min(1, -gx * 0.866 + gz * 0.5));
          hollow = (hL + hR + hB + hF) / 4 - h0;
        }
      }
      const color = new Color();
      if (isLip) {
        const k = (t - 0.92) / 0.08;
        color.copy(SNOW_BASE).lerp(SNOW_RIM, smoothstep(0.15, 1, k));
        if (rimRockBlend > 0) {
          color.lerp(RIM_ROCK, smoothstep(0.42, 1, k) * rimRockBlend);
        }
      } else {
        // R10.1：SNOW_HIGH 权重再收一档（0.45+t*0.35 → 0.4+t*0.28）——
        // 向阳坡与外缘不再顶到近纯白，雪面保有中灰蓝的「雪」质感
        color.copy(SNOW_BASE).lerp(SNOW_HIGH, clamp01(0.3 + shadeNoise * 0.5) * (0.4 + t * 0.28));
        color.lerp(SNOW_SHADE, clamp01(-shadeNoise * 0.5) * 0.62);
        if (t > 0.82) color.lerp(SNOW_RIM, (t - 0.82) * 1.8);
        // 大尺度冰壳斑块：蓝白分区让雪原有「区域」，而不是一整块均匀白。
        // R10：叠一层低频径向调制，斑块沿半径强弱变化——
        // 旧版只依赖 theta，冰壳读成从圆心射出的楔形条纹。
        // R10.1：主岛（organicRim）再提强度与覆盖率，冰原分区在
        // 初始视角也能读出来；三屿保持原强度。
        const patchThreshold = organicRim ? 0.06 : -0.05;
        if (macroPatch < patchThreshold) {
          const patchRadial =
            0.62 + 0.38 * Math.sin(radius * 8.6 + theta * 1.7 + seed);
          color.lerp(
            ICE_PATCH,
            Math.min(
              organicRim ? 0.62 : 0.42,
              (patchThreshold - macroPatch) *
                (organicRim ? 0.68 : 0.5) *
                patchRadial,
            ),
          );
        }
        if (slopeTint > 0) {
          color.lerp(SNOW_SCULPT, slope * slopeTint * 0.62);
          if (sunFacing < 0) {
            color.lerp(SNOW_SCULPT, -sunFacing * slopeTint * 0.28);
          } else {
            // R10.1：向阳提亮 0.18→0.1——向阳坡的过曝是初景大面积
            // 冷白的最后来源；背光加深保持不变，明暗关系不变
            color.lerp(SNOW_HIGH, sunFacing * slopeTint * 0.1);
          }
          if (hollow > 0) {
            color.lerp(SNOW_SCULPT, clamp01(hollow * 2.2) * slopeTint * 0.38);
          } else {
            color.lerp(SNOW_HIGH, clamp01(-hollow * 2.2) * slopeTint * 0.14);
          }
          const wind =
            Math.sin(x * 0.55 + z * 0.18 + seed) *
            Math.sin(z * 0.7 - x * 0.11);
          color.offsetHSL(0, 0, wind * 0.012 * slopeTint * (0.35 + slope));
          // 近岩缘的风蚀带：提前从雪色过渡到冰蓝岩缘，削弱「白色圆盘」边
          if (t > 0.85) {
            color.lerp(SNOW_RIM, (t - 0.85) * slopeTint * 1.6);
          }
        }
        // R12.1-D：陡坡露岩 / 洼地结冰——坡折处露出下伏岩色、低洼处结
        // 冰壳，地表的「岩 / 雪 / 冰」三区在颜色层可读（不改高度）
        if (rockSlopeTint > 0 && slope > 0.45) {
          color.lerp(RIM_ROCK, clamp01((slope - 0.45) / 0.4) * rockSlopeTint);
        }
        if (hollowIceTint > 0 && hollow > 0.06) {
          color.lerp(ICE_PATCH, clamp01((hollow - 0.06) * 2.2) * hollowIceTint);
        }
        // R10.1：路旁压实雪带——zoneAt 返回距路网的压实度（0~1），
        // 沿道路把雪压出「路缘 → 压实雪壳 → 野雪」的可读过渡；
        // 排在坡染 / 冰壳之后，靠近道路时由压实带接管地表颜色
        if (zoneAt) {
          const packed = zoneAt(x, z);
          if (packed > 0) {
            color.lerp(SNOW_PACKED, packed * 0.78);
          }
        }
      }
      // 低多边形雪面：极轻的明度扰动，配合 flatShading 读出手工地形
      color.offsetHSL(0, 0, shadeNoise * 0.016);
      // R12.0-D（G1）：大气透视烘焙（远景岛顶面与岩体同口径）
      if (atmosphereFade > 0) {
        color.lerp(ATMOSPHERE_TONE, atmosphereFade);
      }
      colors.push(color.r, color.g, color.b);
    }
  }

  for (let ring = 0; ring < radialCount; ring += 1) {
    for (let i = 0; i < segments; i += 1) {
      const next = (i + 1) % segments;
      const a = ring * segments + i;
      const b = ring * segments + next;
      const c = (ring + 1) * segments + next;
      const d = (ring + 1) * segments + i;
      // 外向绕序（法线 +Y，从上方可见）；此前绕序相反导致顶面被背面剔除
      indices.push(a, c, d, a, b, c);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(new Uint32BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** 主岛顶面微起伏（纯视觉，幅值 ≤0.25；碰撞仍走解析平面 y=0） */
export function mainIslandRelief(
  x: number,
  z: number,
  radiusX: number,
  radiusZ: number,
): number {
  const nx = x / radiusX;
  const nz = z / radiusZ;
  const r = Math.hypot(nx, nz);
  if (r > 1) return 0;
  const theta = Math.atan2(nz, nx);
  const rimBand = smoothstep(0.48, 0.9, r);
  let height =
    0.17 * rimBand * (0.55 + 0.45 * Math.sin(theta * 3.1 + 1.15)) +
    0.08 * Math.sin(theta * 5.4 + 0.4) * smoothstep(0.28, 0.82, r) +
    0.05 * Math.cos(theta * 8.3 - 1.2) * smoothstep(0.58, 0.96, r);
  height *= 1 - smoothstep(0.93, 1, r);
  return Math.max(-0.02, height);
}

/**
 * R12.1-D（D 阶段）：主岛顶面风积雪垄微起伏（纯视觉，幅值 ≤0.17m）。
 *
 * 与 lib/world/layout 的 mainIslandSurfaceY（碰撞同源场）**叠加**使用，
 * 只加在地形顶面几何上——玩家脚下的解析高度场不变，碰撞 / 导航 /
 * 移动手感零影响；开阔雪原因此获得可读的雪垄走向与长阴影。
 * 正值为主（雪垄），负值钳到 ≥−0.035——物件以解析面落位，只允许
 * 「视觉面略高于物件底」的雪埋，不允许视觉面低于物件底造成悬空。
 */
export function mainIslandMicroRelief(x: number, z: number): number {
  // 两组斜向风雪垄（走向交叉，避免平行条纹）+ 一组细碎风纹
  const ridgeA =
    Math.sin(x * 0.42 + z * 0.31 + 1.7) * Math.sin(z * 0.52 - x * 0.18 - 0.6);
  const ridgeB =
    Math.sin(x * 0.71 - z * 0.47 + 0.4) * Math.sin(z * 0.66 + x * 0.24 + 1.1);
  const fine =
    Math.sin(x * 1.6 + z * 1.1 + 2.2) * Math.sin(z * 1.4 - x * 0.9 + 0.5);
  const height = 0.085 * ridgeA + 0.06 * ridgeB + 0.018 * fine;
  return Math.max(-0.035, height);
}

/**
 * Moss 生态舱地被（R4）：径向网格 + 两座树丘 + 一处池盆 + 苔色分区。
 * 不再用一整块平面绿盘；植被落在真实起伏上，池岸与丘顶有明确高差。
 * 调用方负责 dispose。
 */
export function createMossGroundGeometry(
  radius = 5.3,
  seed = 1.7,
  segments = 48,
  rings = 14,
): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const deep = new Color("#3E8B69");
  const mid = new Color("#5DB58A");
  const light = new Color("#8FDDB4");
  const wet = new Color("#4C9A83");
  const color = new Color();

  for (let ring = 0; ring <= rings; ring += 1) {
    const t = ring / rings;
    for (let i = 0; i < segments; i += 1) {
      const theta = (i / segments) * Math.PI * 2;
      const x = Math.cos(theta) * radius * t;
      const z = Math.sin(theta) * radius * t;
      const moundA =
        0.24 * Math.exp(-(((x + 1.9) / 1.65) ** 2) - (((z + 1.5) / 1.4) ** 2));
      const moundB =
        0.19 * Math.exp(-(((x - 2.2) / 1.45) ** 2) - (((z + 1.7) / 1.25) ** 2));
      const basin =
        -0.12 * Math.exp(-(((x - 0.7) / 1.7) ** 2) - (((z - 1.5) / 1.5) ** 2));
      const ripple = 0.035 * Math.sin(theta * 5 + seed) * t;
      const rim = 0.06 * smoothstep(0.86, 1, t);
      const y = Math.max(0, 0.035 + moundA + moundB + basin + ripple + rim);
      positions.push(x, y, z);

      const shade = clamp01(0.32 + moundA * 2.4 + moundB * 2.4 - basin * 2.2);
      color.copy(deep).lerp(mid, shade);
      if (shade > 0.58) color.lerp(light, (shade - 0.58) * 1.4);
      if (basin < -0.03) color.lerp(wet, Math.min(0.4, -basin * 3));
      color.offsetHSL(0, 0, 0.012 * Math.sin(theta * 7 + seed * 2));
      colors.push(color.r, color.g, color.b);
    }
  }
  for (let ring = 0; ring < rings; ring += 1) {
    for (let i = 0; i < segments; i += 1) {
      const next = (i + 1) % segments;
      const a = ring * segments + i;
      const b = ring * segments + next;
      const c = (ring + 1) * segments + next;
      const d = (ring + 1) * segments + i;
      indices.push(a, c, d, a, b, c);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(new Uint32BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * 风格化巨石几何（R4）：低多边形球体 + 确定性顶点扰动 + 平底。
 * 不再使用标准 dodecahedron 直接缩放——那种重复感来自所有石头共享
 * 同一套面；这里以坐标哈希扰动顶点，保留可读切面但每个种子轮廓不同。
 * 返回非索引几何，调用方负责 dispose；flatShading 材质下读作手工岩块。
 */
export function createBoulderGeometry(
  seed: number,
  detail = 1,
  jaggedness = 0.22,
): BufferGeometry {
  const geometry = new IcosahedronGeometry(1, detail);
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const n =
      Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed) * 0.5 +
      Math.sin(x * 5.13 - y * 9.77 + z * 3.11 + seed * 1.7) * 0.3 +
      Math.sin(x * 2.31 + y * 4.17 - z * 7.53 + seed * 0.6) * 0.2;
    const scale = 1 + jaggedness * n;
    // 底部压平并略收，让石块像「埋进雪里」而不是悬浮的多面体
    const flattenedY = y < -0.42 ? -0.42 + (y + 0.42) * 0.22 : y;
    position.setXYZ(
      i,
      x * scale,
      flattenedY * (1 + jaggedness * n * 0.45),
      z * scale,
    );
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export type CrystalShardSpec = {
  readonly x?: number;
  readonly y?: number;
  readonly z?: number;
  readonly height: number;
  readonly radius: number;
  readonly tiltX?: number;
  readonly tiltZ?: number;
  readonly spin?: number;
};

/**
 * 成组晶簇几何（R5）：同一构图里的 2~4 根晶柱合并为 1 个 draw call。
 * 之前每根晶柱 = 柱体 + 晶尖两个 mesh，主岛两组晶簇就要 14 个 mesh；
 * 现在一组晶簇共用一份几何，材质只留一个主题色。调用方负责 dispose。
 */
export function createCrystalSprayGeometry(
  shards: readonly CrystalShardSpec[],
): BufferGeometry {
  const parts: BufferGeometry[] = [];
  for (const shard of shards) {
    const body = new CylinderGeometry(
      shard.radius * 0.32,
      shard.radius,
      shard.height,
      5,
      1,
    ).toNonIndexed();
    body.translate(0, shard.height / 2, 0);
    const tip = new OctahedronGeometry(shard.radius * 0.9, 0);
    tip.scale(0.9, 1.3, 0.9);
    tip.translate(0, shard.height + shard.radius * 0.95, 0);
    const merged = mergeGeometries([body, tip], false);
    body.dispose();
    tip.dispose();
    if (!merged) throw new Error("晶簇几何合并失败");
    merged.rotateX(shard.tiltX ?? 0);
    merged.rotateZ(shard.tiltZ ?? 0);
    merged.rotateY(shard.spin ?? 0);
    merged.translate(shard.x ?? 0, shard.y ?? 0, shard.z ?? 0);
    parts.push(merged);
  }
  const combined = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  if (!combined) throw new Error("晶簇几何合并失败");
  combined.computeVertexNormals();
  combined.computeBoundingSphere();
  return combined;
}
