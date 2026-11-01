/**
 * 玩家运动解算（纯 TS，无 React / three 依赖）：
 *
 * - combineMoveAxes：键盘 + 摇杆合成，保留输入幅度，长度封顶 1；
 * - axesToWorld：相机系输入 → 世界方向（单位向量）+ 幅度；
 * - stepVelocity：固定步长的加速度 / 阻尼 / 速度上限；
 * - resolveCollisionVelocity：外法线 = 推出位置 − 原位置，只移除朝向
 *   障碍的向内分量，保留背离与切向分量；
 * - createStepAccumulator：固定步长补步，低帧率下保留经过时间，
 *   超长帧（后台恢复）按最大帧间隔与最大补步数截断。
 */
import { PLAYER_PHYSICS } from "./constants.ts";

export type MoveAxes = {
  x: number;
  y: number;
  /** 合成输入幅度（≤1）：轻推 < 满推，斜向 / 键盘+摇杆不会超过 1 */
  magnitude: number;
};

export type WorldMove = {
  /** 世界方向单位向量 */
  x: number;
  z: number;
  magnitude: number;
};

export type PlanarVelocity = { x: number; z: number };

export type MotionStepContext = {
  delta: number;
  sprint: boolean;
  mobile: boolean;
};

export function combineMoveAxes(
  keyboardX: number,
  keyboardY: number,
  joystickX: number,
  joystickY: number,
): MoveAxes {
  const rawX = keyboardX + joystickX;
  const rawY = keyboardY + joystickY;
  const length = Math.hypot(rawX, rawY);
  if (length <= 1) return { x: rawX, y: rawY, magnitude: length };
  return { x: rawX / length, y: rawY / length, magnitude: 1 };
}

export function axesToWorld(axes: MoveAxes, yaw: number): WorldMove {
  const length = Math.hypot(axes.x, axes.y);
  if (length < 1e-6) return { x: 0, z: 0, magnitude: 0 };
  const forwardX = -Math.sin(yaw);
  const forwardZ = -Math.cos(yaw);
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);
  return {
    x: (forwardX * axes.y + rightX * axes.x) / length,
    z: (forwardZ * axes.y + rightZ * axes.x) / length,
    magnitude: Math.min(1, axes.magnitude),
  };
}

export function stepVelocity(
  vx: number,
  vz: number,
  move: WorldMove,
  context: MotionStepContext,
): PlanarVelocity {
  const magnitude = Math.min(1, Math.max(0, move.magnitude));
  let nextX = vx;
  let nextZ = vz;

  if (magnitude > 0.001) {
    nextX += move.x * PLAYER_PHYSICS.acceleration * magnitude * context.delta;
    nextZ += move.z * PLAYER_PHYSICS.acceleration * magnitude * context.delta;

    // 目标速度随输入幅度缩放：微推上限更低，满推 / 斜向 / 键盘+摇杆
    // 都封顶在同一速度，不因输入叠加而超速。
    const maxSpeed =
      PLAYER_PHYSICS.maxSpeed *
      (context.sprint ? PLAYER_PHYSICS.sprintMultiplier : 1) *
      (context.mobile ? PLAYER_PHYSICS.mobileSpeedScale : 1) *
      magnitude;
    const speed = Math.hypot(nextX, nextZ);
    if (speed > maxSpeed && speed > 1e-9) {
      nextX = (nextX / speed) * maxSpeed;
      nextZ = (nextZ / speed) * maxSpeed;
    }
  } else {
    const damp = Math.pow(
      PLAYER_PHYSICS.dampingBase,
      PLAYER_PHYSICS.dampingScale * context.delta,
    );
    nextX *= damp;
    nextZ *= damp;
  }

  return { x: nextX, z: nextZ };
}

/**
 * 圆柱碰撞的速度解算：法线取「推出位置 − 原位置」= 外法线。
 * v·n < 0 表示速度朝向障碍内部，只移除该法向分量；
 * 背离（v·n ≥ 0）与切向分量原样保留。
 */
export function resolveCollisionVelocity(
  vx: number,
  vz: number,
  fromX: number,
  fromZ: number,
  pushedX: number,
  pushedZ: number,
): PlanarVelocity {
  const normalX = pushedX - fromX;
  const normalZ = pushedZ - fromZ;
  const length = Math.hypot(normalX, normalZ);
  if (length < 1e-6) return { x: vx, z: vz };
  const nx = normalX / length;
  const nz = normalZ / length;
  const into = vx * nx + vz * nz;
  if (into >= 0) return { x: vx, z: vz };
  return { x: vx - into * nx, z: vz - into * nz };
}

/** 固定步长：60Hz 物理步进；超长帧最多补 0.25s（15 步） */
export const MOTION_TIMESTEP = {
  step: 1 / 60,
  maxFrameDelta: 0.25,
  maxSubsteps: 15,
} as const;

export type StepAccumulator = {
  /** 传入帧间隔，返回本帧应执行的固定步数（可能为 0） */
  add(rawDelta: number): number;
  reset(): void;
  pending(): number;
};

export function createStepAccumulator(
  step: number = MOTION_TIMESTEP.step,
  maxFrameDelta: number = MOTION_TIMESTEP.maxFrameDelta,
  maxSubsteps: number = MOTION_TIMESTEP.maxSubsteps,
): StepAccumulator {
  let pending = 0;

  return {
    add(rawDelta) {
      const clamped =
        Number.isFinite(rawDelta) && rawDelta > 0
          ? Math.min(rawDelta, maxFrameDelta)
          : 0;
      pending += clamped;
      const steps = Math.min(Math.floor(pending / step), maxSubsteps);
      pending -= steps * step;
      if (pending < 0) pending = 0;
      // 超预算的积压不再留到下一帧，避免持续追赶造成跳变
      if (steps === maxSubsteps && pending >= step) pending = step * 0.999999;
      return steps;
    },
    reset() {
      pending = 0;
    },
    pending() {
      return pending;
    },
  };
}
