"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import { findTeleportSpot } from "@/lib/world/layout";
import { cameraState, inputState } from "./inputState";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import type { PlayerApi } from "./usePlayerController";

/**
 * 传送系统（蓝图 §6.2 数字键 / §7 传送运镜 / §8 快速导航）：
 * - DOM 层（导航面板 / 快捷键）写 inputState.teleportTarget，本系统帧内消费；
 * - 运镜：起点 → 抬升中点 → 终点的二次贝塞尔，1.2s；期间 inputState.
 *   teleportActive 置位，控制器让位（位置完全由运镜接管，输入不生效）；
 * - 相机 yaw 瞬时对齐落点构图方向，位置由 FollowCamera 阻尼自然追上（§7）；
 * - prefers-reduced-motion：300ms 直线飞行、不抬升（§12.3）。
 *
 * 纯 refs + useFrame，零逐帧 React 状态；共享输入态的写入走模块级
 * 命令式入口（渲染期回调内的直接赋值会被 react-hooks/immutability 拦截）。
 */

/** 取走待处理的传送请求（消费即清空） */
function takeTeleportRequest(): string | null {
  const target = inputState.teleportTarget;
  inputState.teleportTarget = null;
  return target;
}

/** 起飞写入：锁输入 / 吞掉本次 pointerup 交互判定 / 相机对齐构图方向 / 解除初始构图保持 */
function beginFlightShared(cameraYaw: number): void {
  inputState.teleportActive = true;
  inputState.pointerDragged = true;
  inputState.wantCameraRelease = true;
  cameraState.yaw = cameraYaw;
}

/** 落地写入：解除输入锁 */
function endFlightShared(): void {
  inputState.teleportActive = false;
}

/** 跨组件 ref 写入（player prop 为渲染期派生值，直接赋值触发 immutability 规则） */
function setRefValue<T>(ref: { current: T }, value: T): void {
  ref.current = value;
}

export function TeleportSystem({ player }: { player: PlayerApi }) {
  const reducedMotion = usePrefersReducedMotion();
  const flying = useRef(false);
  const elapsed = useRef(0);
  const duration = useRef(1);
  const from = useRef(new Vector3());
  const to = useRef(new Vector3());
  const lift = useRef(0);
  const spotHeadingRef = useRef(0);

  useFrame((_, rawDelta) => {
    // ---- 新传送请求 ----
    const targetId = flying.current ? null : takeTeleportRequest();
    if (targetId !== null) {
      const spot = findTeleportSpot(targetId);
      if (spot) {
        const p = player.pos.current as Vector3;
        from.current.copy(p);
        to.current.set(spot.x, spot.y, spot.z);
        duration.current = reducedMotion ? 0.3 : 1.2;
        lift.current = reducedMotion ? 0 : 10;
        elapsed.current = 0;
        flying.current = true;
        beginFlightShared(spot.cameraYaw);
        setRefValue(player.heading, spot.heading);
        setRefValue(spotHeadingRef, spot.heading);
      }
    }

    if (!flying.current) return;

    // ---- 运镜推进：二次贝塞尔（from → 抬升中点 → to） ----
    elapsed.current += Math.min(rawDelta, 1 / 30);
    const t = Math.min(1, elapsed.current / duration.current);
    // easeInOut：起步加速 / 落地减速（reduced-motion 档由时长 300ms 兜底）
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const p = player.pos.current as Vector3;
    const midX = (from.current.x + to.current.x) / 2;
    const midZ = (from.current.z + to.current.z) / 2;
    const midY = (from.current.y + to.current.y) / 2 + lift.current;
    const u = 1 - eased;
    // 贝塞尔插值（p.set 方法写回：prop 派生 ref 的直接属性赋值触发 immutability 规则）
    p.set(
      u * u * from.current.x + 2 * u * eased * midX + eased * eased * to.current.x,
      u * u * from.current.y + 2 * u * eased * midY + eased * eased * to.current.y,
      u * u * from.current.z + 2 * u * eased * midZ + eased * eased * to.current.z,
    );
    player.vel.current.set(0, 0, 0);
    setRefValue(player.speed, 0);
    // heading 朝飞行方向缓转（最短角路径，视觉自然）；写入走 setRefValue
    if (t < 1) {
      const dx = to.current.x - from.current.x;
      const dz = to.current.z - from.current.z;
      if (Math.hypot(dx, dz) > 1e-4) {
        const target = Math.atan2(-dx, -dz);
        let diff = target - player.heading.current;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        setRefValue(
          player.heading,
          player.heading.current + diff * Math.min(1, 3 * Math.min(rawDelta, 1 / 30)),
        );
      }
    }

    if (t >= 1) {
      flying.current = false;
      endFlightShared();
      p.set(to.current.x, to.current.y, to.current.z);
      // 弹簧高度对齐落点：多层地形下防止贴地查询被出发层高度污染
      setRefValue(player.springY, to.current.y);
      setRefValue(player.heading, spotHeadingRef.current);
    }
  });

  return null;
}
