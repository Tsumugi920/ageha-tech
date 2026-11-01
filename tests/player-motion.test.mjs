/**
 * 玩家输入与运动行为测试（node:test）：
 * 对 lib/world/playerInput.ts / playerMotion.ts 做行为级校验：
 * - 多键与同义键：W → W+S → 松开 S；W + ↑ 松开 W；左右 Shift；
 * - 摇杆幅度：轻推 / 满推、斜向封顶、键盘 + 摇杆不叠加超速；
 * - 低帧率：144/60/30/15/5 FPS 等时长位移一致，低帧率 → 正常帧率恢复，
 *   后台超长帧按最大补步数截断；
 * - 碰撞速度：朝障碍 / 背离 / 侧滑 / 斜向 / 持续顶住（真实石碑碰撞体）。
 * 运行方式：npm test（即 node --test tests/*.test.mjs）
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearMoveInput,
  createKeyboardMoveInput,
  syncKeyboardInput,
} from "../lib/world/playerInput.ts";
import {
  MOTION_TIMESTEP,
  axesToWorld,
  combineMoveAxes,
  createStepAccumulator,
  resolveCollisionVelocity,
  stepVelocity,
} from "../lib/world/playerMotion.ts";
import { PLAYER_PHYSICS } from "../lib/world/constants.ts";
import { resolveCylinderPush } from "../lib/world/colliders.ts";
import { SIGN_POST } from "../lib/world/layout.ts";

const STEP = MOTION_TIMESTEP.step;

function simulateAxes(axes, seconds, yaw = 0) {
  const world = axesToWorld(axes, yaw);
  const context = { delta: STEP, sprint: false, mobile: false };
  let x = 0;
  let z = 0;
  let vx = 0;
  let vz = 0;
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const next = stepVelocity(vx, vz, world, context);
    vx = next.x;
    vz = next.z;
    x += vx * STEP;
    z += vz * STEP;
  }
  return { x, z, distance: Math.hypot(x, z), speed: Math.hypot(vx, vz) };
}

function simulateFrameRate(fps, seconds, axes) {
  const clock = createStepAccumulator();
  const world = axesToWorld(axes, 0);
  const context = { delta: STEP, sprint: false, mobile: false };
  let x = 0;
  let z = 0;
  let vx = 0;
  let vz = 0;
  const frames = Math.round(seconds * fps);
  for (let i = 0; i < frames; i += 1) {
    const steps = clock.add(1 / fps);
    for (let s = 0; s < steps; s += 1) {
      const next = stepVelocity(vx, vz, world, context);
      vx = next.x;
      vz = next.z;
      x += vx * STEP;
      z += vz * STEP;
    }
  }
  return { distance: Math.hypot(x, z), speed: Math.hypot(vx, vz) };
}

function simulateSegments(segments) {
  const clock = createStepAccumulator();
  const world = axesToWorld(combineMoveAxes(0, 1, 0, 0), 0);
  const context = { delta: STEP, sprint: false, mobile: false };
  let x = 0;
  let z = 0;
  let vx = 0;
  let vz = 0;
  for (const [fps, seconds] of segments) {
    const frames = Math.round(seconds * fps);
    for (let i = 0; i < frames; i += 1) {
      const steps = clock.add(1 / fps);
      for (let s = 0; s < steps; s += 1) {
        const next = stepVelocity(vx, vz, world, context);
        vx = next.x;
        vz = next.z;
        x += vx * STEP;
        z += vz * STEP;
      }
    }
  }
  return { distance: Math.hypot(x, z), speed: Math.hypot(vx, vz) };
}

/* ------------------------------ 多键与同义键 ------------------------------ */

