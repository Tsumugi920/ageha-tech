/**
 * 北径信标互动时序（纯 TS，node --test 可导入）：
 * pulse（光波行进）→ lit（路径保持点亮）→ idle（复位，可再次触发）。
 */
export const RELAY_TIMING = {
  /** 光波从径头行进到 AgehaOS 的时间 */
  pulseSeconds: 3.2,
  /** 点亮状态的保持时间；到时自动复位，提示仍在，可重复触发 */
  litSeconds: 9,
} as const;

export type RelayPhase = "idle" | "pulse" | "lit";

export function relayPhase(since: number): RelayPhase {
  if (!Number.isFinite(since) || since < 0 || since >= RELAY_TIMING.litSeconds) {
    return "idle";
  }
  return since < RELAY_TIMING.pulseSeconds ? "pulse" : "lit";
}
