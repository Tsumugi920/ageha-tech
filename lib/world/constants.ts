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
  skyTop: "#5FA6E0",
  skyHorizon: "#E6F5FF",
  fog: "#B7D6EC",
  sea: "#8FC8E8",
  /** 岛岩：深蓝岩（globals.css --color-text-primary #10294B 转矿物色） */
  rockDeep: "#10294B",
  rockMid: "#4B668A",
  snow: "#F1F8FF",
  iceEdge: "#DDF3FF",
  glass: "#DDF3FF",
  glassEdge: "#54E3FF",
  /** 蝶枢水晶三色渐变（翼尖→中带→翼根）：app/icon.svg 同款品牌三色 */
  crystal: ["#8FE8FF", "#269DFF", "#9C83FF"] as const,
  trailGlow: "#54E3FF",
  mossGreen: "#6FCF9E",
  mossDeep: "#3E9E77",
  marketWarm: "#FFB36B",
  /** 晨光（微暖）与半球光（§3.3） */
  sunLight: "#FFF1DC",
  hemiSky: "#CDEBFF",
  hemiGround: "#AFC6DD",
} as const;

/**
 * 雾与相机（R3 重调）：
 * - 雾 120→380：近景与主岛保持饱和，三屿 50~75 距离保留材质层次，
 *   远景只在 200 以外才被雾吃掉；
 * - 初始机位由 SPAWN_POINT + 跟随相机球坐标推导（与移动状态完全一致），
 *   不再有「先停特殊机位、一移动就跳到跟随机位」的断层。
 */
export const WORLD_FOG = { color: "#B7D6EC", near: 120, far: 380 } as const;
export const CAMERA_LIMITS = {
  near: 0.1,
  far: 500,
  fovDesktop: 58,
  fovMobile: 64,
  /** 跟随距离三档（§6.2 滚轮）：近看角色 / 常规探索 / 看全地标 */
  distances: [8, 14, 20] as const,
  /**
   * 初始构图：相机在出生点正南、略仰视。yaw=0 时按 W 直行北径，
   * 不会因初始斜角把玩家带向岛缘。
   */
  initialYaw: 0.55,
  /** P1：初始俯角降低，镜头更贴近地面，首屏从「俯瞰沙盘」变为第三人称 */
  initialPitch: 0.18,
  /** P1：默认 14m 中近景——玩家信灯可读，北径与终点塔仍在画内 */
  initialDistanceIndex: 1,
  /**
   * 世界坐标初始机位（与 spawn + initialYaw/Pitch/Distance 推导值一致，
   * 仅用于 Canvas 首帧；第一帧起由 FollowCamera 接管，二者无跳变）。
   */
  initialPosition: { x: 12.44, y: 5.56, z: 16.7 },
  initialLookAt: { x: 5.25, y: 3.05, z: 4.95 },
  /** 跟随视点前探距离（角色的前方探索区，而不是只看角色背影） */
  lookAhead: 2.4,
  /** R12.2-B：统一抬高视点，给蝴蝶翼尖留出导航安全区；首帧与跟随共用。 */
  lookHeight: 2.7,
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

/** 交互系统（§8：靠近 <16 名牌浮现、<6 高亮提示；R2 提高名牌可读距离） */
export const INTERACTION = {
  nameplateDistance: 16,
  promptDistance: 6,
  /** 茧居所发现半径（进入即点亮导航传送项，§9.1 隐藏彩蛋） */
  nookDiscoveryRadius: 12,
  /**
   * 移动端交互距离倍率（§7 触屏友好的交互距离）：提示 / 高亮 /
   * 名牌淡入半径整体 ×1.4（6→8.4、10→14），3D 点击热区同步外扩。
   */
  mobileRadiusScale: 1.4,
} as const;

/** 空间尺度（§2.2 坐标表引用的通用尺度） */
export const WORLD_SCALE = {
  /** 1 unit ≈ 1m；冰海面 y */
  seaLevelY: -60,
  seaSize: 2000,
  skyDomeRadius: 380,
  /** R4：云带下移到地平线附近（8~26），才能在初始仰视构图里被看到 */
  cloudBandY: [8, 26] as const,
} as const;

/**
 * 场景内资产路径登记（§11.2 产物，阶段 3 起消费）：
 * 数据层单源——渲染组件一律从本登记取路径，禁内联路径字面量
 * （world-assets.test.mjs 断言 useTexture 只消费登记变量）。
 */
export const WORLD_ASSET_PATHS = {
  /** 星尘蝶群精灵：app/icon.svg 栅格化 512px（透明底，§5.3） */
  butterflySprite: "/world/butterfly-sprite-512.png",
} as const;
