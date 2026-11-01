/**
 * P2 反馈闭环数据测试（node:test）：
 * - 北径信标时序：pulse → lit → idle，复位后可重复触发；
 * - 运动声音映射：速度/冲刺提升风声增益、截止频率与悬停低频，且有限、有界。
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { RELAY_TIMING, relayPhase } from "../lib/world/relayModel.ts";
import {
  DEFAULT_WORLD_VOLUME,
  motionAudioParams,
  parseStoredVolume,
} from "../lib/world/audioModel.ts";
import { PLAYER_PHYSICS } from "../lib/world/constants.ts";

test("北径信标时序：光波 → 点亮 → 自动复位，可再次进入 pulse", () => {
  assert.equal(RELAY_TIMING.litSeconds > RELAY_TIMING.pulseSeconds, true);
  assert.equal(relayPhase(-1), "idle");
  assert.equal(relayPhase(0), "pulse");
  assert.equal(relayPhase(RELAY_TIMING.pulseSeconds - 0.01), "pulse");
  assert.equal(relayPhase(RELAY_TIMING.pulseSeconds), "lit");
  assert.equal(relayPhase(RELAY_TIMING.litSeconds - 0.01), "lit");
  assert.equal(relayPhase(RELAY_TIMING.litSeconds), "idle");
  assert.equal(relayPhase(Number.NaN), "idle");
  assert.equal(relayPhase(Number.POSITIVE_INFINITY), "idle");
  // 再次触发时 since 归零 → 重新进入 pulse（复位不是单向锁定）
  assert.equal(relayPhase(0.2), "pulse");
});

test("持久化音量：缺失/空串回落默认 0.6，显式 0 合法，越界被夹紧", () => {
  assert.equal(DEFAULT_WORLD_VOLUME, 0.6);
  assert.equal(parseStoredVolume(null), 0.6);
  assert.equal(parseStoredVolume(""), 0.6);
  assert.equal(parseStoredVolume("   "), 0.6);
  assert.equal(parseStoredVolume("0"), 0, "显式 0 是用户主动静音音量，不得被改写");
  assert.equal(parseStoredVolume("0.3"), 0.3);
  assert.equal(parseStoredVolume("1"), 1);
  assert.equal(parseStoredVolume("2"), 1);
  assert.equal(parseStoredVolume("-1"), 0);
  assert.equal(parseStoredVolume("bad"), 0.6);
});

test("运动声音：速度与冲刺提升风声增益/截止/悬停低频，数值有限有界", () => {
  const still = motionAudioParams(0, false);
  const cruise = motionAudioParams(PLAYER_PHYSICS.maxSpeed * 0.5, false);
  const full = motionAudioParams(PLAYER_PHYSICS.maxSpeed, false);
  const sprint = motionAudioParams(PLAYER_PHYSICS.maxSpeed, true);

  assert.ok(still.gain < cruise.gain, "巡航风声应高于静止");
  assert.ok(cruise.gain < full.gain, "满速风声应高于半速");
  assert.ok(full.gain < sprint.gain, "冲刺应有额外风声");
  assert.ok(still.cutoff < cruise.cutoff && cruise.cutoff < full.cutoff);
  assert.ok(still.hum < full.hum);
  assert.ok(full.pitch < sprint.pitch);

  for (const params of [still, cruise, full, sprint]) {
    for (const value of Object.values(params)) {
      assert.ok(Number.isFinite(value), "音频参数必须有限");
      assert.ok(value >= 0, "音频参数不得为负");
    }
    assert.ok(params.gain <= 0.1, "运动风声增益应有上限");
  }
  // 超速/负速度输入不产生越界值
  const clampedHigh = motionAudioParams(999, true);
  const clampedLow = motionAudioParams(-5, false);
  assert.deepEqual(clampedHigh, motionAudioParams(PLAYER_PHYSICS.maxSpeed, true));
  assert.deepEqual(clampedLow, motionAudioParams(0, false));
});
