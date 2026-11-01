"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import { PLAYER_PHYSICS, CAMERA_LIMITS } from "@/lib/world/constants";
import {
  SPAWN_POINT,
  getGroundHeight,
  softBoundaryPush,
} from "@/lib/world/layout";
import { resolveCylinderPush } from "@/lib/world/colliders";
import {
  MOTION_TIMESTEP,
  axesToWorld,
  combineMoveAxes,
  createStepAccumulator,
  resolveCollisionVelocity,
  stepVelocity,
} from "@/lib/world/playerMotion";
import {
  clearMoveInput,
  createKeyboardMoveInput,
  isMovementKey,
  isSprintKey,
  syncKeyboardInput,
} from "@/lib/world/playerInput";
import { cameraState, inputState } from "./inputState";

/**
 * 浮游信灯控制器（蓝图 §6）：输入聚合（键盘物理键 / 摇杆共享态）、
 * 固定步长运动学（加速度 / 摩擦 / 冲刺）、解析面贴地
 * （critically-damped spring）、圆柱碰撞推出与速度解算、软边界气流推回。
 *
 * 全部高频量走 refs + useFrame，零逐帧 React 状态更新；
 * 键盘监听在 useEffect cleanup 注销。低帧率按固定步长补步（保留经过
 * 时间），失焦 / 页面隐藏清空全部输入并丢弃恢复帧的超长 delta。
 */
export type PlayerApi = {
  /** 信灯位置（贴地悬浮高度 = 地面 + 0.35） */
  pos: React.RefObject<Vector3>;
  /** 水平速度（供信灯姿态 / 相机对齐读取） */
  vel: React.RefObject<Vector3>;
  /** 朝向（弧度；面向 = (−sin, 0, −cos)，与相机 yaw 同约定） */
  heading: React.RefObject<number>;
  /** 水平速度模长 */
  speed: React.RefObject<number>;
  /** 贴地弹簧高度（传送落地时由 TeleportSystem 对齐，防跨层吸附） */
  springY: React.RefObject<number>;
};

