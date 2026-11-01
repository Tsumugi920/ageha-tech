/**
 * 运动声音映射（纯 TS）：速度 → 风声增益 / 滤波截止 / 低频悬停音量。
 * 音频引擎只消费这些数值，单元测试不需要创建 AudioContext。
 */
import { PLAYER_PHYSICS } from "./constants.ts";

export type MotionAudioParams = {
  /** 风声增益（0..1） */
  gain: number;
  /** 风声低通截止频率（Hz） */
  cutoff: number;
  /** 悬停低频增益 */
  hum: number;
  /** 悬停音高倍率 */
  pitch: number;
};

export const DEFAULT_WORLD_VOLUME = 0.6;

/** 读取持久化音量：缺失/空串回落到默认值；显式 0 是合法的静音音量。 */
export function parseStoredVolume(raw: string | null): number {
  if (raw === null || raw.trim() === "") return DEFAULT_WORLD_VOLUME;
  const value = Number(raw);
  return Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : DEFAULT_WORLD_VOLUME;
}

export function motionAudioParams(speed: number, sprint: boolean): MotionAudioParams {
  const amount = Math.min(1, Math.max(0, speed / PLAYER_PHYSICS.maxSpeed));
  const boost = sprint ? 1 : 0;
  return {
    gain: 0.012 + amount * 0.05 + boost * 0.012,
    cutoff: 260 + amount * 880 + boost * 120,
    hum: 0.004 + amount * 0.012 + boost * 0.004,
    pitch: 1 + amount * 0.12 + boost * 0.06,
  };
}