test("键盘输入：W → W+S → 松开 S 后继续前进，松开 W 后停止", () => {
  const keyboard = createKeyboardMoveInput();
  keyboard.setKey("KeyW", true);
  assert.deepEqual(keyboard.axes(), { x: 0, y: 1 });

  keyboard.setKey("KeyS", true);
  assert.deepEqual(keyboard.axes(), { x: 0, y: 0 }, "相反方向同时按下应抵消");

  keyboard.setKey("KeyS", false);
  assert.deepEqual(keyboard.axes(), { x: 0, y: 1 }, "松开 S 后仍按住的 W 应恢复前进");

  keyboard.setKey("KeyW", false);
  assert.deepEqual(keyboard.axes(), { x: 0, y: 0 });
});

test("同义键：W + ↑ 松开 W 仍前进；A/←、D/→ 同理，左右互抵", () => {
  const keyboard = createKeyboardMoveInput();
  keyboard.setKey("KeyW", true);
  keyboard.setKey("ArrowUp", true);
  assert.deepEqual(keyboard.axes(), { x: 0, y: 1 });
  keyboard.setKey("KeyW", false);
  assert.deepEqual(keyboard.axes(), { x: 0, y: 1 }, "松开 W 后 ↑ 仍应保持前进");
  keyboard.setKey("ArrowUp", false);
  assert.deepEqual(keyboard.axes(), { x: 0, y: 0 });

  keyboard.setKey("KeyA", true);
  keyboard.setKey("ArrowLeft", true);
  assert.deepEqual(keyboard.axes(), { x: -1, y: 0 });
  keyboard.setKey("KeyA", false);
  assert.deepEqual(keyboard.axes(), { x: -1, y: 0 }, "松开 A 后 ← 仍应保持左移");
  keyboard.setKey("ArrowLeft", false);

  keyboard.setKey("KeyD", true);
  keyboard.setKey("ArrowRight", true);
  keyboard.setKey("KeyA", true);
  assert.deepEqual(keyboard.axes(), { x: 0, y: 0 }, "左右同时按住应抵消");
  keyboard.setKey("KeyA", false);
  assert.deepEqual(keyboard.axes(), { x: 1, y: 0 }, "松开左侧后右侧输入恢复");
  keyboard.setKey("KeyD", false);
  keyboard.setKey("ArrowRight", false);
  assert.deepEqual(keyboard.axes(), { x: 0, y: 0 });
});

test("左右 Shift 分别记录：任一按住保持冲刺，全部松开才取消", () => {
  const keyboard = createKeyboardMoveInput();
  keyboard.setKey("ShiftLeft", true);
  assert.equal(keyboard.sprint(), true);
  keyboard.setKey("ShiftRight", true);
  assert.equal(keyboard.sprint(), true);
  keyboard.setKey("ShiftLeft", false);
  assert.equal(keyboard.sprint(), true, "右 Shift 仍按住时应保持冲刺");
  keyboard.setKey("ShiftRight", false);
  assert.equal(keyboard.sprint(), false);
});

test("失焦 / 页面隐藏：键盘、摇杆与冲刺一并清空，恢复后无残留", () => {
  const keyboard = createKeyboardMoveInput();
  keyboard.setKey("KeyW", true);
  keyboard.setKey("ShiftLeft", true);
  const input = {
    move: { x: 0, y: 0 },
    joystick: { x: -0.7, y: 0.4 },
    sprint: false,
  };
  syncKeyboardInput(input, keyboard);
  assert.deepEqual(input.move, { x: 0, y: 1 });
  assert.equal(input.sprint, true);

  keyboard.clear();
  clearMoveInput(input);
  assert.deepEqual(input.move, { x: 0, y: 0 });
  assert.deepEqual(input.joystick, { x: 0, y: 0 });
  assert.equal(input.sprint, false);
  assert.deepEqual(keyboard.axes(), { x: 0, y: 0 });
  assert.equal(keyboard.sprint(), false);
});

test("非移动键不进入状态机（E / R / 字母键由控制器单独处理）", () => {
  const keyboard = createKeyboardMoveInput();
  assert.equal(keyboard.setKey("KeyE", true), false);
  assert.equal(keyboard.setKey("KeyR", true), false);
  assert.equal(keyboard.setKey("KeyQ", true), false);
  assert.deepEqual(keyboard.axes(), { x: 0, y: 0 });
});

