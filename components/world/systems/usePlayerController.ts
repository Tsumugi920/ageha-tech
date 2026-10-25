"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import { PLAYER_PHYSICS } from "@/lib/world/constants";
import {
  SPAWN_POINT,
  getGroundHeight,
  softBoundaryPush,
} from "@/lib/world/layout";
import { resolveCylinderPush } from "@/lib/world/colliders";
import { cameraState, inputState } from "./inputState";

/**
 * 浮游信灯控制器（蓝图 §6）：输入聚合（键盘 / inputState 共享态）、
 * 运动学（加速度 / 摩擦 / 冲刺）、解析面贴地（critically-damped spring）、
 * 圆柱碰撞推出、软边界气流推回。
 *
 * 全部高频量走 refs + useFrame，零逐帧 React 状态更新；
 * 键盘监听在 useEffect cleanup 注销。
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

const HOLD_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

export function usePlayerController(isMobile: boolean): PlayerApi {
  const pos = useRef<Vector3>(new Vector3(SPAWN_POINT.x, SPAWN_POINT.y, SPAWN_POINT.z));
  const vel = useRef<Vector3>(new Vector3(0, 0, 0));
  const heading = useRef<number>(0);
  const speed = useRef<number>(0);
  // 弹簧高度（贴地悬浮的平滑跟随，避免台阶感跳变）
  const springY = useRef<number>(SPAWN_POINT.y);

  const api = useMemo<PlayerApi>(
    () => ({ pos, vel, heading, speed, springY }),
    [],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent, down: boolean) => {
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      switch (event.code) {
        case "KeyW":
        case "ArrowUp":
          inputState.move.y = down ? 1 : 0;
          break;
        case "KeyS":
        case "ArrowDown":
          inputState.move.y = down ? -1 : 0;
          break;
        case "KeyA":
        case "ArrowLeft":
          inputState.move.x = down ? -1 : 0;
          break;
        case "KeyD":
        case "ArrowRight":
          inputState.move.x = down ? 1 : 0;
          break;
        case "ShiftLeft":
        case "ShiftRight":
          inputState.sprint = down;
          break;
        case "KeyE":
          if (down && !event.repeat) inputState.interactToken += 1;
          break;
        case "KeyR":
          if (down && !event.repeat) inputState.wantRespawn = true;
          break;
        default:
          return;
      }
      if (HOLD_KEYS.has(event.code)) event.preventDefault();
    };
    const onKeyDown = (event: KeyboardEvent) => onKey(event, true);
    const onKeyUp = (event: KeyboardEvent) => onKey(event, false);
    const onBlur = () => {
      // 窗口失焦清空按键态，防止「卡键」持续加速
      inputState.move.x = 0;
      inputState.move.y = 0;
      inputState.sprint = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 30);
    const p = pos.current;
    const v = vel.current;

    // ---- 传送飞行中：让位给 TeleportSystem（位置/朝向由运镜接管） ----
    if (inputState.teleportActive) {
      v.set(0, 0, 0);
      speed.current = 0;
      return;
    }

    // HUD「返回起点」：软重置（位置 / 速度 / 弹簧高度复位，相机自然跟随）
    if (inputState.wantRespawn) {
      inputState.wantRespawn = false;
      p.set(SPAWN_POINT.x, SPAWN_POINT.y, SPAWN_POINT.z);
      v.set(0, 0, 0);
      springY.current = SPAWN_POINT.y;
    }

    // ---- 输入合成（键盘 + 摇杆，相机系） ----
    const ix = inputState.move.x + inputState.joystick.x;
    const iy = inputState.move.y + inputState.joystick.y;
    const mag = Math.min(1, Math.hypot(ix, iy));
    const yaw = cameraState.yaw;
    const fwdX = -Math.sin(yaw);
    const fwdZ = -Math.cos(yaw);
    const rgtX = Math.cos(yaw);
    const rgtZ = -Math.sin(yaw);

    if (mag > 0.001) {
      const wx = (fwdX * iy + rgtX * ix) / Math.max(1e-5, Math.hypot(ix, iy));
      const wz = (fwdZ * iy + rgtZ * ix) / Math.max(1e-5, Math.hypot(ix, iy));
      v.x += wx * PLAYER_PHYSICS.acceleration * delta;
      v.z += wz * PLAYER_PHYSICS.acceleration * delta;
    } else {
      const damp = Math.pow(PLAYER_PHYSICS.dampingBase, PLAYER_PHYSICS.dampingScale * delta);
      v.x *= damp;
      v.z *= damp;
    }

    const maxSpeed =
      PLAYER_PHYSICS.maxSpeed *
      (inputState.sprint ? PLAYER_PHYSICS.sprintMultiplier : 1) *
      (isMobile ? PLAYER_PHYSICS.mobileSpeedScale : 1);
    const sp = Math.hypot(v.x, v.z);
    if (sp > maxSpeed) {
      v.x = (v.x / sp) * maxSpeed;
      v.z = (v.z / sp) * maxSpeed;
    }

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

    // ---- 静态碰撞体推出（蝶枢 / 三屿结构圆柱） ----
    const pushed = resolveCylinderPush(p.x, p.z, PLAYER_PHYSICS.bodyRadius);
    if (pushed) {
      const nx = p.x - pushed.x;
      const nz = p.z - pushed.z;
      const nLen = Math.hypot(nx, nz) || 1;
      const nxn = nx / nLen;
      const nzn = nz / nLen;
      const into = v.x * nxn + v.z * nzn;
      if (into < 0) {
        v.x -= into * nxn;
        v.z -= into * nzn;
      }
      p.x = pushed.x;
      p.z = pushed.z;
    }

    // ---- 贴地：解析面高度 + critically-damped spring（λ=10）----
    const ground = getGroundHeight(p.x, p.z, springY.current);
    if (ground !== null) {
      const targetY = ground + PLAYER_PHYSICS.hoverHeight;
      springY.current += (targetY - springY.current) * (1 - Math.exp(-PLAYER_PHYSICS.verticalLambda * delta));
      p.y = springY.current;
    }

    // ---- 朝向与速度记录 ----
    speed.current = Math.hypot(v.x, v.z);
    if (speed.current > 0.6) {
      const target = Math.atan2(-v.x / speed.current, -v.z / speed.current);
      let diff = target - heading.current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      heading.current += diff * Math.min(1, 10 * delta);
    }
  });

  return api;
}
