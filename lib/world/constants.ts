/**
 * 3D 世界常量：尺度 / 物理参数 / 色值。
 *
 * - 色值与 app/globals.css @theme 品牌令牌同源对齐（冰蓝 / 浅青 / 冷白，
 *   见 globals.css `--color-*` 注释）；3D 侧在此集中登记，HTML HUD 层
 *   继续直接消费 globals.css 令牌，保证 3D 与 DOM 同一套色彩体系。
 * - 本文件为纯 TS 数据（无 JSX、无 three 依赖），node --test 可直接 import
 *   做数据级校验（world-layout.test.mjs）。
 */

/** 天空 / 雾 / 海（§3.1 色板；雾色介于天空顶与地平线之间） */
export const WORLD_COLORS = {
  skyTop: "#9CD8FF",
  skyHorizon: "#EAF7FF",
  fog: "#CFEBFF",
  sea: "#A8DAF5",
  /** 岛岩：深蓝岩（globals.css --color-text-primary #10294B 转矿物色） */
  rockDeep: "#10294B",
  rockMid: "#4B668A",
  snow: "#F1F8FF",
  iceEdge: "#DDF3FF",
  glass: "#DDF3FF",
  glassEdge: "#54E3FF",
  crystal: ["#8FE8FF", "#269DFF", "#9C83FF"] as const,
  trailGlow: "#54E3FF",
  mossGreen: "#6FCF9E",
  mossDeep: "#3E9E77",
  marketWarm: "#FFB36B",
  /** 晨光（微暖）与半球光（§3.3） */
  sunLight: "#FFF6E8",
  hemiSky: "#CDEBFF",
  hemiGround: "#E8DFF0",
} as const;

/** 雾与相机（§2.3：线性雾 70→260，far=500，天空穹 r=380） */
export const WORLD_FOG = { color: "#CFEBFF", near: 70, far: 260 } as const;
export const CAMERA_LIMITS = {
  near: 0.1,
  far: 500,
  fovDesktop: 55,
  fovMobile: 60,
  /** 跟随距离三档（§6.2 滚轮） */
  distances: [6, 9, 13] as const,
  /** 初始构图（§7：出生点 → 蝶枢居中偏上 → 北径尽头塔剪影） */
  initialPosition: { x: 0, y: 4.6, z: 18.5 },
  initialLookAt: { x: 0, y: 3.2, z: -12 },
  /** 跟随相机球坐标初始值（yaw=0 → 相机在目标正南方） */
  initialYaw: 0,
  initialPitch: 0.34,
  initialDistanceIndex: 1,
  /** 轨道观察范围（§6.2：水平 ±120°、垂直 +8°~+60°） */
  yawRange: (Math.PI * 2) / 3,
  pitchMin: 0.14,
  pitchMax: Math.PI / 3,
} as const;

/** 浮游信灯运动学（§6.2 / §6.4：自写运动学，不引物理引擎） */
export const PLAYER_PHYSICS = {
  /** 贴地悬浮高度（地面 + 0.35） */
  hoverHeight: 0.35,
  /** 加速度（unit/s²） */
  acceleration: 22,
  /** 最大速度（unit/s） */
  maxSpeed: 7.5,
  /** 冲刺倍率（Shift） */
  sprintMultiplier: 1.6,
  /** 松键阻尼：v *= 0.85^(Δt·8) */
  dampingBase: 0.85,
  dampingScale: 8,
  /** 垂直方向 critically-damped spring（λ=10） */
  verticalLambda: 10,
  /** 软边界气流推回加速度 */
  boundaryPush: 14,
  /** 玩家碰撞半径（对静态碰撞体的外扩） */
  bodyRadius: 0.45,
  /** 移动端速度上限补偿（−20%，§6.3） */
  mobileSpeedScale: 0.8,
} as const;

/** 交互系统（§8：靠近 <10 名牌浮现、<6 高亮提示） */
export const INTERACTION = {
  nameplateDistance: 10,
  promptDistance: 6,
} as const;

/** 空间尺度（§2.2 坐标表引用的通用尺度） */
export const WORLD_SCALE = {
  /** 1 unit ≈ 1m；冰海面 y */
  seaLevelY: -60,
  seaSize: 2000,
  skyDomeRadius: 380,
  cloudBandY: [30, 60] as const,
} as const;