/* ------------------------------ 摇杆幅度与合成上限 ------------------------------ */

test("摇杆幅度：微推与满推的加速度 / 目标速度可感知不同，长度不超过 1", () => {
  const full = combineMoveAxes(0, 0, 0, 1);
  const light = combineMoveAxes(0, 0, 0, 0.3);
  assert.equal(full.magnitude, 1);
  assert.ok(Math.abs(light.magnitude - 0.3) < 1e-9);

  const context = { delta: STEP, sprint: false, mobile: false };
  const fullStep = stepVelocity(0, 0, axesToWorld(full, 0), context);
  const lightStep = stepVelocity(0, 0, axesToWorld(light, 0), context);
  const fullAccel = Math.hypot(fullStep.x, fullStep.z);
  const lightAccel = Math.hypot(lightStep.x, lightStep.z);
  assert.ok(
    lightAccel < fullAccel * 0.35,
    `微推加速度 ${lightAccel.toFixed(2)} 应显著低于满推 ${fullAccel.toFixed(2)}`,
  );

  const fullRun = simulateAxes(full, 1.5);
  const lightRun = simulateAxes(light, 1.5);
  assert.ok(
    lightRun.distance < fullRun.distance * 0.6,
    `微推位移 ${lightRun.distance.toFixed(2)} 应明显短于满推 ${fullRun.distance.toFixed(2)}`,
  );
  assert.ok(
    lightRun.speed <= PLAYER_PHYSICS.maxSpeed * 0.3 + 1e-6,
    "微推的目标速度上限应随幅度缩放",
  );
});

test("斜向不获得额外速度：单位化方向 + 幅度封顶，与正向同速", () => {
  const diagonal = combineMoveAxes(1, 1, 0, 0);
  assert.equal(diagonal.magnitude, 1);
  assert.ok(Math.abs(diagonal.x - Math.SQRT1_2) < 1e-9);
  assert.ok(Math.abs(diagonal.y - Math.SQRT1_2) < 1e-9);

  const diagonalRun = simulateAxes(diagonal, 2);
  const forwardRun = simulateAxes(combineMoveAxes(0, 1, 0, 0), 2);
  assert.ok(
    diagonalRun.speed <= PLAYER_PHYSICS.maxSpeed + 1e-6,
    `斜向速度 ${diagonalRun.speed.toFixed(3)} 不得超过最大速度`,
  );
  assert.ok(
    Math.abs(diagonalRun.distance - forwardRun.distance) < 0.01,
    "斜向与正向等时长位移应一致（方向单位化）",
  );
});

test("键盘 + 摇杆叠加：合成长度封顶 1，不会出现双倍速", () => {
  const combined = combineMoveAxes(0, 1, 0, 1);
  assert.deepEqual({ x: combined.x, y: combined.y }, { x: 0, y: 1 });
  assert.equal(combined.magnitude, 1);

  const combinedRun = simulateAxes(combined, 2);
  const keyboardRun = simulateAxes(combineMoveAxes(0, 1, 0, 0), 2);
  assert.ok(Math.abs(combinedRun.speed - keyboardRun.speed) < 1e-9);
  assert.ok(combinedRun.speed <= PLAYER_PHYSICS.maxSpeed + 1e-6);

  const bothDiagonal = combineMoveAxes(1, 1, 1, 1);
  assert.equal(bothDiagonal.magnitude, 1, "键盘 + 摇杆同向斜推也不得超过 1");
});

/* ------------------------------ 低帧率运动一致性 ------------------------------ */

