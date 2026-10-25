/**
 * 动画节奏统一表（阶段 3「动画节奏统一」，蓝图 §8 反馈一致性）：
 * 3D 帧循环内的环境动效周期 / 频率在此集中登记，与 DOM 层 CSS 动画
 * 同拍——breathePeriod 对齐 globals.css `world-breathe` 4.5s、
 * pulsePeriod 对齐交互高亮 1.6s——保证跨层节奏一致、呼吸同频。
 *
 * 纯常量数据（无 three / React 依赖），组件按需取用，测试可源码级校验。
 */
export const MOTION = {
  /** 呼吸（状态灯 / 晶体微光 / 导向浮晶；globals.css world-breathe 同拍） */
  breathePeriod: 4.5,
  /** 悬浮（浮晶碎屑 / 蝶枢升沉 / 导向标浮晶的升沉周期） */
  floatPeriod: 6,
  /** 交互高亮脉冲（§8：cyan 光圈，周期 1.6s，全场景交互反馈统一） */
  pulsePeriod: 1.6,
  /** 蝶枢开合（§5.1：四翼绕中心轴缓慢开合旋转，周期 24s） */
  coreOpenPeriod: 24,
  /** 蝶枢自转角速度（rad/s；2π/24 ≈ 0.262，与开合同周期读作整体呼吸） */
  coreSpinSpeed: (Math.PI * 2) / 24,
  /** 星尘蝶群彩蛋：玩家静止触发秒数（§9.2：原地静立 20s 蝶群聚舞） */
  flockGatherIdleSeconds: 20,
  /** 星尘蝶群彩蛋：聚舞持续秒数（纯氛围奖励，无文案宣称） */
  flockGatherDurationSeconds: 14,
  /** 蝶茧轻颤：靠近半径（茧居所中央蝶茧，§9.1） */
  cocoonTrembleDistance: 4.5,
} as const;