export function usePlayerController(isMobile: boolean): PlayerApi {
  const pos = useRef<Vector3>(new Vector3(SPAWN_POINT.x, SPAWN_POINT.y, SPAWN_POINT.z));
  const vel = useRef<Vector3>(new Vector3(0, 0, 0));
  const heading = useRef<number>(0);
  const speed = useRef<number>(0);
  // 弹簧高度（贴地悬浮的平滑跟随，避免台阶感跳变）
  const springY = useRef<number>(SPAWN_POINT.y);
  const keyboardRef = useRef(createKeyboardMoveInput());
  const stepClock = useRef(createStepAccumulator());
  const skipNextDelta = useRef(false);

  const api = useMemo<PlayerApi>(
    () => ({ pos, vel, heading, speed, springY }),
    [],
  );

  useEffect(() => {
    const keyboard = keyboardRef.current;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";

      if (isMovementKey(event.code) || isSprintKey(event.code)) {
        if (typing) return;
        keyboard.setKey(event.code, true);
        syncKeyboardInput(inputState, keyboard);
        if (isMovementKey(event.code)) event.preventDefault();
        return;
      }
      if (typing) return;
      if (event.code === "KeyE") {
        if (!event.repeat) inputState.interactToken += 1;
      } else if (event.code === "KeyR") {
        if (!event.repeat) inputState.wantRespawn = true;
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      // 焦点可能在按住期间移入输入框：已按下的移动键仍须释放，防止卡键
      if (typing && !keyboard.has(event.code)) return;
      if (keyboard.setKey(event.code, false)) {
        syncKeyboardInput(inputState, keyboard);
        if (isMovementKey(event.code)) event.preventDefault();
      }
    };

    const resetTransient = () => {
      keyboard.clear();
      clearMoveInput(inputState);
      stepClock.current.reset();
      // 恢复后的第一帧 rawDelta 可能包含后台停留时间，整帧丢弃
      skipNextDelta.current = true;
    };

    const onBlur = () => resetTransient();
    const onVisibilityChange = () => {
      if (document.hidden) resetTransient();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      keyboard.clear();
    };
  }, []);

  // 单个固定步长：输入 → 速度 → 软边界 → 碰撞推出 + 速度解算 → 贴地 → 朝向
  const advance = (delta: number) => {
    const p = pos.current;
    const v = vel.current;

    const axes = combineMoveAxes(
      inputState.move.x,
      inputState.move.y,
      inputState.joystick.x,
      inputState.joystick.y,
    );
    const move = axesToWorld(axes, cameraState.yaw);
    const nextVelocity = stepVelocity(v.x, v.z, move, {
      delta,
      sprint: inputState.sprint,
      mobile: isMobile,
    });
    v.x = nextVelocity.x;
    v.z = nextVelocity.z;

    // ---- 软边界（§2.3）：候选位置离开可行走面 → 气流推回 + 二分贴边
    // 查询带参考高度（多层地形：茧居所在蝶径 A 正下方，见 layout.ts）
    const refY = springY.current;
    const candX = p.x + v.x * delta;
    const candZ = p.z + v.z * delta;
    if (getGroundHeight(candX, candZ, refY) === null) {
      const push = softBoundaryPush(candX, candZ);
      v.x += push.x * PLAYER_PHYSICS.boundaryPush * delta;
      v.z += push.z * PLAYER_PHYSICS.boundaryPush * delta;
      // 沿原方向二分推进（1/2 → 1/4 → 1/8），保留沿边滑行分量
      let step = 0.5;
      let moved = false;
      for (let i = 0; i < 3; i += 1) {
        const tx = p.x + v.x * delta * step;
        const tz = p.z + v.z * delta * step;
        if (getGroundHeight(tx, tz, refY) !== null) {
          p.x = tx;
          p.z = tz;
          moved = true;
          break;
        }
        step *= 0.5;
      }
      if (!moved) {
        // 完全顶住边界：强阻尼，把速度折向推回方向
        v.x = v.x * 0.2 + push.x * 0.8;
        v.z = v.z * 0.2 + push.z * 0.8;
      }
    } else {
      p.x = candX;
      p.z = candZ;
    }

    // ---- 静态碰撞体推出（蝶枢 / 三屿结构圆柱；悬空装置按身位高度过滤） ----
    const pushed = resolveCylinderPush(
      p.x,
      p.z,
      PLAYER_PHYSICS.bodyRadius,
      springY.current,
    );
    if (pushed) {
      // 外法线 = 推出位置 − 原位置；移除朝向障碍的向内速度分量，
      // 保留背离与切向分量（贴着障碍滑行 / 顶住时不再被吸回）。
      const resolved = resolveCollisionVelocity(
        v.x,
        v.z,
        p.x,
        p.z,
        pushed.x,
        pushed.z,
      );
      v.x = resolved.x;
      v.z = resolved.z;
      p.x = pushed.x;
      p.z = pushed.z;
    }

    // ---- 贴地：解析面高度 + critically-damped spring（λ=10）----
    const ground = getGroundHeight(p.x, p.z, springY.current);
    if (ground !== null) {
      const targetY = ground + PLAYER_PHYSICS.hoverHeight;
      springY.current +=
        (targetY - springY.current) *
        (1 - Math.exp(-PLAYER_PHYSICS.verticalLambda * delta));
      p.y = springY.current;
    }

    // ---- 朝向 ----
    const speedNow = Math.hypot(v.x, v.z);
    if (speedNow > 0.6) {
      const target = Math.atan2(-v.x / speedNow, -v.z / speedNow);
      let diff = target - heading.current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      heading.current += diff * Math.min(1, 10 * delta);
    }
  };

  useFrame((_, rawDelta) => {
    const v = vel.current;

    // ---- 传送飞行中：让位给 TeleportSystem（位置/朝向由运镜接管） ----
    if (inputState.teleportActive) {
      v.set(0, 0, 0);
      speed.current = 0;
      stepClock.current.reset();
      return;
    }

    // HUD「返回起点」：软重置位置 / 速度 / 弹簧高度，并恢复初始构图方向
    // （否则从任意项目屿按 R 会保留上一个地标的视角，落地后不知面向何处）。
    if (inputState.wantRespawn) {
      inputState.wantRespawn = false;
      const p = pos.current;
      p.set(SPAWN_POINT.x, SPAWN_POINT.y, SPAWN_POINT.z);
      v.set(0, 0, 0);
      springY.current = SPAWN_POINT.y;
      cameraState.yaw = CAMERA_LIMITS.initialYaw;
      cameraState.pitch = CAMERA_LIMITS.initialPitch;
      cameraState.distanceIndex = CAMERA_LIMITS.initialDistanceIndex;
      heading.current = 0;
      stepClock.current.reset();
    }

    // 失焦 / 隐藏后恢复：丢弃第一帧的超长 delta，不补跑后台时间
    if (skipNextDelta.current) {
      skipNextDelta.current = false;
      stepClock.current.reset();
    } else {
      const steps = stepClock.current.add(rawDelta);
      for (let i = 0; i < steps; i += 1) {
        advance(MOTION_TIMESTEP.step);
      }
    }

    speed.current = Math.hypot(v.x, v.z);
  });

  return api;
}