test("低帧率不慢动作：144/60/30/15/5 FPS 等时长总位移误差 <2%", () => {
  const axes = combineMoveAxes(0, 1, 0, 0);
  const reference = simulateFrameRate(60, 3, axes);
  for (const fps of [144, 30, 15, 5]) {
    const run = simulateFrameRate(fps, 3, axes);
    const error = Math.abs(run.distance - reference.distance) / reference.distance;
    assert.ok(
      error < 0.02,
      `${fps} FPS 位移 ${run.distance.toFixed(3)} 与 60 FPS ${reference.distance.toFixed(3)} 误差 ${(error * 100).toFixed(2)}% 应 <2%`,
    );
    assert.ok(
      Math.abs(run.speed - reference.speed) < 0.05,
      `${fps} FPS 末速应与 60 FPS 基本一致`,
    );
  }
});

test("低帧率 → 正常帧率恢复：总位移与全程正常帧率一致", () => {
  const reference = simulateSegments([[60, 2]]);
  const recovered = simulateSegments([[10, 1], [60, 1]]);
  const error =
    Math.abs(recovered.distance - reference.distance) / reference.distance;
  assert.ok(
    error < 0.02,
    `10→60 FPS 恢复位移误差 ${(error * 100).toFixed(2)}% 应 <2%`,
  );
});

test("后台超长帧：按最大帧间隔 / 最大补步数截断，积压不跨帧追赶", () => {
  const clock = createStepAccumulator();
  assert.equal(
    MOTION_TIMESTEP.maxSubsteps * MOTION_TIMESTEP.step,
    MOTION_TIMESTEP.maxFrameDelta,
    "最大补步预算应与最大帧间隔一致（0.25s / 15 步）",
  );
  assert.equal(clock.add(2), MOTION_TIMESTEP.maxSubsteps);
  assert.ok(clock.pending() < MOTION_TIMESTEP.step, "截断后不应留下整步积压");

  clock.reset();
  assert.equal(clock.add(0.008), 0);
  assert.equal(clock.add(0.008), 0, "不足一步的余量应保留而非丢弃");
  assert.equal(clock.add(0.002), 1, "余量累积到一步后补步");
  assert.equal(clock.add(Number.NaN), 0, "非法 delta 不应推进时间");
});

/* ------------------------------ 碰撞速度方向 ------------------------------ */

const BODY_RADIUS = PLAYER_PHYSICS.bodyRadius;
const SIGN_COLLIDER_RADIUS = 1.3;
const SIGN_MIN_DIST = SIGN_COLLIDER_RADIUS + BODY_RADIUS;
const SIGN_FEET_Y = 0.35;

function signPushAt(x, z) {
  return resolveCylinderPush(x, z, BODY_RADIUS, SIGN_FEET_Y);
}

test("碰撞速度：朝障碍的向内分量被移除（原有位置推出断言保留在 world-layout）", () => {
  const fromX = SIGN_POST.x + SIGN_MIN_DIST - 0.05;
  const fromZ = SIGN_POST.z;
  const pushed = signPushAt(fromX, fromZ);
  assert.ok(pushed, "起点应进入石碑碰撞体并触发推出");

  const toward = resolveCollisionVelocity(-2, 0, fromX, fromZ, pushed.x, pushed.z);
  assert.ok(Math.abs(toward.x) < 1e-9, "撞向障碍的径向速度应被移除");
  assert.ok(Math.abs(toward.z) < 1e-9);
});

test("碰撞速度：背离障碍的速度保留", () => {
  const fromX = SIGN_POST.x + SIGN_MIN_DIST - 0.05;
  const fromZ = SIGN_POST.z;
  const pushed = signPushAt(fromX, fromZ);
  assert.ok(pushed);
  const away = resolveCollisionVelocity(2, 0, fromX, fromZ, pushed.x, pushed.z);
  assert.ok(Math.abs(away.x - 2) < 1e-9, "背离分量不应被消除");
  assert.ok(Math.abs(away.z) < 1e-9);
});

