/**
 * 性能档位参数表（蓝图 §12.1 数据化；阶段 4 AdaptiveQuality 按帧时间
 * 滑动窗口在此表内升降档，阶段 1 先按设备形态静态选档）。
 *
 * 纯 TS 数据（无 three 依赖），node --test 校验三档齐全
 * （tests/world-layout.test.mjs）。
 */

export type QualityTier = "high" | "medium" | "low";

export type TierParams = {
  readonly tier: QualityTier;
  /** DPR 上限（min(devicePixelRatio, dprMax)） */
  readonly dprMax: number;
  /** 阴影：2048 单光源 / 关闭（关档用贴地柔光圈假阴影） */
  readonly shadows: false | 2048;
  /** transmission 重型透射材质 mesh 数上限（§3.2：全场景 ≤3，性能档降级为 opacity） */
  readonly transmissionBudget: number;
  /** 鳞粉 / 雾粒子预算 */
  readonly particleBudget: number;
  /** 三屿屏幕贴图（§11.2 压缩版；低档不加载，程序化屏幕替代） */
  readonly screenTextures: boolean;
  /** 远景浮岛座数 */
  readonly distantIsles: number;
  /** 星尘蝶群精灵数（0 = 隐藏） */
  readonly butterflySprites: number;
  /** 云层数量 */
  readonly clouds: number;
};

/** 档位表（§12.1：高=桌面默认 / 中=移动与降一档 / 低=自适应触发） */
export const TIER_PARAMS: Record<QualityTier, TierParams> = {
  high: {
    tier: "high",
    dprMax: 2,
    shadows: 2048,
    transmissionBudget: 3,
    particleBudget: 1200,
    screenTextures: true,
    distantIsles: 7,
    butterflySprites: 12,
    clouds: 10,
  },
  medium: {
    tier: "medium",
    dprMax: 1.5,
    shadows: false,
    transmissionBudget: 0,
    particleBudget: 600,
    screenTextures: true,
    distantIsles: 5,
    butterflySprites: 6,
    clouds: 7,
  },
  low: {
    tier: "low",
    dprMax: 1,
    shadows: false,
    transmissionBudget: 0,
    particleBudget: 300,
    screenTextures: false,
    distantIsles: 3,
    butterflySprites: 4,
    clouds: 4,
  },
} as const;

/** 移动端补偿（§6.3：摄影机 +2 档偏移、速度上限 −20%；FOV 60 见 constants） */
export const MOBILE_MODIFIERS = {
  defaultTier: "medium" as QualityTier,
  cameraDistanceOffset: 2,
  speedScale: 0.8,
} as const;

/** 桌面默认高档；移动（粗指针 / 窄屏）默认中档。阶段 4 由 AdaptiveQuality 接管升降。 */
export function pickInitialTier(isMobileLike: boolean): TierParams {
  return TIER_PARAMS[isMobileLike ? MOBILE_MODIFIERS.defaultTier : "high"];
}
