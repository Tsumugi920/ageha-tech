"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Box3, MathUtils, Ray, Vector3 } from "three";
import { CAMERA_LIMITS } from "@/lib/world/constants";
import { CAMERA_OCCLUDERS } from "@/lib/world/colliders";
import { getGroundHeight } from "@/lib/world/layout";
import { cameraState, inputState } from "./inputState";
import type { PlayerApi } from "./usePlayerController";

/**
 * 第三人称跟随相机（蓝图 §7）：
 * - 目标点 = 角色位置 + 前向 1.5；相机 = 目标点 + 球坐标（yaw/pitch/距离档）；
 * - 指针拖拽轨道观察（不锁定指针）；滚轮三档距离；移动时 yaw 缓慢对齐移动方向；
 * - 帧率无关阻尼（damp 位置 λ=4 / lookAt λ=6），无抖动；
 * - 遮挡：目标点→相机连线对碰撞体 Box3 raycast，命中则前移；
 *   相机 y 不低于当地地面 +0.5；
 * - 初始构图保持：首次输入前相机停在蓝图初始机位（§7 第一眼世界观）。
 */
export function FollowCamera({
  player,
  distanceOffset = 0,
}: {
  player: PlayerApi;
  /** 移动端 +2 档距离补偿（蓝图 §6.3） */
  distanceOffset?: number;
}) {
  const { camera, gl } = useThree();

  const lookCurrent = useRef(
    new Vector3(
      CAMERA_LIMITS.initialLookAt.x,
      CAMERA_LIMITS.initialLookAt.y,
      CAMERA_LIMITS.initialLookAt.z,
    ),
  );
  const desiredPos = useRef(new Vector3());
  const desiredLook = useRef(new Vector3());
  const holdInitial = useRef(true);

  const occluders = useMemo<Box3[]>(
    () =>
      CAMERA_OCCLUDERS.map(
        (box) =>
          new Box3(
            new Vector3(box.minX, box.minY, box.minZ),
            new Vector3(box.maxX, box.maxY, box.maxZ),
          ),
      ),
    [],
  );
  const ray = useMemo(() => new Ray(), []);
  const hitPoint = useMemo(() => new Vector3(), []);
  const dirVec = useMemo(() => new Vector3(), []);

  // 画布指针拖拽（轨道观察）与滚轮（距离档）——不锁定指针，点击留给场景交互
  useEffect(() => {
    const canvas = gl.domElement;
    let dragging = false;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      dragging = true;
      holdInitial.current = false;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      inputState.lookDelta.x += event.movementX * 0.0042;
      inputState.lookDelta.y += event.movementY * 0.0032;
    };
    const onPointerUp = () => {
      dragging = false;
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      inputState.zoomStep += event.deltaY > 0 ? 1 : -1;
      holdInitial.current = false;
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [gl]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 30);
    const p = player.pos.current;

    // ---- 输入消费：轨道观察 / 距离档 ----
    if (inputState.lookDelta.x !== 0 || inputState.lookDelta.y !== 0) {
      cameraState.yaw -= inputState.lookDelta.x;
      cameraState.pitch += inputState.lookDelta.y;
      cameraState.yaw = MathUtils.clamp(
        cameraState.yaw,
        -CAMERA_LIMITS.yawRange,
        CAMERA_LIMITS.yawRange,
      );
      cameraState.pitch = MathUtils.clamp(
        cameraState.pitch,
        CAMERA_LIMITS.pitchMin,
        CAMERA_LIMITS.pitchMax,
      );
      inputState.lookDelta.x = 0;
      inputState.lookDelta.y = 0;
      holdInitial.current = false;
    }
    if (inputState.zoomStep !== 0) {
      cameraState.distanceIndex = MathUtils.clamp(
        cameraState.distanceIndex + inputState.zoomStep,
        0,
        CAMERA_LIMITS.distances.length - 1,
      );
      inputState.zoomStep = 0;
    }

    // ---- 初始构图保持：未操作前停在蓝图初始机位 ----
    if (holdInitial.current) {
      const moving =
        Math.abs(inputState.move.x) + Math.abs(inputState.move.y) +
          Math.abs(inputState.joystick.x) + Math.abs(inputState.joystick.y) >
        0.01;
      if (!moving) {
        camera.position.set(
          CAMERA_LIMITS.initialPosition.x,
          CAMERA_LIMITS.initialPosition.y,
          CAMERA_LIMITS.initialPosition.z,
        );
        camera.lookAt(lookCurrent.current);
        return;
      }
      holdInitial.current = false;
    }

    // ---- 移动时 yaw 以 0.4 权重缓慢对齐移动方向（§7） ----
    const v = player.vel.current;
    const sp = Math.hypot(v.x, v.z);
    if (sp > 2) {
      const moveYaw = Math.atan2(-v.x / sp, -v.z / sp);
      let diff = moveYaw - cameraState.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      cameraState.yaw += diff * Math.min(1, 0.4 * 2 * delta);
    }

    const distance =
      CAMERA_LIMITS.distances[cameraState.distanceIndex] + distanceOffset;
    const cosPitch = Math.cos(cameraState.pitch);

    // 目标点 = 角色 + 前向 1.5（+ 视线高度补偿）
    const fwdX = -Math.sin(cameraState.yaw);
    const fwdZ = -Math.cos(cameraState.yaw);
    desiredLook.current.set(
      p.x + fwdX * 1.5,
      p.y + 1.1,
      p.z + fwdZ * 1.5,
    );

    // 相机 = 目标点 + 球坐标偏移
    const offX = Math.sin(cameraState.yaw) * cosPitch;
    const offZ = Math.cos(cameraState.yaw) * cosPitch;
    const offY = Math.sin(cameraState.pitch);
    desiredPos.current.set(
      desiredLook.current.x + offX * distance,
      desiredLook.current.y + offY * distance,
      desiredLook.current.z + offZ * distance,
    );

    // ---- 遮挡：目标点 → 相机连线 raycast，命中则相机前移至命中点 0.3 前 ----
    const dir = dirVec.copy(desiredPos.current).sub(desiredLook.current);
    const desiredDist = dir.length();
    dir.normalize();
    ray.origin.copy(desiredLook.current);
    ray.direction.copy(dir);
    let nearest = desiredDist;
    for (const box of occluders) {
      if (ray.intersectBox(box, hitPoint)) {
        const d = hitPoint.distanceTo(ray.origin);
        if (d < nearest) nearest = Math.max(1.6, d - 0.3);
      }
    }
    if (nearest < desiredDist) {
      desiredPos.current
        .copy(desiredLook.current)
        .add(dir.multiplyScalar(nearest));
    }

    // ---- 相机 y 不低于当地地面 +0.5（无地面则不约束） ----
    const camGround = getGroundHeight(desiredPos.current.x, desiredPos.current.z);
    if (camGround !== null && desiredPos.current.y < camGround + 0.5) {
      desiredPos.current.y = camGround + 0.5;
    }

    // ---- 帧率无关阻尼跟随（λ=4 位置 / λ=6 视点） ----
    const posLambda = 4;
    const lookLambda = 6;
    camera.position.set(
      MathUtils.damp(camera.position.x, desiredPos.current.x, posLambda, delta),
      MathUtils.damp(camera.position.y, desiredPos.current.y, posLambda, delta),
      MathUtils.damp(camera.position.z, desiredPos.current.z, posLambda, delta),
    );
    lookCurrent.current.set(
      MathUtils.damp(lookCurrent.current.x, desiredLook.current.x, lookLambda, delta),
      MathUtils.damp(lookCurrent.current.y, desiredLook.current.y, lookLambda, delta),
      MathUtils.damp(lookCurrent.current.z, desiredLook.current.z, lookLambda, delta),
    );
    camera.lookAt(lookCurrent.current);
  });

  return null;
}
