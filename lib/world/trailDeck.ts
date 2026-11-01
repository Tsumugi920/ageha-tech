/**
 * 分段式径面踏板（R11.6）：把海上蝶径从「一整条半透明丝带」改为
 * 「有节奏的离散石板踏步」。数据层只算踏板的位姿，几何/材质在
 * Trails.tsx 消费；本文件与 layout.ts 同约定——纯 TS、无 three 依赖，
 * node --test 可直接校验（tests/r116-trail-deck.test.mjs）。
 *
 * 背景（R11.5 结论）：trail-c 的 curb/pavement 是一条 3.7m 宽、50m 长
 * 的连续半透明双层丝带，从西侧低机位与径面侧下方看，读作横跨天空的
 * 巨型玻璃带。连接功能（可行走面）来自 layout.ts 的解析蝶径带，与视觉
 * 几何完全解耦——因此踏板只重做视觉，不触碰碰撞与导航。
 */
import { getGroundHeight, PROJECT_ISLES, type Vec3 } from "./layout.ts";

/** 本轮改为分段踏板的蝶径（其余蝶径维持连续丝带视觉） */
export const TRAIL_DECK_IDS: readonly string[] = ["trail-c"];

/** 相邻踏板中距（沿样条弧长，m）。板长 1.7 + 净空 0.6 ≈ 2.3 */
export const DECK_STRIDE = 2.3;
/** 踏板板顶相对可行走面的抬升（脚感仍在解析面上，视觉略高一线） */
export const DECK_TOP_LIFT = 0.02;
/** 石板（pavement 角色）：可行走带宽 3.2，板面收窄到 2.5 降低体量 */
export const DECK_SLAB = { width: 2.5, thickness: 0.14, length: 1.7 } as const;
/** 承托基石（curb 角色）：比石板宽出的一圈深色底沿，给出边界与支撑 */
export const DECK_CURB_PAD = { width: 2.95, thickness: 0.1, length: 2.05 } as const;
/** 导引嵌条（中线角色）：嵌在板顶的主题色短条，取代跨海连续发光线 */
export const DECK_INLAY = { width: 0.16, thickness: 0.02, length: 0.7 } as const;
/** 每隔几块板铺一条嵌条 */
export const DECK_INLAY_EVERY = 2;
/** 板顶低于当地可行走面超过该值即不再铺设（接屿段沉入岛缘，防穿模） */
export const DECK_BURY_LIMIT = 0.08;
/**
 * 岛缘裙部让位（m）：项目屿的视觉岩裙比可行走半径外扩约 1.5~2m，
 * 径面低于屿面爬岛时，踏板在 walkable 半径 + 该让位内不再铺设，
 * 末端收在岩裙之外——踏板「泊到岛基」，而不是插进岩体里。
 */
export const DECK_ISLE_MARGIN = 2.4;
/** 末段收尾：距样条终点不足该值不再铺（终点侧由目标屿盘面接管） */
export const DECK_TAIL_GAP = 0.9;

export type DeckStep = {
  /** 踏板中心（y = 可行走面高度；板顶另加 DECK_TOP_LIFT） */
  x: number;
  y: number;
  z: number;
  /** 绕 Y 朝向（板长边沿路径切线），atan2(tx, tz) 口径与铺装缝一致 */
  angle: number;
};

export type TrailDeck = {
  /** 全部踏板位姿（石板与基石同位叠放） */
  steps: DeckStep[];
  /** 导引嵌条位姿（steps 的隔院子集） */
  inlays: DeckStep[];
  /** 因沉入当地地面而跳过的步数（接屿段） */
  skipped: number;
};

/**
 * 沿蝶径采样折线按弧长等距铺踏板：
 * - 位姿从折线线性插值（y 即可行走面高度，与解析碰撞面同源）；
 * - 当地可行走面明显高于板顶时（目标屿盘面压过径面）跳过——踏板在
 *   岛缘处收尾，而不是沉进岛体里；
 * - 折线本身由 layout.ts 的 Catmull-Rom 生成，本函数不再引入样条。
 */
export function buildTrailDeck(samples: readonly Vec3[]): TrailDeck {
  const steps: DeckStep[] = [];
  if (samples.length < 2) return { steps, inlays: [], skipped: 0 };

  const cum: number[] = [0];
  for (let i = 1; i < samples.length; i += 1) {
    const a = samples[i - 1];
    const b = samples[i];
    cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z));
  }
  const total = cum[cum.length - 1];

  let skipped = 0;
  let seg = 0;
  for (let s = 0; s <= total - DECK_TAIL_GAP; s += DECK_STRIDE) {
    while (seg < cum.length - 2 && cum[seg + 1] < s) seg += 1;
    const a = samples[seg];
    const b = samples[seg + 1];
    const span = Math.max(1e-6, cum[seg + 1] - cum[seg]);
    const t = (s - cum[seg]) / span;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    const z = a.z + (b.z - a.z) * t;

    const ground = getGroundHeight(x, z);
    if (ground !== null && ground - (y + DECK_TOP_LIFT) > DECK_BURY_LIMIT) {
      skipped += 1;
      continue;
    }
    // 屿面高于径面的接近段：让位给目标屿的岩裙（视觉岩体超出
    // walkable 半径，踏板若铺到半径处会插进岩体侧面）
    const underIsleSkirt = PROJECT_ISLES.some(
      (isle) =>
        isle.center.y > y + 0.5 &&
        Math.hypot(x - isle.center.x, z - isle.center.z) < isle.radius + DECK_ISLE_MARGIN,
    );
    if (underIsleSkirt) {
      skipped += 1;
      continue;
    }

    const tx = b.x - a.x;
    const tz = b.z - a.z;
    const len = Math.hypot(tx, tz) || 1;
    steps.push({ x, y, z, angle: Math.atan2(tx / len, tz / len) });
  }

  const inlays = steps.filter((_, i) => i % DECK_INLAY_EVERY === 0);
  return { steps, inlays, skipped };
}