test("碰撞速度：沿侧面滑行的切向速度保留", () => {
  const fromX = SIGN_POST.x + SIGN_MIN_DIST - 0.05;
  const fromZ = SIGN_POST.z;
  const pushed = signPushAt(fromX, fromZ);
  assert.ok(pushed);
  const slide = resolveCollisionVelocity(0, 2, fromX, fromZ, pushed.x, pushed.z);
  assert.ok(Math.abs(slide.x) < 1e-9);
  assert.ok(Math.abs(slide.z - 2) < 1e-9, "切向滑行分量应完整保留");
});

test("碰撞速度：斜向接触只移除法向分量，保留切向分量", () => {
  const fromX = SIGN_POST.x + SIGN_MIN_DIST - 0.05;
  const fromZ = SIGN_POST.z;
  const pushed = signPushAt(fromX, fromZ);
  assert.ok(pushed);
  const diagonal = resolveCollisionVelocity(-2, 2, fromX, fromZ, pushed.x, pushed.z);
  assert.ok(Math.abs(diagonal.x) < 1e-9, "朝向障碍的 x 分量应移除");
  assert.ok(Math.abs(diagonal.z - 2) < 1e-9, "沿侧面的 z 分量应保留");
});

test("碰撞速度：持续顶住不穿透、速度无向内残留，反向输入后可离开", () => {
  let px = SIGN_POST.x + SIGN_MIN_DIST + 0.5;
  let pz = SIGN_POST.z;
  let vx = 0;
  let vz = 0;
  const toward = axesToWorld(combineMoveAxes(-1, 0, 0, 0), 0);
  const away = axesToWorld(combineMoveAxes(1, 0, 0, 0), 0);
  const context = { delta: STEP, sprint: false, mobile: false };

  // 持续向石碑加速：位置推出 + 速度解算每步执行
  for (let i = 0; i < 180; i += 1) {
    const nextVelocity = stepVelocity(vx, vz, toward, context);
    vx = nextVelocity.x;
    vz = nextVelocity.z;
    const nx = px + vx * STEP;
    const nz = pz + vz * STEP;
    const pushed = signPushAt(nx, nz);
    if (pushed) {
      const resolved = resolveCollisionVelocity(vx, vz, nx, nz, pushed.x, pushed.z);
      vx = resolved.x;
      vz = resolved.z;
      px = pushed.x;
      pz = pushed.z;
    } else {
      px = nx;
      pz = nz;
    }
  }

  const heldDistance = Math.hypot(px - SIGN_POST.x, pz - SIGN_POST.z);
  assert.ok(
    heldDistance >= SIGN_MIN_DIST - 1e-6,
    `持续顶住时不得穿透（距碰撞心 ${heldDistance.toFixed(3)} ≥ ${SIGN_MIN_DIST}）`,
  );
  const nx = (px - SIGN_POST.x) / heldDistance;
  const nz = (pz - SIGN_POST.z) / heldDistance;
  const inward = vx * nx + vz * nz;
  assert.ok(inward >= -1e-9, `速度不应残留朝向障碍的分量（实际 ${inward.toFixed(6)}）`);

  // 反向输入后应能背离障碍离开
  for (let i = 0; i < 60; i += 1) {
    const nextVelocity = stepVelocity(vx, vz, away, context);
    vx = nextVelocity.x;
    vz = nextVelocity.z;
    const fromX = px + vx * STEP;
    const fromZ = pz + vz * STEP;
    const pushed = signPushAt(fromX, fromZ);
    if (pushed) {
      const resolved = resolveCollisionVelocity(
        vx,
        vz,
        fromX,
        fromZ,
        pushed.x,
        pushed.z,
      );
      vx = resolved.x;
      vz = resolved.z;
      px = pushed.x;
      pz = pushed.z;
    } else {
      px = fromX;
      pz = fromZ;
    }
  }
  const escapedDistance = Math.hypot(px - SIGN_POST.x, pz - SIGN_POST.z);
  assert.ok(
    escapedDistance > heldDistance + 1,
    `背离输入后应能离开障碍（${heldDistance.toFixed(2)} → ${escapedDistance.toFixed(2)}）`,
  );
});
